console.log("in contentScript.js");

// Create a MutationObserver instance, helps in waiting for a specific element to be loaded
const observer = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    // Check if the mutation involves added nodes
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Iterate through added nodes
      let timerSpanFound = false;
      mutation.addedNodes.forEach(function (node) {
        // Check if the added node matches the target class
        if (node.classList && node.classList.contains('style-scope') && node.classList.contains('ytd-thumbnail-overlay-time-status-renderer')) {
          timerSpanFound = true;
        }
      });

      // Don't want to calls on each timer being loaded. Just after the last one is loaded
      if (timerSpanFound) {
        contentLoaded();
      }
    }
  });
});

// Start observing mutations in the entire document body
observer.observe(document.body, { subtree: true, childList: true });

// Handle tab closures and page refreshes
window.addEventListener('beforeunload', function (event) {
  // Disconnect the observer to clean up resources
  observer.disconnect();
});

function contentLoaded() {
  // check if a valid YT page

  // BOOKMARKING LOGIC FOR YT VIDEO PAGE

  // TIME CALCULATING LOGIC FOR YT PLAYLIST PAGE
  // check if a YT playlist page and send the timestamps to background.js
  // background.js will calculate the time and send back to contentScript
  // on receiving the calculation the contentScript injects that into the YT playlist page

  const url = window.location.href;
  if (isYoutubePlaylistUrl(url)) {
    // get the timestamp spans
    const timerClass = ".ytd-thumbnail-overlay-time-status-renderer";

    const timerSpans = document.querySelectorAll(timerClass);
    let count = 0;
    for (let i = 0; i < timerSpans.length; i++) {
      const timer = timerSpans[i];
      if(timer) {
        console.log(timer.innerText)
        count++;
      }
    }

    console.log("count: ", count);


  } else {
    console.log("Invalid Playlist URL")
  }
}


function isYoutubePlaylistUrl(url) {
  return url && url.includes("youtube.com/playlist?");
}