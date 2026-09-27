/* Test setup for the module build.
 *
 * The app is plain ES modules with no bundler, so tests import them directly.
 * The DOM must be stubbed BEFORE the first import: some modules read
 * localStorage while they evaluate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/* The app asks the clock constantly — realM(), today(), the forecast, the
 * watchdog's "silent for N days". Without pinning it the suite would pass in
 * August and fail in September. */
export const NOW = '2026-08-18T09:00:00';
export function pinClock(iso = NOW) {
  const Real = Date;
  const fixed = new Real(iso).getTime();
  function Fixed(...a) {
    if (!(this instanceof Fixed)) return new Real(fixed).toString();
    return a.length ? new Real(...a) : new Real(fixed);
  }
  Fixed.prototype = Real.prototype;
  Fixed.now = () => fixed;
  Fixed.UTC = Real.UTC;
  Fixed.parse = Real.parse;
  globalThis.Date = Fixed;
}

/* Elements remember what was written to them so assertions can read it back;
 * appendChild concatenates innerHTML, which is enough for list rendering. */
export function stubDom() {
  const reg = {};
  const el = () => ({
    style: {}, value: '', textContent: '', innerHTML: '', dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelector: el, querySelectorAll: () => [el(), el(), el()],
    appendChild(c) { this.innerHTML += (c && c.innerHTML) || ''; },
    removeChild() {}, focus() {}
  });
  globalThis.document = {
    getElementById: id => (reg[id] = reg[id] || el()),
    createElement: el,
    querySelectorAll: () => [el(), el(), el()],
    body: el()
  };
  globalThis.window = { scrollTo() {} };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.fetch = async () => ({ status: 200, json: async () => ({}) });
  globalThis.alert = s => { reg.__dialog = s; };
  globalThis.confirm = s => { reg.__dialog = s; return reg.__confirm !== false; };
  return reg;
}

export function fixture() {
  const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixture.json'), 'utf8'));
  delete f._note;
  return JSON.parse(JSON.stringify(f));
}

/* Reads api/data.js's payload guard without importing the whole route. */
export function payloadGuard() {
  const src = fs.readFileSync(path.join(ROOT, 'api', 'data.js'), 'utf8');
  const m = src.match(/function reject\(body\)[\s\S]*?\n\}/);
  if (!m) throw new Error('reject() not found in api/data.js');
  const MAX_BYTES = 4 * 1024 * 1024;
  return eval('(' + m[0] + ')');
}

export function runner() {
  let pass = 0, fail = 0;
  const failures = [];
  const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { pass++; return; }
    fail++;
    failures.push(`  ${name}\n    got  ${a}\n    want ${b}`);
  };
  const report = () => {
    if (failures.length) console.log('\nFAILURES\n' + failures.join('\n'));
    console.log(`\n${pass} passed, ${fail} failed`);
    return fail;
  };
  return { check, report };
}
