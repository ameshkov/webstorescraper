/* eslint-disable no-console */
/* eslint-disable func-names */
/* globals fetch, chrome */

/**
 * Background script that will be injected into the extension manifest
 * and which will intercept all network requests using chrome.webRequest API
 */
(function () {
    const tabs = {};
    const protectedApi = {
        log: console.log,
        fetch,
        JSON,
        escape,
    };
    chrome.webRequest.onBeforeRequest.addListener(
        function (details) {
            if (details.url.indexOf('http://localhost:3000') === 0) {
                return { cancel: false };
            }

            const requestDetails = {
                method: details.method,
                url: details.url,
                originUrl: tabs[details.tabId],
                type: details.type,
            };

            if (details.requestBody && details.requestBody.formData) {
                requestDetails.body = details.requestBody.formData;
            }

            protectedApi.log(`Reporting ${requestDetails.url}`);
            const inspectUrl = `http://localhost:3000/intercept?details=${
                protectedApi.escape(protectedApi.JSON.stringify(requestDetails))}`;

            protectedApi.fetch.call(this, inspectUrl).then(() => {
                protectedApi.log(`Reported ${requestDetails.url}`);
            });

            if (details.type === 'main_frame') {
                tabs[details.tabId] = details.url;
            }

            return { cancel: false };
        },
        { urls: ['<all_urls>'] },
        ['blocking', 'requestBody'],
    );
}());
