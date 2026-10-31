// ============================================================
// bills.js — date and money rules (no page code in here)
// ============================================================

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const MON = MONTHS.map(m => m.slice(0, 3));

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
export const money = v => euro.format(v || 0);
// Round euros for small labels, e.g. "€ 1.077"
const euro0 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const moneyRound = v => euro0.format(v || 0);

export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function niceDate(s) {
  const d = typeof s === "string" ? parseDate(s) : s;
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}
export function shortDate(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* Does bill b leave the account in month m (0–11) of year y?
   Returns the actual day (31 becomes 30 in November), or null. */
export function dueIn(b, y, m) {
  const day = Math.min(b.day || 1, daysInMonth(y, m));
  const date = new Date(y, m, day);
  const s = parseDate(b.start), e = parseDate(b.end);
  if (s && date < s) return null;
  if (e && date > e) return null;
  const anchor = (b.month || 1) - 1;
  if (b.freq === "quarterly" && ((m - anchor) % 3 + 3) % 3 !== 0) return null;
  if (b.freq === "yearly" && m !== anchor) return null;
  return day;
}

/* Next date (from `from`, inclusive) this bill is paid, or null if never again. */
export function nextDue(b, from) {
  const f = startOfDay(from);
  for (let i = 0; i < 26; i++) {
    const y = f.getFullYear(), m = f.getMonth() + i;
    const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12;
    const d = dueIn(b, yy, mm);
    if (d != null) {
      const date = new Date(yy, mm, d);
      if (date >= f) return date;
    }
  }
  return null;
}

/* "active" | "later" (start date in the future) | "ended" */
export function status(b, today) {
  const t = startOfDay(today);
  const s = parseDate(b.start), e = parseDate(b.end);
  if (e && e < t) return "ended";
  if (s && s > t) return "later";
  return "active";
}

/* What this bill costs per month on average. */
export function perMonth(b) {
  if (b.freq === "yearly") return b.amount / 12;
  if (b.freq === "quarterly") return b.amount / 3;
  return b.amount;
}

export function freqText(b) {
  if (b.freq === "yearly") return "Yearly in " + MONTHS[(b.month || 1) - 1];
  if (b.freq === "quarterly") return "Every 3 months";
  return "Monthly";
}

/* Payments over the next `days` days, starting today.
   Returns [{date, items:[bill], amount, running}] — one entry per day. */
export function upcoming(bills, today, days = 30) {
  const t = startOfDay(today);
  const out = [];
  let running = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
    const items = bills.filter(b => dueIn(b, date.getFullYear(), date.getMonth()) === date.getDate());
    const amount = items.reduce((s, b) => s + b.amount, 0);
    running += amount;
    out.push({ date, items, amount, running });
  }
  return out;
}

/* Reads "49,95", "49.95", "1.234,56" or "1,234.56" as a number. */
export function parseAmount(str) {
  let s = String(str).trim().replace(/[€\s]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return Number(s);
}
