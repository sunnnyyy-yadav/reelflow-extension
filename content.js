/**
 * ReelFlow AI — Instagram Reels Content Script
 * Engine: Browser-side video playback detection & synthetic navigation
 * Safari & Chrome MV3 compatible
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__REELFLOW_LOADED__) return;
  window.__REELFLOW_LOADED__ = true;

  console.log('[ReelFlow AI] Content script active on Instagram');

  // Default configuration
  let config = {
    autoScrollEnabled: true,
    mode: 'video-end', // 'video-end' | 'smart-adaptive' | 'fixed-timer'
    fixedDuration: 8,
    speed: 'smooth',
    minWatchDuration: 2,
    maxWatchCap: 35,
    skipSponsored: true,
    autoUnmute: false,
    soundVolume: 70,
    showOverlayHud: true
  };

  // State
  let currentVideo = null;
  let scrollTimeout = null;
  let countdownTimer = null;
  let remainingSeconds = 0;
  let isScrolling = false;
  let isHovered = false;
  let hudElement = null;

  // Load saved settings from extension storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['reelflow_settings'], (result) => {
      if (result.reelflow_settings) {
        config = { ...config, ...result.reelflow_settings };
      }
      createOrUpdateHUD();
      initObserver();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.reelflow_settings) {
        config = { ...config, ...changes.reelflow_settings.newValue };
        createOrUpdateHUD();
        triggerEvaluator();
      }
    });
  } else {
    initObserver();
    createOrUpdateHUD();
  }

  // Find currently active reel in viewport
  function getActiveVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    let bestVideo = null;
    let maxVisibleRatio = 0;

    const viewportHeight = window.innerHeight;

    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const ratio = visibleHeight / Math.min(rect.height || viewportHeight, viewportHeight);

      if (ratio > maxVisibleRatio && ratio > 0.4) {
        maxVisibleRatio = ratio;
        bestVideo = v;
      }
    }

    return bestVideo;
  }

  // Check if current reel is sponsored/ad
  function isReelSponsored(videoEl) {
    if (!videoEl) return false;
    // Look up the closest article or container
    const container = videoEl.closest('article') || videoEl.closest('div[role="region"]') || videoEl.parentElement?.parentElement;
    if (!container) return false;

    // Instagram uses text 'Sponsored' or 'Paid partnership' or specific SVG tags
    const textContent = container.innerText || '';
    if (/\b(Sponsored|Paid partnership)\b/i.test(textContent)) {
      return true;
    }

    const sponsoredSvg = container.querySelector('[aria-label="Sponsored"], [aria-label="Paid partnership"]');
    return !!sponsoredSvg;
  }

  // Trigger scroll to next reel
  function advanceToNextReel(reason = 'completed') {
    if (isScrolling) return;
    isScrolling = true;

    clearTimers();
    updateHUDStatus('Advancing...', '#00f5d4');

    // 1. First attempt: Synthetic ArrowDown keyboard event (Instagram Reels native shortcut)
    const keyEventOptions = {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
      composed: true
    };

    document.dispatchEvent(new KeyboardEvent('keydown', keyEventOptions));
    window.dispatchEvent(new KeyboardEvent('keydown', keyEventOptions));

    // 2. Second attempt: Target the next button or scroll container if ArrowDown is prevented
    setTimeout(() => {
      // Find Instagram's native next arrow button
      const nextBtn = document.querySelector('svg[aria-label="Down arrow"], svg[aria-label="Next"]')?.closest('button');
      if (nextBtn) {
        nextBtn.click();
      } else {
        // Fallback smooth scroll
        window.scrollBy({
          top: window.innerHeight * 0.9,
          behavior: config.speed === 'turbo' ? 'auto' : 'smooth'
        });
      }

      // Record event in extension storage for telemetry
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'reel_scrolled',
          reason: reason
        }).catch(() => {});
      }

      setTimeout(() => {
        isScrolling = false;
        triggerEvaluator();
      }, 600);
    }, 100);
  }

  function clearTimers() {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  // Calculate target duration for current reel
  function calculateTargetDuration(video) {
    const vidDuration = video.duration && !isNaN(video.duration) && video.duration > 0 ? video.duration : 10;

    if (config.mode === 'fixed-timer') {
      return config.fixedDuration;
    }

    if (config.mode === 'smart-adaptive') {
      // Adaptive curve: shorter reels get full play, long reels capped gracefully
      if (vidDuration <= 15) return vidDuration;
      return Math.min(vidDuration, config.maxWatchCap);
    }

    // Default 'video-end' mode
    return Math.max(vidDuration, config.minWatchDuration);
  }

  // Setup listeners on active video
  function attachVideoListeners(video) {
    if (!video || video === currentVideo) return;

    if (currentVideo) {
      currentVideo.removeEventListener('ended', onVideoEnded);
      currentVideo.removeEventListener('timeupdate', onTimeUpdate);
    }

    currentVideo = video;
    clearTimers();

    // Auto-unmute if requested
    if (config.autoUnmute && video.muted) {
      video.muted = false;
      video.volume = config.soundVolume / 100;
    }

    // Check if reel is sponsored
    if (config.skipSponsored && isReelSponsored(video)) {
      updateHUDStatus('Ad Skipped! ⚡️', '#f59e0b');
      scrollTimeout = setTimeout(() => {
        advanceToNextReel('skipped-sponsored');
      }, 400);
      return;
    }

    video.addEventListener('ended', onVideoEnded);
    video.addEventListener('timeupdate', onTimeUpdate);

    scheduleAutoAdvance(video);
  }

  function scheduleAutoAdvance(video) {
    if (!config.autoScrollEnabled) {
      updateHUDStatus('Auto-Scroll PAUSED', '#94a3b8');
      return;
    }

    clearTimers();

    const targetSec = calculateTargetDuration(video);
    remainingSeconds = targetSec;

    countdownTimer = setInterval(() => {
      if (isHovered && config.pauseOnHover) {
        updateHUDStatus('Paused (Hover)', '#38bdf8');
        return;
      }

      if (video.paused) {
        updateHUDStatus('Video Paused', '#64748b');
        return;
      }

      // Check current progress
      const currentPos = video.currentTime || 0;
      const progress = Math.min(100, (currentPos / (targetSec || 1)) * 100);
      const timeLeft = Math.max(0, targetSec - currentPos).toFixed(1);

      updateHUDCountdown(timeLeft, progress);

      // Trigger condition
      if (currentPos >= targetSec - 0.25 && currentPos > config.minWatchDuration) {
        clearTimers();
        advanceToNextReel('timer-reached');
      }
    }, 150);
  }

  function onVideoEnded() {
    if (config.autoScrollEnabled && !isScrolling) {
      setTimeout(() => advanceToNextReel('video-ended'), 300);
    }
  }

  function onTimeUpdate() {
    // If video looped back to start (Instagram loops reels)
    if (currentVideo && currentVideo.currentTime < 0.3 && currentVideo.currentTime > 0) {
      if (config.autoScrollEnabled && config.mode === 'video-end') {
        // Video finished and looped: advance immediately
        advanceToNextReel('loop-detected');
      }
    }
  }

  function triggerEvaluator() {
    const video = getActiveVideo();
    if (video) {
      attachVideoListeners(video);
    }
  }

  // Setup DOM / Scroll Observer
  function initObserver() {
    let scrollDebounce = null;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(triggerEvaluator, 180);
    }, { passive: true });

    // Also observe DOM modifications (Instagram is a SPA)
    const observer = new MutationObserver(() => {
      triggerEvaluator();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Check periodically
    setInterval(triggerEvaluator, 1500);
  }

  // Inject sleek floating ReelFlow HUD
  function createOrUpdateHUD() {
    if (!config.showOverlayHud) {
      if (hudElement) hudElement.style.display = 'none';
      return;
    }

    if (!hudElement) {
      hudElement = document.createElement('div');
      hudElement.id = 'reelflow-floating-hud';
      hudElement.innerHTML = `
        <div class="rf-badge-inner">
          <div class="rf-header">
            <span class="rf-glow-dot"></span>
            <span class="rf-title">ReelFlow AI</span>
            <button id="rf-toggle-btn" class="rf-icon-btn" title="Toggle Auto-Scroll">⚡️</button>
          </div>
          <div class="rf-timer-row">
            <div class="rf-progress-bar"><div id="rf-bar-fill" class="rf-bar-fill"></div></div>
            <span id="rf-time-left" class="rf-time-text">--</span>
          </div>
          <div id="rf-status" class="rf-status">Active</div>
        </div>
      `;

      document.body.appendChild(hudElement);

      hudElement.addEventListener('mouseenter', () => { isHovered = true; });
      hudElement.addEventListener('mouseleave', () => { isHovered = false; });

      const toggleBtn = hudElement.querySelector('#rf-toggle-btn');
      toggleBtn?.addEventListener('click', () => {
        config.autoScrollEnabled = !config.autoScrollEnabled;
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ reelflow_settings: config });
        }
        createOrUpdateHUD();
        triggerEvaluator();
      });
    }

    hudElement.style.display = 'block';
    const statusEl = hudElement.querySelector('#rf-status');
    if (statusEl) {
      statusEl.textContent = config.autoScrollEnabled ? `Mode: ${config.mode}` : 'PAUSED (Alt+S)';
      statusEl.style.color = config.autoScrollEnabled ? '#22d3ee' : '#94a3b8';
    }
  }

  function updateHUDStatus(text, color = '#22d3ee') {
    if (!hudElement) return;
    const statusEl = hudElement.querySelector('#rf-status');
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.style.color = color;
    }
  }

  function updateHUDCountdown(seconds, percent) {
    if (!hudElement) return;
    const timeEl = hudElement.querySelector('#rf-time-left');
    const fillEl = hudElement.querySelector('#rf-bar-fill');

    if (timeEl) timeEl.textContent = `${seconds}s`;
    if (fillEl) fillEl.style.width = `${percent}%`;
  }

  // Keyboard shortcut listener
  window.addEventListener('keydown', (e) => {
    // Alt + S to toggle
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      config.autoScrollEnabled = !config.autoScrollEnabled;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ reelflow_settings: config });
      }
      createOrUpdateHUD();
      triggerEvaluator();
    }
  });

  // Listen for popup messages
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'toggle') {
        config.autoScrollEnabled = msg.enabled;
        createOrUpdateHUD();
        triggerEvaluator();
        sendResponse({ success: true, enabled: config.autoScrollEnabled });
      } else if (msg.action === 'skip') {
        advanceToNextReel('manual-skip');
        sendResponse({ success: true });
      } else if (msg.action === 'get_status') {
        sendResponse({
          enabled: config.autoScrollEnabled,
          mode: config.mode,
          hasVideo: !!currentVideo
        });
      }
    });
  }

  // Kickstart initial check
  setTimeout(triggerEvaluator, 1000);
})();
