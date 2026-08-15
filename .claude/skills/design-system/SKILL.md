---
name: design-system
description: The visual and structural conventions of the household budget app (index.html). Use this whenever adding, editing, or reviewing any UI in this repo — a new card, panel, note, list row, button, form field, chart, or tab — and whenever asked to "match the existing style", change colours or spacing, or judge whether a screen looks right. Also use it before touching the CSS in :root or any shared class, since those are consumed across the whole file. Reach for it even when the request sounds purely functional ("add a button that does X"), because in a single-file app every addition inherits this system whether or not the request mentions design.
---

# Budget app design system

The whole app is one file: `index.html`, roughly 90KB of HTML + CSS + JS with no build step.
There is no framework, no component library, and no CSS preprocessor. Every screen is built
from a small set of hand-written classes defined once in the `<style>` block at the top.

Adding UI means reusing those classes. Writing new CSS is a last resort — if a new rule seems
necessary, first check whether an existing class does the job, because a one-off rule that
duplicates `.card` or `.r` is how a single-file app slowly becomes unreadable.

## Non-negotiables

These are not preferences. Each one comes from a real defect.

- **Every input, select and textarea is at least 16px.** Below that, iOS Safari zooms the
  viewport on focus and the user has to pinch back out. This applies to inline inputs inside
  list rows too (`.bnum`, `.csel`, `.lb`), which is why they carry explicit `font-size:16px`.
- **RTL Hebrew is the only direction.** The document is `<html lang="he" dir="rtl">`. Use
  logical thinking about sides: what reads as "start" is the right. Latin strings that must
  stay LTR (URLs, emails, card digits) get `direction:ltr;display:inline-block` on their span.
- **Escape everything that reaches `innerHTML`.** All user- and file-derived text goes through
  `esc()`. Merchant names come from imported credit-card files and are not trusted input.
- **Contrast meets WCAG AA.** The `--ink-*` ramp was tuned for this; don't lighten text to make
  a screen feel airier.
- **Money is rendered by `money()` or `signed()`, never by string concatenation.** They handle
  the ₪ sign, rounding and `he-IL` thousands separators. Dates go through `dLabel()` (day.month)
  or `mLabel()` (month + year).

## Tokens

All colour, radius and typography values live in `:root`. Never hardcode a hex in markup or JS —
use the variable, so a future theme change is one edit.

```
--bg      #F2F4F1   page background (warm off-white, not pure grey)
--surface #FFFFFF   cards and panels
--ink     #161A18   primary text
--ink-2   #4A544D   secondary text
--ink-3   #69716C   hints, metadata, disabled-looking labels
--line    #E4E8E3   default 1px border
--line-2  #F0F2EF   internal dividers between list rows
--pos     #15654A   income, positive balance, under-budget      (bg: --pos-bg)
--neg     #9A3B38   expenses, overspend, destructive            (bg: --neg-bg)
--warn    #936517   attention, 80-99% of budget, stale data     (bg: --warn-bg)
--accent  #2C3E4F   neutral emphasis (committed-budget bar, links)
--r-lg 18px  cards      --r-md 12px  controls     --r-sm 9px  chips, small inputs
--f-body  Heebo            400/500/600/700 — all body and UI text
--f-disp  Frank Ruhl Libre 500/700/800 — brand, month name, hero label only
--f-num   monospace stack  — every number, so columns align
--tabh 62px  bottom tab bar height; fixed overlays sit at bottom:var(--tabh)
```

Semantic colour is load-bearing: green means money in, red means money out. Never use green
merely because something succeeded, or red merely for emphasis. A refund is money returning,
so it renders green (`.r-v.p`) even though its `type` is `expense`.

`COLORS` (in JS, near the top) is a separate 13-entry categorical palette for category bars and
dots. Index into it by the category's position in `expCats()` so a category keeps its colour
across screens. It is not interchangeable with the semantic tokens above.

## Layout

```
.shell            max-width 520px, centred — the app is phone-first
  .topbar         sticky, brand + guard badge + logout
  .monthbar       month stepper; visible only on the סקירה and תנועות panels
  main            padding-bottom = tab height + 28px so content clears the bar
    section.panel one per tab; .on shows it
  nav.tabs        fixed bottom, 5 tabs
```

Desktop gets the same 520px column. Do not add breakpoints or a wide layout — the app is used
on phones and the narrow column is deliberate.

## Components

Compose from these. The pattern of each is worth matching closely.

**Card** — the default container for anything on a panel.
```html
<div class="card">
  <h2 class="ttl">כותרת<span class="sub">הסבר קצר</span></h2>
  ...
  <div class="rule"></div>   <!-- full-bleed divider inside a card -->
</div>
```
`.card.flush` removes padding when the card holds only a list.

**Note** — a transient message above the fold: a warning, a forecast, a nudge.
```html
<div class="note warn">        <!-- or .note info -->
  <div class="note-body">טקסט, עם <span class="n">מספרים</span> בפונט המספרים</div>
  <button class="note-act" type="button">פעולה</button>
  <button class="note-x" type="button">✕</button>
</div>
```
Notes are for things that are true right now and may stop being true. Anything permanent
belongs in a card.

**List row** — used for transactions, cards, categories, subscriptions, allow-list entries.
```html
<div class="r">
  <span class="dot" style="background:COLOR"></span>   <!-- optional -->
  <div class="r-mid">
    <span class="r-t">כותרת<span class="tag">תגית</span></span>
    <span class="r-s">שורת משנה · מופרדת · בנקודות</span>
  </div>
  <span class="r-v n">₪123</span>                      <!-- .p green / .n red -->
  <button class="mini" type="button" aria-label="מחק">✕</button>
</div>
```
`.r-mid` is the flexible middle and truncates with ellipsis; keep the value and buttons fixed.
Subtitle metadata is joined with ` · `.

**Bar row** — every proportion in the app (category split, per-card split, budgets, the
committed-vs-free block) uses this, which is why they all read the same.
```html
<div class="brow">
  <div class="btop"><span>תווית</span><span class="r">₪500 · 40%</span></div>
  <div class="btrack"><div class="bfill" style="width:40%;background:var(--pos)"></div></div>
</div>
```

**Buttons** — `.go` is the filled primary (full width), `.go.ghost` the outlined secondary,
`.go.sm` a shorter variant, `.mini` an icon-only row action, `.txt` an inline text link,
`.blink` a small underlined suggestion inside a bar row. Always `type="button"`; there are no
`<form>` elements anywhere and submit-by-default would reload the app.

**Segmented control** — `.seg` with buttons carrying `data-k`; the active one gets `.on` and is
tinted by kind (`expense` red, `income` green, `refund` amber).

**Form grid** — `.grid2` is a two-column grid; `.wide` spans both. Put the amount and category
side by side, description and date full width.

**Empty state** — `<p class="blank">אין עדיין…</p>`, toggled by `style.display`. Every list has
one, and a new list should too.

## JS conventions for UI

- Render functions are named `render*`, take no arguments, read from the module-level `data`,
  and rebuild their container's `innerHTML` from scratch. They must be safe to call repeatedly.
- Register every new one in `renderAll()`, in visual order.
- Wire events in `bind()`, not with inline `onclick` in markup strings — except for handlers on
  elements the render function just created, which attach with `el.querySelector(...).onclick`.
- Any change to `data` is followed by `save(); renderAll();` in that order.
- Guard against a fresh account everywhere: `(data.cards||[])`, `(data.recurring||[])`. A render
  that throws on empty data blocks the whole screen, because `renderAll()` is not per-section
  try/caught.

## Adding a screen or block — the short version

1. Decide card or note. Permanent → card. Conditional and dismissible → note.
2. Add the empty container `<div id="...">` to the right `section.panel` in markup order.
3. Write `renderX()` that fills it, using the classes above and no new CSS.
4. Add it to `renderAll()` and any handlers to `bind()`.
5. Check: does it survive empty data, a 40-character merchant name, and a negative amount?

## Before considering it done

- Numbers in `--f-num`, currency through `money()`/`signed()`.
- No hardcoded hex, no font-size below 16px on anything focusable.
- Text that came from a file or a user passed through `esc()`.
- Empty state exists and is reachable.
- Rendered twice in a row without duplicating rows or leaking listeners.
