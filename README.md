# YT Study-Buddy Extension

A Chrome **Manifest V3** extension that calculates **YouTube playlist watch time** from the visible playlist DOM. Open the toolbar **popup** on a playlist tab to see total duration, playback-speed estimates, and counted / not-counted videos. The content script can scroll the playlist tab to load more lazy-loaded rows.

There is **no build step**, **no bundler**, and **no npm dependencies**. Source files are loaded directly by Chrome as an unpacked extension.

For deep architectural context (including known quirks), see [`PROJECT EXPLANATION.md`](PROJECT%20EXPLANATION.md). The **source code** remains the ultimate source of truth if anything disagrees.

---

## Overview

When you open a URL that contains `youtube.com/playlist`, the content script:

1. Watches the page for DOM changes (`MutationObserver`).
2. Reads each rendered playlist row’s duration (lockup badges or legacy thumbnail overlays).
3. Compares **videos counted** with the playlist total from page metadata when available.

Click the extension icon to open **`popup.html`** for the same stats, or read them in the **`#yt-study-buddy-stats`** panel injected below the playlist header actions (Play all / Save / Share).

---

## Features

Verified against the current implementation:

| Feature | Description |
|--------|-------------|
| **Playlist duration** | Sums `mm:ss` and `h:mm:ss` timestamps from playlist video thumbnails. |
| **Playback-speed estimates** | Dropdown for 0.25x–2x; duration shown is `ceil(totalSeconds / speed)`. Does **not** change YouTube’s actual playback speed. |
| **Human-readable duration** | Displays days, hours, minutes, and seconds (non-zero units only). |
| **Popup UI** | Toolbar popup shows stats; messaging API: `getPlaylistStats`, `setPlaybackScale`, `scrollPlaylist`. |
| **Videos counted / not counted** | Rendered playlist rows vs total parsed from header/sidebar metadata. |
| **Lazy-loaded playlists** | Popup button scrolls the playlist tab to load more videos; click **Refresh stats** after scrolling. |
| **Modern + legacy YouTube rows** | Reads durations from `yt-lockup-view-model` + `badge-shape` when present; falls back to `ytd-playlist-video-renderer` thumbnail overlays. |
| **Dynamic DOM** | `MutationObserver` on `document.body` debounces and re-runs calculations when lockup rows or legacy timestamp overlays appear. |
| **SPA navigation** | Background service worker notifies the content script on URL changes and page load complete so `main()` runs again. |
| **Manifest V3** | Service worker background, content scripts, action popup, `tabs` permission. |

---

## How It Works

```text
manifest.json
    ├── registers contentScript.js on *://www.youtube.com/*
    ├── registers background.js (service worker)
    └── sets popup.html as the toolbar action

popup.html + popup.js + styles.css
    └── UI; messages active tab content script for stats

contentScript.js
    └── parses YouTube playlist DOM; responds to popup messages

YouTube DOM (selectors)
    └── yt-lockup-view-model + badge-shape (primary), ytd-playlist-video-renderer (fallback)
```

**Messaging:** Popup → content script: `getPlaylistStats`, `setPlaybackScale`, `scrollPlaylist`. Background still forwards `urlChanged` / `pageReloaded` so the content script re-initializes on navigation.

**MutationObserver:** Keeps in-memory stats updated while you stay on a playlist page (popup refresh reads latest values).

**Important:** The extension depends on YouTube’s current DOM structure. If YouTube changes markup, selectors in `contentScript.js` may need updating.

---

## Project Structure

```text
YT-study-buddy-extension/
├── manifest.json          # Manifest V3 config (v1.0, tabs permission)
├── background.js          # Service worker: tab update → content script messages
├── contentScript.js       # Playlist DOM parsing + popup messaging
├── popup.html             # Toolbar popup UI
├── popup.js               # Popup logic (tab messaging)
├── styles.css             # Popup styles
├── notes.txt              # Reference links to similar extensions
├── package-lock.json      # Minimal lockfile only; no package.json / no npm deps
├── PROJECT EXPLANATION.md # Detailed agent/human architecture notes
├── README.md              # This file
└── icons/
    ├── logo-16.png
    ├── logo-32.png
    ├── logo-48.png
    └── logo-128.png
```

---

## Prerequisites

- **Google Chrome** (or another Chromium browser that supports Manifest V3 extensions)
- **Git**
- **Cursor** or **Visual Studio Code** (recommended for editing)
- **Node.js is not required** for this project as it stands (no `package.json`, no build script)

---

## Clone the Repository

```bash
git clone https://github.com/shubhamrawat090/YT-study-buddy-extension.git
cd YT-study-buddy-extension
```

If you already cloned the repo, pull latest changes before you start:

```bash
git pull origin main
```

---

## Local Setup

1. Clone the repo (see above).
2. Open the project folder in Cursor or VS Code (`File → Open Folder`).
3. No install step: there is nothing to compile or bundle.

Optional: add a `.gitignore` locally if you want to exclude OS junk (for example `.DS_Store`) from future commits. The repo does not ship a `.gitignore` today.

---

## Load and Run the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right).
3. Click **Load unpacked**.
4. Select the folder that contains `manifest.json` (the repo root).

You should see **YT Study-Buddy Extension** (version **1.0**) in the list.

### Try it on YouTube

1. Open a YouTube **playlist** page, for example:  
   `https://www.youtube.com/playlist?list=...`
2. Wait for the page to finish loading.
3. Click the **YT Study-Buddy** extension icon in the toolbar to open the popup.

If the popup shows an error:

- Click **Reload** on the extension card in `chrome://extensions/`.
- **Refresh** the YouTube tab, then open the popup again.
- Confirm the URL contains `youtube.com/playlist`.

---

## Develop with Cursor or VS Code

1. Edit files directly (`contentScript.js`, `styles.css`, `manifest.json`, etc.).
2. Save your changes.

After code changes:

1. Go to `chrome://extensions/`.
2. Click the **Reload** icon on **YT Study-Buddy Extension** (required for `manifest.json`, `background.js`, and content script changes).
3. **Refresh** any open YouTube tabs you are testing.

Content scripts and CSS reload when the extension reloads; the YouTube page still needs a refresh to pick up a new content script run in many cases.

---

## Test Changes Locally

Manual testing checklist:

- [ ] Extension loads without errors on `chrome://extensions/` (no “Errors” button).
- [ ] Open a playlist with **many videos** (lazy loading).
- [ ] Popup shows duration, **Videos counted**, and **Videos not counted**.
- [ ] Change playback speed in the dropdown; duration updates (YouTube playback speed unchanged).
- [ ] When **Videos not counted** &gt; 0, use **Scroll playlist to load more**, then **Refresh stats**.
- [ ] Navigate to another playlist, open the popup again, and confirm stats update.

There is **no automated test suite** in this repository.

---

## Commit and Push to GitHub

From the project root:

```bash
git status
git add <files-you-changed>
git commit -m "Describe your change clearly"
git push origin main
```

Use a feature branch and pull request if your team prefers that workflow:

```bash
git checkout -b feature/my-change
# ... commit ...
git push -u origin feature/my-change
```

Then open a PR on GitHub against `main`.

**Remote:** `origin` → `https://github.com/shubhamrawat090/YT-study-buddy-extension.git`

Pushing to GitHub does **not** update the Chrome Web Store listing automatically.

---

## Package a Release

There is no build output folder. Ship the extension source files Chrome needs:

**Include:**

- `manifest.json`
- `background.js`
- `contentScript.js`
- `popup.html`
- `popup.js`
- `styles.css`
- `icons/` (all PNGs)

**Exclude from the zip** (recommended):

- `.git/`
- `node_modules/` (if you ever add them)
- `.DS_Store`, IDE folders, local notes not meant for users
- `PROJECT EXPLANATION.md` / `README.md` / `notes.txt` (optional in the store zip; Chrome does not require them)

### Version number

Before publishing an update, bump `"version"` in `manifest.json` (for example `1.0` → `1.0.1` or `1.1`).

### Create a zip (Windows PowerShell example)

From the repo root, zip only runtime files (adjust paths as needed):

```powershell
Compress-Archive -Path manifest.json,background.js,contentScript.js,popup.html,popup.js,styles.css,icons -DestinationPath YT-study-buddy-extension-v1.0.zip -Force
```

On macOS/Linux, use `zip` similarly, ensuring `manifest.json` is at the **root** of the archive (not inside an extra parent folder unless the store upload expects that layout).

---

## Publish or Update on the Chrome Web Store

GitHub and the Web Store are separate. Typical flow:

1. **Developer account:** Register at the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (one-time registration fee may apply; check current Google policies).
2. **New extension:** **New item** → upload the `.zip` package.
3. **Update existing item:** Open your extension → **Package** → upload a new zip with a **higher** `manifest.json` version.
4. Fill in listing details: name, description, screenshots, category, privacy practices, and permissions justification (`tabs` is used for tab update messaging to the content script).
5. Submit for **review**. Review times vary.

Official references (verify current requirements before submit):

- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Manifest V3 overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

After approval, users receive updates according to Chrome’s extension update mechanism; you still manage source on GitHub independently.

---

## Known Limitations

Documented in code and [`PROJECT EXPLANATION.md`](PROJECT%20EXPLANATION.md):

- **YouTube DOM coupling** — Selectors can break when YouTube changes the site again. Video totals use header/sidebar/metadata text when `.metadata-stats` is absent.
- **Popup-only UI** — Stats appear in the extension popup, not on the YouTube page.
- **Lazy loading** — Only rendered rows contribute to duration; metadata total may exceed counted videos until you scroll.
- **MutationObserver timing** — Debounced recalculation may still run before every playlist video has loaded.
- **Scroll helper** — Basic scroll math; marked as incomplete in source (`NEED TO WRITE ITS DEFINITION`).
- **Popup** — All user-facing stats and controls live in the toolbar popup.
- **No CI/CD, no tests, no build pipeline** in this repo.

---

## Reference Material

- [`notes.txt`](notes.txt) — Links to related playlist calculator extensions and repos (inspiration only, not runtime dependencies).

---

## License

No license file is included in this repository. Add a `LICENSE` file and update this section if you intend to open-source under a specific terms.
