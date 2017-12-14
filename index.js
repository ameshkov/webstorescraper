const parser = require('./parser');
const downloader = require('./downloader');
const fs = require('fs');
const path = require('path');

const dataDirectoryPath = "data";
const extensionsMetaFilePath = "extensions.json";
const downloadDirectory = "extensions";
const extensionsMetaPath = dataDirectoryPath + "/" + extensionsMetaFilePath;
const extensionsDirectory = dataDirectoryPath + "/" + downloadDirectory;

/**
 * Creates directory and parent directories (if necessary)
 * 
 * @param {*} folderPath 
 * @param {*} mode 
 */
function mkdirs(folderPath, mode) {
    let folders = [];
    let tmpPath = path.normalize(folderPath);
    let exists = fs.existsSync(tmpPath);
    while (!exists) {
        folders.push(tmpPath);
        tmpPath = path.join(tmpPath, '..');
        exists = fs.existsSync(tmpPath);
    }

    for (var i = folders.length - 1; i >= 0; i--) {
        fs.mkdirSync(folders[i], mode);
    }
}

/**
 * Prints usage
 */
let printUsage = function () {
    console.log("Usage: node index.js command");
    console.log("");
    console.log("command can be:");
    console.log("meta - retrieves extensions meta data and saves to 'data/extensions.json'");
    console.log("download - downloads all the extensions in 'data/extensions.json' to data/extensions/*");
}

let args = process.argv.slice(2);
if (args.length < 1) {
    printUsage();
    return;
}


let command = args[0];
if (command === "meta") {
    mkdirs(dataDirectoryPath);
    parser.parse(extensionsMetaPath);
} else if (command === "download") {
    mkdirs(extensionsDirectory);
    let minUsers = args[1] ? parseInt(args[1]) : 10000;
    downloader.downloadExtensions(extensionsMetaPath, extensionsDirectory, minUsers);
} else {
    printUsage();
}