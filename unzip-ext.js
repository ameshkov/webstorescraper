const fs = require('fs');
const unzip = require('./unzip-crx');

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
 * @returns {string} path to unzipped extensions
 */
async function unzipExtension(extensionsDirectory, id) {
    deleteUnpackedExtension(id);

    const from = `${extensionsDirectory}/${id}.crx`;
    const to = `${extensionsDirectory}/${id}`;
    await unzip(from, to);

    // Get rid of the "verified_contents.json" file
    deleteFolderRecursive(`${to}/_metadata`);
    return to;
}

module.exports = {
    unzipExtension,
    deleteUnpackedExtension,
};
