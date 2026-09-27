/* Regression suite for budget-cloud-app.
 *
 *   npm test        (or: node tests/run.js)
 *
 * Every group exists because something broke in production. The comment above
 * a group says what. Do not delete one without reading it.
 */
process.env.TZ = 'Asia/Jerusalem';

import { stubDom, pinClock, fixture, payloadGuard, runner } from './harness.js';

const reg = stubDom();
pinClock();                 /* 2026-08-18 — see harness.js */

/* imported after the DOM exists: some modules touch localStorage on load */
const { S, emptyData, catsFor } = await import('../app/state.js');
const { guessCat, normName, dupKey } = await import('../app/classify.js');
const { toDate } = await import('../app/importer.js');
const { today, realM, shiftM, lastDay, money, signed } = await import('../app/format.js');
const { normalize, merge } = await import('../app/storage.js');
const { recId, recRow } = await import('../app/recurring.js');
const { issuer, reach, cover, lastImp, renderTrack, renderMissing } = await import('../app/coverage.js');
const ov = await import('../app/views/overview.js');
const { ctx } = await import('../app/chat.js');

const reject = payloadGuard();
const { check: t, report } = runner();
const FX = fixture();
const H = id => (reg[id] ? reg[id].innerHTML : '');
const TXT = id => (reg[id] ? reg[id].textContent : '');
const load = () => { S.data = normalize(fixture()); S.loaded = true; };

/* ---------- categories ----------
   Short keys matched inside longer words: 'גט' fired on 'בגט', 'דן' on
   'גן עדן'. Keys of three characters or fewer now need a word boundary. */
t('electricity is a utility',  guessCat('חברת החשמל'),            'חשבונות ותקשורת');
t('appliance shop is housing', guessCat('מחסני חשמל'),            'דיור');
t('ZARA matches latin',        guessCat('ZARA ISRAEL'),           'ביגוד');
t('baguette is not Gett',      guessCat('בגט של אמא'),            'אחר');
t('bakery is food',            guessCat('מאפיית בגט'),            'מזון');
t('gan eden is not the bus',   guessCat('גן עדן מסעדה'),          'מזון');
t('Dan bus still matches',     guessCat('דן תחבורה'),             'תחבורה');
t('hebrew prefix survives',    guessCat('בשוק העירוני'),          'מזון');
t('city prefix stripped',      guessCat('AMSTERDAM ~NETFLIX.COM'),'מנויים');
t('gas supplier is a utility', guessCat('פזגז בע"מ'),             'חשבונות ותקשורת');
t('unknown falls through',     guessCat('חנות פרחים'),            'אחר');

/* ---------- dates ----------
   SheetJS returns Date objects at LOCAL midnight. Reading them with the UTC
   getters shifted every imported row a day earlier in Israel, pushing
   first-of-month purchases into the previous month. */
t('excel serial',      toDate(45717),              '2025-03-01');
t('local Date object', toDate(new Date(2026,2,1)), '2026-03-01');
t('dd/mm/yyyy',        toDate('01/03/2026'),       '2026-03-01');
t('dd.mm.yy',          toDate('01.03.26'),         '2026-03-01');
t('not a date',        toDate('שלום'),             null);
t('month end',         lastDay('2026-02'),         '2026-02-28');
t('leap year',         lastDay('2028-02'),         '2028-02-29');
t('clock is pinned',   realM(),                    '2026-08');
t('today is pinned',   today(),                    '2026-08-18');

/* ---------- duplicate detection ----------
   Issuers spell the same merchant differently between reports. */
t('city prefix ignored', dupKey('2026-03-01','AMSTERDAM ~NETFLIX.COM',49.9)===dupKey('2026-03-01','NETFLIX.COM',49.9), true);
t('amount matters',      dupKey('2026-03-01','X',10)===dupKey('2026-03-01','X',11), false);
t('normalises spacing',  normName(' נט פליקס '), normName('נטפליקס'));

/* ---------- merge ----------
   Two people edit at once; tombstones stop a deletion coming back. */
const A = {transactions:[{id:'a',date:'2026-03-01',amount:1,type:'expense',category:'אחר'}],deleted:[]};
const B = {transactions:[{id:'b',date:'2026-03-02',amount:2,type:'expense',category:'אחר'}],deleted:['a']};
t('tombstone wins', merge(normalize(A),normalize(B)).transactions.map(x=>x.id), ['b']);

/* ---------- recurring ----------
   Deterministic ids stop two devices creating the same charge twice. */
t('deterministic id', recId({id:'r1'},'2026-03'), 'rec_r1_2026-03');
t('day clamped to month end', recRow({id:'r1',type:'expense',amount:100,category:'דיור',note:'',day:31},'2026-02').date, '2026-02-28');

/* ---------- lock / open ----------
   The overview's main claim: how much of the month was committed before any
   discretionary spending happened. */
load(); S.curM = '2026-07';
ov.renderLockOpen();
t('locked share',   H('splitBox').indexOf('נעול · 72%')!==-1, true);
t('locked amount',  H('splitBox').indexOf('₪5,000')!==-1, true);
t('open share',     H('splitBox').indexOf('פתוח · 28%')!==-1, true);
t('rent is listed', H('splitBox').indexOf('שכר דירה')!==-1, true);
S.curM = '2026-05'; ov.renderLockOpen();
t('no recurring -> 0% locked', H('splitBox').indexOf('נעול · 0%')!==-1, true);
S.data = emptyData(); ov.renderLockOpen();
t('empty account is silent', H('splitBox'), '');

/* ---------- large one-off charges ----------
   A month can look bad because one bill landed in it. */
load(); S.curM = '2026-07'; ov.renderBig();
t('flags the big charge', H('bigNote').indexOf('רכישה חד פעמית גדולה')!==-1, true);
S.curM = '2026-08'; ov.renderBig();
t('quiet when nothing is large', H('bigNote'), '');

/* ---------- credit report coverage ----------
   "There is data" is not "the month is covered": a report pulled on the 13th
   does not contain the rest of the month. */
t('july pulled after month end',   cover('1111','2026-07').s,  'full');
t('august still in progress',      cover('1111','2026-08').s,  'part');
t('august reaches the 13th',       cover('1111','2026-08').to, '2026-08-13');
t('never imported',                cover('1111','2026-04').s,  'none');
/* Legacy rows carry no pull date. Guessing from the last purchase would nag
   about months that are actually fine. */
t('undated import counts as full', cover('1111','2026-05').s,  'full');
t('reach reports its source',      reach('1111','2026-05').src,'undated');
t('last import date',              lastImp('1111'),            '2026-08-13');
t('no imports for unknown card',   lastImp('9999'),            null);

/* ---------- issuer links ---------- */
t('MAX',      issuer('MAX').u,     'https://www.max.co.il/login');
t('CAL',      issuer('כאל').u,     'https://www.cal-online.co.il/self-service/alltransactions/');
t('Isracard', issuer('ישראכרט').u, 'https://digital.isracard.co.il/personalarea/Login/');
t('unknown issuer has no link', issuer('בנק כלשהו'), null);

/* ---------- tracker ---------- */
renderTrack();
t('both cards listed',    ['1111','2222'].every(c=>H('track').indexOf('····'+c)!==-1), true);
t('three chips per card', (H('track').match(/class="tk-p/g)||[]).length, 6);
t('links are safe',       (H('track').match(/rel="noopener noreferrer"/g)||[]).length, 2);
renderMissing();
t('july is complete, no warning', H('missNote'), '');

/* ---------- subscription watchdog ----------
   The missing water and mobile bills went unnoticed for months: a standing
   order that stops simply leaves no trace. */
const subs = ov.subsLike();
t('finds the monthly charge', subs.filter(g=>g.n==='טריפל סי').length, 1);
t('excludes the grocery run', subs.filter(g=>g.n==='סופר הדוגמה').length, 0);
ov.renderWatch();
t('nothing silent yet', H('watchNote'), '');
S.data.transactions.forEach(x=>{ if(x.note==='טריפל סי') x.date='2026-0'+(Number(x.date[6])-3)+x.date.slice(7); });
ov.renderWatch();
t('silence raises an alarm', H('watchNote').indexOf('טריפל סי')!==-1, true);

/* ---------- chat context ----------
   The assistant answered "I have no access to the import history" because
   none of it was ever placed in front of it. */
load(); S.curM = '2026-08';
const C = ctx();
t('carries import history', C.indexOf('היסטוריית ייבוא')!==-1, true);
t('carries the card list',  C.indexOf('····1111')!==-1, true);
t('itemises other months',  C.indexOf('תנועות ביולי 2026')!==-1, true);
t('tags each row source',   /\| קבוע \|/.test(C), true);
t('admits its own limits',  C.indexOf('סיכומי קטגוריות בלבד')!==-1, true);

/* ---------- trend ---------- */
S.curM='2026-07'; S.trendNorm=false; ov.renderTrend();
const plain = TXT('trendTxt');
S.trendNorm=true; ov.renderTrend();
t('rolling average labelled',   TXT('trendTxt').indexOf('ממוצע נע 3 חודשים')===0, true);
t('rolling changes the figure', plain!==TXT('trendTxt'), true);
t('toggle label flips',         TXT('trendMode'), 'בפועל');
S.trendNorm=false;

/* ---------- formatting ---------- */
t('money rounds and groups', money(1234.6), '₪1,235');
t('signed keeps the minus',  signed(-184),  '-₪184');
t('month arithmetic',        shiftM('2026-01',-1), '2025-12');

/* ---------- server payload guard ----------
   The client refuses to write before a successful read, but nothing stopped a
   malformed request replacing the whole key. */
t('rejects empty',      reject(''),                                'empty_body');
t('rejects junk',       reject('not json'),                        'not_json');
t('rejects an array',   reject('[]'),                              'not_an_object');
t('rejects no tx',      reject('{"deleted":[]}'),                   'missing_transactions');
t('rejects no deleted', reject('{"transactions":[]}'),              'missing_deleted');
t('accepts valid',      reject('{"transactions":[],"deleted":[]}'), null);

/* ---------- nothing crashes on a fresh account ---------- */
S.data = emptyData(); S.curM = realM();
ov.renderLockOpen(); ov.renderGap(); ov.renderForecast(); ov.renderBig();
ov.renderWatch(); ov.renderSubs(); ov.renderTrend();
renderTrack(); renderMissing();
t('fresh account renders', [H('splitBox'),H('gapNote'),H('fcNote'),H('bigNote'),H('watchNote'),H('missNote')].join(''), '');

/* ---------- categories list ---------- */
t('income categories differ', catsFor('income').indexOf('משכורת')!==-1, true);

process.exit(report() ? 1 : 0);
