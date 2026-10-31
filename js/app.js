// ============================================================
// app.js — the page: overview, chart, list, add/edit sheets
// ============================================================

import { load, save, backupFile, parseBackup, shareFile } from "./storage.js";
import {
  MONTHS, MON, money, moneyRound, ordinal, niceDate, shortDate,
  dueIn, nextDue, status, perMonth, freqText, upcoming, parseAmount, startOfDay,
} from "./bills.js";

// ---------- label colours ----------
// Presets get fixed colours; your own labels get one picked from the name.
const PRESETS = ["Rent", "Car", "Groceries", "Utilities", "Insurance", "Phone", "Subscriptions", "Health"];
const PRESET_COLOURS = {
  Rent: "#2f7a5f", Car: "#d9822b", Groceries: "#6c9a3a", Utilities: "#3d8bb3",
  Insurance: "#6b6fc4", Phone: "#c2577a", Subscriptions: "#b5432f", Health: "#2a9d8f", Other: "#8a958f",
};
const EXTRA = ["#a0703f", "#7b5aa8", "#4a8f6a", "#b38a2f", "#3f6fb0", "#a85a8a"];
function labelColour(label) {
  const l = label || "Other";
  if (PRESET_COLOURS[l]) return PRESET_COLOURS[l];
  let h = 0; for (const c of l) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

// ---------- state ----------
let data = load();
let selectedDay = null;           // index into the 30-day chart
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const newId = () => "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function persist() {
  if (!save(data)) toast("Couldn't save on this phone. Storage may be full or blocked.");
  render();
}

// ============================================================
// Render
// ============================================================
function render() {
  const today = new Date();
  $("todayLabel").textContent = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  const active = data.bills.filter(b => status(b, today) === "active");
  const monthly = active.reduce((s, b) => s + perMonth(b), 0);

  // hero
  $("total").textContent = money(monthly);
  const spread = active.some(b => b.freq !== "monthly");
  $("totalSub").innerHTML = data.bills.length
    ? `${active.length} active ${active.length === 1 ? "bill" : "bills"} · <b>${moneyRound(monthly * 12)}</b> a year` +
      (spread ? `<br>Yearly and 3-monthly bills are spread out per month.` : "")
    : "Add your first bill to see where your money goes.";

  renderLabels(active, monthly);
  renderChart(active, today);
  renderList(today);
}

function renderLabels(active, monthly) {
  const by = {};
  active.forEach(b => {
    const l = b.label || "Other";
    by[l] = by[l] || { total: 0, count: 0 };
    by[l].total += perMonth(b); by[l].count++;
  });
  const rows = Object.entries(by).sort((a, b) => b[1].total - a[1].total);
  $("labelsCard").hidden = !rows.length;
  if (!rows.length) return;
  $("stackbar").innerHTML = rows.map(([l, v]) =>
    `<span style="width:${(v.total / monthly) * 100}%;background:${labelColour(l)}"></span>`).join("");
  $("labels").innerHTML = rows.map(([l, v]) => `
    <li><button class="lab-row" data-label="${esc(l)}" aria-label="Show ${esc(l)} bills">
      <span class="lab-name"><i class="dot" style="background:${labelColour(l)}"></i><span>${esc(l)}</span><small>${v.count}×</small></span>
      <span class="lab-month">${money(v.total)}</span>
      <span class="lab-year">${moneyRound(v.total * 12)}</span>
      <svg class="chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button></li>`).join("");
  $("labels").querySelectorAll(".lab-row").forEach(el => el.onclick = () => openLabel(el.dataset.label));
}

// ---------- one label's bills (pop-up) ----------
function openLabel(label) {
  const today = new Date();
  const mine = data.bills.filter(b => (b.label || "Other") === label);
  const byDay = (a, b) => a.day - b.day || a.name.localeCompare(b.name);
  const active = mine.filter(b => status(b, today) === "active").sort(byDay);
  const other = mine.filter(b => status(b, today) !== "active").sort(byDay);
  const perM = active.reduce((s, b) => s + perMonth(b), 0);
  openSheet(`
    <div class="sheet-head">
      <div>
        <span class="chip"><i style="background:${labelColour(label)}"></i>${active.length} active ${active.length === 1 ? "bill" : "bills"}</span>
        <h3 style="margin-top:10px">${esc(label)}</h3>
      </div>
      <button class="close" data-close aria-label="Close">✕</button>
    </div>
    <div class="big-amt">${money(perM)}<small class="amt-sub">per month · ${moneyRound(perM * 12)} a year</small></div>
    ${active.length ? `<div class="list">${active.map(b => billRow(b, today)).join("")}</div>` : ""}
    ${other.length ? `<div class="subhead" style="padding-top:0">Not active now</div><div class="list">${other.map(b => billRow(b, today, true)).join("")}</div>` : ""}
  `);
  root.querySelectorAll(".bill").forEach(el => el.onclick = () => openDetail(el.dataset.id, label));
}

// ---------- 30-day chart ----------
function renderChart(active, today) {
  // Include bills that start within the next 30 days too.
  const relevant = data.bills.filter(b => status(b, today) !== "ended");
  const days = upcoming(relevant, today, 30);
  const total = days[days.length - 1].running;
  $("chartCard").hidden = !data.bills.length;
  if (!data.bills.length) return;
  $("chartTotal").textContent = moneyRound(total) + " going out";

  const el = $("chart");
  const W = Math.max(280, Math.round(el.clientWidth || 320));
  const H = 190, padL = 2, padR = 2, padT = 22, padB = 26;
  const plotH = H - padT - padB;
  const max = Math.max(total, 1);
  const bw = (W - padL - padR) / days.length;
  const x = i => padL + i * bw;
  const y = v => padT + plotH * (1 - v / max);
  const base = y(0);

  // Running total as a step area
  let line = `M${x(0)},${base}`;
  let prev = 0;
  days.forEach((d, i) => { line += ` L${x(i)},${y(prev)} L${x(i)},${y(d.running)}`; prev = d.running; });
  line += ` L${x(days.length)},${y(prev)}`;
  const area = line + ` L${x(days.length)},${base} Z`;

  const grid = [0.5, 1].map(f => {
    const yy = y(max * f);
    return `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-dasharray="3 4"/>`;
  }).join("");

  const bars = days.map((d, i) => {
    if (!d.amount) return "";
    const h = Math.max(base - y(d.amount), 3);
    const sel = i === selectedDay;
    return `<rect x="${x(i) + bw * 0.18}" y="${base - h}" width="${Math.max(bw * 0.64, 3)}" height="${h}" rx="2"
      fill="var(--accent)" opacity="${selectedDay == null || sel ? 1 : 0.45}"/>`;
  }).join("");

  // x-axis: today, every 7 days, and month starts
  const ticks = days.map((d, i) => {
    const first = d.date.getDate() === 1 && i > 0;
    let out = "";
    if (first) out += `<line x1="${x(i)}" x2="${x(i)}" y1="${padT - 6}" y2="${base}" stroke="var(--muted)" stroke-opacity=".35"/>
      <text x="${x(i) + 4}" y="${padT - 9}" class="lbl-strong">${MONTHS[d.date.getMonth()]}</text>`;
    if (i === 0) out += `<text x="${x(0)}" y="${H - 8}" class="lbl-strong">Today</text>`;
    else if (i % 7 === 0 && i < days.length - 3) out += `<text x="${x(i) + bw / 2}" y="${H - 8}" text-anchor="middle">${d.date.getDate()} ${MON[d.date.getMonth()]}</text>`;
    return out;
  }).join("");

  const selLine = selectedDay != null
    ? `<line x1="${x(selectedDay) + bw / 2}" x2="${x(selectedDay) + bw / 2}" y1="${padT - 4}" y2="${base}" stroke="var(--ink)" stroke-width="1.2"/>
       <circle cx="${x(selectedDay) + bw / 2}" cy="${y(days[selectedDay].running)}" r="4" fill="var(--surface)" stroke="var(--area-line)" stroke-width="2"/>`
    : "";

  const hits = days.map((d, i) =>
    `<rect data-i="${i}" x="${x(i)}" y="0" width="${bw}" height="${H}" fill="transparent"/>`).join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img"
      aria-label="Money going out over the next 30 days, ${money(total)} in total">
    ${grid}
    <text x="${W - padR}" y="${y(max) - 6}" text-anchor="end">${moneyRound(max)}</text>
    <path d="${area}" fill="var(--area)"/>
    <path d="${line}" fill="none" stroke="var(--area-line)" stroke-width="2" stroke-linejoin="round"/>
    ${bars}
    <line x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}" stroke="var(--line)"/>
    ${ticks}${selLine}${hits}
  </svg>`;

  el.querySelectorAll("rect[data-i]").forEach(r => r.addEventListener("click", () => {
    const i = +r.dataset.i;
    // Tapping an empty day jumps to the nearest day with a payment
    let pick = i;
    if (!days[i].amount) {
      let best = null;
      days.forEach((d, j) => { if (d.amount && (best == null || Math.abs(j - i) < Math.abs(best - i))) best = j; });
      pick = best;
    }
    selectedDay = pick === selectedDay ? null : pick;
    renderChart(active, today);
  }));

  // Info box under the chart
  const info = $("chartInfo");
  if (selectedDay != null && days[selectedDay]) {
    const d = days[selectedDay];
    info.innerHTML = `<div class="ci-top"><span>${shortDate(d.date)}</span><span>${money(d.amount)}</span></div>
      <div class="ci-sub">${d.items.map(b => esc(b.name)).join(", ")}</div>
      <div class="ci-sub">${money(d.running)} out by the end of this day</div>`;
  } else {
    const paying = days.filter(d => d.amount);
    if (!paying.length) { info.innerHTML = `<div class="ci-sub">Nothing goes out in the next 30 days.</div>`; return; }
    const big = paying.reduce((a, b) => (b.amount > a.amount ? b : a));
    const next = paying[0];
    info.innerHTML = `<div class="ci-top"><span>Next: ${shortDate(next.date)}</span><span>${money(next.amount)}</span></div>
      <div class="ci-sub">Biggest day is ${shortDate(big.date)} with ${money(big.amount)}. Tap the chart for any day.</div>`;
  }
}

// ---------- list ----------
function renderList(today) {
  const wrap = $("billList");
  const bills = data.bills;
  $("countNote").textContent = bills.length ? `by day of the month` : "";

  if (!bills.length) {
    wrap.innerHTML = `<div class="empty">
      <strong>No bills yet</strong>
      <span>Add your rent, car, phone, subscriptions and anything else that goes out every month.</span>
      <button class="btn primary" id="emptyAdd">Add your first bill</button>
      <button class="btn" id="loadEx">Try it with example bills</button>
    </div>`;
    $("emptyAdd").onclick = () => openForm();
    $("loadEx").onclick = loadExamples;
    return;
  }

  const byDay = (a, b) => a.day - b.day || a.name.localeCompare(b.name);
  const active = bills.filter(b => status(b, today) === "active").sort(byDay);
  const later = bills.filter(b => status(b, today) === "later").sort(byDay);
  const ended = bills.filter(b => status(b, today) === "ended").sort(byDay);

  let html = active.length ? `<div class="list">${active.map(b => billRow(b, today)).join("")}</div>` : "";
  if (later.length) html += `<div class="subhead">Starting later</div><div class="list">${later.map(b => billRow(b, today, true)).join("")}</div>`;
  if (ended.length) html += `<div class="subhead">Ended</div><div class="list">${ended.map(b => billRow(b, today, true)).join("")}</div>`;
  wrap.innerHTML = html;
  wrap.querySelectorAll(".bill").forEach(el => el.onclick = () => openDetail(el.dataset.id));
}

function billRow(b, today, off = false) {
  const st = status(b, today);
  const nd = nextDue(b, today);
  let when;
  if (st === "ended") when = "Ended " + niceDate(b.end);
  else if (st === "later") when = "Starts " + niceDate(b.start);
  else when = nd ? "Next " + shortDate(nd) : "No more payments";
  const sfx = ordinal(b.day).replace(/\d+/, "");
  return `<button class="bill${off ? " off" : ""}" data-id="${esc(b.id)}">
    <span class="daybadge"><b>${b.day}</b><small>${sfx}</small></span>
    <span class="bill-main">
      <span class="bill-name">${esc(b.name)}</span>
      <span class="bill-meta">
        <span class="chip"><i style="background:${labelColour(b.label)}"></i>${esc(b.label || "Other")}</span>
        ${b.example ? `<span class="chip example">example</span>` : ""}
        <span>${esc(when)}</span>
      </span>
    </span>
    <span class="bill-amt"><b>${money(b.amount)}</b>${b.freq !== "monthly" ? `<small>${b.freq === "yearly" ? "per year" : "per 3 months"}</small>` : ""}</span>
  </button>`;
}

// ============================================================
// Sheets
// ============================================================
const root = $("sheetRoot");
let lastFocus = null;
function openSheet(inner) {
  lastFocus = document.activeElement;
  root.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${inner}</div></div>`;
  $("scrim").addEventListener("click", e => { if (e.target.id === "scrim") closeSheet(); });
  root.querySelectorAll("[data-close]").forEach(b => b.onclick = closeSheet);
  document.body.style.overflow = "hidden";
}
function closeSheet() {
  root.innerHTML = "";
  document.body.style.overflow = "";
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && root.innerHTML) closeSheet(); });

// ---------- detail ----------
// `fromLabel` is set when opened from a label pop-up, so "Back" returns there.
function openDetail(id, fromLabel = null) {
  const b = data.bills.find(x => x.id === id);
  if (!b) return;
  const nd = nextDue(b, new Date());
  openSheet(`
    ${fromLabel ? `<button class="back-link" id="backToLabel">‹ ${esc(fromLabel)}</button>` : ""}
    <div class="sheet-head">
      <div>
        <span class="chip"><i style="background:${labelColour(b.label)}"></i>${esc(b.label || "Other")}</span>
        <h3 style="margin-top:10px">${esc(b.name)}</h3>
      </div>
      <button class="close" data-close aria-label="Close">✕</button>
    </div>
    <div class="big-amt">${money(b.amount)} <small>${b.freq === "yearly" ? "per year" : b.freq === "quarterly" ? "every 3 months" : "per month"}</small></div>
    <dl class="facts">
      <div><dt>Leaves your account</dt><dd>${ordinal(b.day)} of the month</dd></div>
      <div><dt>Repeats</dt><dd>${freqText(b)}</dd></div>
      <div><dt>Next payment</dt><dd>${nd ? shortDate(nd) : "None"}</dd></div>
      <div><dt>Start</dt><dd>${b.start ? niceDate(b.start) : "Not set"}</dd></div>
      <div><dt>End</dt><dd>${b.end ? niceDate(b.end) : "Ongoing"}</dd></div>
      ${b.freq !== "monthly" ? `<div><dt>Spread per month</dt><dd>${money(perMonth(b))}</dd></div>` : ""}
      <div><dt>Per year</dt><dd>${money(perMonth(b) * 12)}</dd></div>
    </dl>
    <div id="detailActions" class="btn-row">
      <button class="btn danger" id="delBtn">Delete</button>
      <button class="btn primary" id="editBtn">Edit</button>
    </div>`);
  if (fromLabel) $("backToLabel").onclick = () => openLabel(fromLabel);
  $("editBtn").onclick = () => openForm(b);
  $("delBtn").onclick = () => {
    $("detailActions").outerHTML = `<div class="confirm">
      <span>Delete <b>${esc(b.name)}</b>? This can't be undone.</span>
      <div class="btn-row"><button class="btn" id="keepBtn">Keep it</button><button class="btn danger-solid" id="yesDel">Delete</button></div>
    </div>`;
    $("keepBtn").onclick = () => openDetail(id, fromLabel);
    $("yesDel").onclick = () => {
      data.bills = data.bills.filter(x => x.id !== id);
      selectedDay = null;
      persist(); closeSheet(); toast("Bill deleted");
    };
  };
}

// ---------- add / edit form ----------
function openForm(existing) {
  const isNew = !existing;
  const today = new Date();
  const b = existing ? { ...existing } : {
    id: newId(), name: "", amount: "", label: "", day: today.getDate(),
    freq: "monthly", month: today.getMonth() + 1, start: "", end: "",
  };
  const labels = [...new Set([...PRESETS, ...data.bills.map(x => x.label).filter(Boolean)])];
  const amountText = b.amount === "" ? "" : String(b.amount.toFixed ? b.amount.toFixed(2) : b.amount).replace(".", ",");

  openSheet(`
    <div class="sheet-head">
      <h3>${isNew ? "Add a bill" : "Edit bill"}</h3>
      <button class="close" data-close aria-label="Close">✕</button>
    </div>
    <form id="billForm" novalidate>
      <div class="field">
        <label for="fName">Name</label>
        <input id="fName" value="${esc(b.name)}" placeholder="e.g. Car insurance" autocomplete="off" enterkeyhint="next">
      </div>
      <div class="row2">
        <div class="field">
          <label for="fAmt">Amount</label>
          <div class="money-input"><span>€</span><input id="fAmt" inputmode="decimal" value="${esc(amountText)}" placeholder="0,00" autocomplete="off"></div>
        </div>
        <div class="field">
          <label for="fDay">Day it goes out</label>
          <select id="fDay">${Array.from({ length: 31 }, (_, i) =>
            `<option value="${i + 1}"${b.day === i + 1 ? " selected" : ""}>${ordinal(i + 1)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field">
        <label for="fLabel">Label</label>
        <input id="fLabel" value="${esc(b.label)}" placeholder="Pick one below or type your own" autocomplete="off">
        <div class="presets" id="presets">${labels.map(l =>
          `<button type="button" aria-pressed="${l === b.label}">${esc(l)}</button>`).join("")}</div>
      </div>
      <div class="field">
        <span class="lbl">How often</span>
        <div class="seg" id="fFreq">${[["monthly", "Monthly"], ["quarterly", "Every 3 mo"], ["yearly", "Yearly"]].map(([v, t]) =>
          `<button type="button" data-v="${v}" aria-pressed="${b.freq === v}">${t}</button>`).join("")}</div>
      </div>
      <div class="field" id="monthField" ${b.freq === "monthly" ? "hidden" : ""}>
        <label for="fMonth" id="monthLbl">${b.freq === "quarterly" ? "First month it's paid" : "Month it's paid"}</label>
        <select id="fMonth">${MONTHS.map((n, i) => `<option value="${i + 1}"${b.month === i + 1 ? " selected" : ""}>${n}</option>`).join("")}</select>
        <span class="hint" id="monthHint"></span>
      </div>
      <div class="field">
        <label for="fStart">Start date <span class="opt">(optional)</span></label>
        <input id="fStart" type="date" value="${esc(b.start)}">
      </div>
      <div class="field">
        <span class="lbl">End</span>
        <div class="seg" id="fEndMode">
          <button type="button" data-v="ongoing" aria-pressed="${!b.end}">Ongoing</button>
          <button type="button" data-v="date" aria-pressed="${!!b.end}">On a date</button>
        </div>
        <input id="fEnd" type="date" value="${esc(b.end)}" aria-label="End date" ${b.end ? "" : "hidden"}>
      </div>
      <div class="err" id="formErr"></div>
      <div class="btn-row">
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn primary">${isNew ? "Add bill" : "Save"}</button>
      </div>
    </form>`);

  root.querySelectorAll("[data-close]").forEach(x => x.onclick = closeSheet);

  // label presets
  const lab = $("fLabel");
  const syncPresets = () => root.querySelectorAll("#presets button")
    .forEach(p => p.setAttribute("aria-pressed", p.textContent === lab.value.trim()));
  root.querySelectorAll("#presets button").forEach(p => p.onclick = () => { lab.value = p.textContent; syncPresets(); });
  lab.addEventListener("input", syncPresets);

  // frequency
  let freq = b.freq;
  const monthHint = () => {
    const m = +$("fMonth").value - 1;
    $("monthHint").textContent = freq === "quarterly"
      ? "Paid in " + [0, 3, 6, 9].map(k => MON[(m + k) % 12]).join(", ") + "."
      : "";
  };
  root.querySelectorAll("#fFreq button").forEach(btn => btn.onclick = () => {
    freq = btn.dataset.v;
    root.querySelectorAll("#fFreq button").forEach(o => o.setAttribute("aria-pressed", o === btn));
    $("monthField").hidden = freq === "monthly";
    $("monthLbl").textContent = freq === "quarterly" ? "First month it's paid" : "Month it's paid";
    monthHint();
  });
  $("fMonth").addEventListener("change", monthHint);
  monthHint();

  // end mode
  const endIn = $("fEnd");
  root.querySelectorAll("#fEndMode button").forEach(btn => btn.onclick = () => {
    root.querySelectorAll("#fEndMode button").forEach(o => o.setAttribute("aria-pressed", o === btn));
    endIn.hidden = btn.dataset.v !== "date";
  });

  $("billForm").addEventListener("submit", e => {
    e.preventDefault();
    const err = $("formErr");
    const name = $("fName").value.trim();
    const amount = parseAmount($("fAmt").value);
    const start = $("fStart").value;
    const end = endIn.hidden ? "" : endIn.value;
    if (!name) { err.textContent = "Give the bill a name."; $("fName").focus(); return; }
    if (!(amount > 0)) { err.textContent = "Enter an amount above zero, like 49,95."; $("fAmt").focus(); return; }
    if (!endIn.hidden && !end) { err.textContent = "Pick an end date, or choose Ongoing."; return; }
    if (start && end && end < start) { err.textContent = "The end date is before the start date."; return; }

    const out = {
      id: b.id, name, amount: Math.round(amount * 100) / 100,
      label: lab.value.trim() || "Other",
      day: +$("fDay").value, freq, month: +$("fMonth").value, start, end,
    };
    const i = data.bills.findIndex(x => x.id === b.id);
    if (i >= 0) data.bills[i] = out; else data.bills.push(out);
    selectedDay = null;
    persist(); closeSheet();
    toast(isNew ? "Bill added" : "Changes saved");
  });
}

// ---------- backup / restore sheet ----------
function openData() {
  const last = data.lastBackup ? "Last backup " + niceDate(new Date(data.lastBackup)) : "No backup made yet";
  const hasExamples = data.bills.some(b => b.example);
  openSheet(`
    <div class="sheet-head">
      <h3>Your data</h3>
      <button class="close" data-close aria-label="Close">✕</button>
    </div>
    <p class="hint" style="margin:0">Bills are saved in this browser on this phone. Back up before updating the app, clearing Safari data or changing phones.</p>
    <div class="data-list">
      <button class="data-item" id="doBackup">
        <span class="ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg></span>
        <span><b>Back up</b><span>${esc(last)} · ${data.bills.length} ${data.bills.length === 1 ? "bill" : "bills"}</span></span>
      </button>
      <button class="data-item" id="doRestore">
        <span class="ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 10l5 5 5-5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg></span>
        <span><b>Restore from backup</b><span>Replaces the bills on this phone</span></span>
      </button>
      ${hasExamples ? `<button class="data-item" id="clearEx">
        <span class="ico"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
        <span><b>Remove example bills</b><span>Keeps the ones you added</span></span>
      </button>` : ""}
    </div>
    <div id="restoreArea"></div>`);

  $("doBackup").onclick = async () => {
    const result = await shareFile(backupFile(data));
    if (result === "cancelled") return;
    data.lastBackup = new Date().toISOString();
    save(data);
    closeSheet();
    toast(result === "shared" ? "Backup ready to save" : "Backup downloaded");
  };
  $("doRestore").onclick = () => { $("restoreInput").value = ""; $("restoreInput").click(); };
  if (hasExamples) $("clearEx").onclick = () => {
    data.bills = data.bills.filter(b => !b.example);
    persist(); closeSheet(); toast("Example bills removed");
  };
}

$("restoreInput").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const area = $("restoreArea");
  try {
    const restored = parseBackup(await file.text());
    const show = html => { if (area) area.innerHTML = html; };
    show(`<div class="confirm">
      <span>This backup has <b>${restored.bills.length}</b> ${restored.bills.length === 1 ? "bill" : "bills"}. Replace the ${data.bills.length} on this phone?</span>
      <div class="btn-row"><button class="btn" id="noRestore">Cancel</button><button class="btn primary" id="yesRestore">Replace</button></div>
    </div>`);
    $("noRestore").onclick = () => show("");
    $("yesRestore").onclick = () => {
      data = { ...restored, lastBackup: data.lastBackup };
      selectedDay = null;
      persist(); closeSheet(); toast("Backup restored");
    };
  } catch (x) {
    if (area) area.innerHTML = `<div class="err">${esc(x.message)}</div>`;
  }
});

// ---------- examples ----------
function loadExamples() {
  const ex = [
    ["Rent", 925, "Rent", 1], ["Health insurance", 151.95, "Insurance", 1], ["Car insurance", 64.5, "Car", 3],
    ["Groceries budget", 280, "Groceries", 5], ["Spotify", 11.99, "Subscriptions", 8], ["Netflix", 13.99, "Subscriptions", 14],
    ["Phone plan", 17.5, "Phone", 12], ["Energy", 145, "Utilities", 15], ["Fuel", 120, "Car", 20], ["Water", 22.8, "Utilities", 24],
  ];
  data.bills = ex.map(([name, amount, label, day]) => ({
    id: newId(), name, amount, label, day, freq: "monthly", month: 1, start: "", end: "", example: true,
  }));
  data.bills.push({ id: newId(), name: "Car service", amount: 240, label: "Car", day: 15, freq: "yearly", month: 3, start: "", end: "", example: true });
  persist();
  toast("Examples loaded. Remove them from the ⋯ menu.");
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- wire up ----------
$("addBtn").onclick = () => openForm();
$("dataBtn").onclick = openData;
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
// Re-check dates when the app comes back to the front (e.g. the next day)
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
render();
