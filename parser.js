const puppeteer = require('puppeteer');
const util = require('util');
const fs = require('fs');
const consola = require('consola');

const chromeStoreUrl = 'https://chrome.google.com/webstore/category/ext/';
const chromeStoreSearchUrl = 'https://chrome.google.com/webstore/search/';
const categories = [
    '22-accessibility',
    '10-blogging',
    '15-by-google',
    '11-web-development',
    '14-fun',
    '6-news',
    '28-photos',
    '7-productivity',
    '38-search-tools',
    '12-shopping',
    '1-communication',
    '13-sports',
];
const searchTerms = [
    'adblock',
    'adguard',
    'ublock',
    'adblocker',
    'ad%20blocker',
    'facebook',
    'youtube',
    'twitter',
    'vpn',
    'proxy',
];
const itemRequestPath = '/webstore/ajax/item';
const pageSize = 50;
const maxLimit = 30000;
const scrollStep = 1000;
const scrollAttempts = 30;
const testSelectorTimeout = 1000;
const testSelectorFormat = '.webstore-test-wall-tile[index="%d"]';

/**
 * Waits for the next page with extensions
 *
 * @param {*} page puppeteer page instance
 * @param {*} testSelector sleector we're waiting for
 * @returns true if testSelector is found, false if not
 */
async function waitForNextPage(page, testSelector) {
    for (let i = 0; i < scrollAttempts; i += 1) {
        try {
            // Scroll down to trigger next page load
            // eslint-disable-next-line no-await-in-loop
            await page.evaluate(`window.scrollBy(0, ${scrollStep});`);
            // eslint-disable-next-line no-await-in-loop
            await page.waitForSelector(testSelector, { timeout: testSelectorTimeout });
            return true;
        } catch (ex) {
            // Ignore, that's just timeout
        }
    }
    return false;
}

/**
 * Parses a given category
 *
 * @param searchUrl Search url
 * @param searchTerm search term - for logging
 */
async function parseUrl(searchUrl, searchTerm) {
    // necessary for debian
    const args = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    const browser = await puppeteer.launch(args);

    // Open the search result page
    const page = await browser.newPage();
    await page.goto(searchUrl);
    await page.content();
    const extensions = [];

    page.on('response', async (response) => {
        try {
            const url = response.url();
            if (url.indexOf(itemRequestPath) === -1) {
                return;
            }
            const responseBody = await response.buffer();

            // Remove the first )]}' characters to make a valid json
            const jsonString = responseBody.toString().substring(4);
            const json = JSON.parse(jsonString);

            const items = json[0][1][1];
            for (let i = 0; i < items.length; i += 1) {
                const item = items[i];
                const extensionData = {
                    id: item[0],
                    name: item[1],
                    author: item[2],
                    description: item[6],
                    category: item[10],
                    usersCount: parseInt(item[23].replace(/[^0-9]/g, ''), 10),
                    rating: item[12],
                    ratingsCount: item[22],
                    analyticsId: item[83],
                    website: item[81],
                    inApp: item[30],
                };
                extensions.push(extensionData);
            }
        } catch (ex) {
            consola.warn('Error while parsing extension data');
            consola.warn(ex);
        }
    });

    try {
        for (let i = 0; i < maxLimit; i += pageSize) {
            const testSelector = util.format(testSelectorFormat, i + 1);
            // eslint-disable-next-line no-await-in-loop
            const found = await waitForNextPage(page, testSelector);

            if (found) {
                consola.info(`Parsed ${i} extensions from ${searchTerm}`);
            } else {
                consola.info('Next page not found');
                break;
            }
        }
    } catch (ex) {
        consola.error(ex);
    }

    await browser.close();
    return extensions;
}

/**
 * Scrapes extensions meta-data and saves to the specified output file
 * @param {*} outputPath Path to the output file
 */
async function parse(outputPath) {
    let extensions = [];
    for (let i = 0; i < categories.length; i += 1) {
        const category = categories[i];
        const url = `${chromeStoreUrl + category}?hl=en`;
        // eslint-disable-next-line no-await-in-loop
        const categoryExtensions = await parseUrl(url, category);
        consola.info('Retrieved %d extensions from %s', categoryExtensions.length, category);
        extensions = extensions.concat(categoryExtensions);
    }

    for (let i = 0; i < searchTerms.length; i += 1) {
        const searchTerm = searchTerms[i];
        const url = `${chromeStoreSearchUrl + searchTerm}?_category=extensions&hl=en`;
        // eslint-disable-next-line no-await-in-loop
        const foundExtensions = await parseUrl(url, searchTerm);
        consola.info('Retrieved %d extensions from %s', foundExtensions.length, searchTerm);

        let added = 0;
        for (let j = 0; j < foundExtensions.length; j += 1) {
            const extension = foundExtensions[j];
            if (!extensions.find((ex) => ex.id === extension.id)) {
                extensions.push(extension);
                added += 1;
            }
        }
        consola.info('Added %d new extensions from %s', added, searchTerm);
    }

    consola.info('Total number of extensions retrieved is %d', extensions.length);
    fs.writeFileSync(outputPath, JSON.stringify(extensions, 0, 4));
}

module.exports.parse = parse;
