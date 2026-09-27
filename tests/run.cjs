/* Regression suite for budget-cloud-app.
 *
 *   node tests/run.js            (TZ is forced to Asia/Jerusalem below)
 *
 * Every group below exists because something broke in production. Read the
 * comment above a group before changing what it asserts.
 */
process.env.TZ = 'Asia/Jerusalem';

const { appSource, makeDom, fixture, payloadGuard, runner, pinClock } = require('./harness.cjs');

pinClock();   /* 2026-08-18 — see harness.cjs */

const reg = makeDom();
const FX = fixture();
const reject = payloadGuard();
const { check: t, report } = runner();
const H = id => (reg[id] ? reg[id].innerHTML : '');
const T = id => (reg[id] ? reg[id].textContent : '');

let dlg = '', confirmed = true;
global.alert = s => { dlg = s; };
global.confirm = s => { dlg = s; return confirmed; };

/* The suite runs inside the app's own scope. Keep it as one template string. */
const SUITE = `

/* ---------- categories ----------
   Short keys used to match inside longer words: 'גט' fired on 'בגט',
   'דן' on 'גן עדן'. Keys of <=3 chars now need a word boundary. */
t('electricity is a utility',   guessCat('חברת החשמל'),        'חשבונות ותקשורת');
t('appliance shop is housing',  guessCat('מחסני חשמל'),        'דיור');
t('ZARA matches latin',         guessCat('ZARA ISRAEL'),        'ביגוד');
t('baguette is not Gett',       guessCat('בגט של אמא'),         'אחר');
t('bakery is food',             guessCat('מאפיית בגט'),         'מזון');
t('gan eden is not the bus',    guessCat('גן עדן מסעדה'),       'מזון');
t('Dan bus still matches',      guessCat('דן תחבורה'),          'תחבורה');
t('hebrew prefix survives',     guessCat('בשוק העירוני'),       'מזון');
t('city prefix stripped',       guessCat('AMSTERDAM ~NETFLIX.COM'), 'מנויים');
t('gas supplier is a utility',  guessCat('פזגז בע"מ'),          'חשבונות ותקשורת');
t('unknown falls through',      guessCat('חנות פרחים'),         'אחר');

/* ---------- dates ----------
   SheetJS returns Date objects at LOCAL midnight. Reading them with the UTC
   getters shifted every imported row a day earlier in Israel, which pushed
   first-of-month purchases into the previous month. */
t('excel serial',      toDate(45717),                 '2025-03-01');
t('local Date object', toDate(new Date(2026,2,1)),    '2026-03-01');
t('dd/mm/yyyy',        toDate('01/03/2026'),          '2026-03-01');
t('dd.mm.yy',          toDate('01.03.26'),            '2026-03-01');
t('not a date',        toDate('שלום'),                null);
t('month end',         lastDay('2026-02'),            '2026-02-28');
t('leap year',         lastDay('2028-02'),            '2028-02-29');

/* ---------- refunds ----------
   A refund is an expense with a negative amount, never an income row. */
t('negative expense is a refund', isRef({type:'expense',amount:-50}), true);
t('income is not a refund',       isRef({type:'income',amount:50}),   false);

/* ---------- duplicate detection ----------
   Issuers write merchant names differently between reports. */
t('city prefix ignored', dupKey('2026-03-01','AMSTERDAM ~NETFLIX.COM',49.9)===dupKey('2026-03-01','NETFLIX.COM',49.9), true);
t('amount matters',      dupKey('2026-03-01','X',10)===dupKey('2026-03-01','X',11), false);

/* ---------- merge ----------
   Two people edit at once; tombstones stop a deletion from coming back. */
data = emptyData();
var A = {transactions:[{id:'a',date:'2026-03-01',amount:1,type:'expense',category:'אחר'}],deleted:[]};
var B = {transactions:[{id:'b',date:'2026-03-02',amount:2,type:'expense',category:'אחר'}],deleted:['a']};
t('tombstone wins', merge(normalize(A),normalize(B)).transactions.map(x=>x.id), ['b']);

/* ---------- recurring ----------
   Deterministic ids stop two devices generating the same charge twice. */
t('deterministic id', recId({id:'r1'},'2026-03'), 'rec_r1_2026-03');
t('day clamped to month end', recRow({id:'r1',type:'expense',amount:100,category:'דיור',note:'',day:31},'2026-02').date, '2026-02-28');

/* ---------- lock / open ----------
   The overview's main claim: how much of the month was committed before any
   discretionary spending happened. */
data = normalize(JSON.parse(JSON.stringify(FX))); loaded = true; curM = '2026-07';
renderLockOpen();
t('locked share',    H('splitBox').indexOf('נעול · 72%')!==-1, true);
t('locked amount',   H('splitBox').indexOf('₪5,000')!==-1, true);
t('open share',      H('splitBox').indexOf('פתוח · 28%')!==-1, true);
t('rent is listed',  H('splitBox').indexOf('שכר דירה')!==-1, true);
curM = '2026-05'; renderLockOpen();
t('no recurring -> 0% locked', H('splitBox').indexOf('נעול · 0%')!==-1, true);
data = emptyData(); renderLockOpen();
t('empty account is silent', H('splitBox'), '');

/* ---------- large one-off charges ----------
   A month can look bad because one bill landed in it. */
data = normalize(JSON.parse(JSON.stringify(FX))); curM = '2026-07';
renderBig();
t('flags the big charge', H('bigNote').indexOf('רכישה חד פעמית גדולה')!==-1, true);
curM = '2026-08'; renderBig();
t('quiet when nothing is large', H('bigNote'), '');

/* ---------- credit report coverage ----------
   "There is data" is not "the month is covered": a report pulled on the 13th
   does not contain the rest of the month. */
t('july pulled after month end', cover('1111','2026-07').s, 'full');
t('august still in progress',    cover('1111','2026-08').s, 'part');
t('august reaches the 13th',     cover('1111','2026-08').to, '2026-08-13');
t('never imported',              cover('1111','2026-04').s, 'none');
/* Legacy rows carry no date; guessing from the last purchase would nag about
   months that are actually fine. */
t('undated import counts as full', cover('1111','2026-05').s, 'full');
t('reach reports its source',      reach('1111','2026-05').src, 'undated');
t('last import date',              lastImp('1111'), '2026-08-13');
t('no imports for unknown card',   lastImp('9999'), null);

/* ---------- issuer links ---------- */
t('MAX',      issuer('MAX').u,     'https://www.max.co.il/login');
t('CAL',      issuer('כאל').u,     'https://www.cal-online.co.il/self-service/alltransactions/');
t('Isracard', issuer('ישראכרט').u, 'https://digital.isracard.co.il/personalarea/Login/');
t('unknown issuer has no link', issuer('בנק כלשהו'), null);

/* ---------- tracker ---------- */
renderTrack();
t('both cards listed',   ['1111','2222'].every(c=>H('track').indexOf('····'+c)!==-1), true);
t('three chips per card',(H('track').match(/class="tk-p/g)||[]).length, 6);
t('links are safe',      (H('track').match(/rel="noopener noreferrer"/g)||[]).length, 2);

t('clock is pinned', realM(), '2026-08');

/* ---------- subscription watchdog ----------
   The missing water and mobile bills went unnoticed for months because a
   standing order that stops simply leaves no trace. */
var subs = subsLike();
t('finds the monthly charge', subs.filter(g=>g.n==='טריפל סי').length, 1);
t('excludes the grocery run', subs.filter(g=>g.n==='סופר הדוגמה').length, 0);
renderWatch();
t('nothing silent yet', H('watchNote'), '');
data.transactions.forEach(x=>{ if(x.note==='טריפל סי') x.date = '2026-0'+(Number(x.date[6])-3)+x.date.slice(7); });
renderWatch();
t('silence raises an alarm', H('watchNote').indexOf('טריפל סי')!==-1, true);

/* ---------- chat context ----------
   The assistant answered "I have no access to the import history" because
   none of it was ever placed in front of it. */
data = normalize(JSON.parse(JSON.stringify(FX))); curM = '2026-08';
var C = ctx();
t('carries import history', C.indexOf('היסטוריית ייבוא')!==-1, true);
t('carries the card list',  C.indexOf('····1111')!==-1, true);
t('itemises other months',  C.indexOf('תנועות ביולי 2026')!==-1, true);
t('tags each row source',   /\\| קבוע \\|/.test(C), true);
t('admits its own limits',  C.indexOf('סיכומי קטגוריות בלבד')!==-1, true);

/* ---------- trend ---------- */
curM='2026-07'; trendNorm=false; renderTrend();
var plain = T('trendTxt');
trendNorm=true; renderTrend();
t('rolling average labelled', T('trendTxt').indexOf('ממוצע נע 3 חודשים')===0, true);
t('rolling changes the figure', plain!==T('trendTxt'), true);
t('toggle label flips', T('trendMode'), 'בפועל');
trendNorm=false;

/* ---------- server payload guard ----------
   The client refuses to write before a successful read, but nothing stopped a
   malformed request from replacing the whole key. */
t('rejects empty',      reject(''),                              'empty_body');
t('rejects junk',       reject('not json'),                      'not_json');
t('rejects an array',   reject('[]'),                            'not_an_object');
t('rejects no tx',      reject('{"deleted":[]}'),                'missing_transactions');
t('rejects no deleted', reject('{"transactions":[]}'),           'missing_deleted');
t('accepts valid',      reject('{"transactions":[],"deleted":[]}'), null);

/* ---------- nothing crashes on a fresh account ---------- */
data = emptyData(); curM = realM();
renderLockOpen(); renderGap(); renderForecast(); renderBig(); renderWatch();
renderTrack(); renderMissing(); renderSubs(); renderTrend();
t('fresh account renders', [H('splitBox'),H('gapNote'),H('fcNote'),H('bigNote'),H('watchNote'),H('missNote')].join(''), '');
`;

eval(appSource() + SUITE);

const { pass, fail } = report('FAILURES');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
