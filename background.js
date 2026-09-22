function notifyTab(tabId, messageType) {
  chrome.tabs.sendMessage(tabId, { message: messageType }).catch(function () {
    // Tab may not have a content script yet (non-YouTube pages, etc.)
  });
}

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.url) {
    notifyTab(tabId, "urlChanged");
  }
  if (changeInfo.status && changeInfo.status === "complete") {
    notifyTab(tabId, "pageReloaded");
  }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.message !== "contentScriptReady") {
    return;
  }

  const tab = sender.tab;
  if (!tab || !tab.id) {
    return;
  }

  if (tab.status === "complete") {
    notifyTab(tab.id, "pageReloaded");
  }
});
