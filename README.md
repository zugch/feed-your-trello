# feed-your-trello

Daily GitHub Actions to feed JSON data into Trello boards.

## Overview

`feed-your-trello` creates a Trello list for the current day using the format `DD.MM.YYYY`, then fills that list with cards defined in `data/items.json`.
The script is designed for scheduled automation through GitHub Actions, but it can also be run locally for testing.

## How it works

1. The script checks whether today’s Trello list already exists.
2. If it does not exist, a new list is created on the configured board.
3. `data/items.json` is loaded.
4. All timespans where `skip` is `false`, today falls between `firstday` and `lastday`, and an optional `cron` expression matches today are collected.
5. The entries from all matching timespans are merged and posted to Trello.

If an entry contains a `link`, the card is created with that link attached.
If an entry contains a `desc`, the card is created with that description (supports Markdown).
If an entry includes labels, they are added to the card after creation.
If an entry includes a valid due configuration, a Trello due date is added to the card.

## Repository structure

```text
feed-your-trello/
├── .github/
│   └── workflows/
│       └── trello.yml
├── data/
│   └── items.json
├── src/
│   └── trello.js
├── .env.example
├── LICENSE
├── package.json
└── README.md
```

## Configuration

The script expects these environment variables:

- `TRELLO_KEY` — Trello API key.
- `TRELLO_TOKEN` — Trello API token.
- `BOARD_ID` — ID of the Trello board to write to.

For local runs, place them in a `.env` file or export them in your shell.
For GitHub Actions, store them as repository secrets.

If you use due dates, set `TZ=Europe/Zurich` in the workflow or local environment so times like `23:59` are interpreted in Swiss local time before being converted to ISO 8601 for Trello.

## data/items.json

`data/items.json` is an array of timespan objects.
Each object contains a date range, a `skip` flag, an optional `cron` field, and an `entries` array.

```json
[
  {
    "firstday": "2026-06-01",
    "lastday": "2026-06-21",
    "skip": false,
    "cron": "* * * * 1-5",
    "entries": [
      { "name": "Apfelkiste Wettbewerb", "link": "https://www.apfelkiste.ch/kisten-win.html" },
      { "name": "Migrolino App -> Win (Würfelspiel)", "dueOffsetDays": 2, "dueTime": "18:30" },
      { "name": "Scoop -> Daily Game", "dueOffsetDays": 1, "desc": "Check the dashboard for instructions." },
      { "name": "Evening reminder", "dueTime": "20:00" },
      { "name": "Example", "link": "https://www.example.com", "labels": [ { "name": "win", "color": "red" }, { "name": "daily", "color": "blue" } ], "dueOffsetDays": 3, "dueTime": "12:00", "desc": "Important info:\n- Step 1\n- Step 2" }
    ]
  }
]
```

### Fields

- `firstday`: Start date in `YYYY-MM-DD` format.
- `lastday`: End date in `YYYY-MM-DD` format.
- `skip`: If `true`, the span is ignored.
- `cron`: Optional 5-field cron expression used to further restrict when the timespan is active.
- `entries`: Array of cards to create.
- `entries[].name`: Required card title.
- `entries[].link`: Optional link attached to the card.
- `entries[].desc`: Optional card description (supports standard Markdown language).
- `entries[].dueOffsetDays`: Optional number of days added to the current run date before the due date is calculated.
- `entries[].dueTime`: Optional due time in `HH:mm` format.
- `entries[].labels`: Optional array of labels, each with `name` and `color`.

### Behavior notes

- Multiple matching active timespans are supported and their entries are combined.
- `name` is used only as the card title.
- If `link` is set, it is passed to Trello as the card link.
- Duplicate names are not de-duplicated automatically.
- If neither `dueOffsetDays` nor `dueTime` is set, no due date is added.
- If one or both due fields are set, missing values fall back to `0` for `dueOffsetDays` and `23:59` for `dueTime`.
- `labels` are optional and can contain multiple entries.
- `dueOffsetDays` must be a non-negative integer.
- `dueTime` must be in `HH:mm` 24-hour format.
- If either due field is invalid, both are ignored and the card is created without a due date.
- If `cron` is not set, the timespan is active for every day within the date range.
- If `cron` is set, the timespan is active only when the current day matches the cron expression.
- The cron expression is evaluated in addition to `firstday`, `lastday`, and `skip`.
- Cron expressions use the standard 5-field format: `minute hour day-of-month month day-of-week`.
- For this project, the date match is evaluated using a probe time at `12:00` local time so day-of-week handling is stable around day boundaries.

### Cron examples

Examples for the optional `cron` field:

- `* * * * *` — every day.
- `* * * * 1-5` — Monday to Friday.
- `* * * * 3` — Wednesday.
- `* * * * 0,6` — Sunday and Saturday.
- `* * * 1 *` — every day in January.

The first two fields (`minute` and `hour`) are accepted as part of the cron format, but for timespan activation the relevant part is whether the expression matches the current calendar day.
Depending on the cron implementation, day-of-week usually supports `0-7`, where `0` and often `7` mean Sunday. To avoid ambiguity, prefer `0` for Sunday.
Some cron features such as `L`, `W`, `#`, and `?` are supported by the underlying cronjs packages.

## Local testing

```bash
cp .env.example .env
```

Edit .env with your real values

```bash
npm install && npm start
```

✅ Check Trello board for new date list

If you use due dates locally, run with `TZ=Europe/Zurich npm start`.
If your setup uses native Node env-file loading, you can also start with `node --env-file-if-exists=.env src/trello.js`.

The script will create or reuse today’s Trello list and populate it with matching cards.

## GitHub Actions

The repository includes a workflow that runs daily on a schedule and can also be started manually from the Actions tab.
It checks out the repository, installs dependencies, and runs `node src/trello.js` with the required secrets.

If you use due dates, add `TZ: Europe/Zurich` to the workflow environment.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
