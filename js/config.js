/**
 * Shared site config — update once, used by RSVP & Wishes.
 */
window.WEDDING_CONFIG = {
  /**
   * Google Apps Script web app URL (not the Sheet link).
   * Sheet: https://docs.google.com/spreadsheets/d/1L2Ovgv5TKJoNY1wRTuI2cm2T3yaZGB7h13xoUbvZ5Fs
   * After Deploy → Web app, paste the .../macros/s/XXXX/exec URL here.
   */
  scriptUrl: "https://script.google.com/macros/s/AKfycbzTRai4OmlwE4Z61fx1pagmu6ZuwIOj_lzHzaXZbuWQtftC3Vb4IjRdxebeDMF92KM8/exec", // "https://script.google.com/macros/s/XXXX/exec"

  weddingDateISO: "2026-10-17T11:00:00+08:00",

  /**
   * Background music / lyric video:
   * - Uses assets/nuca-lyric.mp4 in the floating glass player.
   * - Leave youtubeVideoId empty (video file is preferred).
   */
  youtubeVideoId: "",

  /**
   * Start the video at this time when doors open (seconds).
   * Examples: 0 = beginning, 90 = 1:30, 125 = 2:05
   */
  musicStartSeconds: 57, // 0:57
};
