/**
 * RSVP → Google Apps Script web app
 *
 * Replace SCRIPT_URL with your deployed Apps Script URL after setup.
 *
 * Hadir → show bilangan + telefon (required)
 * Tidak Hadir → name + attendance only
 */
(function (global) {
  "use strict";

  const SCRIPT_URL =
    (global.WEDDING_CONFIG && global.WEDDING_CONFIG.scriptUrl) || "";

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", Boolean(isError));
  }

  async function submitRsvp(payload) {
    if (!SCRIPT_URL) {
      // Demo / offline mode — simulate success and store locally
      const key = "wedding_rsvp_local";
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push({ ...payload, time: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(list));
      return { ok: true, demo: true };
    }

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      // text/plain avoids CORS preflight with Apps Script
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type: "rsvp", ...payload }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Could not save RSVP");
    }
    return data;
  }

  function syncAttendFields(form) {
    const details = document.getElementById("rsvpDetails");
    const guests = document.getElementById("rsvpGuests");
    const phone = document.getElementById("rsvpPhone");
    if (!details || !guests || !phone) return;

    const attend = form.querySelector('input[name="attend"]:checked');
    const isAttending = attend && attend.value === "Yes";

    details.hidden = !isAttending;
    guests.required = isAttending;
    phone.required = isAttending;

    if (!isAttending) {
      guests.value = "1";
      phone.value = "";
    }
  }

  function init() {
    const form = document.getElementById("rsvpForm");
    const status = document.getElementById("rsvpStatus");
    const submitBtn = document.getElementById("rsvpSubmit");
    if (!form) return;

    form.querySelectorAll('input[name="attend"]').forEach((radio) => {
      radio.addEventListener("change", () => syncAttendFields(form));
    });
    syncAttendFields(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const attend = String(fd.get("attend") || "");
      const isAttending = attend === "Yes";
      const guests = isAttending ? Number(fd.get("guests") || 0) : 0;
      const phone = isAttending ? String(fd.get("phone") || "").trim() : "";

      if (!name || !attend) {
        setStatus(status, "Sila isi nama dan kehadiran.", true);
        return;
      }

      if (isAttending) {
        if (!guests || guests < 1) {
          setStatus(status, "Sila masukkan bilangan tetamu.", true);
          return;
        }
        if (!phone) {
          setStatus(status, "Sila masukkan no. telefon.", true);
          return;
        }
      }

      submitBtn.disabled = true;
      setStatus(status, "Menghantar…");

      try {
        const result = await submitRsvp({ name, attend, guests, phone });
        const note = result.demo
          ? "Disimpan secara tempatan (sambung Google Sheets untuk sync online)."
          : "Terima kasih! RSVP anda telah diterima.";
        setStatus(status, note);
        form.reset();
        syncAttendFields(form);
      } catch (err) {
        setStatus(status, err.message || "Ralat. Sila cuba lagi.", true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  global.WeddingRsvp = { init, SCRIPT_URL };
})(window);
