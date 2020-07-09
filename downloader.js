// eslint-disable-next-line camelcase
const child_process = require('child_process');
const fs = require('fs');
const consola = require('consola');

// eslint-disable-next-line no-template-curly-in-string
const downloadUrlFormat = 'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=49.0&x=id%3D${id}%26installsource%3Dondemand%26uc';

/**
 * Downloads extension with the specified id.
 *
 * @param {*} id Extension ID
 * @param {*} outputDirectory Output directory.
 */
function download(id, outputDirectory) {
    try {
        // eslint-disable-next-line no-template-curly-in-string
        const url = downloadUrlFormat.replace('${id}', id);
        const filePath = `${outputDirectory}/${id}.crx`;
        child_process.execFileSync('wget', ['-O', filePath, url]);
    } catch (ex) {
        consola.error('Cannot download extension %s', id);
        consola.error(ex);
    }
}

/**
 * Downloads extensions files
 *
 * @param extensionsMetaFilePath Path to the file with extensions metadata
 * @param outputDirectory Path to the directory where we should put the downloaded files
 * @param usersCountLimit Download only extensions with users count greater than this
 */
function downloadExtensions(extensionsMetaFilePath, outputDirectory, usersCountLimit) {
    consola.info('Downloading extensions with users count greater than %d', usersCountLimit);
    const extensions = JSON.parse(fs.readFileSync(extensionsMetaFilePath));
    let downloadedCount = 0;

    for (let i = 0; i < extensions.length; i += 1) {
        const extension = extensions[i];
        if (extension.usersCount >= usersCountLimit) {
            consola.info('Downloading %s (%s)', extension.name, extension.id);
            download(extension.id, outputDirectory);
            downloadedCount += 1;
        }
    }

    consola.info('Downloaded %d extensions', downloadedCount);
}

module.exports.downloadExtensions = downloadExtensions;
