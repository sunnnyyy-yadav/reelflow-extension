# ReelFlow AI — Safari Web Extension Guide

Welcome to ReelFlow AI for Safari and Chromium browsers.

## Option 1: Load directly into Safari on macOS

Apple uses standard WebExtensions (Manifest V3) converted via Xcode command line tools.

### Step 1: Open Terminal and run the Apple converter
Run this single command pointing to your extracted `reelflow-extension` folder:

```bash
xcrun safari-web-extension-converter /path/to/reelflow-extension --app-name "ReelFlow AI"
```

### Step 2: Open and Build in Xcode
1. A new Xcode project titled **ReelFlow AI** will open.
2. Select your development team under **Signing & Capabilities** (free personal Apple ID works).
3. Click the **Run ▶** button to build the macOS companion app.

### Step 3: Enable in Safari
1. Open **Safari**.
2. Go to **Settings** (⌘,) → **Advanced**.
3. Check the box: **"Show Develop menu in menu bar"**.
4. In the Safari menu bar, click **Develop** → **Allow Unsigned Extensions**.
5. Go to **Safari Settings** → **Extensions**, and check **ReelFlow AI**.
6. Set permission to **"Always Allow on instagram.com"**.

---

## Option 2: Test in Google Chrome / Brave / Edge (Developer Mode)

1. Open `chrome://extensions` in your browser.
2. Toggle on **Developer Mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `reelflow-extension` folder.
5. Navigate to `https://www.instagram.com/reels` and enjoy hands-free auto-scrolling!

---

## Default Keyboard Shortcuts
- **Alt + S** (Mac: **⌘ + Shift + R**): Toggle Auto-Scroll ON/OFF
- **Alt + J** (Mac: **⌘ + Shift + Down**): Skip to next Reel immediately
- **L**: Quick Like current reel
