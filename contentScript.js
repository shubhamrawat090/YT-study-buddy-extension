// Send a message to background.js indicating that the content script is ready
chrome.runtime.sendMessage({ message: "contentScriptReady" });

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.message === "urlChanged" || message.message === "pageReloaded") {
    main();
  }
});

// DRIVER FUNCTION
function main() {
  let totalTimeInSec = 0;
  let videosCounted = 0;
  let videosNotCounted = 0;
  let selectedScale = 0;
  let videoCardHeight = 0;

  // Check if it's a Playlist Page
  function isPlaylistPage() {
    return window.location.href.includes("youtube.com/playlist");
  }

  function retrieveTimestamps() {
    const videos = document.querySelectorAll(
      "ytd-playlist-video-renderer #content"
    );

    totalTimeInSec = 0;
    videosCounted = 0;
    videosNotCounted = 0;

    videos.forEach((video) => {
      if (!video) return;
      const thumbnail = video.querySelector("#overlays.ytd-thumbnail");

      if (!thumbnail) return;
      const timestamps = thumbnail.querySelector(
        "#time-status.ytd-thumbnail-overlay-time-status-renderer"
      );

      if (!timestamps) return;
      const timerspan = timestamps.querySelector(
        "#text.ytd-thumbnail-overlay-time-status-renderer"
      );

      if (!timerspan) return;
      const timer = timerspan.innerText;
      /* 
        Timer format: 10:37 ==> min:sec, 1:10:35 ==> hour:min:sec
      */
      if (!timer) return;
      const timerSplit = timer.split(":");
      if (timerSplit.length === 3) {
        const [hr, min, sec] = timerSplit;
        totalTimeInSec += Number(hr) * 60 * 60;
        totalTimeInSec += Number(min) * 60;
        totalTimeInSec += Number(sec);
      } else {
        const [min, sec] = timerSplit;
        totalTimeInSec += Number(min) * 60;
        totalTimeInSec += Number(sec);
      }

      videoCardHeight = video.clientHeight;
    });

    /* 
    TODO: 
    Get no. of videos counted here
    Total number of videos
    Get no. of videos NOT counted (diff of above 2)
    Give a message "Scroll down to count more videos" if no. of NOT counted !== 0
    */

    const metaDataStatsElem = document.querySelector(".metadata-stats");
    const videoCount = metaDataStatsElem.querySelector(
      ".yt-formatted-string"
    )?.innerText;

    let totalVideos = Number(videoCount);
    videosCounted = videos.length;
    videosNotCounted = totalVideos - videosCounted;

    // Initially, we show normal/1x duration. 
    if (selectedScale === 0) selectedScale = 1; // If no scale is selected we set it to 1 otherwise we take the value already present.
    injectDataToWebpage();
  }

  /* 
    User can select amongst different scales (0.25, 0.5, 1, 1.5, 2) and 
    this function will recalculate and print that value.
  */
  function secToDayHrMinSec(sec) {
    // Steps for 49hr, 120min, 92 sec  ==> 2 days, 3 hr, 3 min, 2 sec
    // handle seconds only
    // -> 49hr, (120 + 3) min, 2 sec
    // -> 49hr, 123 min, 2 sec

    // handle minutes only
    // -> (49 + 2) hr, 3 min, 2 sec
    // -> 51 hr, 3 min, 2 sec

    // handle hours only
    // -> (0 + 2) days, 3 hr, 3 min, 2 sec
    // -> 2 days, 3 hr, 3 min, 2 sec
    let min = 0;
    let hrs = 0;
    let days = 0;

    min += Math.floor(sec / 60);
    sec = sec % 60;

    hrs += Math.floor(min / 60);
    min = min % 60;

    days += Math.floor(hrs / 24);
    hrs = hrs % 24;

    return { days, hrs, min, sec };
  }

  function injectDataToWebpage() {
    // Remove the previously injected stats(if they already exist)
    const metaDataDiv = document.querySelector(".metadata-wrapper");
    const elemPresent = metaDataDiv.querySelector("#yt-study-buddy-stats");
    if (elemPresent) {
      metaDataDiv.removeChild(elemPresent);
    }

    const { days, hrs, min, sec } = scaleDuration(selectedScale);
    const elementsToPush = [];
    if (days !== 0) elementsToPush.push(`<div>${days} days</div>`);
    if (hrs !== 0) elementsToPush.push(`<div>${hrs} hours</div>`);
    if (min !== 0) elementsToPush.push(`<div>${min} mins</div>`);
    if (sec !== 0) elementsToPush.push(`<div>${sec} sec</div>`);

    // Construct reqdDiv with non-empty elements
    const reqdDiv = `
    <div id="yt-study-buddy-stats">
      <div class='durationSelector'>
        <select id='durationSelect'>
          <option value="0.25" ${selectedScale === 0.25 ? 'selected' : ''}>0.25x</option>
          <option value="0.5" ${selectedScale === 0.5 ? 'selected' : ''}>0.5x</option>
          <option value="0.75" ${selectedScale === 0.75 ? 'selected' : ''}>0.75x</option>
          <option value="1" ${selectedScale === 1 ? 'selected' : ''}>Normal</option>
          <option value="1.25" ${selectedScale === 1.25 ? 'selected' : ''}>1.25x</option>
          <option value="1.5" ${selectedScale === 1.5 ? 'selected' : ''}>1.5x</option>
          <option value="1.75" ${selectedScale === 1.75 ? 'selected' : ''}>1.75x</option>
          <option value="2" ${selectedScale === 2 ? 'selected' : ''}>2x</option>
        </select>
        <span class="duration">${elementsToPush.join("")}</span>
      </div>
      <div class="videosCounted">Videos Counted: <span>${videosCounted}</span></div>
      <div class="videosNotCounted">Videos NOT Counted: <span>${videosNotCounted}</span></div>
      ${videosNotCounted !== 0
        ? `<div class="scroll-msg">
            <svg id="scroll-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
            <svg id="scroll-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>

            <span id="scroll-text">Scroll down to count more videos</span>

            <svg id="scroll-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
            <svg id="scroll-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
          </div>`
        : ""
      }
    </div>
  `;

    metaDataDiv.children[2].insertAdjacentHTML("afterend", reqdDiv);
  }

  function scaleDuration(scaleVal) {
    let totalSecByScale = Math.ceil(totalTimeInSec / scaleVal);
    var { days, hrs, min, sec } = secToDayHrMinSec(totalSecByScale);

    let calcDays = days;
    let calcHours = hrs;
    let calcMinutes = min;
    let calcSeconds = sec;

    return {
      days: calcDays,
      hrs: calcHours,
      min: calcMinutes,
      sec: calcSeconds
    }
  }

  // Define getDuration outside of any other function
  function getDuration() {
    const select = document.getElementById('durationSelect');
    selectedScale = Number(select.value);
    const { days, hrs, min, sec } = scaleDuration(selectedScale);
    const elementsToPush = [];
    if (days !== 0) elementsToPush.push(`<div>${days} days</div>`);
    if (hrs !== 0) elementsToPush.push(`<div>${hrs} hours</div>`);
    if (min !== 0) elementsToPush.push(`<div>${min} mins</div>`);
    if (sec !== 0) elementsToPush.push(`<div>${sec} sec</div>`);

    const durationDiv = document.querySelector('.duration');
    durationDiv.innerHTML = elementsToPush.join("");
  }

  if (isPlaylistPage()) {
    const callback = function (mutationsList, observer) {
      // PROBLEM: This wait for the first timestamp element to render on page and then breaks. I want it to wait for the last one
      // FIX: Do observe.disconnect() in the beforeunload event
      for (const mutation of mutationsList) {
        if (
          mutation.target &&
          mutation.target.classList.contains(
            "ytd-thumbnail-overlay-time-status-renderer"
          )
        ) {
          retrieveTimestamps();
          break;
        }
      }
    };
    const observer = new MutationObserver(callback);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("beforeunload", function (event) {
      // Disconnect the observer when the tab is refreshed or closed
      observer.disconnect();
    });

    // Event delegation for dynamically added elements
    // Because simply adding onchange on the dynamically injected HTML doesn't work
    document.addEventListener('change', function (event) {
      const target = event.target;
      if (target && target.id === 'durationSelect') {
        // Call the function when the select element is changed
        getDuration();
      }
    });

    document.addEventListener('click', function (event) {
      const target = event.target;
      if (target && target.classList.contains('scroll-msg') || target.id === 'scroll-text' || target.id === 'scroll-icon') {
        // On clicking the scroll message it automatically scrolls to the bottom of the page to load new videos
        scrollToBottom();

        function scrollToBottom() {
          /* 
            Lets say there are 20 videos loaded and 10 more to load.
            So, we need to scroll to 20 videos worth of height(height of 1 video * no. of videos: 20 here) to load next 10 video due to pagination by youtube.
          */
          const scrollHeight = videoCardHeight * (videosCounted + videosNotCounted);
          // NEED TO WRITE ITS DEFINITION
          window.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        }
      }
    })
  }
}
