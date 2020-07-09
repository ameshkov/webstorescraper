const puppeteer = require('puppeteer');
const fs = require('fs');
const delay = require('delay');
const path = require('path');
const consola = require('consola');
const unzip = require('unzip-crx');
const { Interceptor } = require('./analyse_intercept');

const ANALYSE_INTERCEPTOR = 'analyse_intercept_requests_bgscript.js';
const ANALYZE_INIT_DELAY = 2 * 1000; // 2 sec for the extension initialization
const ANALYZE_TIMEOUT = 5 * 1000; // 5 seconds on a test run
const TEST_WEBSITE = 'https://example.org/';

/**
 * @param {string} pathToDir path to a directory to delete
 */
function deleteFolderRecursive(pathToDir) {
    if (fs.existsSync(pathToDir)) {
        fs.readdirSync(pathToDir).forEach((file) => {
            const curPath = `${pathToDir}/${file}`;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(pathToDir);
    }
}

/**
 * Deletes an unpacked extension folder
 *
 * @param {string} extensionsDirectory extensions directory
 * @param {string} id extension ID
 */
function deleteUnpackedExtension(extensionsDirectory, id) {
    const pathToExt = `${extensionsDirectory}/${id}`;
    deleteFolderRecursive(pathToExt);
}

/**
 * Unzips the specified extension
 *
 * @param {string} extensionsDirectory Extensions directory
 * @param {string} id extension ID
 */
async function unzipExtension(extensionsDirectory, id) {
    deleteUnpackedExtension(id);

    const from = `${extensionsDirectory}/${id}.crx`;
    const to = `${extensionsDirectory}/${id}`;
    await unzip(from, to);

    // Get rid of the "verified_contents.json" file
    deleteFolderRecursive(`${to}/_metadata`);
}

/**
 * Patches the background page and adds our interceptor there
 *
 * @param {string} id extension ID
 * @param {string} extensionPath path to the unpacked extension
 * @param {*} bgPage path to the background page file
 */
function patchBackgroundHtml(id, extensionPath, bgPage) {
    // Parse HTML and add our script t
    let bgHtml = fs.readFileSync(`${extensionPath}/${bgPage}`).toString();
    if (!bgHtml) {
        consola.error(`Wrong bg page path: ${id}`);
    }

    const parts = bgHtml.split('<script', 2);
    if (parts.length !== 2) {
        consola.error(`Wrong bg page: ${id}`);
    }

    bgHtml = `${parts[0]}<script src='/${ANALYSE_INTERCEPTOR}'></script>\n<script${parts[1]}`;
    fs.writeFileSync(`${extensionPath}/${bgPage}`, bgHtml);
}

/**
 * Patches extension manifest and adds our script to the manifest
 *
 * @param {string} extensionsDirectory extensions directory
 * @param {string} id extension ID
 */
function patchManifest(extensionsDirectory, id) {
    const extensionPath = `${extensionsDirectory}/${id}`;
    const manifestPath = `${extensionPath}/manifest.json`;
    const manifest = JSON.parse(fs.readFileSync(manifestPath));

    // Prepare the interceptor script
    const interceptor = fs.readFileSync(ANALYSE_INTERCEPTOR);
    fs.writeFileSync(`${extensionPath}/${ANALYSE_INTERCEPTOR}`, interceptor);

    // Add it to the manifest
    if (!manifest.background) {
        manifest.background = {
            scripts: [
                ANALYSE_INTERCEPTOR,
            ],
            persistent: true,
        };
    } else if (manifest.background.scripts) {
        manifest.background.persistent = true;
        manifest.background.scripts.unshift(ANALYSE_INTERCEPTOR);
    } else if (manifest.background.page) {
        manifest.background.persistent = true;
        patchBackgroundHtml(id, extensionPath, manifest.background.page);
    } else if (typeof manifest.background === 'string') {
        patchBackgroundHtml(id, extensionPath, manifest.background);
    } else {
        consola.error(`Wrong manifest: ${id}`);
    }

    // Add necessary permissions so that interceptor could work
    if (!manifest.permissions) {
        manifest.permissions = [];
    }

    if (manifest.permissions.indexOf('webRequest') === -1) {
        manifest.permissions.unshift('webRequest');
    }

    if (manifest.permissions.indexOf('webRequestBlocking') === -1) {
        manifest.permissions.unshift('webRequestBlocking');
    }

    if (manifest.permissions.indexOf('<all_urls>') === -1) {
        manifest.permissions.unshift('<all_urls>');
    }

    // Allow all
    manifest.content_security_policy = "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';";

    // Update the manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, 0, 4));
}

/**
 * Analyzes the specified extension
 *
 * @param {string} extensionsDirectory extensions directory
 * @param {string} id extension ID (must be present in the `data/extensions` directory)
 */
async function analyzeExtension(extensionsDirectory, id) {
    consola.info(`Start analyzing extension: ${id}`);
    try {
        await unzipExtension(extensionsDirectory, id);
        patchManifest(extensionsDirectory, id);
    } catch (ex) {
        consola.error(`Cannot patch the extension due to ${ex}`);
        return null;
    }

    const extensionPath = path.resolve(`${extensionsDirectory}/${id}`);
    const args = {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    };

    // Start the intercepting server
    const interceptor = new Interceptor(id);
    let browser;

    try {
        interceptor.start();
        browser = await puppeteer.launch(args);
        const page = await browser.newPage();
        page.on('dialog', async (dialog) => {
            await dialog.dismiss();
        });

        await delay(ANALYZE_INIT_DELAY);
        await page.goto(TEST_WEBSITE);
    } catch (ex) {
        consola.error(`Error while running the browser: ${ex}`);
    } finally {
        await delay(ANALYZE_TIMEOUT);
        if (browser) {
            await browser.close();
        }
        interceptor.close();
    }

    const extensionInfo = {
        id,
        requests: interceptor.requests,
    };

    consola.info(JSON.stringify(extensionInfo, 0, 4));

    deleteUnpackedExtension(extensionsDirectory, id);
    consola.info(`Finished analyzing extension: ${id}`);

    return extensionInfo;
}

/**
 * Analyzes all the extensions stored in the extensionsDirectory
 *
 * @param {string} extensionsDirectory extensions directory
 * @param {string} outputPath path to a file we need to write the output to
 */
async function analyzeExtensions(extensionsDirectory, outputPath) {
    const files = fs.readdirSync(extensionsDirectory);
    const requests = [];

    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const id = path.basename(file, '.crx');
        if (id && id.indexOf('.') === -1) {
            // eslint-disable-next-line no-await-in-loop
            const extensionInfo = await analyzeExtension(extensionsDirectory, id);
            if (extensionInfo) {
                requests.push(extensionInfo);
            }
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(requests, 0, 4));

    consola.info(`Finished analyzing extensions. Count=${requests.length}`);
}

module.exports = analyzeExtensions;
