const child_process = require('child_process');
const fs = require('fs');

const downloadUrlFormat = "https://clients2.google.com/service/update2/crx?response=redirect&prodversion=49.0&x=id%3D${id}%26installsource%3Dondemand%26uc";


/**
 * Downloads extension with the specified id.
 * 
 * @param {*} id Extension ID
 * @param {*} outputDirectory Output directory.
 */
let download = function (id, outputDirectory) {

    try {
        let url = downloadUrlFormat.replace("${id}", id);
        let filePath = outputDirectory + "/" + id + ".crx";
        child_process.execFileSync('wget', ["-O", filePath, url]);
    } catch (ex) {
        console.error("Cannot download extension %s", id);
        console.error(ex);
    }
};

/**
 * Downloads extensions files
 * 
 * @param extensionsMetaFilePath Path to the file with extensions metadata
 * @param outputDirectory Path to the directory where we should put the downloaded files
 * @param usersCountLimit Download only extensions with users count greater than this
 */
let downloadExtensions = function (extensionsMetaFilePath, outputDirectory, usersCountLimit) {
    console.log("Downloading extensions with users count greater than %d", usersCountLimit);
    let extensions = JSON.parse(fs.readFileSync(extensionsMetaFilePath));
    let downloadedCount = 0;

    for (let i = 0; i < extensions.length; i++) {

        let extension = extensions[i];
        if (extension.usersCount > usersCountLimit) {
            console.log("Downloading %s (%s)", extension.name, extension.id);
            download(extension.id, outputDirectory);
            downloadedCount++;
        }
    }

    console.log("Downloaded %d extensions", downloadedCount);
};

module.exports.downloadExtensions = downloadExtensions;