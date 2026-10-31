// ============================================================
// storage.js — saving, loading, backup and restore
//
// All data lives in this phone's browser (localStorage) under one
// key. Nothing is sent anywhere. To change where data is kept later,
// only this file needs to change: keep the same function names.
// ============================================================

const KEY = "monthly-bills:v1";

// Bump this when the data shape changes, and add a step in migrate().
export const DATA_VERSION = 1;

/*
  A bill looks like this:
  {
    id:     "b1abc",
    name:   "Car insurance",
    amount: 64.5,            // euros
    label:  "Car",
    day:    3,               // day of the month it leaves the account (1–31)
    freq:   "monthly" | "quarterly" | "yearly",
    month:  3,               // 1–12, which month for quarterly/yearly bills
    start:  "2026-01-01" | "",   // empty = no start date
    end:    "2027-06-30" | "",   // empty = ongoing
    example: true            // only on example bills
  }
*/

function emptyData() {
  return { version: DATA_VERSION, bills: [], lastBackup: null };
}

// Upgrade older saved data to the current shape.
function migrate(data) {
  const d = { ...emptyData(), ...data };
  d.bills = Array.isArray(data.bills) ? data.bills : [];
  // if (d.version < 2) { ...change shape... ; d.version = 2 }
  d.version = DATA_VERSION;
  return d;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyData();
  } catch (e) {
    console.error("Could not read saved data", e);
    return emptyData();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Could not save", e);
    return false;
  }
}

// ---------- Backup & restore ----------

export function backupFile(data) {
  const stamp = new Date().toISOString().slice(0, 10);
  const { lastBackup, ...rest } = data;
  const json = JSON.stringify({ app: "monthly-bills", exportedAt: new Date().toISOString(), ...rest }, null, 2);
  return { name: `bills-backup-${stamp}.json`, text: json, type: "application/json" };
}

// Returns the restored data, or throws an Error with a readable message.
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("That file isn't a valid backup (not JSON)."); }
  if (obj.app !== "monthly-bills" || !Array.isArray(obj.bills)) {
    throw new Error("That file doesn't look like a Monthly Bills backup.");
  }
  delete obj.app; delete obj.exportedAt;
  return migrate(obj);
}

// Saves a file to the phone. On iPhone this opens the share sheet
// ("Save to Files", AirDrop, mail…). Elsewhere it downloads the file.
// Resolves "shared", "downloaded" or "cancelled".
export async function shareFile({ name, text, type }) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // fall through to a normal download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
