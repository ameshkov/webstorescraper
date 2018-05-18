/**
 * Background script that will be injected into the extension manifest
 * and which will intercept all network requests using chrome.webRequest API
 */
const tabs = {};
chrome.webRequest.onBeforeRequest.addListener(
    function (details) {
        if (details.url.indexOf('http://localhost:3000') === 0) {
            return { cancel: false };
        }

        let requestDetails = {
            method: details.method,
            url: details.url,
            originUrl: tabs[details.tabId],
            type: details.type
        };

        if (details.requestBody && details.requestBody.formData) {
            requestDetails.body = details.requestBody.formData;
        }

        fetch('http://localhost:3000/intercept?details=' + escape(JSON.stringify(requestDetails))).then(() => {
            console.log("Reported " + requestDetails.url);
        });

        if (details.type === "main_frame") {
            tabs[details.tabId] = details.url;
        }        

        return { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestBody"]
);