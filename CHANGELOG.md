# Changelog

Versions are assigned per release, not per commit. `APP_VERSION` in
`index.html` must match the newest entry here. Versions before 1.5 were
assigned retroactively from the git history.

## 2.0.0 — 2026-08-18

The single file is gone. Same app, same behaviour, no build step — just real
files with real boundaries.

- `index.html` is markup only, down from about 100KB to 15KB. It loads four
  stylesheets and `app/main.js` as an ES module.
- The stylesheet is split into `styles/tokens.css`, `base.css`,
  `components.css` and `panels.css`.
- The script is split into fourteen modules under `app/`, each with a header
  saying what it owns. The boundaries follow what the code already did:
  storage, classification, coverage, import, recurring, maintenance, chat,
  backup, and one module per panel.
- Shared mutable state moved onto a single exported object, `S`. ES module
  imports are read-only bindings, so `export let data` could never have been
  reassigned from another module.
- The suite imports the modules directly instead of cutting the script block
  out of the HTML, and grew from 68 assertions to 73.
- `APP_VERSION` moved to `app/config.js`.

No behaviour changed. The rewrite was mechanical: the module split was done by
slicing on the existing section boundaries, and the rename of shared state was
done with an AST pass rather than by hand, so nothing was retyped.

## 1.8.0 — 2026-08-18

- Credit-report tracking distinguishes a complete month from a report pulled
  mid-month. A tick now means the data is known to reach the final day; a
  number means that is the last day it reaches. Previously any data at all
  earned a tick, so a report pulled on the 13th claimed the whole month.
- Import rows with no recorded pull date are treated as complete rather than as
  reaching only the last purchase, which was producing false warnings on
  months that were in fact fine.
- The overview's missing-report warning now covers partial months and says how
  far the data reaches.
- `APP_VERSION` added and shown in the More tab.
- Regression suite committed under `tests/`, with a synthetic fixture and a
  pinned clock. 68 assertions.

## 1.7.0 — 2026-08-18

- Overview redesigned around "locked and open": a dark block for the part of
  the month already committed, a light one for what is still under the
  household's control.
- Credit-report tracker in the Import tab — every card with three months of
  status, the date of its last import, and a link to the issuer's download
  page (MAX, CAL, Isracard).
- Renamed the new block to `renderLockOpen()` after `renderSplit()` was found
  to collide with the existing category breakdown.

## 1.6.0 — 2026-08-15

- Committed-versus-free panel on the overview.
- End-of-month forecast from the pace of discretionary spending.
- Large one-off charges flagged, so a month that looks bad because one bill
  landed in it can be read correctly.
- Recurring charges detected from the card reports, and a warning when one of
  them stops appearing.
- Trend chart can switch to a three-month rolling average, which flattens the
  spikes from bi-monthly bills.
- Chat context carries the card registry, the import history, each row's
  source, and itemised rows for the last three months rather than only the
  displayed one.
- Classification rules: appliance chains back to housing, gas and water
  suppliers to utilities, bakeries to food, Triple C to utilities.

## 1.5.0 — 2026-08-15

Six bugs, all found by reading the code against real imports.

- **Every imported date was a day early.** SheetJS returns `Date` objects at
  local midnight; reading them with the UTC getters shifted each row back one
  day in Israel, moving first-of-month purchases into the previous month.
- **Multi-card reports were attributed to one card.** `parseSheet` wrote the
  file-level last-4 onto every row, and MAX exports are detected precisely by
  covering every card on the account.
- **Restore merged instead of replacing.** The dialog promised a replacement;
  the save path merged by id, so nothing was ever removed. Now writes
  tombstones for rows absent from the backup.
- **Short classifier keys matched inside words** — "בגט" read as Gett, "גן עדן"
  as the Dan bus company. Keys of three characters or fewer now need a word
  boundary, with an allowance for a single attached Hebrew prefix.
- **Two rule-table faults**: electricity was captured by housing before the
  utilities rule could see it, and the clothing rule contained `זara`, a Hebrew
  zayin followed by Latin letters, so ZARA never matched.
- **The server accepted any body and overwrote everything.** `api/data.js` now
  validates the payload and refuses a write that would clear all transactions
  without matching tombstones.

Also: a read-only tool that measures how much money the date shift moved
between months, and a one-shot repair for the twelve affected rows.

## 1.4.0 — 2026-07-26

- Deterministic recurring ids, so two devices cannot generate the same monthly
  charge twice.
- Search covers every month rather than the displayed one.
- Tombstone list capped at 800.

## 1.3.0 — 2026-07-26

- One Redis client per lambda with retry and real error logging, fixing
  sporadic 500s.
- Google sign-in diagnostics surfaced on screen, including unauthorised origin.

## 1.2.0 — 2026-07-25

- Google sign-in with server-side ID token verification, an email allow-list
  and a signed session cookie. Access code kept as a fallback.
- Session key derived from `REDIS_URL` and the allow-list moved into Redis, so
  no extra environment variables are needed.
- Never write after a failed read; save failures surfaced instead of silently
  overwriting.

## 1.1.0 — 2026-07-25

- Tabbed layout.
- Refunds modelled as negative expenses.
- Duplicate detection and the category system reworked.
- Logout, maintenance tools, merge-on-save.
- Contrast raised to WCAG AA; inputs enlarged to stop iOS zooming on focus.

## 1.0.0 — 2026-07-25

First working version: credit-file import, recurring transactions, monthly
trend, backup, editing, card registry, access code.
