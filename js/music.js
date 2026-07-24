/**
 * Glassmorphism video player — replaces the old MP3 music FAB.
 * Keeps the WeddingMusic API used by main.js (init / unlockAndPlay / play / pause).
 */
(function (global) {
  "use strict";

  const cfg = global.WEDDING_CONFIG || {};
  const MUSIC_START_SECONDS = Math.max(0, Number(cfg.musicStartSeconds) || 0);

  /** @type {HTMLVideoElement|null} */
  let video = null;
  let isPlaying = false;
  let wantSound = false;
  let unlocked = false;
  let hasSeekedStart = false;
  let pausedByVisibility = false;
  let rafId = null;
  let isSeeking = false;
  let lastVolume = 0.6;
  let panelOpen = false;

  function $(id) {
    return document.getElementById(id);
  }

  function els() {
    return {
      root: $("musicFab"),
      toggle: $("musicToggle"),
      panel: $("musicPanel"),
      playBtn: $("vpPlay"),
      progress: $("vpProgress"),
      progressFill: $("vpProgressFill"),
      time: $("vpTime"),
      volume: $("musicVolume"),
      mute: $("vpMute"),
      glare: $("vpGlare"),
      icon: $("musicIcon"),
    };
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function setPlayingUi(playing) {
    isPlaying = playing;
    const { playBtn, toggle, icon } = els();
    if (toggle) {
      toggle.classList.toggle("is-playing", playing);
      toggle.setAttribute(
        "aria-label",
        panelOpen ? "Close music player" : "Open music player"
      );
    }
    if (icon) icon.textContent = playing ? "♫" : "♪";
    if (playBtn) {
      playBtn.classList.toggle("is-playing", playing);
      playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
      const playIcon = playBtn.querySelector(".vp__icon--play");
      const pauseIcon = playBtn.querySelector(".vp__icon--pause");
      if (playIcon) playIcon.hidden = playing;
      if (pauseIcon) pauseIcon.hidden = !playing;
    }
  }

  function updateMuteUi(muted) {
    const { mute } = els();
    if (!mute) return;
    mute.classList.toggle("is-muted", muted);
    mute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    const speaker = mute.querySelector(".vp__icon--speaker");
    const mutedIcon = mute.querySelector(".vp__icon--muted");
    if (speaker) speaker.hidden = muted;
    if (mutedIcon) mutedIcon.hidden = !muted;
  }

  function seekToConfiguredStart() {
    if (!video || hasSeekedStart || MUSIC_START_SECONDS <= 0) return;
    const apply = () => {
      if (hasSeekedStart || !video) return;
      try {
        if (video.duration && MUSIC_START_SECONDS < video.duration) {
          video.currentTime = MUSIC_START_SECONDS;
        }
        hasSeekedStart = true;
      } catch (_) {
        /* wait for more data */
      }
    };
    if (video.readyState >= 1) apply();
    else video.addEventListener("loadedmetadata", apply, { once: true });
  }

  function syncProgress() {
    if (!video || isSeeking) return;
    const { progress, progressFill, time } = els();
    const dur = video.duration || 0;
    const cur = video.currentTime || 0;
    const pct = dur > 0 ? (cur / dur) * 1000 : 0;
    if (progress) progress.value = String(Math.round(pct));
    if (progressFill) progressFill.style.width = dur > 0 ? (cur / dur) * 100 + "%" : "0%";
    if (time) time.textContent = formatTime(cur) + " / " + formatTime(dur);
  }

  function startProgressLoop() {
    cancelProgressLoop();
    const tick = () => {
      syncProgress();
      if (video && !video.paused) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function cancelProgressLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function playVideo(withSound) {
    if (!video) return Promise.reject();
    seekToConfiguredStart();

    if (withSound) {
      video.muted = false;
      wantSound = true;
      const { volume } = els();
      const pct = volume ? Number(volume.value) : lastVolume * 100;
      video.volume = Math.max(0, Math.min(1, pct / 100));
      lastVolume = video.volume || lastVolume;
      updateMuteUi(false);
    } else {
      video.muted = true;
      updateMuteUi(true);
    }

    return video.play().then(() => {
      setPlayingUi(true);
      startProgressLoop();
    });
  }

  function pauseAll() {
    wantSound = false;
    pausedByVisibility = false;
    if (video) video.pause();
    setPlayingUi(false);
    cancelProgressLoop();
    syncProgress();
  }

  function pauseForVisibility() {
    if (!video) return;
    const wasWant = wantSound || (!video.paused && !video.muted);
    if (video.paused && !wasWant) return;
    pausedByVisibility = wantSound;
    video.pause();
    setPlayingUi(false);
    cancelProgressLoop();
  }

  function resumeFromVisibility() {
    if (!pausedByVisibility || !wantSound) {
      pausedByVisibility = false;
      return;
    }
    pausedByVisibility = false;
    playVideo(true).catch(() => {
      /* user can retry */
    });
  }

  function bindVisibilityPause() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForVisibility();
      else resumeFromVisibility();
    });
    window.addEventListener("pagehide", pauseForVisibility);
  }

  function setVolume(pct) {
    if (!video) return;
    const v = Math.max(0, Math.min(100, Number(pct))) / 100;
    video.volume = v;
    if (v > 0) {
      lastVolume = v;
      video.muted = false;
      updateMuteUi(false);
    } else {
      video.muted = true;
      updateMuteUi(true);
    }
    const { volume } = els();
    if (volume && Number(volume.value) !== Math.round(v * 100)) {
      volume.value = String(Math.round(v * 100));
    }
  }

  function toggleMute() {
    if (!video) return;
    if (video.muted || video.volume === 0) {
      video.muted = false;
      const restore = lastVolume > 0 ? lastVolume : 0.6;
      setVolume(restore * 100);
    } else {
      lastVolume = video.volume || lastVolume;
      video.muted = true;
      updateMuteUi(true);
    }
  }

  function togglePlay() {
    if (!video) return;
    if (video.paused) {
      unlocked = true;
      playVideo(true).catch(() => playVideo(false));
    } else {
      // Pause but keep wantSound so launcher state can resume
      wantSound = true;
      video.pause();
      setPlayingUi(false);
      cancelProgressLoop();
      syncProgress();
    }
  }

  function openPanel() {
    const { panel, toggle } = els();
    if (!panel) return;
    panel.hidden = false;
    panelOpen = true;
    if (toggle) toggle.setAttribute("aria-expanded", "true");
    // Trigger enter animation
    requestAnimationFrame(() => {
      panel.classList.add("is-open");
    });
  }

  function closePanel() {
    const { panel, toggle } = els();
    if (!panel) return;
    panel.classList.remove("is-open");
    panelOpen = false;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    window.setTimeout(() => {
      if (!panelOpen) panel.hidden = true;
    }, 280);
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function showFab() {
    const { root } = els();
    if (root) root.hidden = false;
  }

  /** Door-open gesture — unmute + play from configured start */
  function unlockAndPlay() {
    wantSound = true;
    unlocked = true;
    showFab();
    // Keep panel closed during cinematic; guest opens with ♪
    playVideo(true).catch(() => {
      playVideo(false).catch(() => {
        /* idle until user taps */
      });
    });
  }

  function play() {
    wantSound = true;
    unlocked = true;
    return playVideo(true);
  }

  function bindGlare() {
    const { panel, glare } = els();
    if (!panel || !glare) return;
    panel.addEventListener("pointermove", (e) => {
      const rect = panel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      glare.style.left = x + "px";
      glare.style.top = y + "px";
    });
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (!panelOpen || !video) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        syncProgress();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        video.currentTime = Math.min(
          video.duration || video.currentTime + 5,
          video.currentTime + 5
        );
        syncProgress();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setVolume((video.volume || 0) * 100 + 5);
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setVolume((video.volume || 0) * 100 - 5);
      } else if (e.code === "Escape") {
        closePanel();
      }
    });
  }

  function init() {
    video = /** @type {HTMLVideoElement|null} */ ($("bgMusic"));
    const {
      toggle,
      panel,
      playBtn,
      progress,
      volume,
      mute,
    } = els();

    if (video) {
      video.controls = false;
      video.disablePictureInPicture = true;
      const pct = volume ? Number(volume.value) : 60;
      lastVolume = pct / 100;
      video.volume = lastVolume;
      video.muted = true;
    }

    bindVisibilityPause();
    bindGlare();
    bindKeyboard();

    if (toggle) {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePanel();
      });
    }

    if (playBtn) {
      playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlay();
      });
    }

    if (video) {
      video.addEventListener("click", (e) => {
        e.preventDefault();
        togglePlay();
      });
      video.addEventListener("play", () => {
        setPlayingUi(true);
        startProgressLoop();
      });
      video.addEventListener("pause", () => {
        setPlayingUi(false);
        cancelProgressLoop();
        syncProgress();
      });
      video.addEventListener("loadedmetadata", syncProgress);
      video.addEventListener("ended", () => {
        // loop attribute handles restart; keep UI in sync
        setPlayingUi(true);
      });
    }

    if (progress) {
      progress.addEventListener("pointerdown", () => {
        isSeeking = true;
      });
      progress.addEventListener("pointerup", () => {
        isSeeking = false;
      });
      progress.addEventListener("input", () => {
        if (!video || !video.duration) return;
        const ratio = Number(progress.value) / 1000;
        video.currentTime = ratio * video.duration;
        const { progressFill, time } = els();
        if (progressFill) progressFill.style.width = ratio * 100 + "%";
        if (time) {
          time.textContent =
            formatTime(video.currentTime) + " / " + formatTime(video.duration);
        }
      });
      progress.addEventListener("change", () => {
        isSeeking = false;
        if (!video.paused) startProgressLoop();
      });
    }

    if (volume) {
      volume.addEventListener("input", () => setVolume(volume.value));
    }

    if (mute) {
      mute.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleMute();
      });
    }

    // Click outside closes panel (playback continues)
    document.addEventListener("click", (e) => {
      const { root } = els();
      if (!root || !panelOpen) return;
      if (!root.contains(e.target)) closePanel();
    });

    syncProgress();
    updateMuteUi(true);
  }

  global.WeddingMusic = {
    init,
    play,
    unlockAndPlay,
    pause: pauseAll,
    showFab,
    setVolume,
  };
})(window);
