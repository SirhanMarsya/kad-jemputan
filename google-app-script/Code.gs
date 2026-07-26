/**
 * Google Apps Script — Wedding Invitation backend
 * Sheet: https://docs.google.com/spreadsheets/d/1L2Ovgv5TKJoNY1wRTuI2cm2T3yaZGB7h13xoUbvZ5Fs
 *
 * Tabs used:
 *   - rsvp    → Name | Attend | Guests | Phone | Timestamp | Id
 *   - wishes  → Name | Wish | Timestamp
 *
 * SETUP / RE-DEPLOY (required after this update)
 * 1. Extensions → Apps Script → replace Code.gs with this file
 * 2. Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy
 *    (or New deployment if first time)
 * 3. Keep: Execute as Me, Who has access: Anyone
 * 4. js/config.js scriptUrl should already point at this web app
 *
 * RSVP API
 *   POST { type:"rsvp", action:"create"|"update"|"delete", id, name, attend, guests, phone }
 *   GET  ?type=rsvp&id=XXXX
 */

var SPREADSHEET_ID = "1L2Ovgv5TKJoNY1wRTuI2cm2T3yaZGB7h13xoUbvZ5Fs";
var SHEET_RSVP = "rsvp";
var SHEET_WISHES = "wishes";

function doGet(e) {
  var type = (e && e.parameter && e.parameter.type) || "wishes";
  var id = (e && e.parameter && e.parameter.id) || "";

  try {
    if (type === "wishes") {
      return jsonResponse({ ok: true, wishes: getWishes_() });
    }
    if (type === "rsvp") {
      if (!id) {
        return jsonResponse({ ok: false, error: "Missing id" });
      }
      var row = getRsvpById_(id);
      if (!row) {
        return jsonResponse({ ok: false, error: "RSVP not found", missing: true });
      }
      return jsonResponse({ ok: true, rsvp: row });
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
      var action = String(data.action || "create").toLowerCase();
      if (action === "create") {
        var created = upsertRsvp_(data, false);
        return jsonResponse({ ok: true, rsvp: created });
      }
      if (action === "update") {
        var updated = upsertRsvp_(data, true);
        return jsonResponse({ ok: true, rsvp: updated });
      }
      if (action === "delete") {
        var removed = deleteRsvp_(data.id);
        if (!removed) {
          return jsonResponse({ ok: false, error: "RSVP not found", missing: true });
        }
        return jsonResponse({ ok: true, deleted: true });
      }
      return jsonResponse({ ok: false, error: "Unknown RSVP action" });
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

/** Create or update an RSVP row. Must include id from the client. */
function upsertRsvp_(data, mustExist) {
  var sheet = getSheet_(SHEET_RSVP);
  ensureHeaders_(sheet, SHEET_RSVP);

  var id = String(data.id || "").trim();
  if (!id) {
    throw new Error("Missing RSVP id");
  }

  var name = String(data.name || "").trim();
  var attend = String(data.attend || "").trim();
  var guests = Number(data.guests) || 0;
  var phone = String(data.phone || data.message || "").trim();
  var now = new Date();

  var rowIndex = findRsvpRowIndexById_(sheet, id);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, 6).setValues([
      [name, attend, guests, phone, now, id],
    ]);
  } else {
    if (mustExist) {
      throw new Error("RSVP not found");
    }
    sheet.appendRow([name, attend, guests, phone, now, id]);
  }

  return {
    id: id,
    name: name,
    attend: attend,
    guests: guests,
    phone: phone,
    time: now.toISOString(),
  };
}

function deleteRsvp_(id) {
  id = String(id || "").trim();
  if (!id) return false;
  var sheet = getSheet_(SHEET_RSVP);
  ensureHeaders_(sheet, SHEET_RSVP);
  var rowIndex = findRsvpRowIndexById_(sheet, id);
  if (rowIndex < 1) return false;
  sheet.deleteRow(rowIndex);
  return true;
}

function getRsvpById_(id) {
  id = String(id || "").trim();
  if (!id) return null;
  var sheet = getSheet_(SHEET_RSVP);
  ensureHeaders_(sheet, SHEET_RSVP);
  var rowIndex = findRsvpRowIndexById_(sheet, id);
  if (rowIndex < 1) return null;
  var r = sheet.getRange(rowIndex, 1, 1, 6).getValues()[0];
  return {
    id: String(r[5] || id),
    name: String(r[0] || ""),
    attend: String(r[1] || ""),
    guests: Number(r[2]) || 0,
    phone: String(r[3] || ""),
    time: r[4] ? new Date(r[4]).toISOString() : "",
  };
}

/** Id lives in column F (index 5). Returns 1-based row index or -1. */
function findRsvpRowIndexById_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 6, last, 6).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || "").trim() === id) {
      return i + 2;
    }
  }
  return -1;
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
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw err;
  }
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);

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
  var width = name === SHEET_RSVP ? 6 : 3;
  var first = sheet.getRange(1, 1, 1, width).getValues()[0];
  var hasHeader = String(first[0] || "").trim() !== "";

  if (name === SHEET_RSVP) {
    if (!hasHeader) {
      sheet.getRange(1, 1, 1, 6).setValues([
        ["Name", "Attend", "Guests", "Phone", "Timestamp", "Id"],
      ]);
      return;
    }
    // Older sheets: add Id header in column F if missing
    if (String(first[5] || "").trim() === "") {
      sheet.getRange(1, 6).setValue("Id");
    }
    return;
  }

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, 3).setValues([["Name", "Wish", "Timestamp"]]);
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
