// Check if it's a Playlist Page
function isPlaylistPage() {
  return window.location.href.includes("youtube.com/playlist");
}

function retrieveTimestamps() {
  if (isPlaylistPage()) {
    const videos = document.querySelectorAll("ytd-playlist-video-renderer #content");
    videos.forEach((video, idx) => {
      console.log("-----------")
      console.log(idx+1);
      const thumbnail = video.querySelector("#overlays.ytd-thumbnail");
      console.log(thumbnail)
      const timestamps = thumbnail.querySelector("#time-status.ytd-thumbnail-overlay-time-status-renderer")
      console.log(timestamps)
    })
  }
}

const callback = function(mutationsList, observer) {
  // PROBLEM: This wait for the first timestamp element to render on page and then breaks. I want it to wait for the last one
  for (const mutation of mutationsList) {
    if(mutation.target && mutation.target.classList.contains('ytd-thumbnail-overlay-time-status-renderer')) {
      retrieveTimestamps();
      observer.disconnect();
      break;
    }
  }
};
const observer = new MutationObserver(callback);
observer.observe(document.body, {childList: true, subtree: true });