const puppeteer = require('puppeteer');
const util = require('util');
const fs = require('fs');
const delay = require('delay');

const chromeStoreUrl = "https://chrome.google.com/webstore/category/ext/";
const chromeStoreSearchUrl = "https://chrome.google.com/webstore/search/";
const categories = [
    "22-accessibility",
    "10-blogging",
    "15-by-google",
    "11-web-development",
    "14-fun",
    "6-news",
    "28-photos",
    "7-productivity",
    "38-search-tools",
    "12-shopping",
    "1-communication",
    "13-sports"
];
const searchTerms = [
    "adblock",
    "adguard",
    "ublock",
    "adblocker",
    "ad%20blocker",
    "facebook",
    "youtube",
    "twitter",
    "vpn",
    "proxy"
];
const itemRequestPath = "/webstore/ajax/item";
const pageSize = 50;
const maxLimit = 30000;
const scrollStep = 1000;
const scrollAttempts = 30;
const testSelectorTimeout = 1000;
const testSelectorFormat = ".webstore-test-wall-tile[index=\"%d\"]";

/**
 * Waits for the next page with extensions
 *
 * @param {*} page puppeteer page instance
 * @param {*} testSelector sleector we're waiting for
 * @returns true if testSelector is found, false if not
 */
let waitForNextPage = async function (page, testSelector) {
    for (let i = 0; i < scrollAttempts; i++) {
        try {
            // Scroll down to trigger next page load
            await page.evaluate(`window.scrollBy(0, ${scrollStep});`);
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
 * @param url Search url
 * @param searchTerm search term - for logging
 */
let parseUrl = async function (url, searchTerm) {
    // necessary for debian
    let args = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    const browser = await puppeteer.launch(args);

    // Open the search result page
    const page = await browser.newPage();
    await page.goto(url);
    await page.content();
    let extensions = [];

    page.on('response', async function (response) {
        try {
            let url = response.url();
            if (url.indexOf(itemRequestPath) === -1) {
                return;
            }
            let responseBody = await response.buffer();

            // Remove the first )]}' characters to make a valid json
            let jsonString = responseBody.toString().substring(4);
            let json = JSON.parse(jsonString);

            let items = json[0][1][1];
            for (let i = 0; i < items.length; i++) {
                let item = items[i];
                let extensionData = {
                    id: item[0],
                    name: item[1],
                    author: item[2],
                    description: item[6],
                    category: item[10],
                    usersCount: parseInt(item[23].replace(/[^0-9]/g, '')),
                    rating: item[12],
                    ratingsCount: item[22],
                    analyticsId: item[83],
                    website: item[81],
                    inApp: item[30]
                };
                extensions.push(extensionData);
            }
        } catch (ex) {
            console.warn("Error while parsing extension data");
            console.warn(ex);
        }
    });

    try {
        for (let i = 0; i < maxLimit; i += pageSize) {
            let testSelector = util.format(testSelectorFormat, i + 1);
            let found = await waitForNextPage(page, testSelector);

            if (found) {
                console.log(`Parsed ${i} extensions from ${searchTerm}`);
            } else {
                console.log('Next page not found');
                break;
            }
        }
    } catch (ex) {
        console.error(ex);
    }

    await browser.close();
    return extensions;
};

/**
 * Scrapes extensions meta-data and saves to the specified output file
 * @param {*} outputPath Path to the output file
 */
let parse = async function (outputPath) {

    let extensions = [];
    for (let i = 0; i < categories.length; i++) {
        let category = categories[i];
        let url = chromeStoreUrl + category + '?hl=en';
        let categoryExtensions = await parseUrl(url, category);
        console.log("Retrieved %d extensions from %s", categoryExtensions.length, category);
        extensions = extensions.concat(categoryExtensions);
    }

    for (let i = 0; i < searchTerms.length; i++) {
        let searchTerm = searchTerms[i];
        let url = chromeStoreSearchUrl + searchTerm + '?_category=extensions&hl=en';
        let foundExtensions = await parseUrl(url, searchTerm);
        console.log("Retrieved %d extensions from %s", foundExtensions.length, searchTerm);

        let added = 0;
        for (let j = 0; j < foundExtensions.length; j++) {
            const extension = foundExtensions[j];
            if (!extensions.find((ex) => ex.id === extension.id)) {
                extensions.push(extension);
                added += 1;
            }
        }
        console.log("Added %d new extensions from %s", added, searchTerm);
    }

    console.log("Total number of extensions retrieved is %d", extensions.length);
    fs.writeFileSync(outputPath, JSON.stringify(extensions, 0, 4));
};

module.exports.parse = parse;