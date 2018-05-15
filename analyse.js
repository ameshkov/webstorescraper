const puppeteer = require('puppeteer');
const util = require('util');
const fs = require('fs');
const delay = require('delay');
const path = require('path');
const unzip = require("unzip-crx");

const EXTENSIONS_DIR = 'data/extensions';

let deleteUnpackedExtension = function (id) {
    let path = EXTENSIONS_DIR + '/' + id;
    deleteFolderRecursive(path);
};

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
 * @param {string} id extension ID
 */
let unzipExtension = async function (id) {
    deleteUnpackedExtension(id);

    let from = EXTENSIONS_DIR + '/' + id + '.crx';
    let to = EXTENSIONS_DIR + '/' + id;
    await unzip(from, to);

    // Get rid of the "verified_contents.json" file
    deleteFolderRecursive(to + '/_metadata');
}

/**
 * Analyzes the specified extension
 * 
 * @param {string} id extension ID (must be present in the `data/extensions` directory)
 */
let analyzeExtension = async function (id) {

    await unzipExtension(id);

    let extensionPath = path.resolve(EXTENSIONS_DIR + '/' + id);
    let args = {
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-extensions-except=' + extensionPath,
            '--load-extension=' + extensionPath
        ]
    };

    const browser = await puppeteer.launch(args);
    await delay(1000);
    await browser.close();
}

analyzeExtension('aapbdbdomjkkjkaonfhkkikfgjllcleb');