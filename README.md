# Monthly Bills

A small phone app for keeping track of recurring bills: what you pay per month, how it splits by label (Car, Groceries, Subscriptions…), and when money leaves your account over the next 30 days.

Plain HTML, CSS and JavaScript. No build step, no server, no accounts. Data is stored only in the browser on the phone you use it on.

## Put it online (GitHub Pages)

1. Create a new repository, e.g. `monthly-bills`.
2. Upload everything in this folder (keep the folder structure).
3. In the repo go to **Settings → Pages**, set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. After a minute it's live at `https://<your-username>.github.io/monthly-bills/`.

On iPhone: open the link in Safari → Share → **Add to Home Screen**. It then opens full screen like an app.

Anyone else can use the same link. Each person's bills stay on their own phone.

## Files

```
index.html             page layout (header, total, cards, list)
css/styles.css         all styling; colours are tokens at the top (light + dark)
js/app.js              everything you see and tap: render, chart, sheets, backup
js/bills.js            date and money rules (when a bill is due, per-month cost)
js/storage.js          load/save in localStorage, backup + restore, data version
manifest.webmanifest   Home Screen name and icon
icons/                 app icons
```

## Backups

Tap **⋯ → Back up** to save a `bills-backup-YYYY-MM-DD.json` file (on iPhone: *Save to Files*).
**⋯ → Restore from backup** reads that file back and replaces the bills on the phone.

Do this before updating the app files, clearing Safari website data, or moving to a new phone. Updating the files on GitHub normally keeps your data (same address = same storage), but a backup makes it safe either way.

## Changing the data shape later

`storage.js` keeps a `DATA_VERSION`. If you add a field (say `notes` on each bill):

1. Bump `DATA_VERSION` to `2`.
2. In `migrate()`, add a step that fills the new field on old bills:
   ```js
   if (d.version < 2) { d.bills = d.bills.map(b => ({ notes: "", ...b })); }
   ```
3. Old backups still restore, because `parseBackup()` runs them through `migrate()` too.

## Common tweaks

- **Label presets and colours**: `PRESETS` and `PRESET_COLOURS` at the top of `js/app.js`.
- **Chart range**: `upcoming(relevant, today, 30)` in `renderChart()`; change `30`.
- **Colours / fonts**: the `:root` block at the top of `css/styles.css`.
- **How often options**: the `fFreq` buttons in `openForm()` and the rules in `dueIn()` in `js/bills.js`.
