# feed-your-trello

Daily GitHub Actions to feed JSON data into Trello boards.

## Overview

`feed-your-trello` creates a Trello list for the current day using the format `DD.MM.YYYY`, then fills that list with cards defined in `data/items.json`.
The script is designed for scheduled automation through GitHub Actions, but it can also be run locally for testing.

## How it works

1. The script checks whether today’s Trello list already exists.
2. If it does not exist, a new list is created on the configured board.
3. `data/items.json` is loaded.
4. All timespans where `skip` is `false` and today falls between `firstday` and `lastday` are collected.
5. The entries from all matching timespans are merged and posted to Trello.

URL entries are turned into link cards, while normal text entries are created as standard Trello cards.
If multiple active timespans overlap on the same day, all of their entries are used.

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

## data/items.json

`data/items.json` is an array of timespan objects.
Each object contains a date range, a `skip` flag, and an `entries` array.

```json
[
  {
    "firstday": "2026-06-01",
    "lastday": "2026-06-21",
    "skip": false,
    "entries": [
      { "name": "https://www.apfelkiste.ch/kisten-win.html" }
    ]
  }
]
```

### Fields

- `firstday`: Start date in `YYYY-MM-DD` format.
- `lastday`: End date in `YYYY-MM-DD` format.
- `skip`: If `true`, the span is ignored.
- `entries`: Array of cards to create.
- `entries[].name`: Card title or URL.

### Behavior notes

- Multiple matching active timespans are supported and their entries are combined.
- URL values are shortened for the card title and stored as Trello link cards.
- Duplicate names are not de-duplicated automatically.

## Local testing

```bash
cp .env.example .env
```
Edit .env with your real values
```bash
npm install && npm start
```
✅ Check Trello board for new date list

The script will create or reuse today’s Trello list and populate it with matching cards.

## GitHub Actions

The repository includes a workflow that runs daily on a schedule and can also be started manually from the Actions tab.
It checks out the repository, installs dependencies, and runs `node src/trello.js` with the required secrets.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
