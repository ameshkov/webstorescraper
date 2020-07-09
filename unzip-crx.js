/* eslint-disable no-bitwise */
// Code from here:
// https://github.com/ddramone/unzip-crx/blob/feat/crx-v3-support/src/index.js

const fs = require('fs');
const path = require('path');
const jszip = require('jszip');
const mkdirp = require('mkdirp');
const consola = require('consola');

// Credits for the original function go to Rob--W
// https://github.com/Rob--W/crxviewer/blob/master/src/lib/crx-to-zip.js
function crxToZip(arraybuffer) {
    function calcLength(a, b, c, d) {
        let length = 0;

        length += a << 0;
        length += b << 8;
        length += c << 16;
        length += (d << 24) >>> 0;
        return length;
    }
    // Definition of crx format: http://developer.chrome.com/extensions/crx.html
    const view = new Uint8Array(arraybuffer);

    // 50 4b 03 04
    if (view[0] === 80 && view[1] === 75 && view[2] === 3 && view[3] === 4) {
        consola.warn('Input is not a CRX file, but a ZIP file.');
        const buffer = Buffer.from(arraybuffer);

        return Uint8Array.from(buffer).buffer;
    }

    // 43 72 32 34
    if (view[0] !== 67 || view[1] !== 114 || view[2] !== 50 || view[3] !== 52) {
        throw new Error(
            'Invalid header: Does not start with PK\\x03\\x04 or Cr24\n\n',
        );
    }

    // 02 00 00 00
    // 03 00 00 00 CRX3
    if ((view[4] !== 2 && view[4] !== 3) || view[5] || view[6] || view[7]) {
        throw new Error('Unexpected crx format version number.');
    }

    let zipStartOffset;

    if (view[4] === 2) {
        const publicKeyLength = calcLength(view[8], view[9], view[10], view[11]);
        const signatureLength = calcLength(view[12], view[13], view[14], view[15]);

        // 16 = Magic number (4), CRX format version (4), lengths (2x4)
        zipStartOffset = 16 + publicKeyLength + signatureLength;
    } else {
        // view[4] === 3
        // CRX3 - https://cs.chromium.org/chromium/src/components/crx_file/crx3.proto
        const crx3HeaderLength = calcLength(view[8], view[9], view[10], view[11]);

        // 12 = Magic number (4), CRX header length
        zipStartOffset = 12 + crx3HeaderLength;
    }

    // Create a new view for the existing buffer, and wrap it in a Blob object.
    const buffer = Buffer.from(new Uint8Array(arraybuffer, zipStartOffset));

    return Uint8Array.from(buffer).buffer;
}

async function unzip(crxFilePath, destination) {
    const filePath = path.resolve(crxFilePath);
    const extname = path.extname(crxFilePath);
    const basename = path.basename(crxFilePath, extname);
    const dirname = path.dirname(crxFilePath);

    // eslint-disable-next-line no-param-reassign
    destination = destination || path.resolve(dirname, basename);

    const buf = fs.readFileSync(filePath);
    const zipBuf = crxToZip(buf);
    const zip = await jszip.loadAsync(zipBuf);
    const zipFileKeys = Object.keys(zip.files);

    for (let i = 0; i < zipFileKeys.length; i += 1) {
        const filename = zipFileKeys[i];
        const isFile = !zip.files[filename].dir;
        const fullPath = path.join(destination, filename);
        const directory = (isFile && path.dirname(fullPath)) || fullPath;
        // eslint-disable-next-line no-await-in-loop
        const content = await zip.files[filename].async('nodebuffer');

        // eslint-disable-next-line no-await-in-loop
        await mkdirp(directory);

        if (isFile) {
            fs.writeFileSync(fullPath, content);
        }
    }
}

module.exports = unzip;
