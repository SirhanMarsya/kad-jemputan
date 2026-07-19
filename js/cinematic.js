/**
 * Cinematic opening sequence
 * Triggered ONLY after the frosted doors have finished opening.
 * Stages: title → names → couple → groom zoom → zoom out → bride zoom → return → auto-scroll
 * Any user interaction aborts the remaining cinematic (and auto-scroll).
 */
(function (global) {
  "use strict";

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
    DETAILS_FADE: 900, // mist fade-in after zoom
    GROOM_HOLD: 2200,
    BRIDE_HOLD: 2200,
    RETURN_HOLD: 450,
    AUTO_SCROLL: 55000, // slow enough to read each section
    INTERACT_GRACE: 400, // ignore leftover door-tap events
  };

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
    scrollRoot.style.overflow = "";
    scrollRoot.style.overflowY = "";
  }

  // ----- Interrupt: any user interaction stops cinematic -----
  function onUserInteract(e) {
    // Ignore pure mouse-move; require intentional input
    if (!running && !autoScrollRaf) return;
    // Don't treat music toggle as "stop cinematic" only — still ok to stop
    abortCinematic();
  }

  function bindInteractAbort() {
    if (interactBound) return;
    interactBound = true;
    const opts = { passive: true, capture: true };
    const root = document.getElementById("cardFrame") || document;
    root.addEventListener("wheel", onUserInteract, opts);
    root.addEventListener("touchstart", onUserInteract, opts);
    root.addEventListener("pointerdown", onUserInteract, opts);
    root.addEventListener("keydown", onUserInteract, opts);
  }

  function unbindInteractAbort() {
    if (!interactBound) return;
    interactBound = false;
    const opts = { capture: true };
    const root = document.getElementById("cardFrame") || document;
    root.removeEventListener("wheel", onUserInteract, opts);
    root.removeEventListener("touchstart", onUserInteract, opts);
    root.removeEventListener("pointerdown", onUserInteract, opts);
    root.removeEventListener("keydown", onUserInteract, opts);
  }

  function abortCinematic() {
    if (aborted && !running && !autoScrollRaf) return;
    aborted = true;
    clearTimers();
    cancelAutoScroll();

    const scene = document.getElementById("hero");
    const intro = document.getElementById("pelaminIntro");
    settleScene(scene, intro);
    running = false;
    unbindInteractAbort();
  }

  // ----- Stage 9: auto-scroll (cancel on user scroll) -----
  function cancelAutoScroll() {
    autoScrollCancelled = true;
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  }

  function autoScrollToBottom() {
    if (aborted) return;

    const root = getScrollRoot();
    autoScrollCancelled = false;

    root.style.overflowY = "auto";
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    const measureEnd = () =>
      Math.max(0, root.scrollHeight - root.clientHeight);

    root.scrollTop = 0;
    let end = measureEnd();

    if (end <= 4) {
      requestAnimationFrame(() => {
        if (aborted) return;
        end = measureEnd();
        if (end > 4) startTween(root, 0, end, prevBehavior);
        else root.style.scrollBehavior = prevBehavior || "";
      });
      return;
    }

    startTween(root, 0, end, prevBehavior);
  }

  function startTween(root, start, end, prevBehavior) {
    const duration = DUR.AUTO_SCROLL;
    const t0 = performance.now();

    function easeLinear(t) {
      return t; // even pace so every section stays readable
    }

    function tick(now) {
      if (autoScrollCancelled || aborted) {
        root.style.scrollBehavior = prevBehavior || "";
        unbindInteractAbort();
        return;
      }

      const liveEnd = Math.max(end, root.scrollHeight - root.clientHeight);
      const t = Math.min(1, (now - t0) / duration);
      root.scrollTop = start + (liveEnd - start) * easeLinear(t);

      if (t < 1) {
        autoScrollRaf = requestAnimationFrame(tick);
      } else {
        autoScrollRaf = null;
        root.scrollTop = liveEnd;
        root.style.scrollBehavior = prevBehavior || "";
        unbindInteractAbort();
      }
    }

    autoScrollRaf = requestAnimationFrame(tick);
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
