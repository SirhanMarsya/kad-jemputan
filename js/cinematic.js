/**
 * Cinematic opening sequence
 * Triggered ONLY after the frosted doors have finished opening.
 * Stages: title → names → couple → groom zoom → zoom out → bride zoom → return → auto-scroll
 * Any user interaction aborts the remaining cinematic (and auto-scroll).
 */
(function (global) {
  "use strict";

  function isAppleTouchDevice() {
    const ua = navigator.userAgent || "";
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  }

  // ----- Duration constants (ms) -----
  const DUR = {
    DOOR_OPEN: 1850, // matches .glass-doors__pane transition (1.85s)
    TITLE_IN: 850,
    TITLE_HOLD: 2000,
    TITLE_OUT: 700,
    NAMES_IN: 900,
    NAMES_HOLD: 2000,
    COUPLE_IN: 2200, // match CSS crossfade (~2.2s)
    COUPLE_HOLD: 1200,
    ZOOM: 1050, // matches CSS transform transition
    DETAILS_FADE: 1000, // mist fade-in after zoom
    GROOM_HOLD: 2400,
    BRIDE_HOLD: 2400,
    RETURN_HOLD: 500,
    AUTO_SCROLL: 55000, // total travel time between pauses (approx)
    SECTION_HOLD: 3000, // pause on jemputan / countdown / location / schedule
    // iOS often synthesizes leftover pointer/touch after the door tap
    INTERACT_GRACE: isAppleTouchDevice() ? 1200 : 400,
  };

  /** Sections that get a 3s dwell during cinematic auto-scroll */
  const SCROLL_PAUSE_IDS = ["jemputan", "countdown", "location", "schedule"];


  let running = false;
  let aborted = false;
  let autoScrollRaf = null;
  let autoScrollCancelled = false;
  let timers = [];
  let interactBound = false;

  function wait(ms) {
    return new Promise((resolve, reject) => {
      if (aborted) {
        reject(createAbortError());
        return;
      }
      const id = setTimeout(() => {
        if (aborted) reject(createAbortError());
        else resolve();
      }, ms);
      timers.push(id);
    });
  }

  function createAbortError() {
    const err = new Error("cinematic-aborted");
    err.name = "CinematicAbortError";
    return err;
  }

  function isAbort(err) {
    return err && err.name === "CinematicAbortError";
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function getScrollRoot() {
    return document.getElementById("cardScroll") || document.documentElement;
  }

  function setMist(person, open) {
    const panel = document.getElementById(
      person === "groom" ? "groomDetails" : "brideDetails"
    );
    if (!panel) return;
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function clearFocus(scene) {
    if (!scene) return;
    scene.classList.remove("is-focus-groom", "is-focus-bride");
    setMist("groom", false);
    setMist("bride", false);
    document.querySelectorAll(".figure").forEach((btn) => {
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function focusPerson(scene, person) {
    clearFocus(scene);
    scene.classList.add(
      person === "groom" ? "is-focus-groom" : "is-focus-bride"
    );
    setMist(person, true);
    const btn = document.querySelector(`.figure--${person}`);
    if (btn) {
      btn.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
    }
  }

  /** Leave the page in a usable resting state after abort or finish */
  function settleScene(scene, intro) {
    if (!scene) return;
    scene.classList.remove("is-cinematic-pending", "is-cinematic-running");
    scene.classList.add("is-couple-shown");
    if (intro) intro.classList.add("is-shown");
    clearFocus(scene);

    const title = document.getElementById("cinematicTitle");
    if (title) {
      title.classList.remove("is-shown");
      title.setAttribute("aria-hidden", "true");
    }

    const scrollRoot = getScrollRoot();
    // Explicit restore — clearing inline overflow can leave iOS Safari stuck
    scrollRoot.style.removeProperty("overflow");
    scrollRoot.style.overflowY = "auto";
    scrollRoot.style.overflowX = "hidden";

    // Ensure invitation sections are visible (iOS IO can miss them)
    document.querySelectorAll(".reveal:not(.is-shown)").forEach((el) => {
      el.classList.add("is-shown");
    });

    // Show bottom nav when cinematic finishes or is interrupted
    document.dispatchEvent(new CustomEvent("wedding:cinematic-settled"));
  }

  // ----- Interrupt: user interaction stops cinematic -----
  let touchStartY = null;

  function onUserInteract() {
    if (!running && !autoScrollRaf) return;
    abortCinematic();
  }

  function onTouchStart(e) {
    if (!running && !autoScrollRaf) return;
    // During auto-scroll, wait for a real swipe — a light tap shouldn't kill it
    if (autoScrollRaf && !running) {
      const t = e.touches && e.touches[0];
      touchStartY = t ? t.clientY : null;
      return;
    }
    onUserInteract();
  }

  function onTouchMove(e) {
    if (!autoScrollRaf || running) return;
    const t = e.touches && e.touches[0];
    if (!t || touchStartY == null) return;
    if (Math.abs(t.clientY - touchStartY) > 14) {
      touchStartY = null;
      onUserInteract();
    }
  }

  function onPointerDown(e) {
    if (!running && !autoScrollRaf) return;
    // Ignore while auto-scrolling (touch handlers cover mobile; mouse uses wheel)
    if (autoScrollRaf && !running && e.pointerType === "touch") return;
    // On iOS, pointerdown often fires with the same door-open gesture /
    // music-unmute tap and would abort the cinematic instantly
    if (isAppleTouchDevice() && e.pointerType === "touch") return;
    onUserInteract();
  }

  function bindInteractAbort() {
    if (interactBound) return;
    interactBound = true;
    const opts = { passive: true, capture: true };
    const root = document.getElementById("cardFrame") || document;
    root.addEventListener("wheel", onUserInteract, opts);
    root.addEventListener("touchstart", onTouchStart, opts);
    root.addEventListener("touchmove", onTouchMove, opts);
    root.addEventListener("pointerdown", onPointerDown, opts);
    root.addEventListener("keydown", onUserInteract, opts);
  }

  function unbindInteractAbort() {
    if (!interactBound) return;
    interactBound = false;
    touchStartY = null;
    const opts = { capture: true };
    const root = document.getElementById("cardFrame") || document;
    root.removeEventListener("wheel", onUserInteract, opts);
    root.removeEventListener("touchstart", onTouchStart, opts);
    root.removeEventListener("touchmove", onTouchMove, opts);
    root.removeEventListener("pointerdown", onPointerDown, opts);
    root.removeEventListener("keydown", onUserInteract, opts);
  }

  function abortCinematic() {
    if (aborted && !running && !autoScrollRaf) return;
    aborted = true;
    clearTimers();
    cancelAutoScroll();
    document.body.classList.remove("is-auto-scrolling");

    const scene = document.getElementById("hero");
    const intro = document.getElementById("pelaminIntro");
    settleScene(scene, intro);
    running = false;
    unbindInteractAbort();
  }

  // ----- Stage 9: auto-scroll (cancel on user scroll) -----
  function cancelAutoScroll() {
    autoScrollCancelled = true;
    document.body.classList.remove("is-auto-scrolling");
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  }

  /** Section top relative to scroll root */
  function sectionScrollTop(root, el, offset) {
    const rootTop = root.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    return Math.max(0, elTop - rootTop + root.scrollTop - offset);
  }

  function tweenScrollTo(root, target, speedPxPerMs) {
    return new Promise((resolve) => {
      if (autoScrollCancelled || aborted) {
        resolve(false);
        return;
      }

      let pos = root.scrollTop;
      let last = performance.now();
      const goingDown = target >= pos;

      function tick(now) {
        if (autoScrollCancelled || aborted) {
          resolve(false);
          return;
        }

        const dt = Math.min(40, Math.max(0, now - last));
        last = now;

        if (goingDown) {
          pos = Math.min(target, pos + speedPxPerMs * dt);
        } else {
          pos = Math.max(target, pos - speedPxPerMs * dt);
        }
        root.scrollTop = pos;

        const done = goingDown ? pos >= target - 1 : pos <= target + 1;
        if (done) {
          root.scrollTop = target;
          autoScrollRaf = null;
          resolve(true);
          return;
        }
        autoScrollRaf = requestAnimationFrame(tick);
      }

      autoScrollRaf = requestAnimationFrame(tick);
    });
  }

  function holdPause(ms) {
    return new Promise((resolve) => {
      if (autoScrollCancelled || aborted) {
        resolve(false);
        return;
      }
      const id = setTimeout(() => {
        resolve(!(autoScrollCancelled || aborted));
      }, ms);
      timers.push(id);
    });
  }

  async function autoScrollToBottom() {
    if (aborted) return;

    const root = getScrollRoot();
    autoScrollCancelled = false;
    document.body.classList.add("is-auto-scrolling");

    // Reveal everything up front so section heights don't jump mid-scroll
    document.querySelectorAll(".reveal:not(.is-shown)").forEach((el) => {
      el.classList.add("is-shown");
    });

    root.style.overflowY = "auto";
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    const measureEnd = () =>
      Math.max(0, root.scrollHeight - root.clientHeight);

    root.scrollTop = 0;

    const finish = () => {
      autoScrollRaf = null;
      root.scrollTop = measureEnd();
      root.style.scrollBehavior = prevBehavior || "";
      document.body.classList.remove("is-auto-scrolling");
      unbindInteractAbort();
    };

    const abortCleanup = () => {
      root.style.scrollBehavior = prevBehavior || "";
      document.body.classList.remove("is-auto-scrolling");
      unbindInteractAbort();
    };

    // Wait a frame so layout settles after reveals
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (aborted || autoScrollCancelled) {
      abortCleanup();
      return;
    }

    const end = measureEnd();
    if (end <= 4) {
      abortCleanup();
      return;
    }

    // Travel speed based on full-page duration
    const speed = Math.max(end, 1) / DUR.AUTO_SCROLL;
    const pinOffset = 12;

    const pauseSections = SCROLL_PAUSE_IDS.map((id) =>
      document.getElementById(id)
    ).filter(Boolean);

    for (let i = 0; i < pauseSections.length; i++) {
      if (aborted || autoScrollCancelled) {
        abortCleanup();
        return;
      }

      const section = pauseSections[i];
      // Re-measure each time (layout can shift)
      const target = Math.min(
        measureEnd(),
        sectionScrollTop(root, section, pinOffset)
      );

      const ok = await tweenScrollTo(root, target, speed);
      if (!ok) {
        abortCleanup();
        return;
      }

      const held = await holdPause(DUR.SECTION_HOLD);
      if (!held) {
        abortCleanup();
        return;
      }
    }

    // Continue to bottom after last pause
    if (aborted || autoScrollCancelled) {
      abortCleanup();
      return;
    }

    const toBottom = await tweenScrollTo(root, measureEnd(), speed);
    if (!toBottom) {
      abortCleanup();
      return;
    }

    finish();
  }

  /**
   * Run the full cinematic sequence.
   * Call this AFTER the door-open animation has completed.
   */
  async function runCinematicSequence() {
    if (running) return;
    running = true;
    aborted = false;
    clearTimers();

    const scene = document.getElementById("hero");
    const title = document.getElementById("cinematicTitle");
    const intro = document.getElementById("pelaminIntro");
    if (!scene) {
      running = false;
      return;
    }

    scene.classList.remove("is-cinematic-pending");
    scene.classList.add("is-cinematic-running");
    clearFocus(scene);

    const scrollRoot = getScrollRoot();
    scrollRoot.style.overflow = "hidden";
    scrollRoot.scrollTop = 0;

    // Grace period so the door-open tap doesn't immediately abort
    const graceId = setTimeout(() => {
      if (!aborted) bindInteractAbort();
    }, DUR.INTERACT_GRACE);
    timers.push(graceId);

    try {
      // ===== Stage 3: Wedding invitation title =====
      if (title) {
        title.setAttribute("aria-hidden", "false");
        title.classList.add("is-shown");
      }
      await wait(DUR.TITLE_IN + DUR.TITLE_HOLD);

      if (title) {
        title.classList.remove("is-shown");
        title.setAttribute("aria-hidden", "true");
      }
      await wait(DUR.TITLE_OUT);

      // ===== Stage 4: Couple names =====
      if (intro) {
        intro.classList.add("is-shown");
      }
      await wait(DUR.NAMES_IN + DUR.NAMES_HOLD);

      // ===== Stage 5: Show couple scene (pelamin_pengantin.PNG) =====
      // Fades in full illustration with bride & groom (replaces empty pelamin.png)
      scene.classList.add("is-couple-shown");
      await wait(DUR.COUPLE_IN + DUR.COUPLE_HOLD);

      // ===== Stage 6: Groom focus (zoom → fade details → hold) =====
      focusPerson(scene, "groom");
      await wait(DUR.ZOOM + DUR.DETAILS_FADE + DUR.GROOM_HOLD);

      // ===== Stage 6b: Zoom out to full couple before bride =====
      clearFocus(scene);
      await wait(DUR.ZOOM + DUR.RETURN_HOLD);

      // ===== Stage 7: Bride focus (zoom → fade details → hold) =====
      focusPerson(scene, "bride");
      await wait(DUR.ZOOM + DUR.DETAILS_FADE + DUR.BRIDE_HOLD);

      // ===== Stage 8: Return to full invitation =====
      clearFocus(scene);
      await wait(DUR.ZOOM + DUR.RETURN_HOLD);
    } catch (err) {
      if (!isAbort(err)) throw err;
      // Aborted by user — settle and skip auto-scroll
      settleScene(scene, intro);
      running = false;
      return;
    } finally {
      if (!aborted) {
        settleScene(scene, intro);
      }
      running = false;
    }

    if (aborted) return;

    // ===== Stage 9: Auto-scroll top → bottom =====
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!aborted) autoScrollToBottom();
      });
    });
  }

  /**
   * Schedule cinematic to start once doors are fully open.
   * Hook this from the existing openInvitation() flow.
   */
  function startAfterDoorsOpen() {
    aborted = false;
    const id = setTimeout(() => {
      runCinematicSequence();
    }, DUR.DOOR_OPEN);
    timers.push(id);
  }

  global.WeddingCinematic = {
    startAfterDoorsOpen,
    runCinematicSequence,
    abortCinematic,
    cancelAutoScroll,
    DUR,
  };
})(window);
