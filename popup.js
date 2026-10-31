// ReelFlow AI Safari / Chrome popup controller

document.addEventListener('DOMContentLoaded', () => {
  const masterToggle = document.getElementById('master-toggle');
  const durationSlider = document.getElementById('duration-slider');
  const durationVal = document.getElementById('duration-val');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const skipSponsored = document.getElementById('skip-sponsored');
  const autoUnmute = document.getElementById('auto-unmute');
  const pauseHover = document.getElementById('pause-hover');
  const skipNowBtn = document.getElementById('skip-now-btn');
  const openDashboardBtn = document.getElementById('open-dashboard-btn');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');

  let currentSettings = {
    autoScrollEnabled: true,
    mode: 'video-end',
    fixedDuration: 8,
    speed: 'smooth',
    skipSponsored: true,
    autoUnmute: false,
    pauseOnHover: true
  };

  // 1. Load initial settings
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['reelflow_settings'], (result) => {
      if (result.reelflow_settings) {
        currentSettings = { ...currentSettings, ...result.reelflow_settings };
      }
      applyToUI();
    });
  }

  function applyToUI() {
    masterToggle.checked = currentSettings.autoScrollEnabled;
    durationSlider.value = currentSettings.fixedDuration;
    durationVal.textContent = currentSettings.fixedDuration + 's';
    skipSponsored.checked = currentSettings.skipSponsored;
    autoUnmute.checked = currentSettings.autoUnmute;
    pauseHover.checked = currentSettings.pauseOnHover;

    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === currentSettings.mode);
    });

    updateStatusBadge();
  }

  function updateStatusBadge() {
    if (currentSettings.autoScrollEnabled) {
      statusText.textContent = 'ACTIVE';
      statusPill.style.color = '#00f5d4';
      statusPill.style.borderColor = 'rgba(0, 245, 212, 0.4)';
    } else {
      statusText.textContent = 'PAUSED';
      statusPill.style.color = '#94a3b8';
      statusPill.style.borderColor = 'rgba(148, 163, 184, 0.3)';
    }
  }

  function saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ reelflow_settings: currentSettings });
    }
    updateStatusBadge();

    // Broadcast to active tab
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggle',
            enabled: currentSettings.autoScrollEnabled
          }).catch(() => {});
        }
      });
    }
  }

  masterToggle.addEventListener('change', () => {
    currentSettings.autoScrollEnabled = masterToggle.checked;
    saveSettings();
  });

  durationSlider.addEventListener('input', () => {
    currentSettings.fixedDuration = parseInt(durationSlider.value, 10);
    durationVal.textContent = currentSettings.fixedDuration + 's';
    saveSettings();
  });

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.mode = btn.getAttribute('data-mode');
      saveSettings();
    });
  });

  skipSponsored.addEventListener('change', () => {
    currentSettings.skipSponsored = skipSponsored.checked;
    saveSettings();
  });

  autoUnmute.addEventListener('change', () => {
    currentSettings.autoUnmute = autoUnmute.checked;
    saveSettings();
  });

  pauseHover.addEventListener('change', () => {
    currentSettings.pauseOnHover = pauseHover.checked;
    saveSettings();
  });

  skipNowBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'skip' }).catch(() => {});
        }
      });
    }
  });

  openDashboardBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'https://aladdin-ai.net' });
    } else {
      window.open('/', '_blank');
    }
  });
});
