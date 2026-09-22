const statusMessage = document.getElementById("statusMessage");
const statsPanel = document.getElementById("statsPanel");
const durationSelect = document.getElementById("durationSelect");
const durationDisplay = document.getElementById("durationDisplay");
const videosCountedEl = document.getElementById("videosCounted");
const videosNotCountedEl = document.getElementById("videosNotCounted");
const scrollBtn = document.getElementById("scrollBtn");
const refreshBtn = document.getElementById("refreshBtn");
const inPageToggle = document.getElementById("inPageToggle");

let activeTabId = null;
let statsPollTimer = null;

function startStatsPolling() {
  stopStatsPolling();
  statsPollTimer = setInterval(function () {
    if (activeTabId && !statsPanel.hidden) {
      loadStats();
    }
  }, 2000);
}

function stopStatsPolling() {
  if (statsPollTimer) {
    clearInterval(statsPollTimer);
    statsPollTimer = null;
  }
}

function showStatus(message, isError) {
  stopStatsPolling();
  statusMessage.hidden = false;
  statusMessage.textContent = message;
  statusMessage.classList.toggle("status-error", !!isError);
  statsPanel.hidden = true;
}

function formatDurationParts(duration) {
  const parts = [];
  if (duration.days) parts.push(`${duration.days} days`);
  if (duration.hrs) parts.push(`${duration.hrs} hours`);
  if (duration.min) parts.push(`${duration.min} mins`);
  if (duration.sec) parts.push(`${duration.sec} sec`);
  if (parts.length === 0) {
    parts.push("0 sec");
  }
  return parts.join(" · ");
}

function renderStats(response) {
  if (!response?.ok) {
    showStatus(
      response?.message ||
        "Open a YouTube playlist page, then open this popup again.",
      true
    );
    return;
  }

  statusMessage.hidden = true;
  statsPanel.hidden = false;

  durationSelect.value = String(response.selectedScale);
  durationDisplay.textContent = formatDurationParts(response.duration);
  videosCountedEl.textContent = String(response.videosCounted);
  videosNotCountedEl.textContent = String(response.videosNotCounted);

  scrollBtn.hidden = response.videosNotCounted === 0;

  if (typeof response.inPagePanelVisible === "boolean") {
    inPageToggle.checked = response.inPagePanelVisible;
  }

  startStatsPolling();
}

function sendTabMessage(message, callback) {
  if (!activeTabId) {
    showStatus("No active YouTube tab found.", true);
    return;
  }

  chrome.tabs.sendMessage(activeTabId, message, function (response) {
    if (chrome.runtime.lastError) {
      showStatus(
        "Could not read the playlist tab. Refresh the YouTube page and try again.",
        true
      );
      return;
    }
    if (callback) {
      callback(response);
    }
  });
}

function loadStats() {
  sendTabMessage({ message: "getPlaylistStats" }, renderStats);
}

function init() {
  inPageToggle.checked = true;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0];
    if (!tab?.id) {
      showStatus("No active tab found.", true);
      return;
    }

    if (!tab.url || !tab.url.includes("youtube.com")) {
      showStatus("Open YouTube in this tab first.", true);
      return;
    }

    if (!tab.url.includes("youtube.com/playlist")) {
      showStatus(
        "Navigate to a YouTube playlist page, then open this popup again.",
        true
      );
      return;
    }

    activeTabId = tab.id;
    loadStats();
  });
}

durationSelect.addEventListener("change", function () {
  sendTabMessage(
    {
      message: "setPlaybackScale",
      scale: Number(durationSelect.value),
    },
    renderStats
  );
});

scrollBtn.addEventListener("click", function () {
  sendTabMessage({ message: "scrollPlaylist" }, function () {
    setTimeout(loadStats, 400);
    setTimeout(loadStats, 1200);
  });
});

refreshBtn.addEventListener("click", loadStats);

inPageToggle.addEventListener("change", function () {
  const visible = inPageToggle.checked;

  if (!activeTabId) {
    return;
  }

  sendTabMessage({ message: "setInPagePanelVisible", visible: visible });
});

window.addEventListener("unload", stopStatsPolling);

init();
