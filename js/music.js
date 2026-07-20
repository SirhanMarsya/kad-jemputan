/**
 * Background music — YouTube (preferred) + optional MP3 fallback.
 * Browsers block unmuted autoplay on load; we:
 * 1) start muted as soon as YouTube is ready
 * 2) unmute + raise volume when the guest opens the invitation (tap)
 */
(function (global) {
  "use strict";

  const cfg = global.WEDDING_CONFIG || {};
  const YOUTUBE_VIDEO_ID = cfg.youtubeVideoId || "";
  const MUSIC_START_SECONDS = Math.max(0, Number(cfg.musicStartSeconds) || 0);

  let audio;
  let ytPlayer = null;
  let ytReady = false;
  let isPlaying = false;
  let useYoutube = Boolean(YOUTUBE_VIDEO_ID);
  let wantSound = false;
  let unlocked = false;
  let hasSeekedStart = false;
  let pausedByVisibility = false;

  function seekToConfiguredStart() {
    if (!audio || hasSeekedStart || MUSIC_START_SECONDS <= 0) return;
    try {
      audio.currentTime = MUSIC_START_SECONDS;
      hasSeekedStart = true;
    } catch (_) {
      /* seek when metadata ready */
      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (!hasSeekedStart) {
            audio.currentTime = MUSIC_START_SECONDS;
            hasSeekedStart = true;
          }
        },
        { once: true }
      );
    }
  }

  function els() {
    return {
      fab: document.getElementById("musicFab"),
      toggle: document.getElementById("musicToggle"),
      panel: document.getElementById("musicPanel"),
      play: document.getElementById("musicPlay"),
      pause: document.getElementById("musicPause"),
      volume: document.getElementById("musicVolume"),
      icon: document.getElementById("musicIcon"),
    };
  }

  function setPlayingState(playing) {
    isPlaying = playing;
    const { toggle } = els();
    if (!toggle) return;
    toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    toggle.classList.toggle("is-playing", playing);
  }

  function playYt(withSound) {
    if (!ytPlayer || !ytReady) return false;
    useYoutube = true;
    try {
      const { volume } = els();
      const pct = volume ? Number(volume.value) : 60;
      if (withSound) {
        ytPlayer.unMute();
        ytPlayer.setVolume(pct);
      } else {
        ytPlayer.mute();
      }
      ytPlayer.playVideo();
      if (withSound) setPlayingState(true);
      return true;
    } catch (_) {
      return false;
    }
  }

  function playMp3() {
    if (!audio) return Promise.reject();
    seekToConfiguredStart();
    return audio.play().then(() => {
      useYoutube = false;
      setPlayingState(true);
    });
  }

  function pauseAll() {
    wantSound = false;
    pausedByVisibility = false;
    if (audio) audio.pause();
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.pauseVideo();
      } catch (_) {
        /* ignore */
      }
    }
    setPlayingState(false);
  }

  /** Pause when tab/app is hidden — keep wantSound so we can resume */
  function pauseForVisibility() {
    const mp3Playing = Boolean(audio && !audio.paused);
    let ytPlaying = false;
    if (ytPlayer && ytReady && global.YT) {
      try {
        ytPlaying =
          ytPlayer.getPlayerState() === global.YT.PlayerState.PLAYING;
      } catch (_) {
        /* ignore */
      }
    }

    if (!wantSound && !isPlaying && !mp3Playing && !ytPlaying) return;

    pausedByVisibility = wantSound;
    if (audio) audio.pause();
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.pauseVideo();
      } catch (_) {
        /* ignore */
      }
    }
    setPlayingState(false);
  }

  function resumeFromVisibility() {
    if (!pausedByVisibility || !wantSound) {
      pausedByVisibility = false;
      return;
    }
    pausedByVisibility = false;
    if (YOUTUBE_VIDEO_ID && playYt(true)) return;
    playMp3().catch(() => {
      /* user can retry via FAB */
    });
  }

  function bindVisibilityPause() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForVisibility();
      else resumeFromVisibility();
    });

    // Extra safety when leaving the page (bfcache / mobile browsers)
    window.addEventListener("pagehide", pauseForVisibility);
  }

  function play() {
    wantSound = true;
    unlocked = true;

    if (YOUTUBE_VIDEO_ID) {
      if (playYt(true)) return Promise.resolve();
      return playMp3().catch(() => {
        /* wait for YouTube onReady */
      });
    }

    return playMp3();
  }

  /** Call from door-open (user gesture) — play MP3 (or YouTube if configured) */
  function unlockAndPlay() {
    wantSound = true;
    unlocked = true;
    showFab();

    if (!YOUTUBE_VIDEO_ID) {
      playMp3().catch(() => {
        /* user can retry via music FAB */
      });
      return;
    }

    if (playYt(true)) return;

    // Retry briefly while YouTube iframe finishes loading
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (playYt(true) || tries >= 25) clearInterval(timer);
    }, 200);

    playMp3().catch(() => {
      /* YouTube preferred when ID is set */
    });
  }

  function setVolume(pct) {
    const v = Math.max(0, Math.min(100, Number(pct))) / 100;
    if (audio) audio.volume = v;
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.setVolume(Math.round(v * 100));
        if (v === 0) ytPlayer.mute();
        else if (wantSound) ytPlayer.unMute();
      } catch (_) {
        /* ignore */
      }
    }
  }

  function loadYouTubeApi() {
    if (!YOUTUBE_VIDEO_ID) return;
    if (global.YT && global.YT.Player) {
      createYtPlayer();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    global.onYouTubeIframeAPIReady = createYtPlayer;
  }

  function createYtPlayer() {
    if (!YOUTUBE_VIDEO_ID || !global.YT) return;
    const host = document.getElementById("ytPlayer");
    if (!host) return;

    ytPlayer = new global.YT.Player("ytPlayer", {
      height: "1",
      width: "1",
      videoId: YOUTUBE_VIDEO_ID,
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        loop: 1,
        playlist: YOUTUBE_VIDEO_ID,
        playsinline: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (e) => {
          ytReady = true;
          useYoutube = true;
          const { volume } = els();
          e.target.setVolume(volume ? Number(volume.value) : 60);

          if (wantSound || unlocked) {
            playYt(true);
          } else {
            // Warm-start muted — allowed on most browsers without a click
            playYt(false);
          }
        },
        onStateChange: (e) => {
          if (e.data === global.YT.PlayerState.PLAYING) {
            if (wantSound) setPlayingState(true);
          }
          if (
            e.data === global.YT.PlayerState.PAUSED ||
            e.data === global.YT.PlayerState.ENDED
          ) {
            if (wantSound) setPlayingState(false);
          }
        },
      },
    });
  }

  function showFab() {
    const { fab } = els();
    if (fab) fab.hidden = false;
  }

  function init() {
    audio = document.getElementById("bgMusic");
    const { toggle, panel, play: playBtn, pause: pauseBtn, volume } = els();

    if (audio) {
      audio.volume = volume ? Number(volume.value) / 100 : 0.6;
    }

    loadYouTubeApi();
    bindVisibilityPause();

    if (toggle) {
      toggle.addEventListener("click", () => {
        if (isPlaying) {
          pauseAll();
        } else {
          play();
        }
        if (panel) panel.hidden = !panel.hidden;
      });
    }

    if (playBtn) playBtn.addEventListener("click", () => play());
    if (pauseBtn) pauseBtn.addEventListener("click", () => pauseAll());
    if (volume) {
      volume.addEventListener("input", () => setVolume(volume.value));
    }

    document.addEventListener("click", (e) => {
      const { fab, panel: p } = els();
      if (!fab || !p || p.hidden) return;
      if (!fab.contains(e.target)) p.hidden = true;
    });
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
