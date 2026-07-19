/**
 * Calendar helpers — Google, Apple (.ics)
 */
(function (global) {
  "use strict";

  const EVENT = {
    title: "Sirhan & Marsya Wedding",
    details:
      "Ketibaan Tetamu 11.00 pagi. Ketibaan Pengantin 12.00 tengah hari. Majlis Tamat 4.00 petang. Ruang Acara Nadi Rafanda, Elmina East.",
    location: "Ruang Acara Nadi Rafanda, Elmina East",
    start: "20261017T110000",
    end: "20261017T160000",
    startISO: "2026-10-17T11:00:00+08:00",
    endISO: "2026-10-17T16:00:00+08:00",
  };

  function googleCalendarUrl() {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: EVENT.title,
      details: EVENT.details,
      location: EVENT.location,
      dates: `${EVENT.start}/${EVENT.end}`,
      ctz: "Asia/Kuala_Lumpur",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatIcsDate(d) {
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z"
    );
  }

  function buildIcs() {
    const start = new Date(EVENT.startISO);
    const end = new Date(EVENT.endISO);
    const stamp = formatIcsDate(new Date());
    const uid = `wedding-${EVENT.start}@sirhan-marsya.invite`;

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SirhanMarsya//Wedding//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${EVENT.title}`,
      `DESCRIPTION:${EVENT.details.replace(/\n/g, "\\n")}`,
      `LOCATION:${EVENT.location}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
  }

  function downloadAppleIcs() {
    const blob = new Blob([buildIcs()], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sirhan-marsya-wedding.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function init() {
    const g = document.getElementById("calGoogle");
    const apple = document.getElementById("calApple");

    if (g) {
      g.addEventListener("click", () => {
        window.open(googleCalendarUrl(), "_blank", "noopener,noreferrer");
      });
    }
    if (apple) {
      apple.addEventListener("click", downloadAppleIcs);
    }
  }

  global.WeddingCalendar = { init, EVENT, googleCalendarUrl, downloadAppleIcs };
})(window);
