const puppeteer = require('puppeteer');
const util = require('util');
const fs = require('fs');
const delay = require('delay');

const chromeStoreUrl = "https://chrome.google.com/webstore/category/ext/";
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
const itemRequestPath = "/webstore/ajax/item";
const pageSize = 50;
const maxLimit = 30000;
const testSelectorTimeout = 10000;
const testSelectorFormat = ".webstore-test-wall-tile[index=\"%d\"]";

/**
 * Parses a given category
 * 
 * @param category Category name
 */
let parseCategory = async function (category) {
    // necessary for debian
    let args = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
    const browser = await puppeteer.launch(args);
    let url = chromeStoreUrl + category + '?hl=en';

    // Open the category page
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
            try {
                await page.waitForSelector(testSelector, { timeout: testSelectorTimeout });
                // wait for render
                await delay(1000);
            } catch (ex) {
                // Ignore, that's just timeout
                break;
            }

            // scroll down to trigger loading of the next batch of extensions
            const realHeight = 'Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight)';
            await page.evaluate(`window.scrollTo(0, ${realHeight});`);
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
        let categoryExtensions = await parseCategory(category);
        console.log("Retrieved %d extensions from %s", categoryExtensions.length, category);
        extensions = extensions.concat(categoryExtensions);
    }

    console.log("Total number of extensions retrieved is %d", extensions.length);
    fs.writeFileSync(outputPath, JSON.stringify(extensions, 0, 4));
};

module.exports.parse = parse;