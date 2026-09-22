let playlistObserver = null;
let retrieveDebounceTimer = null;
let injectRetryTimer = null;
let injectRetryAttempts = 0;
const MAX_INJECT_RETRIES = 40;
let beforeUnloadHandler = null;
let pageChangeHandler = null;
let pageClickHandler = null;
let scrollHandler = null;
const scrollBoundElements = [];
let shadowDomObservers = [];
let inPagePanelVisible = true;
let globalSelectedScale = 0;

let mainState = {
  totalTimeInSec: 0,
  videosCounted: 0,
  videosNotCounted: 0,
  videoCardHeight: 0,
};

chrome.runtime.sendMessage({ message: "contentScriptReady" });

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.message === "urlChanged" || message.message === "pageReloaded") {
    main();
    return;
  }

  if (message.message === "getPlaylistStats") {
    sendResponse(buildPlaylistStatsResponse());
    return true;
  }

  if (message.message === "setPlaybackScale") {
    const scale = Number(message.scale);
    if (Number.isFinite(scale) && scale > 0) {
      globalSelectedScale = scale;
    }
    sendResponse(buildPlaylistStatsResponse());
    return true;
  }

  if (message.message === "scrollPlaylist") {
    scrollPlaylistToLoadMore();
    sendResponse({ ok: true });
    return true;
  }

  if (message.message === "setInPagePanelVisible") {
    setInPagePanelVisible(!!message.visible);
    sendResponse({ ok: true, visible: inPagePanelVisible });
    return true;
  }

  if (message.message === "getInPagePanelVisible") {
    sendResponse({ visible: inPagePanelVisible });
    return true;
  }
});

function isPlaylistPage() {
  return window.location.href.includes("youtube.com/playlist");
}

function parseDurationText(timer) {
  if (!timer || !/^\d+(:\d+){1,2}$/.test(timer.trim())) {
    return null;
  }
  const timerSplit = timer.trim().split(":");
  if (timerSplit.length === 3) {
    const [hr, min, sec] = timerSplit;
    return Number(hr) * 3600 + Number(min) * 60 + Number(sec);
  }
  const [min, sec] = timerSplit;
  return Number(min) * 60 + Number(sec);
}

function secToDayHrMinSec(sec) {
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

function scaleDuration(totalSec, scaleVal) {
  return secToDayHrMinSec(Math.ceil(totalSec / scaleVal));
}

function formatDurationHtml(duration) {
  const { days, hrs, min, sec } = duration;
  const elementsToPush = [];
  if (days !== 0) elementsToPush.push(`<div>${days} days</div>`);
  if (hrs !== 0) elementsToPush.push(`<div>${hrs} hours</div>`);
  if (min !== 0) elementsToPush.push(`<div>${min} mins</div>`);
  if (sec !== 0) elementsToPush.push(`<div>${sec} sec</div>`);
  if (elementsToPush.length === 0) {
    elementsToPush.push(`<div>0 sec</div>`);
  }
  return elementsToPush.join("");
}

function isElementVisible(el) {
  return elementHasVisibleLayout(el);
}

function elementHasVisibleLayout(el) {
  if (!el || !(el instanceof Element)) {
    return false;
  }
  if (el.hidden) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return true;
  }

  const lightNodes = el.querySelectorAll(
    "button, a, yt-button-shape, .metadata-action-bar, #actions, yt-content-metadata-view-model"
  );
  for (const node of lightNodes) {
    const nodeRect = node.getBoundingClientRect();
    if (nodeRect.width > 0 && nodeRect.height > 0) {
      return true;
    }
  }

  const deepNodes = queryAllDeep("button, a, yt-button-shape", el);
  for (const node of deepNodes) {
    const nodeRect = node.getBoundingClientRect();
    if (nodeRect.width > 0 && nodeRect.height > 0) {
      return true;
    }
  }

  return false;
}

function isUsableInjectionContainer(el) {
  if (!el || !(el instanceof Element) || el.hidden) {
    return false;
  }
  return elementHasVisibleLayout(el);
}

function findHeaderAnchor(container) {
  const anchors = queryAllDeep(
    ".metadata-action-bar, #actions, .play-menu",
    container
  );
  for (const anchor of anchors) {
    if (elementHasVisibleLayout(anchor)) {
      return anchor;
    }
  }

  const buttons = queryAllDeep("a, button, yt-button-shape", container);
  for (const btn of buttons) {
    const label = (
      (btn.textContent || "") +
      " " +
      (btn.getAttribute("aria-label") || "")
    ).toLowerCase();
    if (!label.includes("play all")) {
      continue;
    }
    const rect = btn.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    return (
      btn.closest(".metadata-action-bar, #actions, .play-menu") ||
      btn.parentElement
    );
  }

  const metadataBlocks = queryAllDeep("yt-content-metadata-view-model", container);
  for (const block of metadataBlocks) {
    if (elementHasVisibleLayout(block)) {
      return block;
    }
  }

  return null;
}

function findVisibleFlexibleActionsHost() {
  const hosts = queryAllDeep("yt-flexible-actions-view-model");
  for (const host of hosts) {
    if (!isUsableInjectionContainer(host)) {
      continue;
    }
    const playAll = queryAllDeep("a, button", host).find(function (el) {
      const label = (
        (el.textContent || "") +
        " " +
        (el.getAttribute("aria-label") || "")
      ).toLowerCase();
      return label.includes("play all");
    });
    if (playAll) {
      return host;
    }
  }
  return null;
}

function findInjectionTarget() {
  const flexibleActions = findVisibleFlexibleActionsHost();
  if (flexibleActions) {
    return {
      container: flexibleActions,
      mode: "flexible-actions",
    };
  }

  const containerSelectors = [
    ".metadata-wrapper",
    "ytd-playlist-sidebar-renderer",
    "ytd-playlist-header-renderer",
  ];

  for (const selector of containerSelectors) {
    const containers = queryAllDeep(selector);
    for (const container of containers) {
      if (!isUsableInjectionContainer(container)) {
        continue;
      }
      const nestedActions = findVisibleFlexibleActionsHost();
      if (nestedActions && container.contains(nestedActions)) {
        return {
          container: nestedActions,
          mode: "flexible-actions",
        };
      }
      return {
        container: container,
        mode: selector === ".metadata-wrapper" ? "metadata-wrapper" : "header",
        injectAfter: findHeaderAnchor(container),
      };
    }
  }

  const interactive = queryAllDeep("a, button, yt-button-shape, tp-yt-paper-button");
  for (const el of interactive) {
    const label = (
      (el.textContent || "") +
      " " +
      (el.getAttribute("aria-label") || "")
    ).toLowerCase();
    if (!label.includes("play all")) {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    const flexibleHost = el.closest("yt-flexible-actions-view-model");
    if (flexibleHost && isUsableInjectionContainer(flexibleHost)) {
      return {
        container: flexibleHost,
        mode: "flexible-actions",
      };
    }

    const container =
      el.closest("ytd-playlist-sidebar-renderer") ||
      el.closest("ytd-playlist-header-renderer") ||
      el.closest(".metadata-wrapper") ||
      el.closest("ytd-browse");
    if (!container || container.hidden) {
      continue;
    }

    return {
      container: container,
      mode: "play-all",
      injectAfter:
        el.closest(".metadata-action-bar, #actions, .play-menu") ||
        el.parentElement,
    };
  }

  return null;
}

function getVisibleStudyBuddyPanel() {
  for (const panel of document.querySelectorAll(".yt-study-buddy")) {
    const rect = panel.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return panel;
    }
  }
  return null;
}

function removeHiddenStudyBuddyPanels() {
  document.querySelectorAll(".yt-study-buddy").forEach(function (panel) {
    const rect = panel.getBoundingClientRect();
    const inHiddenHost = panel.closest("[hidden]");
    if (rect.width === 0 || rect.height === 0 || inHiddenHost) {
      panel.remove();
    }
  });
}

function insertStudyBuddyPanel(target, html) {
  document.querySelectorAll(".yt-study-buddy").forEach(function (el) {
    el.remove();
  });

  if (target.mode === "flexible-actions") {
    target.container.insertAdjacentHTML("beforeend", html);
    return;
  }

  target.container.querySelectorAll(".yt-study-buddy").forEach(function (el) {
    el.remove();
  });

  if (target.mode === "metadata-wrapper") {
    const anchor = target.injectAfter || target.container.children[2];
    if (anchor) {
      anchor.insertAdjacentHTML("afterend", html);
    } else {
      target.container.insertAdjacentHTML("beforeend", html);
    }
    return;
  }

  if (target.injectAfter) {
    target.injectAfter.insertAdjacentHTML("afterend", html);
    return;
  }

  target.container.insertAdjacentHTML("beforeend", html);
}

function isPanelCorrectlyPlaced(panel, target) {
  if (!panel || !target) {
    return false;
  }
  if (target.mode === "flexible-actions") {
    return panel.parentElement === target.container;
  }
  return target.container.contains(panel);
}

function scheduleInjectRetry() {
  if (!inPagePanelVisible) {
    return;
  }
  const visiblePanel = getVisibleStudyBuddyPanel();
  if (visiblePanel) {
    const target = findInjectionTarget();
    if (target && isPanelCorrectlyPlaced(visiblePanel, target)) {
      injectRetryAttempts = 0;
      return;
    }
  }
  if (injectRetryAttempts >= MAX_INJECT_RETRIES) {
    return;
  }
  if (injectRetryTimer) {
    return;
  }
  injectRetryTimer = setTimeout(function () {
    injectRetryTimer = null;
    injectRetryAttempts += 1;
    injectStatsPanel();
  }, 500);
}

function buildInjectedPanelHtml(selectedScale) {
  const duration = scaleDuration(mainState.totalTimeInSec, selectedScale);
  const durationHtml = formatDurationHtml(duration);

  return `
    <div id="yt-study-buddy-stats" class="yt-study-buddy">
      <div class="durationSelector">
        <select id="durationSelect">
          <option value="0.25" ${selectedScale === 0.25 ? "selected" : ""}>0.25x</option>
          <option value="0.5" ${selectedScale === 0.5 ? "selected" : ""}>0.5x</option>
          <option value="0.75" ${selectedScale === 0.75 ? "selected" : ""}>0.75x</option>
          <option value="1" ${selectedScale === 1 ? "selected" : ""}>Normal</option>
          <option value="1.25" ${selectedScale === 1.25 ? "selected" : ""}>1.25x</option>
          <option value="1.5" ${selectedScale === 1.5 ? "selected" : ""}>1.5x</option>
          <option value="1.75" ${selectedScale === 1.75 ? "selected" : ""}>1.75x</option>
          <option value="2" ${selectedScale === 2 ? "selected" : ""}>2x</option>
        </select>
        <span class="duration">${durationHtml}</span>
      </div>
      <div class="videosCounted">Videos Counted: <span>${mainState.videosCounted}</span></div>
      <div class="videosNotCounted">Videos NOT Counted: <span>${mainState.videosNotCounted}</span></div>
      ${
        mainState.videosNotCounted !== 0
          ? `<button type="button" class="scroll-msg">
            <span class="scroll-text">Scroll down to count more videos</span>
          </button>`
          : ""
      }
    </div>
  `;
}

function syncInjectedPanelContent(panel, selectedScale) {
  const durationEl = panel.querySelector(".duration");
  if (durationEl) {
    durationEl.innerHTML = formatDurationHtml(
      scaleDuration(mainState.totalTimeInSec, selectedScale)
    );
  }

  const countedEl = panel.querySelector(".videosCounted span");
  if (countedEl) {
    countedEl.textContent = String(mainState.videosCounted);
  }

  const notCountedEl = panel.querySelector(".videosNotCounted span");
  if (notCountedEl) {
    notCountedEl.textContent = String(mainState.videosNotCounted);
  }

  const selectEl = panel.querySelector("#durationSelect");
  if (selectEl) {
    selectEl.value = String(selectedScale);
  }

  let scrollMsg = panel.querySelector(".scroll-msg");
  if (mainState.videosNotCounted !== 0) {
    if (!scrollMsg) {
      scrollMsg = document.createElement("button");
      scrollMsg.type = "button";
      scrollMsg.className = "scroll-msg";
      scrollMsg.innerHTML =
        '<span class="scroll-text">Scroll down to count more videos</span>';
      panel.appendChild(scrollMsg);
    }
  } else if (scrollMsg) {
    scrollMsg.remove();
  }
}

function removeAllInPagePanels() {
  document.querySelectorAll(".yt-study-buddy").forEach(function (panel) {
    panel.remove();
  });
}

function setInPagePanelVisible(visible) {
  inPagePanelVisible = visible;

  if (injectRetryTimer) {
    clearTimeout(injectRetryTimer);
    injectRetryTimer = null;
  }
  injectRetryAttempts = 0;

  if (!visible) {
    removeAllInPagePanels();
    return;
  }

  injectStatsPanel();
}

function injectStatsPanel() {
  if (!isPlaylistPage()) {
    return;
  }

  if (!inPagePanelVisible) {
    removeAllInPagePanels();
    return;
  }

  removeHiddenStudyBuddyPanels();

  const target = findInjectionTarget();
  const scale = globalSelectedScale || 1;
  const visiblePanel = getVisibleStudyBuddyPanel();

  if (visiblePanel && target && isPanelCorrectlyPlaced(visiblePanel, target)) {
    syncInjectedPanelContent(visiblePanel, scale);
    return;
  }

  document.querySelectorAll(".yt-study-buddy").forEach(function (panel) {
    panel.remove();
  });

  if (!target) {
    scheduleInjectRetry();
    return;
  }

  insertStudyBuddyPanel(target, buildInjectedPanelHtml(scale));

  if (!getVisibleStudyBuddyPanel()) {
    scheduleInjectRetry();
  } else {
    injectRetryAttempts = 0;
  }
}

function updateInjectedDurationDisplay() {
  const panel = getVisibleStudyBuddyPanel();
  if (!panel) {
    injectStatsPanel();
    return;
  }
  syncInjectedPanelContent(panel, globalSelectedScale || 1);
}

function parseVideoCountFromText(text) {
  if (!text) return null;
  const match = text.match(/([\d,]+)\s*videos?\b/i);
  if (!match) return null;
  const count = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(count) && count > 0 ? count : null;
}

function getTotalPlaylistVideoCount() {
  const legacyCountEl = document.querySelector(
    ".metadata-stats .yt-formatted-string"
  );
  if (legacyCountEl?.innerText) {
    const legacyCount = Number(legacyCountEl.innerText.replace(/,/g, ""));
    if (Number.isFinite(legacyCount) && legacyCount > 0) {
      return legacyCount;
    }
  }

  const header = document.querySelector("ytd-playlist-header-renderer");
  if (header) {
    const fromHeader = parseVideoCountFromText(header.innerText);
    if (fromHeader) return fromHeader;
  }

  const sidebar = document.querySelector("ytd-playlist-sidebar-renderer");
  if (sidebar) {
    const fromSidebar = parseVideoCountFromText(sidebar.innerText);
    if (fromSidebar) return fromSidebar;
  }

  const browse = document.querySelector('ytd-browse[page-subtype="playlist"]');
  if (browse) {
    const fromBrowse = parseVideoCountFromText(browse.innerText);
    if (fromBrowse) return fromBrowse;
  }

  const headerMetadata = document.querySelector(
    "ytd-playlist-header-renderer yt-content-metadata-view-model"
  );
  if (headerMetadata) {
    const fromHeaderMetadata = parseVideoCountFromText(
      headerMetadata.innerText
    );
    if (fromHeaderMetadata) return fromHeaderMetadata;
  }

  const pageMetadata = document.querySelector("yt-content-metadata-view-model");
  if (pageMetadata) {
    const fromPageMetadata = parseVideoCountFromText(pageMetadata.innerText);
    if (fromPageMetadata) return fromPageMetadata;
  }

  return null;
}

/** Walks light DOM + open shadow roots (YouTube hides many playlist nodes in shadow trees). */
function queryAllDeep(selector, root = document.documentElement) {
  const results = [];

  function walk(node) {
    if (!node) return;
    if (
      node.nodeType !== Node.ELEMENT_NODE &&
      node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
    ) {
      return;
    }

    if (node.querySelectorAll) {
      node.querySelectorAll(selector).forEach(function (el) {
        results.push(el);
      });
    }

    if (node.shadowRoot) {
      walk(node.shadowRoot);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return [...new Set(results)];
}

function collectPlaylistVideoRows() {
  const searchRoots = [
    document.querySelector('ytd-browse[page-subtype="playlist"]'),
    document.querySelector("ytd-playlist-panel-renderer"),
    document.documentElement,
  ].filter(Boolean);

  const lockupSelector = "yt-lockup-view-model, ytd-lockup-view-model";
  const panelSelector = "ytd-playlist-panel-video-renderer";
  const legacySelector = "ytd-playlist-video-renderer";

  for (const root of searchRoots) {
    const lockups = queryAllDeep(lockupSelector, root);
    if (lockups.length > 0) {
      return { rows: lockups, rowType: "lockup" };
    }

    const panelRows = queryAllDeep(panelSelector, root);
    if (panelRows.length > 0) {
      return { rows: panelRows, rowType: "panel" };
    }

    const legacyRows = queryAllDeep(legacySelector, root);
    if (legacyRows.length > 0) {
      return { rows: legacyRows, rowType: "legacy" };
    }
  }

  return { rows: [], rowType: "none" };
}

function getDurationFromLegacyRow(video) {
  const scope = video.querySelector("#content") || video;
  const thumbnailOverlays = queryAllDeep("#overlays.ytd-thumbnail", scope);
  for (const thumbnail of thumbnailOverlays) {
    const timestamps = thumbnail.querySelector(
      "#time-status.ytd-thumbnail-overlay-time-status-renderer"
    );
    if (!timestamps) continue;
    const timerspan = timestamps.querySelector(
      "#text.ytd-thumbnail-overlay-time-status-renderer"
    );
    if (!timerspan) continue;
    const seconds = parseDurationText(timerspan.innerText);
    if (seconds != null) return seconds;
  }

  const overlayTexts = queryAllDeep(
    "#text.ytd-thumbnail-overlay-time-status-renderer, .ytd-thumbnail-overlay-time-status-renderer",
    scope
  );
  for (const timerspan of overlayTexts) {
    const seconds = parseDurationText(timerspan.textContent);
    if (seconds != null) return seconds;
  }

  return null;
}

function getDurationFromLockupRow(lockup) {
  const badges = queryAllDeep(
    "badge-shape.ytBadgeShapeThumbnailBadge, badge-shape",
    lockup
  );
  for (const badge of badges) {
    const badgeText =
      badge.querySelector(".yt-badge-shape__text")?.textContent ||
      badge.textContent;
    const seconds = parseDurationText(badgeText);
    if (seconds != null) return seconds;
  }

  const badgeTexts = queryAllDeep(".yt-badge-shape__text", lockup);
  for (const el of badgeTexts) {
    const seconds = parseDurationText(el.textContent);
    if (seconds != null) return seconds;
  }

  return null;
}

function getDurationFromRow(row) {
  const fromLockup = getDurationFromLockupRow(row);
  if (fromLockup != null) return fromLockup;

  const fromLegacy = getDurationFromLegacyRow(row);
  if (fromLegacy != null) return fromLegacy;

  const anyBadgeText = queryAllDeep(".yt-badge-shape__text", row);
  for (const el of anyBadgeText) {
    const seconds = parseDurationText(el.textContent);
    if (seconds != null) return seconds;
  }

  return null;
}

function refreshPlaylistStats() {
  if (!isPlaylistPage()) {
    return;
  }

  const { rows } = collectPlaylistVideoRows();

  mainState.totalTimeInSec = 0;
  mainState.videosCounted = rows.length;
  mainState.videosNotCounted = 0;

  rows.forEach(function (row) {
    const seconds = getDurationFromRow(row);
    if (seconds != null) {
      mainState.totalTimeInSec += seconds;
    }
    if (row.clientHeight) {
      mainState.videoCardHeight = row.clientHeight;
    }
  });

  const totalVideos = getTotalPlaylistVideoCount();
  if (totalVideos != null) {
    mainState.videosNotCounted = Math.max(
      0,
      totalVideos - mainState.videosCounted
    );
  }

  if (globalSelectedScale === 0) {
    globalSelectedScale = 1;
  }

  injectStatsPanel();
}

function buildPlaylistStatsResponse() {
  if (!isPlaylistPage()) {
    return {
      ok: false,
      error: "not_playlist",
      message: "Open a YouTube playlist page to see stats.",
    };
  }

  refreshPlaylistStats();

  const scale = globalSelectedScale || 1;
  const duration = scaleDuration(mainState.totalTimeInSec, scale);

  return {
    ok: true,
    totalTimeInSec: mainState.totalTimeInSec,
    videosCounted: mainState.videosCounted,
    videosNotCounted: mainState.videosNotCounted,
    selectedScale: scale,
    duration,
    inPagePanelVisible: inPagePanelVisible,
  };
}

function scheduleRefreshAfterScroll() {
  scheduleRefreshPlaylistStats();
  setTimeout(scheduleRefreshPlaylistStats, 300);
  setTimeout(scheduleRefreshPlaylistStats, 800);
  setTimeout(scheduleRefreshPlaylistStats, 1500);
}

function isScrollableElement(el) {
  if (!(el instanceof Element)) {
    return false;
  }
  if (el === document.body || el === document.documentElement) {
    return false;
  }
  try {
    if (el.scrollHeight <= el.clientHeight + 8) {
      return false;
    }
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    return (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay" ||
      el.scrollHeight > el.clientHeight + 50
    );
  } catch (err) {
    return false;
  }
}

function findScrollableAncestor(startEl) {
  let current = startEl;
  while (current) {
    if (current instanceof Element) {
      let node = current;
      while (node) {
        if (isScrollableElement(node)) {
          return node;
        }
        node = node.parentElement;
      }
    }
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      current = root.host;
    } else {
      break;
    }
  }
  return null;
}

function scrollerContainsPlaylistRows(scroller) {
  if (!scroller || !(scroller instanceof Element)) {
    return false;
  }
  if (scroller.id === "items" || scroller.id === "contents") {
    return true;
  }
  return (
    queryAllDeep(
      "ytd-playlist-panel-video-renderer, yt-lockup-view-model, ytd-lockup-view-model",
      scroller
    ).length > 0
  );
}

function scrollElementBy(el, delta) {
  const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
  const nextTop = Math.min(Math.max(0, el.scrollTop + delta), maxTop);
  el.scrollTop = nextTop;
  try {
    el.scrollTo({ top: nextTop, behavior: "smooth" });
  } catch (err) {
    /* scrollTop assignment above is the fallback */
  }
}

function scrollPlaylistToLoadMore() {
  const { rows } = collectPlaylistVideoRows();
  let scroller = null;

  if (rows.length > 0) {
    scroller = findScrollableAncestor(rows[rows.length - 1]);
  }
  if (!scroller || !scrollerContainsPlaylistRows(scroller)) {
    scroller = getPrimaryPlaylistScroller();
  }

  const rowStep = Math.max(mainState.videoCardHeight * 8, 400);
  const viewportStep = scroller ? Math.max(scroller.clientHeight * 0.9, 500) : 800;
  const scrollAmount = Math.max(rowStep, viewportStep);

  if (scroller) {
    scrollElementBy(scroller, scrollAmount);
  }

  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    try {
      lastRow.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch (err) {
      /* ignore */
    }
    if (scroller) {
      setTimeout(function () {
        scrollElementBy(scroller, rowStep);
      }, 150);
    }
  } else if (!scroller) {
    window.scrollBy({ top: scrollAmount, behavior: "smooth" });
  }

  scheduleRefreshAfterScroll();
}

function getPrimaryPlaylistScroller() {
  const scrollables = [];

  function consider(node) {
    if (!(node instanceof Element)) {
      return;
    }
    try {
      if (isScrollableElement(node)) {
        scrollables.push(node);
      }
    } catch (err) {
      /* ignore */
    }
    if (node.shadowRoot) {
      walk(node.shadowRoot);
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  function walk(node) {
    if (node instanceof DocumentFragment) {
      for (const child of node.children) {
        consider(child);
      }
      return;
    }
    consider(node);
  }

  queryAllDeep(
    "ytd-playlist-panel-renderer, ytd-playlist-video-list-renderer, ytd-browse"
  ).forEach(walk);

  const withRows = scrollables.filter(scrollerContainsPlaylistRows);
  const pool = withRows.length > 0 ? withRows : scrollables;

  if (pool.length === 0) {
    return null;
  }

  pool.sort(function (a, b) {
    return (
      b.scrollHeight -
      b.clientHeight -
      (a.scrollHeight - a.clientHeight)
    );
  });
  return pool[0];
}

function detachScrollListeners() {
  if (!scrollHandler) {
    return;
  }
  window.removeEventListener("scroll", scrollHandler);
  scrollBoundElements.forEach(function (entry) {
    entry.el.removeEventListener("scroll", scrollHandler);
  });
  scrollBoundElements.length = 0;
}

function attachScrollListenersDeep(node) {
  if (!scrollHandler) {
    return;
  }
  if (node instanceof Element) {
    try {
      if (node.scrollHeight > node.clientHeight + 8) {
        node.addEventListener("scroll", scrollHandler, { passive: true });
        scrollBoundElements.push({ el: node });
      }
    } catch (err) {
      /* ignore */
    }
    if (node.shadowRoot) {
      attachScrollListenersDeep(node.shadowRoot);
    }
    for (const child of node.children) {
      attachScrollListenersDeep(child);
    }
  } else if (node instanceof DocumentFragment) {
    for (const child of node.children) {
      attachScrollListenersDeep(child);
    }
  }
}

function attachScrollListenersForPlaylist() {
  detachScrollListeners();
  scrollHandler = function () {
    scheduleRefreshPlaylistStats();
  };

  window.addEventListener("scroll", scrollHandler, { passive: true });
  attachScrollListenersDeep(document.documentElement);
  queryAllDeep(
    "ytd-playlist-panel-renderer, ytd-playlist-video-list-renderer, ytd-browse"
  ).forEach(function (root) {
    attachScrollListenersDeep(root);
  });
}

function disconnectShadowDomObservers() {
  shadowDomObservers.forEach(function (observer) {
    observer.disconnect();
  });
  shadowDomObservers = [];
}

function observeShadowTreeRecursive(node) {
  if (!(node instanceof Element)) {
    return;
  }
  if (node.shadowRoot) {
    const shadowObserver = new MutationObserver(function () {
      scheduleRefreshPlaylistStats();
      attachScrollListenersForPlaylist();
    });
    shadowObserver.observe(node.shadowRoot, {
      childList: true,
      subtree: true,
    });
    shadowDomObservers.push(shadowObserver);
    attachScrollListenersDeep(node.shadowRoot);
  }
  for (const child of node.children) {
    observeShadowTreeRecursive(child);
  }
}

function observePlaylistShadowTrees() {
  disconnectShadowDomObservers();
  queryAllDeep(
    "ytd-playlist-panel-renderer, ytd-playlist-video-list-renderer, ytd-browse"
  ).forEach(function (root) {
    observeShadowTreeRecursive(root);
  });
}

function teardownPlaylistHandlers() {
  if (retrieveDebounceTimer) {
    clearTimeout(retrieveDebounceTimer);
    retrieveDebounceTimer = null;
  }
  if (injectRetryTimer) {
    clearTimeout(injectRetryTimer);
    injectRetryTimer = null;
  }
  injectRetryAttempts = 0;
  if (playlistObserver) {
    playlistObserver.disconnect();
    playlistObserver = null;
  }
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
  if (pageChangeHandler) {
    document.removeEventListener("change", pageChangeHandler);
    pageChangeHandler = null;
  }
  if (pageClickHandler) {
    document.removeEventListener("click", pageClickHandler);
    pageClickHandler = null;
  }
  detachScrollListeners();
  scrollHandler = null;
  disconnectShadowDomObservers();
}

function mutationShouldTriggerRecalc(mutation) {
  const target = mutation.target;
  if (!target || !(target instanceof Element)) {
    return false;
  }
  if (target.closest && target.closest(".yt-study-buddy")) {
    return false;
  }
  if (!target.classList) {
    return false;
  }
  if (target.classList.contains("ytd-thumbnail-overlay-time-status-renderer")) {
    return true;
  }
  if (
    target.tagName === "YT-LOCKUP-VIEW-MODEL" ||
    target.tagName === "YTD-LOCKUP-VIEW-MODEL"
  ) {
    return true;
  }
  if (
    target.tagName === "BADGE-SHAPE" &&
    target.classList.contains("ytBadgeShapeThumbnailBadge")
  ) {
    return true;
  }
  if (target.tagName === "YT-CONTENT-METADATA-VIEW-MODEL") {
    return true;
  }
  if (
    target.tagName === "YTD-PLAYLIST-HEADER-RENDERER" ||
    target.tagName === "YTD-PLAYLIST-SIDEBAR-RENDERER" ||
    target.tagName === "YTD-PLAYLIST-PANEL-VIDEO-RENDERER" ||
    target.tagName === "YTD-PLAYLIST-PANEL-RENDERER" ||
    target.tagName === "YTD-BROWSE"
  ) {
    return true;
  }
  return false;
}

function scheduleRefreshPlaylistStats() {
  if (retrieveDebounceTimer) {
    clearTimeout(retrieveDebounceTimer);
  }
  retrieveDebounceTimer = setTimeout(function () {
    retrieveDebounceTimer = null;
    refreshPlaylistStats();
  }, 200);
}

function main() {
  if (!isPlaylistPage()) {
    teardownPlaylistHandlers();
    return;
  }

  teardownPlaylistHandlers();

  const observerCallback = function (mutationsList) {
    for (const mutation of mutationsList) {
      if (mutationShouldTriggerRecalc(mutation)) {
        scheduleRefreshPlaylistStats();
        break;
      }
    }
  };

  playlistObserver = new MutationObserver(observerCallback);
  playlistObserver.observe(document.body, { childList: true, subtree: true });

  beforeUnloadHandler = function () {
    teardownPlaylistHandlers();
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  pageChangeHandler = function (event) {
    const target = event.target;
    if (target && target.id === "durationSelect" && target.closest(".yt-study-buddy")) {
      globalSelectedScale = Number(target.value);
      updateInjectedDurationDisplay();
    }
  };
  document.addEventListener("change", pageChangeHandler);

  pageClickHandler = function (event) {
    const target = event.target;
    if (
      target &&
      (target.classList.contains("scroll-msg") ||
        target.classList.contains("scroll-text") ||
        (target.closest && target.closest(".scroll-msg")))
    ) {
      event.preventDefault();
      event.stopPropagation();
      scrollPlaylistToLoadMore();
    }
  };
  document.addEventListener("click", pageClickHandler);

  attachScrollListenersForPlaylist();
  observePlaylistShadowTrees();

  refreshPlaylistStats();
}

if (isPlaylistPage()) {
  main();
}
