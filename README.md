# Monthly Bills

A small budgeting web app for phones. It keeps track of recurring bills, shows what they add up to each month and year, how that splits across labels like *Car*, *Groceries* or *Subscriptions*, and when money leaves your account over the next 30 days.

The goal is simple: know how much needs to be in the account before each bill comes out, and see what you're paying for things like subscriptions.

**Live app:** `https://<your-username>.github.io/monthly-bills/`

---

## Features

- **Monthly total**: what all active bills cost per month, plus the yearly figure. Yearly and 3-monthly bills are spread out per month so the number is realistic.
- **Where it goes**: a coloured bar and a list of labels with their monthly and yearly cost. Tap a label to see just its bills in a pop-up.
- **Next 30 days chart**: a bar for each day a payment goes out and a running total line, so you can see how much is needed and by when. Tap any day to see which bills go out.
- **All bills**: sorted by the day of the month they go out, each showing its next payment date. Bills that haven't started yet or have ended are listed separately.
- **Add, edit, delete**: each bill has a name, amount, label, debit day, how often it repeats (monthly, every 3 months or yearly), an optional start date and an end date or *Ongoing*.
- **Backup and restore**: export everything to a JSON file and load it back, so data survives app updates or a new phone.
- **Works like an app**: add it to the Home Screen and it opens full screen. Respects the iPhone notch and home bar, and follows light or dark mode.
- **Example bills**: try the app with sample data, then remove the examples in one tap.

## How it's built

- Plain **HTML, CSS and JavaScript** (ES modules). No framework, no build step, no dependencies.
- **localStorage** for data. Nothing is sent to a server and there are no accounts. Each person's bills stay in the browser on their own device.
- **Hand-drawn SVG** for the 30-day chart.
- **Web Share API** for backups: on iPhone the backup opens the share sheet (*Save to Files*, AirDrop, mail). Other browsers download the file.
- **Web app manifest** and Apple meta tags for Home Screen install.
- Fonts from Google Fonts (Bricolage Grotesque and Instrument Sans), with system fonts as a fallback.

## Project structure

```
index.html             page layout: header, total, cards, list, add button
css/styles.css         all styling; colour tokens at the top for light and dark mode
js/app.js              everything you see and tap: rendering, chart, pop-ups, forms, backup
js/bills.js            date and money rules: when a bill is due, cost per month, next payment
js/storage.js          load and save in localStorage, backup and restore, data versioning
manifest.webmanifest   Home Screen name, colours and icons
icons/                 app icons (180, 192, 512 px)
```

The code is split by job. `bills.js` has no page code, so the date logic can be read and changed on its own. `storage.js` is the only file that touches localStorage, so swapping to another kind of storage later only changes that file.

## Data

Each bill is stored like this:

```js
{
  id: "b1abc",
  name: "Car insurance",
  amount: 64.5,                // euros
  label: "Car",
  day: 3,                      // day of the month it goes out (1–31)
  freq: "monthly",             // "monthly" | "quarterly" | "yearly"
  month: 3,                    // 1–12, which month for quarterly or yearly bills
  start: "2026-01-01",         // "" = no start date
  end: ""                      // "" = ongoing
}
```

A few rules worth knowing:

- A bill set to the 31st goes out on the last day in shorter months (30th, or 28th/29th in February).
- *Every 3 months* repeats from the chosen month, e.g. March means March, June, September and December.
- The data has a version number (`DATA_VERSION` in `storage.js`). When the shape changes, `migrate()` upgrades old saved data and old backups.

## Run it locally

ES modules don't load from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

1. Push this folder to a repository, e.g. `monthly-bills`.
2. Go to **Settings → Pages**, choose *Deploy from a branch*, branch `main`, folder `/ (root)`.
3. After a minute the app is live at `https://<your-username>.github.io/monthly-bills/`.

On iPhone, open the link in Safari, tap Share, then **Add to Home Screen**.

## Backups

Use **⋯ → Back up** to save a `bills-backup-YYYY-MM-DD.json` file, and **⋯ → Restore from backup** to load one.

Updating the files on GitHub normally keeps your data, since the address stays the same. Clearing Safari's website data or changing phones does not, so back up first.

## Changing things

- **Label presets and colours**: `PRESETS` and `PRESET_COLOURS` at the top of `js/app.js`.
- **Chart range**: the `30` in `upcoming(relevant, today, 30)` inside `renderChart()`.
- **Colours and fonts**: the `:root` block at the top of `css/styles.css`.
- **Repeat options**: the *How often* buttons in `openForm()` and the rules in `dueIn()` in `js/bills.js`.
- **Adding a field to bills**: bump `DATA_VERSION`, add a step in `migrate()` that fills the field on old bills, then add it to the form in `openForm()`.

## Privacy

Everything stays on your device. The app makes no network requests apart from loading the fonts.
