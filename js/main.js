/**
 * Main invitation controller — doors, countdown, reveal, couple focus
 */
(function () {
  "use strict";

  const WEDDING_DATE = new Date(
    (window.WEDDING_CONFIG && window.WEDDING_CONFIG.weddingDateISO) ||
      "2026-10-17T11:00:00+08:00"
  );

  function initGuestName() {
    const rsvpName = document.getElementById("rsvpName");
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("to") || params.get("guest");
    if (rsvpName && raw) {
      try {
        rsvpName.value = decodeURIComponent(raw.replace(/\+/g, " "));
      } catch {
        rsvpName.value = raw;
      }
    }
  }

  function spawnPetalRain() {
    const host = document.getElementById("cardFrame") || document.body;
    const styles = [
      "linear-gradient(135deg, #fff8f2, #f0d4c8 55%, #e8b4b0)",
      "linear-gradient(135deg, #fff, #f5efe6 50%, #e8dcc8)",
      "linear-gradient(135deg, #f7f4ef, #d4e0c8)",
      "linear-gradient(135deg, #ffe8e0, #f0c4b8)",
    ];

    for (let i = 0; i < 42; i++) {
      const petal = document.createElement("span");
      const size = 8 + Math.random() * 10;
      petal.className = "petal petal--burst";
      petal.style.left = Math.random() * 100 + "%";
      petal.style.width = size + "px";
      petal.style.height = size * 0.85 + "px";
      petal.style.background = styles[i % styles.length];
      petal.style.setProperty("--drift", `${-60 + Math.random() * 120}px`);
      petal.style.animationDelay = Math.random() * 0.9 + "s";
      petal.style.animationDuration = 2.8 + Math.random() * 2.4 + "s";
      host.appendChild(petal);
      setTimeout(() => petal.remove(), 6000);
    }

    const sceneRain = document.querySelector(".petal-rain");
    if (sceneRain) sceneRain.classList.add("is-active");
  }

  function openInvitation() {
    const door = document.getElementById("openInvitation");
    const landing = document.getElementById("landing");
    const invitation = document.getElementById("invitation");
    if (!door || door.classList.contains("is-opening")) return;

    if (invitation) {
      invitation.classList.remove("is-behind-glass");
      invitation.classList.add("is-visible");
      invitation.setAttribute("aria-hidden", "false");
    }

    if (landing) landing.classList.add("is-revealing");
    door.classList.add("is-opening");
    spawnPetalRain();

    if (window.WeddingMusic) {
      WeddingMusic.unlockAndPlay();
    }

    document.body.classList.add("has-opened");
    document.dispatchEvent(new CustomEvent("wedding:opened"));

    // Cinematic sequence starts only after doors finish opening
    if (window.WeddingCinematic) {
      WeddingCinematic.startAfterDoorsOpen();
    }

    const bottomNav = document.getElementById("bottomNav");
    // Wait for doors to mostly finish, then ease the nav in
    setTimeout(() => {
      if (bottomNav) {
        bottomNav.hidden = false;
        bottomNav.setAttribute("aria-hidden", "false");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bottomNav.classList.add("is-shown");
          });
        });
      }
    }, 1500);

    setTimeout(() => {
      if (landing) landing.classList.add("is-hidden");
      setTimeout(() => {
        if (landing) landing.style.display = "none";
      }, 900);
    }, 1700);
  }

  function getScrollRoot() {
    return document.getElementById("cardScroll") || document.documentElement;
  }

  function initDoor() {
    const door = document.getElementById("openInvitation");
    if (door) {
      door.addEventListener("click", openInvitation);
      door.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openInvitation();
        }
      });
    }
  }

  function initBottomNav() {
    const nav = document.getElementById("bottomNav");
    if (!nav) return;

    const scrollRoot = getScrollRoot();
    const hideBtn = document.getElementById("navHideBtn");
    const showBtn = document.getElementById("navShowBtn");

    function setNavCollapsed(collapsed) {
      nav.classList.toggle("is-collapsed", collapsed);
      document.body.classList.toggle("nav-hidden", collapsed);
      if (showBtn) {
        showBtn.hidden = !collapsed;
        showBtn.setAttribute("aria-hidden", collapsed ? "false" : "true");
      }
    }

    hideBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      setNavCollapsed(true);
    });

    showBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      setNavCollapsed(false);
    });

    const links = Array.from(nav.querySelectorAll(".bottom-nav__item[href]"));
    const sections = links
      .map((link) => {
        const id = (link.getAttribute("href") || "").replace("#", "");
        const el = document.getElementById(id);
        return el ? { link, el } : null;
      })
      .filter(Boolean);

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || href.charAt(0) !== "#") return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        const offset = 8;
        const rootTop = scrollRoot.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        const top = targetTop - rootTop + scrollRoot.scrollTop - offset;
        scrollRoot.scrollTo({ top, behavior: "smooth" });
      });
    });

    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const match = sections.find((s) => s.el === entry.target);
          if (!match) return;
          links.forEach((l) => l.classList.remove("is-active"));
          match.link.classList.add("is-active");
        });
      },
      {
        root: scrollRoot === document.documentElement ? null : scrollRoot,
        rootMargin: "-35% 0px -50% 0px",
        threshold: 0.01,
      }
    );

    sections.forEach(({ el }) => io.observe(el));
  }

  function initContactPopup() {
    const popup = document.getElementById("contactPopup");
    const openBtn = document.getElementById("navContact");
    if (!popup || !openBtn) return;

    function open() {
      popup.hidden = false;
      openBtn.classList.add("is-active");
      openBtn.setAttribute("aria-expanded", "true");
    }

    function close() {
      popup.hidden = true;
      openBtn.classList.remove("is-active");
      openBtn.setAttribute("aria-expanded", "false");
    }

    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (popup.hidden) open();
      else close();
    });

    popup.querySelectorAll("[data-close-popup]").forEach((el) => {
      el.addEventListener("click", close);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !popup.hidden) close();
    });
  }

  function updateCountdown() {
    const root = document.getElementById("countdownTimer");
    if (!root) return;

    const now = new Date();
    let diff = WEDDING_DATE - now;

    if (diff <= 0) {
      root.querySelectorAll("[data-unit]").forEach((el) => {
        el.textContent = "0";
      });
      return;
    }

    const days = Math.floor(diff / 86400000);
    diff %= 86400000;
    const hours = Math.floor(diff / 3600000);
    diff %= 3600000;
    const minutes = Math.floor(diff / 60000);
    diff %= 60000;
    const seconds = Math.floor(diff / 1000);

    const map = { days, hours, minutes, seconds };
    Object.keys(map).forEach((key) => {
      const el = root.querySelector(`[data-unit="${key}"]`);
      if (el) el.textContent = String(map[key]).padStart(2, "0");
    });
  }

  function initCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  function initReveal() {
    const nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    const show = (el) => el.classList.add("is-shown");

    // iOS Safari IntersectionObserver + overflow root is unreliable —
    // sections can stay opacity:0 ("content missing"). Show with a safe fallback.
    const showAll = () => nodes.forEach(show);

    if (!("IntersectionObserver" in window)) {
      showAll();
      return;
    }

    const scrollRoot = getScrollRoot();
    let io;
    try {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              show(entry.target);
              io.unobserve(entry.target);
            }
          });
        },
        {
          root: scrollRoot === document.documentElement ? null : scrollRoot,
          threshold: 0.01,
          rootMargin: "80px 0px 80px 0px",
        }
      );
      nodes.forEach((n) => io.observe(n));
    } catch (_) {
      showAll();
      return;
    }

    // Fallback: if IO never fires (common on iOS), reveal everything
    window.setTimeout(() => {
      nodes.forEach((n) => {
        if (!n.classList.contains("is-shown")) show(n);
      });
    }, 2500);

    // After doors open / first scroll, force any still-hidden reveals
    document.addEventListener(
      "wedding:opened",
      () => {
        window.setTimeout(showAll, 400);
      },
      { once: true }
    );
  }

  function initCoupleReveal() {
    const scene = document.querySelector(".pelamin");
    const figures = document.querySelectorAll(".figure");
    if (!scene || !figures.length) return;

    function clearFocus() {
      scene.classList.remove("is-focus-bride", "is-focus-groom");
      figures.forEach((btn) => {
        btn.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        const id = btn.getAttribute("aria-controls");
        const panel = id ? document.getElementById(id) : null;
        if (panel) panel.setAttribute("aria-hidden", "true");
      });
    }

    figures.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const person = btn.getAttribute("data-person");
        const already =
          (person === "bride" && scene.classList.contains("is-focus-bride")) ||
          (person === "groom" && scene.classList.contains("is-focus-groom"));

        clearFocus();
        if (already) return;

        scene.classList.add(person === "bride" ? "is-focus-bride" : "is-focus-groom");
        btn.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        const id = btn.getAttribute("aria-controls");
        const panel = id ? document.getElementById(id) : null;
        if (panel) panel.setAttribute("aria-hidden", "false");
      });
    });

    scene.addEventListener("click", (e) => {
      if (
        e.target.closest(".figure") ||
        e.target.closest(".mist") ||
        e.target.closest(".pelamin__hotspots")
      ) {
        return;
      }
      clearFocus();
    });
  }

  function initPageLoader() {
    const el = document.getElementById("pageLoader");
    if (!el) return;

    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      el.classList.add("is-done");
      el.setAttribute("aria-busy", "false");
      window.setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 500);
    };

    if (document.readyState === "complete") {
      hide();
    } else {
      window.addEventListener("load", hide, { once: true });
    }
    // Fallback so a stuck asset never blocks the invite forever
    window.setTimeout(hide, 12000);
  }

  /**
   * Drive full-screen sizing via a JS variable instead of container queries.
   * `container-type: size` + `cqh` caused iOS Safari to blank scrolled content.
   */
  function initAppHeight() {
    const scroll = document.getElementById("cardScroll");
    const setH = () => {
      const h =
        (scroll && scroll.clientHeight) ||
        window.innerHeight ||
        document.documentElement.clientHeight;
      if (h) {
        document.documentElement.style.setProperty("--app-h", h + "px");
      }
    };
    setH();
    // Re-measure after layout settles and on viewport changes
    requestAnimationFrame(setH);
    window.addEventListener("load", setH);
    window.addEventListener("resize", setH);
    window.addEventListener("orientationchange", () => {
      setH();
      window.setTimeout(setH, 300);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAppHeight();
    initPageLoader();
    initGuestName();
    initDoor();
    initCountdown();
    initReveal();
    initCoupleReveal();
    initBottomNav();
    initContactPopup();

    if (window.WeddingMusic) WeddingMusic.init();
    if (window.WeddingCalendar) WeddingCalendar.init();
    if (window.WeddingRsvp) WeddingRsvp.init();
    if (window.WeddingWishes) WeddingWishes.init();
  });
})();
