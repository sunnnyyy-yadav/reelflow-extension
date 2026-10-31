// ReelFlow AI Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('[ReelFlow AI] Extension installed successfully.');
  chrome.storage.local.set({
    reelflow_settings: {
      autoScrollEnabled: true,
      mode: 'video-end',
      fixedDuration: 8,
      speed: 'smooth',
      minWatchDuration: 2,
      maxWatchCap: 35,
      skipSponsored: true,
      autoUnmute: false,
      soundVolume: 70,
      pauseOnHover: true,
      showOverlayHud: true
    }
  });
});

// Keyboard Command Shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-autoscroll') {
    chrome.storage.local.get(['reelflow_settings'], (result) => {
      const current = result.reelflow_settings || {};
      const newEnabled = !current.autoScrollEnabled;
      const updated = { ...current, autoScrollEnabled: newEnabled };

      chrome.storage.local.set({ reelflow_settings: updated }, () => {
        // Broadcast to tabs
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'toggle',
              enabled: newEnabled
            }).catch(() => {});
          }
        });
      });
    });
  } else if (command === 'skip-reel') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'skip' }).catch(() => {});
      }
    });
  }
});

// Telemetry & Badge Update
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'reel_scrolled') {
    // Update badge or count
    sendResponse({ received: true });
  }
});
