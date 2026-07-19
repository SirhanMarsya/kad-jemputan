/**
 * Wedding wishes — submit + live list from Google Sheets / local fallback
 */
(function (global) {
  "use strict";

  const SCRIPT_URL =
    (global.WEDDING_CONFIG && global.WEDDING_CONFIG.scriptUrl) || "";
  const POLL_MS = 20000;
  const LOCAL_KEY = "wedding_wishes_local";

  const DEMO_WISHES = [
    { name: "Sarah", wish: "Congratulations — wishing you a lifetime of love." },
    { name: "Hakim", wish: "May Allah bless both of you." },
  ];

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", Boolean(isError));
  }

  function renderWishes(items) {
    const list = document.getElementById("wishesList");
    if (!list) return;

    if (!items || !items.length) {
      list.innerHTML = `<p class="wishes__empty">Jadilah yang pertama meninggalkan ucapan.</p>`;
      return;
    }

    list.innerHTML = items
      .map(
        (w) => `
      <article class="wish-card">
        <p class="wish-card__text">${escapeHtml(w.wish)}</p>
        <p class="wish-card__name">— ${escapeHtml(w.name)}</p>
      </article>`
      )
      .join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeLocal(items) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  }

  async function fetchWishes() {
    if (!SCRIPT_URL) {
      const local = readLocal();
      return local.length ? local : DEMO_WISHES;
    }

    const res = await fetch(`${SCRIPT_URL}?type=wishes`, { method: "GET" });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || "Failed to load wishes");
    return data.wishes || [];
  }

  async function submitWish(payload) {
    if (!SCRIPT_URL) {
      const list = readLocal();
      list.unshift({ ...payload, time: new Date().toISOString() });
      writeLocal(list);
      return { ok: true, demo: true };
    }

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type: "wish", ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.error || "Could not save wish");
    return data;
  }

  async function refresh() {
    try {
      const wishes = await fetchWishes();
      renderWishes(wishes);
    } catch {
      /* keep current list silently */
    }
  }

  function init() {
    const form = document.getElementById("wishesForm");
    const status = document.getElementById("wishStatus");
    const submitBtn = document.getElementById("wishSubmit");

    refresh();
    setInterval(refresh, POLL_MS);

    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const wish = String(fd.get("wish") || "").trim();

      if (!name || !wish) {
        setStatus(status, "Please enter your name and wish.", true);
        return;
      }

      submitBtn.disabled = true;
      setStatus(status, "Sending…");

      try {
        const result = await submitWish({ name, wish });
        setStatus(
          status,
          result.demo
            ? "Wish saved locally (connect Google Sheets to sync online)."
            : "Thank you for your beautiful wish!"
        );
        form.reset();
        await refresh();
      } catch (err) {
        setStatus(status, err.message || "Something went wrong.", true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  global.WeddingWishes = { init, SCRIPT_URL };
})(window);
