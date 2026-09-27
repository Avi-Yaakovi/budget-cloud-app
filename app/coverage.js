import { MONTHS } from './config.js';
import { dLabel, esc, lastDay, mLabel, mk, realM, shiftM } from './format.js';
import { S } from './state.js';

/* Credit-report coverage. Whether a month is covered is a question about how
   far the data reaches, not whether any rows exist. A report pulled on the
   13th does not contain the rest of the month. */

export const ISSUERS={
  'MAX':      {u:'https://www.max.co.il/login',                         n:'max.co.il'},
  'כאל':      {u:'https://www.cal-online.co.il/self-service/alltransactions/', n:'cal-online.co.il'},
  'ישראכרט':  {u:'https://digital.isracard.co.il/personalarea/Login/',   n:'isracard.co.il'}
};
export function issuer(co){
  const c=String(co||'');
  for(const k in ISSUERS){ if(c.indexOf(k)!==-1) return ISSUERS[k]; }
  return null;
}
/* How far into a month the data for a card actually reaches. A report pulled on
   the 13th does not contain the rest of the month, so "there is data" is not the
   same as "the month is covered" — the tick used to claim the latter. */
export function reach(c4,k){
  const rel=(S.data.importHistory||[]).filter(x=>x.cardLast4===c4&&(x.months||[]).indexOf(k)!==-1);
  const dated=rel.filter(x=>x.at).map(x=>x.at).sort();
  if(dated.length) return {d:dated[dated.length-1],src:'import'};
  /* Older history rows carry no date. We cannot know how far they reached, and
     guessing from the last purchase would nag about months that are actually
     fine — so an undated import counts as complete. */
  if(rel.length) return {d:null,src:'undated'};
  const ds=S.data.transactions.filter(t=>t.cardLast4===c4&&mk(t.date)===k).map(t=>t.date).sort();
  if(ds.length) return {d:ds[ds.length-1],src:'tx'};
  return null;
}
/* 'full' only when the data is known to reach the final day of the month. */
export function cover(c4,k){
  const r=reach(c4,k);
  if(!r) return {s:'none'};
  if(r.src==='undated') return {s:'full'};
  return r.d>=lastDay(k) ? {s:'full',to:r.d} : {s:'part',to:r.d};
}
export function covered(c4,k){ return cover(c4,k).s!=='none'; }
export function lastImp(c4){
  const xs=(S.data.importHistory||[]).filter(x=>x.cardLast4===c4&&x.at);
  return xs.length?xs.map(x=>x.at).sort().pop():null;
}
/* Cards are listed with the last three months so a gap is visible as a gap,
   not as a number that happens to look small. */
export function trackMonths(){
  const now=realM(), out=[];
  for(let i=2;i>=0;i--) out.push(shiftM(now,-i));
  return out;
}
export function renderTrack(){
  const box=document.getElementById('track'), no=document.getElementById('trackNo');
  box.innerHTML='';
  const cards=(S.data.cards||[]).slice();
  if(!cards.length){ no.style.display='block'; return; }
  no.style.display='none';
  const ms=trackMonths(), now=realM();
  cards.forEach(c=>{
    const lb=(S.data.cardLabels||{})[c.last4]||c.label||'', iss=issuer(c.company);
    const li=lastImp(c.last4);
    const d=document.createElement('div'); d.className='tk';
    const chips=ms.map(k=>{
      const cv=cover(c.last4,k), live=(k===now);
      let cls,face,tip;
      if(cv.s==='full'){ cls='ok'; face='✓'; tip='חודש מלא'; }
      else if(cv.s==='none'){ cls=live?'':'no'; face=live?'·':'✕'; tip=live?'עוד לא הועלה':'לא הועלה'; }
      else { cls=live?'':'wait'; face=String(Number(cv.to.slice(8))); tip='נתונים עד '+dLabel(cv.to)+(live?'':' — הדוח נמשך לפני סוף החודש'); }
      return `<span class="tk-p ${cls}" title="${esc(mLabel(k)+' · '+tip)}"><b>${face}</b>${esc(MONTHS[Number(k.slice(5))-1].slice(0,3))}</span>`;
    }).join('');
    d.innerHTML=`<div class="tk-m"><span class="tk-t">${esc(lb||('····'+c.last4))}</span>`
      +`<span class="tk-s">${esc(c.company||'לא ידוע')} · ····${esc(c.last4)}${li?' · יובא '+esc(dLabel(li)):''}</span></div>`
      +`<div class="tk-c">${chips}</div>`
      +(iss?`<a class="tk-a" href="${iss.u}" target="_blank" rel="noopener noreferrer">הורדה ↗</a>`:'');
    box.appendChild(d);
  });
}
/* Surfaces a missing report while it still matters — the previous month is the
   one that should be complete, the current one is merely in progress. */
export function renderMissing(){
  const el=document.getElementById('missNote'); el.innerHTML='';
  const prev=shiftM(realM(),-1);
  const gaps=(S.data.cards||[]).map(c=>({c,cv:cover(c.last4,prev)})).filter(x=>x.cv.s!=='full');
  if(!gaps.length) return;
  el.innerHTML=`<div class="note warn"><div class="note-body"><b>${esc(mLabel(prev))} עדיין לא מכוסה במלואו</b><br>`
    +gaps.map(({c,cv})=>{
      const lb=(S.data.cardLabels||{})[c.last4]||c.label||('····'+c.last4), iss=issuer(c.company);
      const st=cv.s==='none'?'לא הועלה':('נתונים עד '+dLabel(cv.to)+' בלבד');
      return esc(lb)+' · '+esc(st)+(iss?` <a href="${iss.u}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${esc(iss.n)} ↗</a>`:'');
    }).join('<br>')
    +`</div></div>`;
}

/* "נעול ופתוח": the committed mass and the part still open to decisions.
   Not to be confused with renderSplit(), which draws the category breakdown. */
