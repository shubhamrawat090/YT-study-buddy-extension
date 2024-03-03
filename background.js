console.log("In background.js")
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     console.log({ tabId, changeInfo, tab })
//     if (tab.url) {
//         if (isYouTubeURL(tab.url)) {
//             chrome.tabs.sendMessage(tabId, { type: "VALID_YOUTUBE_URL" });
//         } else {
//             chrome.tabs.sendMessage(tabId, { type: "INVALID_YOUTUBE_URL" });
//         }
//     }
// });

// function isYouTubeURL(url) {
//     return url.includes("youtube.com");
// }

