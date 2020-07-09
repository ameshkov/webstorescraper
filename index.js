/* eslint-disable prefer-destructuring */
const fs = require('fs');
const path = require('path');
const consola = require('consola');

const parser = require('./parser');
const downloader = require('./downloader');
const db = require('./db');
const analyse = require('./analyse');

const dataDirectoryPath = 'data';
const extensionsMetaFilePath = 'extensions.json';
const downloadDirectory = 'extensions';
const extensionsMetaPath = `${dataDirectoryPath}/${extensionsMetaFilePath}`;
const extensionsDirectory = `${dataDirectoryPath}/${downloadDirectory}`;
const extensionsRequestPath = `${dataDirectoryPath}/requests.json`;

/**
 * Creates directory and parent directories (if necessary)
 *
 * @param {*} folderPath
 * @param {*} mode
 */
function mkdirs(folderPath, mode) {
    const folders = [];
    let tmpPath = path.normalize(folderPath);
    let exists = fs.existsSync(tmpPath);
    while (!exists) {
        folders.push(tmpPath);
        tmpPath = path.join(tmpPath, '..');
        exists = fs.existsSync(tmpPath);
    }

    for (let i = folders.length - 1; i >= 0; i -= 1) {
        fs.mkdirSync(folders[i], mode);
    }
}

/**
 * Prints usage
 */
function printUsage() {
    consola.info('Usage: node index.js command [limit] [dbProperties]');
    consola.info('');
    consola.info('command can be:');
    consola.info("meta - retrieves extensions meta data and saves to 'data/extensions.json'");
    consola.info("download - downloads all the extensions in 'data/extensions.json' to data/extensions/*");
    consola.info('analyse - analyse the downloaded extensions');
    consola.info('database - fills a postgresql database with parsed & downloaded data');
    consola.info('');
    consola.info('For the `download` command you can also pass an optional `limit` parameter.');
    consola.info('It controls the minimum downloads extension should have in order to be downloaded.');
    consola.info('Default value is 10000.');
    consola.info('');
    consola.info('For the `database` command you can also pass database properties');
    consola.info('dbProperties=host port database user password');
}

const args = process.argv.slice(2);
if (args.length < 1) {
    printUsage();
    return;
}

const command = args[0];
if (command === 'meta') {
    mkdirs(dataDirectoryPath);
    parser.parse(extensionsMetaPath);
} else if (command === 'download') {
    mkdirs(extensionsDirectory);
    const minUsers = args[1] ? parseInt(args[1], 10) : 10000;
    downloader.downloadExtensions(extensionsMetaPath, extensionsDirectory, minUsers);
} else if (command === 'database') {
    const dbProperties = {
        user: process.env.DBUSER,
        password: process.env.PASSWORD,
        host: process.env.HOST,
        port: process.env.PORT,
        database: process.env.DATABASE,
    };

    if (args.length === 6) {
        dbProperties.host = args[1];
        dbProperties.port = args[2];
        dbProperties.database = args[3];
        dbProperties.user = args[4];
        dbProperties.password = args[5];
    }

    db.fillExtensionsTables(
        extensionsMetaPath,
        extensionsDirectory,
        extensionsRequestPath,
        dbProperties,
    );
} else if (command === 'analyse') {
    analyse(extensionsDirectory, extensionsRequestPath);
} else {
    printUsage();
}
