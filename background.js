// Listen for the message from contentScripts.js indicating that it's ready
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.message === "contentScriptReady") {
        // Content script is ready, now we just listen to either URL changed or a page refresh event
        chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
            if (changeInfo.url) {
                chrome.tabs.sendMessage(tabId, { message: "urlChanged" });
            }
            if (changeInfo.status && changeInfo.status === 'complete') {
                chrome.tabs.sendMessage(tabId, { message: "pageReloaded" });
            }
        });
    }
});