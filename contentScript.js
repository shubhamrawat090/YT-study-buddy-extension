// Check if it's a Playlist Page
function isPlaylistPage() {
  return window.location.href.includes("youtube.com/playlist");
}

function retrieveTimestamps() {

  const videos = document.querySelectorAll("ytd-playlist-video-renderer #content");
  let daySum = 0, hourSum = 0, minSum = 0, secSum = 0;
  videos.forEach((video, idx) => {
    console.log("-----------")
    console.log(idx + 1);
    if (!video) return;
    const thumbnail = video.querySelector("#overlays.ytd-thumbnail");

    if (!thumbnail) return;
    const timestamps = thumbnail.querySelector("#time-status.ytd-thumbnail-overlay-time-status-renderer")

    if (!timestamps) return;
    const timerspan = timestamps.querySelector("#text.ytd-thumbnail-overlay-time-status-renderer");

    if (!timerspan) return;
    const timer = timerspan.innerText;
    console.log(timer);
    /* 
      Timer format: 10:37 ==> min:sec, 1:10:35 ==> hour:min:sec
    */
    if (!timer) return;
    const timerSplit = timer.split(':');
    if (timerSplit.length === 3) {
      const [hr, min, sec] = timerSplit;
      hourSum += Number(hr);
      minSum += Number(min);
      secSum += Number(sec);
    } else {
      const [min, sec] = timerSplit;
      minSum += Number(min);
      secSum += Number(sec);
    }
  })

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

  minSum += Math.floor(secSum / 60);
  secSum = secSum % 60;

  hourSum += Math.floor(minSum / 60);
  minSum = minSum % 60;

  daySum += Math.floor(hourSum / 24);
  hourSum = hourSum % 24;

  console.log({ daySum, hourSum, minSum, secSum });

  /* 
    TODO: 
      Get no. of videos counted here
      Total number of videos
      Get no. of videos NOT counted (diff of above 2)
      Give a message "Scroll down to count more videos" if no. of NOT counted !== 0
  */
}

if (isPlaylistPage()) {
  const callback = function (mutationsList, observer) {
    // PROBLEM: This wait for the first timestamp element to render on page and then breaks. I want it to wait for the last one
    // FIX: Do observe.disconnect() to on beforeunload event
    for (const mutation of mutationsList) {
      if (mutation.target && mutation.target.classList.contains('ytd-thumbnail-overlay-time-status-renderer')) {
        retrieveTimestamps();
        break;
      }
    }
  };
  const observer = new MutationObserver(callback);
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('beforeunload', function (event) {
    // Disconnect the observer when the tab is refreshed or closed
    observer.disconnect();
  });
}