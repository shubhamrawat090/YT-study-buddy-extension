# YT Study-Buddy Extension — Project Explanation

## Purpose

This document is the source of truth for an AI coding agent working on the **YT Study-Buddy Extension** repository.

Read this file before making changes to the project. It describes the current implementation, architecture, runtime behavior, files, known limitations, and important assumptions.

Do not assume that a feature exists merely because it is mentioned as a future idea. The current source code is authoritative.

---

## 1. Project Overview

**YT Study-Buddy Extension** is a Chrome browser extension built with **Chrome Manifest V3** and plain JavaScript/CSS.

Its current implemented purpose is to calculate and display the total duration of videos in a **YouTube playlist**, including an estimate of how long the playlist would take to watch at different playback speeds.

The extension currently works primarily by injecting UI directly into YouTube playlist pages.

There is no React, Vite, Webpack, TypeScript, or other application framework in the current repository.

There is also no real build step.

The extension can therefore be loaded directly into Chrome as an **unpacked extension**.

---

## 2. Current Repository Structure

The current repository contains:

```text
YT-study-buddy-extension/
├── manifest.json
├── background.js
├── contentScript.js
├── popup.html
├── popup.js
├── styles.css
├── notes.txt
├── package-lock.json
└── icons/
    ├── logo-16.png
    ├── logo-32.png
    ├── logo-48.png
    └── logo-128.png
```

There is also a `.DS_Store` file in the supplied project archive. It is an operating-system metadata file and is not part of the extension's application logic.

---

# 3. manifest.json

The extension uses:

```json
{
  "manifest_version": 3,
  "name": "YT Study-Buddy Extension",
  "version": "1.0",
  "permissions": ["tabs"]
}
```

### Manifest V3

This is a Chrome Manifest V3 extension.

### Extension name

The extension is named:

**YT Study-Buddy Extension**

### Current version

The current manifest version is:

```text
1.0
```

Do not change it automatically when modifying the code unless a release/versioning task explicitly requires it.

### Permission

The current extension requests:

```text
tabs
```

The permission is related to the extension's use of Chrome tab APIs in `background.js`.

Do not add additional permissions unless the requested functionality actually requires them.

### Popup

The extension action points to:

```text
popup.html
```

### Background service worker

The background service worker is:

```text
background.js
```

### Content script

The content script is:

```text
contentScript.js
```

It is injected on:

```text
*://www.youtube.com/*
```

and runs at:

```text
document_end
```

The content script also loads:

```text
styles.css
```

### Icons

The extension defines 16px, 32px, 48px and 128px icons from the `icons/` directory.

---

# 4. background.js

`background.js` is the Manifest V3 background service worker.

Its current responsibility is to listen for a message from the content script indicating that the content script is ready:

```text
contentScriptReady
```

It registers `chrome.tabs.onUpdated` **once** at service worker startup (not inside the message handler).

When the content script sends `contentScriptReady`, if the sender tab is already `complete`, the background script also sends `pageReloaded` immediately so an open playlist tab works after an extension reload.

The listener reacts to:

### URL changes

When:

```text
changeInfo.url
```

exists, the background script sends:

```text
urlChanged
```

to the affected tab.

### Page reload completion

When:

```text
changeInfo.status === "complete"
```

the background script sends:

```text
pageReloaded
```

to the affected tab.

The content script receives these messages and calls `main()`. It also calls `main()` on first load when the URL is already a playlist page.

`sendMessage` failures on non-YouTube tabs are ignored (`.catch`).

---

# 5. contentScript.js

This is the primary implementation of the extension.

It is responsible for:

- detecting YouTube playlist pages
- observing YouTube's dynamically rendered DOM
- finding playlist video cards
- reading video durations
- converting durations into seconds
- calculating the total playlist duration
- calculating adjusted durations for playback speeds
- injecting the extension UI into the YouTube page
- displaying counted/not-counted video counts
- allowing playback-speed selection
- providing a scroll prompt when not all playlist videos are loaded
- reacting to page/navigation events

---

# 6. Initial Content Script Communication

When the content script starts, it sends:

```text
contentScriptReady
```

to the background service worker.

The background script uses this as the signal that the content script is available.

The content script also listens for:

```text
urlChanged
pageReloaded
```

and calls:

```javascript
main();
```

when either message is received.

---

# 7. main()

The `main()` function is the central driver.

It initializes state variables:

```text
totalTimeInSec
videosCounted
videosNotCounted
selectedScale
videoCardHeight
```

These represent:

- `totalTimeInSec`: accumulated duration of counted videos
- `videosCounted`: number of playlist video elements currently counted
- `videosNotCounted`: estimated number of playlist videos that have not yet been loaded/countable
- `selectedScale`: currently selected playback speed
- `videoCardHeight`: height of a playlist video card, used by the scrolling logic

---

# 8. Playlist Detection

The extension checks:

```javascript
window.location.href.includes("youtube.com/playlist")
```

through:

```javascript
isPlaylistPage()
```

Therefore the current implementation specifically treats URLs containing:

```text
youtube.com/playlist
```

as playlist pages.

This is a simple URL check, not a comprehensive YouTube route/page-state detection system.

---

# 9. retrieveTimestamps()

`retrieveTimestamps()` is responsible for finding playlist videos and calculating their total duration.

It uses a **dual-path** strategy depending on which row type YouTube renders:

### Modern lockup layout (preferred when present)

Rows:

```css
yt-lockup-view-model, ytd-lockup-view-model
```

Duration from the thumbnail badge:

```css
badge-shape.ytBadgeShapeThumbnailBadge
```

(text content such as `9:59` or `1:10:35`)

### Legacy layout (fallback)

It queries:

```css
ytd-playlist-video-renderer #content
```

For every matching legacy video element, it searches for the timestamp through:

```css
#overlays.ytd-thumbnail
```

then:

```css
#time-status.ytd-thumbnail-overlay-time-status-renderer
```

then:

```css
#text.ytd-thumbnail-overlay-time-status-renderer
```

The timestamp is read from:

```javascript
timerspan.innerText
```

---

# 10. Timestamp Parsing

Durations are parsed by `parseDurationText()` (shared helper). The code supports:

```text
10:37
```

and:

```text
1:10:35
```

The first is interpreted as:

```text
minutes:seconds
```

The second is interpreted as:

```text
hours:minutes:seconds
```

All durations are converted into seconds.

For example:

```text
10:37
```

becomes:

```text
637 seconds
```

and:

```text
1:10:35
```

becomes:

```text
4235 seconds
```

The seconds are accumulated into:

```text
totalTimeInSec
```

---

# 11. Counting Videos

The code gets the number of currently rendered playlist video elements from:

```javascript
videos.length
```

and assigns that to:

```text
videosCounted
```

It then attempts to determine the total playlist video count from:

```css
.metadata-stats
```

and:

```css
.yt-formatted-string
```

The value is converted to a number.

Then:

```text
videosNotCounted = totalVideos - videosCounted
```

This is intended to represent playlist videos that exist in the playlist but have not yet been rendered/countable in the current DOM.

This behavior depends heavily on YouTube's current DOM and metadata structure.

---

# 12. Default Playback Speed

The initial selected scale is set to:

```text
1
```

if no scale has previously been selected.

Therefore the default display represents normal:

```text
1x
```

playback.

---

# 13. Supported Playback Speeds

The injected dropdown currently supports:

```text
0.25x
0.5x
0.75x
1x
1.25x
1.5x
1.75x
2x
```

The option labelled `Normal` corresponds to:

```text
1x
```

---

# 14. Duration Scaling

The function:

```javascript
scaleDuration(scaleVal)
```

calculates:

```text
ceil(totalTimeInSec / scaleVal)
```

This models the approximate amount of real-world viewing time required when watching at the selected playback speed.

Examples:

```text
1x  → total duration / 1
2x  → total duration / 2
0.5x → total duration / 0.5
```

The result is rounded up using `Math.ceil()`.

---

# 15. Converting Seconds to Days/Hours/Minutes/Seconds

The function:

```javascript
secToDayHrMinSec(sec)
```

converts total seconds into:

```text
days
hours
minutes
seconds
```

It first converts seconds to minutes, then minutes to hours, then hours to days.

For example, a large playlist duration can be represented as:

```text
2 days
3 hours
3 mins
2 sec
```

Only non-zero units are rendered in the injected duration display.

---

# 16. Injected UI

The extension injects a container with the ID:

```text
yt-study-buddy-stats
```

into the YouTube page.

The injected UI contains:

### Playback-speed selector

```text
#durationSelect
```

### Duration display

```text
.duration
```

### Counted videos

```text
Videos Counted
```

### Not-counted videos

```text
Videos NOT Counted
```

### Conditional scrolling message

When videos remain uncounted, it displays:

```text
Scroll down to count more videos
```

with arrow SVGs.

---

# 17. Where the UI Is Injected

The extension looks for:

```text
.metadata-wrapper
```

It then inserts the extension UI after:

```text
metaDataDiv.children[2]
```

This is another area that depends on YouTube's current DOM structure.

Before injecting the UI, the extension removes an existing:

```text
#yt-study-buddy-stats
```

element if present.

This prevents duplicate copies of the injected UI during repeated calculations.

---

# 18. Playback Selector Interaction

Because the injected selector is dynamically created, the code uses event delegation.

A document-level `change` listener checks whether:

```text
event.target.id === "durationSelect"
```

When it is, the selected scale is read and the duration display is recalculated.

The code does not change the actual YouTube playback speed.

Important distinction:

**The extension calculates the estimated viewing duration for a selected playback speed. It does not currently control the video's playback speed.**

---

# 19. MutationObserver

The extension creates a:

```javascript
MutationObserver
```

when the page is identified as a playlist.

It observes:

```text
document.body
```

with:

```text
childList: true
subtree: true
```

The purpose is to detect dynamically rendered YouTube playlist content.

When a relevant mutation is observed (legacy `ytd-thumbnail-overlay-time-status-renderer`, `yt-lockup-view-model`, or thumbnail `badge-shape`), the extension **debounces** (200ms) and then calls `retrieveTimestamps()`.

On playlist setup, `main()` also calls `retrieveTimestamps()` **immediately** so the panel appears without waiting for a mutation.

This is necessary because YouTube dynamically loads/renders content rather than putting the complete playlist DOM into the page immediately.

Module-level teardown disconnects the observer and removes document listeners before `main()` runs again (SPA navigation / repeated `pageReloaded`).

---

# 20. Important Existing MutationObserver TODO

The source itself contains a comment indicating a known issue:

The observer currently reacts when the first timestamp element is rendered rather than explicitly waiting for the last relevant timestamp element.

The existing code therefore does not guarantee that every playlist video has been loaded before the first duration calculation.

This is a known limitation and should not be silently "fixed" by an AI agent unless requested.

---

# 21. beforeunload Handling

The code registers a:

```text
beforeunload
```

listener.

When the page is refreshed or closed, it disconnects the MutationObserver.

This is intended to prevent the observer from continuing to operate after the page is being unloaded.

---

# 22. Scroll-to-Load Behavior

If:

```text
videosNotCounted !== 0
```

the extension displays:

```text
Scroll down to count more videos
```

The click handler attempts to scroll down automatically.

It calculates:

```text
videoCardHeight * (videosCounted + videosNotCounted)
```

and uses:

```javascript
window.scrollTo({
  top: scrollHeight,
  behavior: "smooth"
});
```

The purpose is to trigger YouTube's lazy-loading/pagination behavior so more playlist videos become available in the DOM.

---

# 23. Existing Scroll Logic TODO

The source contains a comment:

```text
NEED TO WRITE ITS DEFINITION
```

around the scrolling logic.

The current implementation is therefore an early implementation rather than a finalized robust lazy-loading system.

Do not assume it works perfectly for every playlist size.

---

# 24. Event Handler Condition

The current click handler checks for:

```text
.scroll-msg
#scroll-text
#scroll-icon
```

There are multiple SVG elements with the same:

```text
id="scroll-icon"
```

inside the generated HTML.

Duplicate IDs are invalid HTML semantics and may be worth addressing in a future cleanup, but should not be changed merely as part of README/setup work.

---

# 25. popup.html

The current extension popup is extremely minimal.

It contains:

```text
Youtube Study-Buddy Extension
```

as the HTML title and currently displays:

```text
HI
```

in the popup body.

It loads:

```text
styles.css
```

and:

```text
popup.js
```

with `defer`.

---

# 26. popup.js

`popup.js` is currently empty.

There is no implemented popup functionality.

Therefore, do not document a feature-rich popup.

The extension's current useful functionality is primarily injected directly into YouTube playlist pages.

---

# 27. styles.css

`styles.css` contains styles for the injected YouTube UI.

Main styled elements/classes include:

```text
#yt-study-buddy-stats
.durationSelector
.duration
#durationSelect
.videosCounted
.videosNotCounted
.scroll-msg
```

The CSS controls:

- layout
- spacing
- typography
- gradients
- dropdown styling
- count display
- scrolling prompt
- SVG sizing
- hover behavior

The extension uses CSS gradients for the duration and video-count displays.

---

# 28. package-lock.json

The repository contains a very minimal:

```text
package-lock.json
```

with:

```json
{
  "lockfileVersion": 1
}
```

There is no meaningful dependency setup visible in the current project.

There is no current package.json in the supplied repository.

Therefore:

**Do not tell users to run `npm install` unless a future change introduces an actual package.json/dependency requirement.**

The current extension can be loaded directly into Chrome without a Node.js build step.

---

# 29. notes.txt

`notes.txt` contains reference links to other YouTube playlist calculator extensions/repositories.

These are reference material for the project and may have influenced the implementation.

They should not be treated as runtime dependencies.

---

# 30. Current Runtime Architecture

The current runtime flow is approximately:

```text
Chrome loads the extension
        ↓
Manifest registers content script + background service worker
        ↓
YouTube page loads
        ↓
contentScript.js starts
        ↓
content script sends "contentScriptReady"
        ↓
background.js receives the message
        ↓
background listens for tab URL/page updates
        ↓
content script detects playlist page
        ↓
MutationObserver watches YouTube DOM
        ↓
playlist video elements become available
        ↓
retrieveTimestamps()
        ↓
extract timestamps
        ↓
convert timestamps to seconds
        ↓
calculate total playlist duration
        ↓
calculate videos counted / not counted
        ↓
inject YT Study-Buddy UI
        ↓
user selects playback speed
        ↓
duration is recalculated
        ↓
if videos remain unloaded:
"Scroll down to count more videos"
        ↓
user clicks scroll message
        ↓
page scrolls to trigger more YouTube content loading
        ↓
MutationObserver detects new content
        ↓
duration is recalculated
```

This is the conceptual runtime flow. Always verify exact behavior against the source before changing it.

---

# 31. Current Project Characteristics

The project is currently:

- Chrome-specific
- Manifest V3
- Plain JavaScript
- Plain CSS
- No frontend framework
- No bundler
- No build process
- No automated test suite
- Dependent on YouTube's DOM structure
- Dependent on YouTube's playlist metadata structure
- Designed primarily for YouTube playlist pages

---

# 32. Important YouTube DOM Dependency

A major architectural characteristic is that the extension directly queries YouTube's DOM using selectors such as:

```text
yt-lockup-view-model, ytd-lockup-view-model
badge-shape.ytBadgeShapeThumbnailBadge
ytd-playlist-video-renderer #content
#overlays.ytd-thumbnail
#time-status.ytd-thumbnail-overlay-time-status-renderer
#text.ytd-thumbnail-overlay-time-status-renderer
.metadata-stats
.yt-formatted-string
.metadata-wrapper
```

YouTube can change its DOM structure without notice.

Therefore, a future breakage could occur even if the extension's own JavaScript has not changed.

When debugging a future issue, inspect the current YouTube DOM before assuming the calculation logic itself is wrong.

---

# 33. No Build Step

The current extension does not require:

```text
npm run build
```

or a bundler.

The source files are directly consumed by Chrome.

For local development:

```text
chrome://extensions/
→ Developer mode
→ Load unpacked
→ select the directory containing manifest.json
```

After modifying source files, the extension normally needs to be reloaded from the Chrome Extensions page and the YouTube page may need to be refreshed.

---

# 34. GitHub and Chrome Web Store Are Separate

The project source can be maintained in GitHub.

A typical development flow is:

```text
GitHub
   ↓
clone
   ↓
Cursor
   ↓
local changes
   ↓
Chrome Load Unpacked
   ↓
test
   ↓
git commit
   ↓
git push
   ↓
GitHub updated
```

This does NOT automatically mean that the Chrome Web Store is updated.

Chrome Web Store publishing is a separate release process unless an explicit publishing automation pipeline is configured.

---

# 35. Chrome Web Store Packaging

Because the current project has no build system, a release package can conceptually contain the extension source files required by Chrome, including:

```text
manifest.json
background.js
contentScript.js
popup.html
popup.js
styles.css
icons/
```

The package should not include development metadata such as:

```text
.git/
node_modules/
IDE-specific files
temporary files
OS metadata
```

Do not invent additional packaging requirements. Current Chrome Web Store requirements should be checked against official Google/Chrome documentation when preparing an actual release.

---

# 36. Current Known Limitations

The following limitations are visible in the current source:

1. YouTube DOM selectors may break when YouTube changes its markup.
2. The MutationObserver may react before all playlist videos have been loaded.
3. Playlist videos may be lazily loaded.
4. The scroll-to-load strategy is basic.
5. The popup is currently only a placeholder.
6. popup.js is empty.
7. There is no automated test suite.
8. There is no build pipeline.
9. There is no visible CI/CD pipeline.
10. The extension currently calculates playback duration but does not control actual YouTube playback speed.
11. The implementation relies on specific YouTube DOM selectors (lockup and legacy paths).
12. The current video count extraction assumes a particular `.metadata-stats` / `.yt-formatted-string` structure.
13. Scroll-to-load math is still basic (see comment in `contentScript.js`).

These should be treated as known project characteristics, not as instructions to fix them automatically.

---

# 37. Future Development Guidance

When an AI coding agent modifies this project:

### First

Read:

```text
PROJECT EXPLANATION.md
```

Then inspect the actual source code.

### Second

Understand the requested change and identify which existing files are affected.

### Third

Make the smallest reasonable change.

### Fourth

Preserve existing behavior unless the task explicitly asks to change it.

### Fifth

Test the extension locally in Chrome.

### Sixth

Check for console errors and extension errors.

### Seventh

Commit changes to Git with a meaningful message.

---

# 38. Source of Truth

For the current implementation, use this priority order:

```text
1. Actual source code
2. manifest.json
3. PROJECT EXPLANATION.md
4. README.md
5. notes.txt
6. AI assumptions
```

If this document conflicts with the source code, inspect the source and update the documentation rather than blindly trusting this file.

The AI agent must not invent functionality that is not implemented.

---

# 39. What This Project Is NOT Yet

The current repository should NOT be described as:

- a React application
- a TypeScript application
- a Vite project
- a production-grade Chrome extension framework
- an automated Chrome Web Store deployment pipeline
- a full YouTube study platform
- an extension that changes YouTube playback speed

Those may be future directions, but they are not the current implementation.

---

# 40. Intended Role of This File

`PROJECT EXPLANATION.md` is an AI-context/documentation file.

Its purpose is to allow a coding agent such as Cursor to quickly understand:

- what the project is
- how it works
- what each file does
- what assumptions it makes
- what is currently implemented
- what is not implemented
- what known issues exist
- how the pieces communicate

Any future major architectural change should be reflected in this file.
