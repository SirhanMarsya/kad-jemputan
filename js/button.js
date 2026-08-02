/**
 * Glass-Neumorphism submit button
 * States: idle → pressed → compacting → loading → success | error
 * Appearance stays glass; this module only drives animation + state.
 * Does not replace form submit handlers — wraps the Promise for animation.
 */
(function (global) {
  "use strict";

  const DEFAULT_LABEL = "Hantar";
  const HOLD_MS = 2000;
  const PRESS_MS = 150;
  const COMPACT_MS = 320;
  const CIRCLE_MS = 360;
  const ERROR_MS = 450;

  /** @type {'reset'|'callback'} Default after success hold */
  const DEFAULT_AFTER_SUCCESS = "reset";

  const STATE_CLASSES = [
    "is-idle",
    "is-pressed",
    "is-compacting",
    "is-loading",
    "is-success",
    "is-error",
    "is-width-locked",
  ];

  const CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path class="btn-neo__check-path" d="M5 13l4.5 4.5L19 7" ' +
    'pathLength="100" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function wait(ms) {
    if (prefersReducedMotion()) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getLabelEl(btn) {
    return btn ? btn.querySelector(".btn-neo__label") : null;
  }

  function getCheckPath(btn) {
    return btn ? btn.querySelector(".btn-neo__check-path") : null;
  }

  function ensureStructure(btn) {
    if (!btn) return;

    if (!getLabelEl(btn)) {
      const text = btn.textContent.trim() || DEFAULT_LABEL;
      btn.textContent = "";
      const label = document.createElement("span");
      label.className = "btn-neo__label";
      label.textContent = text;
      btn.appendChild(label);
    }

    if (!btn.querySelector(".btn-neo__spinner")) {
      const spinner = document.createElement("span");
      spinner.className = "btn-neo__spinner";
      spinner.setAttribute("aria-hidden", "true");
      btn.appendChild(spinner);
    }

    const checkHost = btn.querySelector(".btn-neo__check");
    if (!checkHost) {
      const check = document.createElement("span");
      check.className = "btn-neo__check";
      check.setAttribute("aria-hidden", "true");
      check.innerHTML = CHECK_SVG;
      btn.appendChild(check);
    } else if (!getCheckPath(btn)) {
      checkHost.innerHTML = CHECK_SVG;
    }
  }

  function setLabel(btn, text) {
    if (!btn) return;
    ensureStructure(btn);
    const label = getLabelEl(btn);
    if (label) label.textContent = text;
    btn.dataset.labelIdle = text;
  }

  function getIdleLabel(btn) {
    if (!btn) return DEFAULT_LABEL;
    if (btn.dataset.labelIdle) return btn.dataset.labelIdle;
    const label = getLabelEl(btn);
    return (label && label.textContent.trim()) || DEFAULT_LABEL;
  }

  function clearStateClasses(btn) {
    btn.classList.remove.apply(btn.classList, STATE_CLASSES);
  }

  function getState(btn) {
    return (btn && btn.dataset.neoState) || "idle";
  }

  function setState(btn, state) {
    if (!btn) return;
    clearStateClasses(btn);
    btn.dataset.neoState = state;

    if (state === "idle") {
      btn.classList.add("is-idle");
      return;
    }

    btn.classList.add("is-" + state);

    if (state === "pressed" || state === "compacting") {
      btn.classList.add("is-width-locked");
    }
  }

  function lockMeasuredWidth(btn) {
    const w = Math.round(btn.getBoundingClientRect().width);
    btn.style.setProperty("--btn-neo-from-w", w + "px");
    btn.classList.add("is-width-locked");
    void btn.offsetWidth;
  }

  function unlockWidth(btn) {
    btn.style.removeProperty("--btn-neo-from-w");
    btn.classList.remove("is-width-locked");
  }

  function resetCheckPath(btn) {
    const path = getCheckPath(btn);
    if (!path) return;
    path.style.animation = "none";
    path.style.strokeDashoffset = "100";
    void path.getBoundingClientRect();
    path.style.animation = "";
    path.style.strokeDashoffset = "";
  }

  /**
   * Morph: pressed → compact pill → perfect circle (loading spinner).
   * Glass styles remain via CSS; only state classes change.
   */
  async function morphToLoading(btn) {
    ensureStructure(btn);

    if (!btn.dataset.labelIdle) {
      btn.dataset.labelIdle = getIdleLabel(btn);
    }

    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");

    lockMeasuredWidth(btn);
    setState(btn, "pressed");
    await wait(PRESS_MS);

    setState(btn, "compacting");
    await wait(COMPACT_MS);

    setState(btn, "loading");
    await wait(CIRCLE_MS);
  }

  function showSuccess(btn) {
    if (!btn) return;
    resetCheckPath(btn);
    setState(btn, "success");
    btn.setAttribute("aria-busy", "false");
  }

  function showError(btn) {
    if (!btn) return;
    setState(btn, "error");
    btn.setAttribute("aria-busy", "false");

    window.setTimeout(() => {
      reset(btn);
    }, ERROR_MS);
  }

  function reset(btn) {
    if (!btn) return;
    resetCheckPath(btn);
    clearStateClasses(btn);
    unlockWidth(btn);
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    btn.dataset.neoState = "idle";
    btn.classList.add("is-idle");
    const label = getLabelEl(btn);
    if (label) label.textContent = btn.dataset.labelIdle || DEFAULT_LABEL;
  }

  /** Back-compat simple loading toggle */
  function setLoading(btn, loading) {
    if (loading) {
      morphToLoading(btn);
    } else {
      reset(btn);
    }
  }

  function startLoading(btn) {
    return morphToLoading(btn);
  }

  /**
   * Run submit Promise with full Dribbble-style animation flow.
   *
   * options.afterSuccess:
   *   'reset'    — Option B: restore idle label after hold (default)
   *   'callback' — Option A: hold success, then onComplete (e.g. close / summary)
   *
   * @param {HTMLButtonElement} btn
   * @param {() => Promise<any>} submitFn  real async submit (no fake delay)
   * @param {{
   *   afterSuccess?: 'reset'|'callback',
   *   holdMs?: number,
   *   onComplete?: (result: any, btn: HTMLButtonElement) => void,
   *   onError?: (err: Error, btn: HTMLButtonElement) => void
   * }} [options]
   * @returns {Promise<any>}
   */
  async function withSubmit(btn, submitFn, options) {
    const opts = options || {};
    const afterSuccess = opts.afterSuccess || DEFAULT_AFTER_SUCCESS;
    const holdMs = opts.holdMs != null ? opts.holdMs : HOLD_MS;

    if (!btn) return undefined;
    ensureStructure(btn);
    if (!btn.dataset.neoState) {
      btn.dataset.neoState = "idle";
      btn.classList.add("is-idle");
    }
    if (getState(btn) !== "idle") return undefined;

    // Morph and real request run together; success waits for both
    const morphPromise = morphToLoading(btn);
    const submitPromise = Promise.resolve().then(() => submitFn());

    try {
      const result = await submitPromise;
      await morphPromise;

      showSuccess(btn);
      await wait(holdMs);

      if (afterSuccess === "callback") {
        if (typeof opts.onComplete === "function") {
          await Promise.resolve(opts.onComplete(result, btn));
        }
        reset(btn);
      } else {
        reset(btn);
        if (typeof opts.onComplete === "function") {
          await Promise.resolve(opts.onComplete(result, btn));
        }
      }

      return result;
    } catch (err) {
      // Ensure morph settles before shake / restore
      try {
        await morphPromise;
      } catch (_) {
        /* ignore */
      }
      showError(btn);
      if (typeof opts.onError === "function") {
        opts.onError(err, btn);
      }
      throw err;
    }
  }

  function spawnRipple(btn, clientX, clientY) {
    if (
      !btn ||
      btn.disabled ||
      getState(btn) !== "idle"
    ) {
      return;
    }

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "btn-neo__ripple is-animating";
    ripple.setAttribute("aria-hidden", "true");

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ripple.style.left = x - 6 + "px";
    ripple.style.top = y - 6 + "px";

    btn.appendChild(ripple);
    ripple.addEventListener(
      "animationend",
      () => {
        ripple.remove();
      },
      { once: true }
    );
  }

  function enhance(btn) {
    if (!btn || btn.dataset.neoReady === "1") return;
    btn.dataset.neoReady = "1";
    ensureStructure(btn);
    btn.dataset.labelIdle = getIdleLabel(btn);
    btn.dataset.neoState = "idle";
    btn.classList.add("is-idle");

    // Keyboard: Enter / Space already activate <button type="submit">
    // Keep focus-visible styles; block re-entry while busy
    btn.addEventListener("keydown", (e) => {
      if (getState(btn) !== "idle") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
        }
      }
    });

    btn.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      if (getState(btn) !== "idle") return;
      spawnRipple(btn, e.clientX, e.clientY);
    });
  }

  function init() {
    document.querySelectorAll(".btn-neo").forEach(enhance);
  }

  global.WeddingButton = {
    init,
    enhance,
    setLabel,
    setLoading,
    startLoading,
    showSuccess,
    showError,
    reset,
    withSubmit,
    getIdleLabel,
    getState,
    /** Configurable defaults */
    defaults: {
      afterSuccess: DEFAULT_AFTER_SUCCESS,
      holdMs: HOLD_MS,
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
