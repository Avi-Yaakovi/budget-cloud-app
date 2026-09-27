# budget-cloud-app

A Hebrew household budget app. Two people use it daily with real money. Treat
every change as production.

Live: https://budget-cloud-app.vercel.app · current version: see `APP_VERSION`
in `index.html`, history in `CHANGELOG.md`.

## Before you touch anything

1. `node tests/run.cjs` — 68 assertions, must pass before and after your change.
2. Read `.claude/skills/design-system/SKILL.md` before any UI work.
3. Never paste a credential into a chat. See "Secrets" below.

## Shape of the thing

```
index.html    the entire app — HTML + CSS + JS, ~100KB, no build step
api/data.js   read/write the budget blob in Redis, with a write guard
api/auth.js   Google sign-in, allowed-email list
api/chat.js   proxy to the Anthropic API (needs ANTHROPIC_API_KEY)
api/_auth.js  session signing and authorisation (shared)
api/_redis.js one Redis client per lambda, with retry
vercel.json   Cross-Origin-Opener-Policy, required by the Google popup
tests/        regression suite + synthetic fixture
```

Dependencies: `ioredis`, `google-auth-library`. From CDN: SheetJS (reads the
credit-card files), Google Identity Services.

Infrastructure: GitHub `Avi-Yaakovi/budget-cloud-app`, branch `main`. Vercel
deploys `main` automatically in about a minute — project
`prj_72NMV5V7wlEgriVvcwYnVSGdd6Na`, team `team_9dGgVSc0erwBV4NwFYcGwGj7`.
Storage is Upstash Redis behind `REDIS_URL`, with two keys:
`household-budget-v1` (everything) and `household-budget-allowed` (emails).
The only Vercel environment variables are `REDIS_URL` and `APP_CODE` — the
session secret is derived from `REDIS_URL` and the allow-list lives in Redis,
deliberately, so that nothing needs setting by hand.

## Data

```js
{
  transactions: [{ id, type:'expense'|'income', amount, category, note,
                   date:'YYYY-MM-DD', cardLast4?, recurringId? }],
  budgets:   { [category]: number },
  recurring: [{ id, type, amount, category, note, day }],
  cards:     [{ last4, company, label }],
  cardLabels:{ [last4]: label },
  importHistory: [{ id, file, company, cardLast4, cardLabel, months[], count, at }],
  uploadReminderDismissed: { [monthKey]: true },
  customCats: [string],
  deleted:    [id]        // tombstones, last 800 kept
}
```

`importHistory.at` is the day the report was pulled. Rows created before that
field existed have no `at`; code must treat that as "reach unknown", never as
"reaches nowhere".

## Rules that must not break

Each one is here because it already failed in production once.

1. **A refund is an expense with a negative amount.** It reduces spending in its
   category. Never model it as `type:'income'`.
2. **Monthly recurring rows get a deterministic id** — `rec_{ruleId}_{YYYY-MM}`.
   This is what stops two devices creating the rent twice on the same morning.
3. **Duplicate detection normalises merchant names** — strips whitespace,
   punctuation and city prefixes, so `AMSTERDAM ~NETFLIX.COM` equals
   `NETFLIX.COM`. Issuers spell the same merchant differently between reports.
4. **Never write to the server before a successful read.** The `loaded` flag
   blocks it. Every save is read, merge, write; if the read fails the save is
   abandoned and a red bar appears. One network glitch nearly wiped the account.
5. **Merge by id with tombstones**, so two people can edit at once without one
   overwriting the other.
6. **Every focusable input is at least 16px**, or iOS Safari zooms on focus.
   Contrast meets WCAG AA.

## Working on it

**Deploy.** Edit, commit, push to `main`. Vercel takes about 60 seconds. Verify
afterwards with the Vercel tools (`list_deployments`, `get_runtime_logs`,
`web_fetch_vercel_url`) rather than assuming. Runtime logs expire after roughly
an hour, so read them while they exist.

**Test.** `node tests/run.cjs`. The suite cuts the `<script>` block out of
`index.html`, stubs a DOM, pins the clock to 2026-08-18 and evals the app and
the assertions **in the same scope** — the app's top-level `const`/`let` are not
reachable any other way. `tests/fixture.json` is synthetic; it contains no real
financial data and must stay that way, because the repository is public.

**Add a render function.** Name it `render*`, give it no arguments, have it
rebuild its container from `data`, register it in `renderAll()` in visual order
and wire events in `bind()`. Guard against an empty account everywhere —
`(data.cards||[])` — since `renderAll()` has no per-section try/catch and one
throw blanks the screen.

**Watch for name collisions.** Everything lives in one scope. `renderSplit()`
already means the category breakdown; the lock/open block had to become
`renderLockOpen()` after it silently clobbered it. Grep before naming.

**Release.** Bump `APP_VERSION` in `index.html` and add a `CHANGELOG.md` entry
in the same commit.

## Secrets

The GitHub token is pasted at the start of a session and rotated afterwards; it
is fine-grained, limited to this repository, `Contents: Read and write` only.
Do not write it into any file, commit, or reply — including in an example. If a
token appears in repository content or in a document, say so and stop.

`REDIS_URL` gives full read and write access to two people's financial data.
Nothing in a chat session needs it. Do not ask for it.

## Known gaps

- The repository is public. It should be private.
- Water and mobile bills are paid by bank standing order, never appear on any
  card, and so are invisible to the app and to the card tracker. They need to be
  entered as recurring rows by hand; roughly ₪300–550 a month is unaccounted for
  until that happens.
- `api/chat.js` needs `ANTHROPIC_API_KEY` in Vercel.
- There is no CSV export, only the JSON backup.
- Everything lives under one Redis key. Fine for years, not forever.
- `SHIFTED` in `index.html` is a finished one-shot migration that repaired
  twelve mis-dated rows. It is idempotent and safe to delete once you are sure
  the repair ran.

## How Avi works

Hebrew. Short, direct answers. Do not break a task into steps for approval —
take the whole thing and run. Do not hand back manual work that you could do
yourself, and check that you really cannot before saying you cannot. When you
find a problem, state it plainly with the numbers and without softening it;
accurate criticism is worth more than agreement.
