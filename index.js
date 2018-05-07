const parser = require('./parser');
const downloader = require('./downloader');
const db = require('./db');
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
    console.log("Usage: node index.js command [limit] [dbProperties]");
    console.log("");
    console.log("command can be:");
    console.log("meta - retrieves extensions meta data and saves to 'data/extensions.json'");
    console.log("download - downloads all the extensions in 'data/extensions.json' to data/extensions/*");
    console.log("database - fills a postgresql database with parsed & downloaded data");
    console.log("");
    console.log("For the `download` command you can also pass an optional `limit` parameter.");
    console.log("It controls the minimum downloads extension should have in order to be downloaded.");
    console.log("Default value is 10000.");
    console.log("");
    console.log("For the `database` command you can also pass database properties");
    console.log("dbProperties=host port database user password");
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
} else if (command === "database") {

    let dbProperties;

    if (args.length == 6) {
        dbProperties = {
            user: args[4],
            host: args[1],
            database: args[3],
            password: args[5],
            port: args[2],
        }
    }

    db.fillExtensionsTables(extensionsMetaPath, extensionsDirectory, dbProperties);
} else {
    printUsage();
}