/**
 * Google Apps Script — Wedding Invitation backend
 * Sheet: https://docs.google.com/spreadsheets/d/1L2Ovgv5TKJoNY1wRTuI2cm2T3yaZGB7h13xoUbvZ5Fs
 *
 * Tabs used:
 *   - rsvp    → Name | Attend | Guests | Phone | Timestamp
 *   - wishes  → Name | Wish | Timestamp
 *
 * SETUP
 * 1. Open the Google Sheet above
 * 2. Confirm two tabs named exactly: rsvp | wishes
 *    (create them if missing; headers are added automatically)
 * 3. Extensions → Apps Script → paste this entire file (replace any default code)
 * 4. Deploy → New deployment → type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Authorize when prompted
 * 6. Copy the Web app URL
 * 7. Paste it into js/config.js → scriptUrl: "https://script.google.com/macros/s/XXXX/exec"
 */

var SPREADSHEET_ID = "1L2Ovgv5TKJoNY1wRTuI2cm2T3yaZGB7h13xoUbvZ5Fs";
var SHEET_RSVP = "rsvp";
var SHEET_WISHES = "wishes";

function doGet(e) {
  var type = (e && e.parameter && e.parameter.type) || "wishes";

  try {
    if (type === "wishes") {
      return jsonResponse({ ok: true, wishes: getWishes_() });
    }
    return jsonResponse({ ok: false, error: "Unknown type" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || "{}";
    var data = JSON.parse(raw);
    var type = data.type || "";

    if (type === "rsvp") {
      appendRsvp_(data);
      return jsonResponse({ ok: true });
    }

    if (type === "wish") {
      appendWish_(data);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: "Unknown type" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function appendRsvp_(data) {
  var sheet = getSheet_(SHEET_RSVP);
  ensureHeaders_(sheet, SHEET_RSVP);
  sheet.appendRow([
    String(data.name || "").trim(),
    String(data.attend || "").trim(),
    Number(data.guests) || 0,
    String(data.phone || data.message || "").trim(),
    new Date(),
  ]);
}

function appendWish_(data) {
  var sheet = getSheet_(SHEET_WISHES);
  ensureHeaders_(sheet, SHEET_WISHES);
  sheet.appendRow([
    String(data.name || "").trim(),
    String(data.wish || "").trim(),
    new Date(),
  ]);
}

function getWishes_() {
  var sheet = getSheet_(SHEET_WISHES);
  ensureHeaders_(sheet, SHEET_WISHES);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  // newest first (skip header)
  var rows = values.slice(1).reverse();
  return rows
    .filter(function (r) {
      return r[0] && r[1];
    })
    .slice(0, 50)
    .map(function (r) {
      return {
        name: String(r[0]),
        wish: String(r[1]),
        time: r[2] ? new Date(r[2]).toISOString() : "",
      };
    });
}

function getSpreadsheet_() {
  // Prefer opening by ID so it always hits your wedding sheet
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    // Fallback if script is bound to the sheet
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw err;
  }
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);

  // Tolerate common name variants
  if (!sheet) {
    var alt =
      name === SHEET_RSVP
        ? ["RSVP", "Rsvp"]
        : ["Wishes", "Wish", "wishes "];
    for (var i = 0; i < alt.length; i++) {
      sheet = ss.getSheetByName(alt[i]);
      if (sheet) break;
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function ensureHeaders_(sheet, name) {
  var first = sheet.getRange(1, 1, 1, 5).getValues()[0];
  var hasHeader = String(first[0] || "").trim() !== "";
  if (hasHeader) return;

  if (name === SHEET_RSVP) {
    sheet.getRange(1, 1, 1, 5).setValues([
      ["Name", "Attend", "Guests", "Phone", "Timestamp"],
    ]);
  } else if (name === SHEET_WISHES) {
    sheet.getRange(1, 1, 1, 3).setValues([["Name", "Wish", "Timestamp"]]);
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
