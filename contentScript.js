let totalTimeInSec = 0;
let videosCounted = 0;
let videosNotCounted = 0;

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

  videos.forEach((video, idx) => {
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

  injectDataToWebpage();
}

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
  const metaDataDiv = document.querySelector(".metadata-wrapper");
  const elemPresent = metaDataDiv.querySelector("#yt-study-buddy-stats");
  if (elemPresent) {
    metaDataDiv.removeChild(elemPresent);
  }

  // Duration at normal speed
  var { days, hrs, min, sec } = secToDayHrMinSec(totalTimeInSec);

  let daySum = days;
  let hourSum = hrs;
  let minSum = min;
  let secSum = sec;

  // Create an array to store non-empty elements
  const elements = [];

  // Push non-empty elements into the array
  if (daySum !== 0) elements.push(`<div>${daySum} days</div>`);
  if (hourSum !== 0) elements.push(`<div>${hourSum} hours</div>`);
  if (minSum !== 0) elements.push(`<div>${minSum} mins</div>`);
  if (secSum !== 0) elements.push(`<div>${secSum} sec</div>`);

  console.log({ daySum, hourSum, minSum, secSum });
  console.log({ videosCounted, videosNotCounted });

  // Duration at 1.5x
  let secAt1_5x = Math.ceil(totalTimeInSec / 1.5);
  var { days, hrs, min, sec } = secToDayHrMinSec(secAt1_5x);

  let daySumAt1_5x = days;
  let hourSumAt1_5x = hrs;
  let minSumAt1_5x = min;
  let secSumAt1_5x = sec;

  // Create an array to store non-empty elements
  const elementsAt1_5x = [];

  // Push non-empty elements into the array
  if (daySumAt1_5x !== 0)
    elementsAt1_5x.push(`<div>${daySumAt1_5x} days</div>`);
  if (hourSumAt1_5x !== 0)
    elementsAt1_5x.push(`<div>${hourSumAt1_5x} hours</div>`);
  if (minSumAt1_5x !== 0)
    elementsAt1_5x.push(`<div>${minSumAt1_5x} mins</div>`);
  if (secSumAt1_5x !== 0) elementsAt1_5x.push(`<div>${secSumAt1_5x} sec</div>`);

  // Duration at 2x
  let secAt2x = Math.ceil(totalTimeInSec / 2);
  var { days, hrs, min, sec } = secToDayHrMinSec(secAt2x);

  let daySumAt2x = days;
  let hourSumAt2x = hrs;
  let minSumAt2x = min;
  let secSumAt2x = sec;

  // Create an array to store non-empty elements
  const elementsAt2x = [];

  // Push non-empty elements into the array
  if (daySumAt2x !== 0) elementsAt2x.push(`<div>${daySumAt1_5x} days</div>`);
  if (hourSumAt2x !== 0) elementsAt2x.push(`<div>${hourSumAt2x} hours</div>`);
  if (minSumAt2x !== 0) elementsAt2x.push(`<div>${minSumAt2x} mins</div>`);
  if (secSumAt2x !== 0) elementsAt2x.push(`<div>${secSumAt2x} sec</div>`);

  // Construct reqdDiv with non-empty elements
  const reqdDiv = `
    <div id="yt-study-buddy-stats">
      <div class="duration">
        ${elements.join("")}
      </div>

      <table class="durationTable">
        <tr>
          <td>At 1.5x</td>
          <td>
            <div class="durationAt1_5x">
            ${elementsAt1_5x.join("")}
            </div>
          </td>
        </tr>
        <tr>
          <td>At 2x</td>
          <td>
            <div class="durationAt2x">
            ${elementsAt2x.join("")}
            </div>
          </td>
        </tr>
      </table>
      
      <div class="videosCounted">Videos Counted: ${videosCounted}</div>
      <div class="videosNotCounted">Videos NOT Counted: ${videosNotCounted}</div>
      ${
        videosNotCounted !== 0
          ? `<div class="scroll-msg">Scroll down to count more videos</div>`
          : ""
      }
    </div>
    `;

  metaDataDiv.children[0].insertAdjacentHTML("afterend", reqdDiv);
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
}
