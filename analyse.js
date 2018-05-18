const puppeteer = require('puppeteer');
const util = require('util');
const fs = require('fs');
const delay = require('delay');
const path = require('path');
const unzip = require("unzip-crx");
const { Interceptor } = require("./analyse_intercept");

const ANALYSE_INTERCEPTOR = "analyse_intercept_requests_bgscript.js";
const ANALYZE_INIT_DELAY = 2 * 1000; // 2 sec for the extension initialization
const ANALYZE_TIMEOUT = 5 * 1000; // 5 seconds on a test run
const TEST_WEBSITE = 'https://example.org/';

/**
 * Deletes an unpacked extension folder
 * 
 * @param {string} extensionsDirectory extensions directory
 * @param {string} id extension ID
 */
let deleteUnpackedExtension = function (extensionsDirectory, id) {
    let path = extensionsDirectory + '/' + id;
    deleteFolderRecursive(path);
};

/**
 * @param {string} path path to a directory to delete
 */
let deleteFolderRecursive = function (path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

/**
 * Unzips the specified extension
 * 
 * @param {string} extensionsDirectory Extensions directory
 * @param {string} id extension ID
 */
let unzipExtension = async function (extensionsDirectory, id) {
    deleteUnpackedExtension(id);

    let from = extensionsDirectory + '/' + id + '.crx';
    let to = extensionsDirectory + '/' + id;
    await unzip(from, to);

    // Get rid of the "verified_contents.json" file
    deleteFolderRecursive(to + '/_metadata');
}

let patchBackgroundHtml = function (id, extensionPath, bgPage) {
    // Parse HTML and add our script t
    let bgHtml = fs.readFileSync(extensionPath + "/" + bgPage).toString();
    if (!bgHtml) {
        console.error("Wrong bg page path: " + id);
    }

    let parts = bgHtml.split("<script", 2);
    if (parts.length !== 2) {
        console.error("Wrong bg page: " + id);
    }

    bgHtml = parts[0] + "<script src='" + ANALYSE_INTERCEPTOR + '"></script><script' + parts[1];
    fs.writeFileSync(extensionPath + "/" + bgPage, bgHtml);
}

/**
 * Patches extension manifest and adds our script to the manifest
 * 
 * @param {string} extensionsDirectory extensions directory
 * @param {string} id extension ID
 */
let patchManifest = function (extensionsDirectory, id) {

    let extensionPath = extensionsDirectory + '/' + id;
    let manifestPath = extensionPath + '/manifest.json';
    let manifest = JSON.parse(fs.readFileSync(manifestPath));

    // Prepare the interceptor script
    let interceptor = fs.readFileSync(ANALYSE_INTERCEPTOR);
    fs.writeFileSync(extensionPath + '/' + ANALYSE_INTERCEPTOR, interceptor);

    // Add it to the manifest
    if (!manifest.background) {
        manifest.background = {
            scripts: [
                ANALYSE_INTERCEPTOR
            ],
            "persistent": true
        };
    } else if (manifest.background.scripts) {
        manifest.background.persistent = true;
        manifest.background.scripts.unshift(ANALYSE_INTERCEPTOR);
    } else if (manifest.background.page) {
        manifest.background.persistent = true;
        patchBackgroundHtml(id, extensionPath, manifest.background.page);
    } else if (typeof manifest.background === "string") {
        patchBackgroundHtml(id, extensionPath, manifest.background);
    } else {
        console.error("Wrong manifest: " + id);
    }

    // Add necessary permissions so that interceptor could work
    if (!manifest.permissions) {
        manifest.permissions = [];
    }

    if (manifest.permissions.indexOf("webRequest") === -1) {
        manifest.permissions.unshift("webRequest");
    }

    if (manifest.permissions.indexOf("webRequestBlocking") === -1) {
        manifest.permissions.unshift("webRequestBlocking");
    }

    if (manifest.permissions.indexOf("<all_urls>") === -1) {
        manifest.permissions.unshift("<all_urls>");
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
let analyzeExtension = async function (extensionsDirectory, id) {

    console.log("Start analyzing extension: " + id);
    await unzipExtension(extensionsDirectory, id);
    patchManifest(extensionsDirectory, id);

    let extensionPath = path.resolve(extensionsDirectory + '/' + id);
    let args = {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions-except=' + extensionPath,
            '--load-extension=' + extensionPath
        ]
    };

    // Start the intercepting server
    let interceptor = new Interceptor(id);

    try {
        interceptor.start();
        const browser = await puppeteer.launch(args);
        const page = await browser.newPage();
        await delay(ANALYZE_INIT_DELAY);
        await page.goto(TEST_WEBSITE);
        await delay(ANALYZE_TIMEOUT);
        await browser.close();
    } finally {
        interceptor.close();
    }

    let extensionInfo = {
        id: id,
        requests: interceptor.requests
    };

    console.log(JSON.stringify(extensionInfo, 0, 4));

    deleteUnpackedExtension(extensionsDirectory, id);
    console.log("Finished analyzing extension: " + id);

    return extensionInfo;
}

/**
 * Analyzes all the extensions stored in the extensionsDirectory
 * 
 * @param {string} extensionsDirectory extensions directory
 * @param {string} outputPath path to a file we need to write the output to
 */
let analyzeExtensions = async function (extensionsDirectory, outputPath) {
    let files = fs.readdirSync(extensionsDirectory);
    let requests = [];

    for (let i = 0; i < files.length; i++) {
        let file = files[i];
        let id = path.basename(file, ".crx");
        if (id && id.indexOf(".") === -1) {
            let extensionInfo = await analyzeExtension(extensionsDirectory, id);
            requests.push(extensionInfo);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(requests, 0, 4));

    analyzeExtension(extensionsDirectory, "mlikepnkghhlnkgeejmlkfeheihlehne");
    console.log("Finished analyzing extensions. Count=" + requests.length);
}

module.exports = analyzeExtensions;