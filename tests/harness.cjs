/* Loads the app's logic outside a browser.
 *
 * index.html is one file with no build step, so there is nothing to import.
 * The script block is cut out, a minimal DOM is stubbed, and the app source is
 * eval'd. Test code must be eval'd in the SAME scope — the app's top-level
 * `const` and `let` bindings are not reachable from an outer scope otherwise.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function appSource() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const open = html.lastIndexOf('<script>');
  const close = html.lastIndexOf('</script>');
  if (open === -1 || close === -1) throw new Error('could not find the app script block');
  return html.slice(open + 8, close).replace(/\ninit\(\);\s*$/, '\n');
}

/* The app asks the clock constantly — realM(), today(), the forecast, the
 * watchdog's "silent for N days". A suite that reads the real clock passes in
 * August and fails in September, so the clock is pinned here. */
const NOW = '2026-08-18T09:00:00';
function pinClock(iso) {
  const Real = Date;
  const fixed = new Real(iso || NOW).getTime();
  function Fixed(...a) {
    if (!(this instanceof Fixed)) return new Real(fixed).toString();
    return a.length ? new Real(...a) : new Real(fixed);
  }
  Fixed.prototype = Real.prototype;
  Fixed.now = () => fixed;
  Fixed.UTC = Real.UTC;
  Fixed.parse = Real.parse;
  global.Date = Fixed;
  return () => { global.Date = Real; };
}

/* Elements remember what was written to them so assertions can read it back.
 * appendChild concatenates innerHTML, which is enough for list rendering. */
function makeDom() {
  const reg = {};
  const el = () => ({
    style: {}, value: '', textContent: '', innerHTML: '', dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    querySelector: el, querySelectorAll: () => [el(), el(), el()],
    appendChild(c) { this.innerHTML += (c && c.innerHTML) || ''; },
    removeChild() {}, focus() {}
  });
  global.document = {
    getElementById: id => (reg[id] = reg[id] || el()),
    createElement: el,
    querySelectorAll: () => [el(), el(), el()],
    body: el()
  };
  global.window = { scrollTo() {} };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.fetch = async () => ({ status: 200, json: async () => ({}) });
  return reg;
}

function fixture() {
  const f = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
  delete f._note;
  return f;
}

/* Reads api/data.js's payload guard without importing the ES module. */
function payloadGuard() {
  const src = fs.readFileSync(path.join(ROOT, 'api', 'data.js'), 'utf8');
  const m = src.match(/function reject\(body\)[\s\S]*?\n\}/);
  if (!m) throw new Error('reject() not found in api/data.js');
  const MAX_BYTES = 4 * 1024 * 1024;
  return eval('(' + m[0] + ')');
}

function runner() {
  let pass = 0, fail = 0;
  const failures = [];
  const check = (name, got, want) => {
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { pass++; return; }
    fail++;
    failures.push(`  ${name}\n    got  ${a}\n    want ${b}`);
  };
  const report = label => {
    if (failures.length) console.log(`\n${label}\n` + failures.join('\n'));
    return { pass, fail };
  };
  return { check, report };
}

module.exports = { appSource, makeDom, fixture, payloadGuard, runner, pinClock, NOW, ROOT };
