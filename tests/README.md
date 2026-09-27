# Tests

```
npm test
```

Exit code 0 means everything passed. Run it before and after every change.

## Why it looks like this

The app is plain ES modules with no bundler, so the suite imports them
directly. The order matters: `stubDom()` and `pinClock()` must run **before**
the first `import()`, because some modules read `localStorage` and the clock
while they evaluate. That is why the imports are dynamic `await import(...)`
calls rather than static ones at the top of the file.

Shared state lives on the `S` object from `app/state.js`. Set `S.data` and
`S.curM` before calling a render function; never destructure `S`, or the test
stops seeing later updates.

## The clock is pinned

`pinClock()` fixes "now" at 2026-08-18. The app reads the clock constantly —
`realM()`, `today()`, the forecast, the watchdog's "silent for N days" — so
without this the suite passes in August and fails in September. If you add an
assertion that depends on the date, it must hold at that fixed instant.

## The fixture

`fixture.json` is synthetic. It contains no real financial data and must stay
that way: the repository is public.

It is small but every part of it is load-bearing:

- **Two cards**, one per issuer, so the per-row card attribution and the
  issuer links both have something to match.
- **An import in August dated the 13th**, which is what makes August "partial"
  rather than complete.
- **A July import dated 2026-08-02**, after the month ended, which is what
  makes July complete.
- **A legacy import row with no `at`**, to prove that an undated row counts as
  complete instead of triggering a false warning.
- **A monthly ₪85 charge** ("טריפל סי") that the subscription detector must
  find, and **a grocery** with varying amounts and more than one visit a month
  that it must ignore.
- **Recurring rent and salary**, so the locked/open split has both sides.
- **A refund** as a negative expense, and a merchant with a city prefix.

Changing an amount will move the percentages asserted in `run.js`. Recompute
rather than adjusting the expectation until it goes green.

## Adding a test

Put it in the group it belongs to and write one line above it saying what broke
to make it necessary. A test with no such line tends to get deleted by whoever
next finds it inconvenient.
