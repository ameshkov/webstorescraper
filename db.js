const fs = require('fs');
const consola = require('consola');
// node-postgres uses the same environment variables as libpq to connect to a PostgreSQL server.
const { Client } = require('pg');
const glob = require('glob');
const { unzipExtension, deleteUnpackedExtension } = require('./unzip-ext');

const insertMetaSql = 'INSERT INTO extensions.extensions (id, name, author, description, category, usersCount, rating, ratingsCount, analyticsId, website, inApp) '
    + ' VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);';
const insertFileSql = 'INSERT INTO extensions.extensions_files (extension_id, file_path, file_content) VALUES ($1, $2, $3);';
const insertRequestSql = 'INSERT INTO extensions.requests (extension_id, method, url, origin_url, type, request_body) VALUES ($1, $2, $3, $4, $5, $6);';

/**
 * Insert extension requests data to the requests table
 *
 * @param {*} requestsPath requests path
 * @param {*} dbProperties  db properties
 */
async function insertRequests(requestsPath, dbProperties) {
    consola.info('Inserting extension requests');

    if (!fs.existsSync(requestsPath)) {
        consola.info('Requests file does not exist');
        return;
    }

    const requests = JSON.parse(fs.readFileSync(requestsPath));

    // Connecting to the database
    const client = new Client(dbProperties);
    try {
        await client.connect();

        for (let i = 0; i < requests.length; i += 1) {
            const extensionRequests = requests[i];

            for (let j = 0; j < extensionRequests.requests.length; j += 1) {
                const request = extensionRequests.requests[j];

                // eslint-disable-next-line no-await-in-loop
                await client.query(insertRequestSql, [
                    extensionRequests.id,
                    request.method,
                    request.url,
                    request.originUrl,
                    request.type,
                    request.body,
                ]);
            }
        }
    } catch (ex) {
        consola.error(ex);
    } finally {
        await client.end();
    }
}

/**
 * Insert extension files content to the extensions_files table
 *
 * @param {*} extension Extension meta data
 * @param {*} extensionsDirectory Extensions directory
 * @param {*} dbProperties  db properties
 */
async function insertExtensionFiles(extension, extensionsDirectory, dbProperties) {
    consola.info('Inserting files of %s (%s)', extension.name, extension.id);

    const filePath = `${extensionsDirectory}/${extension.id}.crx`;
    if (!fs.existsSync(filePath)) {
        consola.info('File does not exist');
        return;
    }

    // Connecting to the database
    const client = new Client(dbProperties);
    try {
        await client.connect();

        // unzip extension to a directory
        const extDir = await unzipExtension(extensionsDirectory, extension.id);
        const files = glob.sync(`${extDir}/**/*.{json,js,json,html,txt}`);

        // go through all files
        for (let i = 0; i < files.length; i += 1) {
            const path = files[i];
            const fileContents = fs.readFileSync(path).toString();

            // eslint-disable-next-line no-await-in-loop
            await client.query(insertFileSql, [
                extension.id,
                path,
                fileContents,
            ]);
        }
    } catch (ex) {
        consola.error(ex);
    } finally {
        deleteUnpackedExtension(extensionsDirectory, extension.id);
        await client.end();
    }
}

/**
 * Inserts extension data to the extensions table
 *
 * @param {*} extension Extension meta data
 */
async function insertExtensionData(extension, dbProperties) {
    consola.info('Inserting data of %s (%s)', extension.name, extension.id);

    // Connecting to the database
    const client = new Client(dbProperties);
    try {
        await client.connect();

        await client.query(insertMetaSql, [
            extension.id,
            extension.name,
            extension.author,
            extension.description,
            extension.category,
            extension.usersCount,
            extension.rating,
            extension.ratingsCount,
            extension.analyticsId,
            extension.website,
            extension.inApp,
        ]);
    } catch (ex) {
        consola.error(ex);
    } finally {
        await client.end();
    }
}

/**
 * Fills extensions tables with data (see data/db.sql)
 *
 * @param {*} extensionsMetaFilePath Path to the file with extensions meta data
 * @param {*} extensionsDirectory Path to the directory with extensions CRX files
 * @param {*} requestsPath Extensions requests path
 * @param {*} dbProperties DB properties
 */
async function fillExtensionsTables(extensionsMetaFilePath,
    extensionsDirectory, requestsPath, dbProperties) {
    try {
        consola.info('Filling extensions tables with data');
        const extensions = JSON.parse(fs.readFileSync(extensionsMetaFilePath));

        for (let i = 0; i < extensions.length; i += 1) {
            const extension = extensions[i];
            // eslint-disable-next-line no-await-in-loop
            await insertExtensionData(extension, dbProperties);
            // eslint-disable-next-line no-await-in-loop
            await insertExtensionFiles(extension, extensionsDirectory, dbProperties);
        }

        await insertRequests(requestsPath, dbProperties);
    } catch (ex) {
        consola.info(ex);
    }
}

module.exports.fillExtensionsTables = fillExtensionsTables;
