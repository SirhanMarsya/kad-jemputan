/**
 * RSVP — Google Sheets sync + local persistence
 *
 * Flow:
 *  - Submit → create row in Sheet + save to localStorage → show summary
 *  - Kemaskini → edit form → update Sheet
 *  - Batal → delete Sheet row + clear local → empty form
 *  - Refresh → restore from localStorage, verify against Sheet when online
 */
(function (global) {
  "use strict";

  const SCRIPT_URL =
    (global.WEDDING_CONFIG && global.WEDDING_CONFIG.scriptUrl) || "";
  const LOCAL_KEY = "wedding_rsvp_mine";

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(el, message, isError) {
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", Boolean(isError));
  }

  function makeId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return (
      "rsvp_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.id) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function writeLocal(rsvp) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rsvp));
  }

  function clearLocal() {
    localStorage.removeItem(LOCAL_KEY);
  }

  async function apiPost(payload) {
    if (!SCRIPT_URL) {
      return { ok: true, demo: true, apiVersion: 2, rsvp: payload };
    }

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ type: "rsvp", ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      const err = new Error(data.error || "Could not save RSVP");
      err.missing = Boolean(data.missing);
      throw err;
    }
    // Old deployment always appends and has no apiVersion
    if (data.apiVersion !== 2) {
      const err = new Error(
        "Google Script belum dikemas kini. Deploy semula Code.gs (New version)."
      );
      err.needsRedeploy = true;
      throw err;
    }
    return data;
  }

  async function apiGetRsvp(id) {
    if (!SCRIPT_URL || !id) return null;
    const url =
      SCRIPT_URL +
      (SCRIPT_URL.indexOf("?") >= 0 ? "&" : "?") +
      "type=rsvp&id=" +
      encodeURIComponent(id);
    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (data.missing) return null;
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Could not load RSVP");
    }
    return data.rsvp || null;
  }

  function syncAttendFields(form) {
    const details = $("rsvpDetails");
    const guests = $("rsvpGuests");
    const phone = $("rsvpPhone");
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

  function fillForm(rsvp) {
    const form = $("rsvpForm");
    if (!form || !rsvp) return;
    const idEl = $("rsvpId");
    const nameEl = $("rsvpName");
    const guestsEl = $("rsvpGuests");
    const phoneEl = $("rsvpPhone");
    if (idEl) idEl.value = rsvp.id || "";
    if (nameEl) nameEl.value = rsvp.name || "";
    if (guestsEl) guestsEl.value = String(rsvp.guests > 0 ? rsvp.guests : 1);
    if (phoneEl) phoneEl.value = rsvp.phone || "";

    const yes = form.querySelector('input[name="attend"][value="Yes"]');
    const no = form.querySelector('input[name="attend"][value="No"]');
    if (rsvp.attend === "Yes" && yes) yes.checked = true;
    else if (no) no.checked = true;

    syncAttendFields(form);
  }

  function clearForm() {
    const form = $("rsvpForm");
    if (!form) return;
    form.reset();
    const idEl = $("rsvpId");
    if (idEl) idEl.value = "";
    syncAttendFields(form);
  }

  function showSummary(rsvp) {
    const form = $("rsvpForm");
    const summary = $("rsvpSummary");
    if (form) form.hidden = true;
    if (summary) summary.hidden = false;

    const nameEl = $("rsvpSummaryName");
    const attendEl = $("rsvpSummaryAttend");
    const guestsEl = $("rsvpSummaryGuests");

    if (nameEl) nameEl.textContent = rsvp.name || "—";
    if (attendEl) {
      attendEl.textContent =
        rsvp.attend === "Yes" ? "Kehadiran: Hadir" : "Kehadiran: Tidak Hadir";
    }
    if (guestsEl) {
      if (rsvp.attend === "Yes") {
        const n = Number(rsvp.guests) || 1;
        guestsEl.hidden = false;
        guestsEl.textContent =
          n === 1 ? "Bilangan tetamu: 1 orang" : "Bilangan tetamu: " + n + " orang";
      } else {
        guestsEl.hidden = true;
        guestsEl.textContent = "";
      }
    }

    setStatus($("rsvpSummaryStatus"), "");
    setEditMode(false);
  }

  function showForm(editMode) {
    const form = $("rsvpForm");
    const summary = $("rsvpSummary");
    if (summary) summary.hidden = true;
    if (form) form.hidden = false;
    setEditMode(Boolean(editMode));
    setStatus($("rsvpStatus"), "");
  }

  function setEditMode(editing) {
    const submitBtn = $("rsvpSubmit");
    if (submitBtn) {
      const label = editing ? "Kemaskini" : "Hantar";
      if (window.WeddingButton) WeddingButton.setLabel(submitBtn, label);
      else submitBtn.textContent = label;
    }
    const form = $("rsvpForm");
    if (form) form.dataset.mode = editing ? "edit" : "create";
  }

  function collectPayload(form) {
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const attend = String(fd.get("attend") || "");
    const isAttending = attend === "Yes";
    const guests = isAttending ? Number(fd.get("guests") || 0) : 0;
    const phone = isAttending ? String(fd.get("phone") || "").trim() : "";
    let id = String(fd.get("id") || "").trim();
    const mode = form.dataset.mode === "edit" ? "update" : "create";

    if (mode === "create" && !id) id = makeId();

    return { id, name, attend, guests, phone, isAttending, mode };
  }

  function validate(payload, status) {
    if (!payload.name || !payload.attend) {
      setStatus(status, "Sila isi nama dan kehadiran.", true);
      return false;
    }
    if (payload.isAttending) {
      if (!payload.guests || payload.guests < 1) {
        setStatus(status, "Sila masukkan bilangan tetamu.", true);
        return false;
      }
      if (!payload.phone) {
        setStatus(status, "Sila masukkan no. telefon.", true);
        return false;
      }
    }
    return true;
  }

  async function restoreOnLoad() {
    const local = readLocal();
    if (!local) {
      showForm(false);
      return;
    }

    // Show local immediately for fast paint
    showSummary(local);

    if (!SCRIPT_URL) return;

    try {
      const remote = await apiGetRsvp(local.id);
      if (!remote) {
        // Deleted on sheet — clear local and show form
        clearLocal();
        clearForm();
        showForm(false);
        setStatus(
          $("rsvpStatus"),
          "RSVP terdahulu tidak dijumpai. Sila hantar semula.",
          true
        );
        return;
      }
      writeLocal(remote);
      showSummary(remote);
    } catch (_) {
      // Keep local summary if network fails
    }
  }

  function init() {
    const form = $("rsvpForm");
    const status = $("rsvpStatus");
    const submitBtn = $("rsvpSubmit");
    const editBtn = $("rsvpEdit");
    const deleteBtn = $("rsvpDelete");
    if (!form) return;

    form.querySelectorAll('input[name="attend"]').forEach((radio) => {
      radio.addEventListener("change", () => syncAttendFields(form));
    });
    syncAttendFields(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = collectPayload(form);
      if (!validate(payload, status)) return;

      const action = payload.mode === "edit" ? "update" : "create";
      const body = {
        action,
        id: payload.id,
        name: payload.name,
        attend: payload.attend,
        guests: payload.guests,
        phone: payload.phone,
      };

      setStatus(status, "");

      const run = async () => {
        const result = await apiPost(body);
        return { result, saved: result.rsvp || body, action };
      };

      const onSuccess = (data) => {
        writeLocal(data.saved);
        showSummary(data.saved);
        setStatus(
          $("rsvpSummaryStatus"),
          data.result.demo
            ? "Disimpan secara tempatan (sambung Google Sheets untuk sync online)."
            : data.action === "update"
              ? "RSVP berjaya dikemas kini."
              : "Terima kasih! RSVP anda telah diterima."
        );
      };

      const onFail = (err) => {
        if (err.missing && payload.mode === "edit") {
          clearLocal();
          setStatus(
            status,
            "RSVP tidak dijumpai di server. Sila hantar sebagai RSVP baharu.",
            true
          );
          setEditMode(false);
          const idEl = $("rsvpId");
          if (idEl) idEl.value = "";
        } else {
          setStatus(status, err.message || "Ralat. Sila cuba lagi.", true);
        }
      };

      try {
        if (window.WeddingButton && WeddingButton.withSubmit) {
          // Option A: after checkmark, close form into summary view
          await WeddingButton.withSubmit(submitBtn, run, {
            afterSuccess: "callback",
            holdMs: 2000,
            onComplete: onSuccess,
            onError: onFail,
          });
        } else {
          submitBtn.disabled = true;
          try {
            const data = await run();
            onSuccess(data);
          } catch (err) {
            onFail(err);
          } finally {
            submitBtn.disabled = false;
          }
        }
      } catch (_) {
        /* onError already handled status */
      }
    });

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const local = readLocal();
        if (!local) {
          showForm(false);
          return;
        }
        fillForm(local);
        showForm(true);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const local = readLocal();
        if (!local) {
          clearForm();
          showForm(false);
          return;
        }

        const ok = global.confirm(
          "Batalkan RSVP anda? Rekod akan dipadam dari senarai."
        );
        if (!ok) return;

        deleteBtn.disabled = true;
        setStatus($("rsvpSummaryStatus"), "Memadam…");

        try {
          await apiPost({ action: "delete", id: local.id });
          clearLocal();
          clearForm();
          showForm(false);
          setStatus($("rsvpStatus"), "RSVP telah dibatalkan.");
        } catch (err) {
          if (err.missing) {
            clearLocal();
            clearForm();
            showForm(false);
            setStatus($("rsvpStatus"), "RSVP telah dibatalkan.");
          } else {
            setStatus(
              $("rsvpSummaryStatus"),
              err.message || "Gagal memadam. Sila cuba lagi.",
              true
            );
          }
        } finally {
          deleteBtn.disabled = false;
        }
      });
    }

    restoreOnLoad();
  }

  global.WeddingRsvp = { init, SCRIPT_URL };
})(window);
