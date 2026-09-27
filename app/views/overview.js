import { mTx, normName, sums } from '../classify.js';
import { COLORS, MONTHS } from '../config.js';
import { dLabel, dim, esc, mLabel, mk, money, realM, shiftM, signed, today } from '../format.js';
import { renderAll, setTab } from '../shell.js';
import { S, expCats } from '../state.js';
import { save } from '../storage.js';

/* The overview panel: balance, the locked/open split, forecast, large charges,
   the subscription watchdog, the trend chart and the category breakdown. */

export function renderHero(){
  const s=sums(S.curM), bal=s.inc-s.exp;
  const h=document.getElementById('heroNum');
  h.textContent=signed(bal);
  h.style.color=bal<0?'var(--neg)':'var(--ink)';
  document.getElementById('inSum').textContent=money(s.inc);
  document.getElementById('outSum').textContent=money(s.exp);
  const p=sums(shiftM(S.curM,-1)).exp, d=document.getElementById('heroDelta');
  if(p>0&&s.exp>0){
    const diff=s.exp-p, pct=Math.round(Math.abs(diff)/p*100);
    const [,pm]=shiftM(S.curM,-1).split('-').map(Number);
    d.innerHTML=`הוצאתם <b style="color:${diff>=0?'var(--neg)':'var(--pos)'}">${money(diff)}</b> ${diff>=0?'יותר':'פחות'} מ${MONTHS[pm-1]} (${pct}%)`;
    d.style.display='block';
  } else d.style.display='none';
}

export function renderLockOpen(){
  const el=document.getElementById('splitBox'); el.innerHTML='';
  const tx=mTx(S.curM);
  const lockRows={}, openRows={};
  let lock=0, open=0;
  tx.forEach(t=>{
    if(t.type!=='expense') return;
    if(t.recurringId){ lock+=t.amount; lockRows[t.note||t.category]=(lockRows[t.note||t.category]||0)+t.amount; }
    else { open+=t.amount; openRows[t.category]=(openRows[t.category]||0)+t.amount; }
  });
  const total=lock+open;
  if(!total) return;
  const inc=tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const pool=inc-lock;
  const lockPct=Math.round(lock/total*100), openPct=100-lockPct;
  const top=o=>Object.keys(o).sort((a,b)=>o[b]-o[a]).slice(0,4);
  const SHADE=['#C8CCC2','#8A9184','#5C6357','#3E443B'];
  const lk=top(lockRows), op=top(openRows);
  const segs=lk.map((k,i)=>`<div style="width:${Math.max(1,Math.round(lockRows[k]/lock*100))}%;background:${SHADE[i]}"></div>`).join('');
  const usedPct=pool>0?Math.min(100,Math.round(open/pool*100)):(open>0?100:0);
  const col=pool>0&&open>pool?'var(--neg)':(usedPct>=80?'var(--warn)':'var(--pos)');

  let s=`<div class="lock2"><div class="sp-h"><span class="sp-k">נעול · ${lockPct}%</span><span class="sp-v">${money(lock)}</span></div>`
    +`<p class="sp-s">כבר יצא או מובטח לצאת. אין מה להחליט כאן החודש.</p>`
    +(lock?`<div class="sp-seg">${segs}</div>`:'')
    +`<div class="sp-l">`+lk.map(k=>`<div class="sp-r"><span>${esc(k)}</span><b>${money(lockRows[k])}</b></div>`).join('')+`</div></div>`;

  s+=`<div class="open2"><div class="sp-h"><span class="sp-k">פתוח · ${openPct}%</span><span class="sp-v">${money(open)}</span></div>`
    +`<p class="sp-s">${pool>0
        ? (open>pool
            ? `מתוך ${money(pool)} שנשארו. חריגה של ${money(open-pool)}.`
            : `מתוך ${money(pool)} שנשארו. פנוי ${money(pool-open)}.`)
        : 'ההוצאות הקבועות כבר גדולות מההכנסה החודש.'}</p>`
    +`<div class="sp-bar"><i style="width:${usedPct}%;background:${col}"></i></div>`
    +op.map(k=>`<div class="sp-r"><span>${esc(k)}</span><b>${money(openRows[k])}</b></div>`).join('')
    +`</div>`;
  el.innerHTML=s;
}

/* The balance alone hides the real constraint: how much of the month was already
   committed before a single discretionary shekel was spent. */
export function renderGap(){
  const el=document.getElementById('gapNote');
  const ri=(S.data.recurring||[]).filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const re=(S.data.recurring||[]).filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  if(!ri&&!re){ el.innerHTML=''; return; }
  const free=ri-re;
  const tx=mTx(S.curM);
  const usedV=tx.filter(t=>t.type==='expense'&&!t.recurringId).reduce((s,t)=>s+t.amount,0);
  const extraI=tx.filter(t=>t.type==='income'&&!t.recurringId).reduce((s,t)=>s+t.amount,0);
  const pool=free+extraI, left=pool-usedV;
  if(free<0){
    el.innerHTML=`<div class="note warn"><div class="note-body"><b>הקבועות לבדן גדולות מההכנסה הקבועה.</b><br>`
      +`יוצא <span class="n">${money(re)}</span> מול <span class="n">${money(ri)}</span> שנכנס — חסר <span class="n">${money(free)}</span> עוד לפני הוצאה שוטפת אחת.</div></div>`;
    return;
  }
  const commitPct=ri?Math.min(100,Math.round(re/ri*100)):0;
  const usedPct=pool>0?Math.min(100,Math.round(usedV/pool*100)):(usedV>0?100:0);
  const col=left<0?'var(--neg)':(usedPct>=80?'var(--warn)':'var(--pos)');
  el.innerHTML=`<div class="card">
    <h2 class="ttl">מחויב מראש מול פנוי<span class="sub">${mLabel(S.curM)}</span></h2>
    <div class="brow"><div class="btop"><span>קבועות מתוך ההכנסה הקבועה</span><span class="r">${money(re)} / ${money(ri)} · ${commitPct}%</span></div>
      <div class="btrack"><div class="bfill" style="width:${commitPct}%;background:var(--accent)"></div></div></div>
    <div class="brow"><div class="btop"><span>מהפנוי כבר נוצל</span><span class="r">${money(usedV)} / ${money(pool)} · ${usedPct}%</span></div>
      <div class="btrack"><div class="bfill" style="width:${usedPct}%;background:${col}"></div></div></div>
    <p class="hint" style="margin:2px 0 0">${left>=0
      ? `נשאר <b class="n" style="color:var(--pos)">${money(left)}</b> פנוי החודש.`
      : `חריגה של <b class="n" style="color:var(--neg)">${money(left)}</b> מעבר לפנוי.`}</p>
  </div>`;
}

/* Projects the month before it ends, from the pace of discretionary spend so far.
   Recurring rows are already created in full for the month, so only the variable
   part is extrapolated. */
export function renderForecast(){
  const el=document.getElementById('fcNote'); el.innerHTML='';
  if(S.curM!==realM()) return;
  const [y,m]=S.curM.split('-').map(Number), tot=dim(y,m), day=new Date().getDate();
  if(day<5||day>=tot) return;
  const tx=mTx(S.curM);
  const varE=tx.filter(t=>t.type==='expense'&&!t.recurringId).reduce((s,t)=>s+t.amount,0);
  const recE=tx.filter(t=>t.type==='expense'&&t.recurringId).reduce((s,t)=>s+t.amount,0);
  const inc=tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  if(!varE&&!recE) return;
  const proj=recE+varE/day*tot, bal=inc-proj;
  el.innerHTML=`<div class="note ${bal<0?'warn':'info'}"><div class="note-body">`
    +`<b>תחזית לסוף ${MONTHS[m-1]}</b> (לפי ${day} מתוך ${tot} ימים)<br>`
    +`הוצאות צפויות <span class="n">${money(proj)}</span>`
    +(inc?` · מאזן צפוי <span class="n" style="color:${bal<0?'var(--neg)':'var(--pos)'}">${signed(Math.round(bal))}</span>`:'')
    +`<br><span style="font-size:11px;color:var(--ink-3)">הקבועות נספרות מלאות; המשתנות מוכפלות לפי הקצב עד עכשיו.</span></div></div>`;
}

/* Flags unusually large one-off charges, so a bad-looking month can be read
   correctly instead of blamed on day-to-day spending. */
export function renderBig(){
  const el=document.getElementById('bigNote'); el.innerHTML='';
  const big=mTx(S.curM).filter(t=>t.type==='expense'&&!t.recurringId&&t.amount>=700)
    .sort((a,b)=>b.amount-a.amount).slice(0,4);
  if(!big.length) return;
  const sum=big.reduce((s,t)=>s+t.amount,0);
  el.innerHTML=`<div class="note info"><div class="note-body"><b>חיובים גדולים חד־פעמיים החודש — ${money(sum)}</b><br>`
    +big.map(t=>`${esc(t.note||t.category)} <span class="n">${money(t.amount)}</span>`).join(' · ')
    +`<br><span style="font-size:11px;color:var(--ink-3)">בלעדיהם החודש עומד על ${money(sums(S.curM).exp-sum)}.</span></div></div>`;
}

/* Standing orders that simply stopped showing up are invisible otherwise —
   this is how the missing water and mobile bills went unnoticed for months. */
export function subsLike(){
  const by=new Map();
  S.data.transactions.forEach(t=>{
    if(t.type!=='expense'||t.recurringId||t.amount<=0) return;
    const k=normName(t.note||''); if(k.length<4) return;
    if(!by.has(k)) by.set(k,[]);
    by.get(k).push(t);
  });
  const now=new Date(today()), out=[];
  by.forEach(rows=>{
    if(rows.length<3) return;
    const months=new Set(rows.map(t=>mk(t.date)));
    if(months.size<3) return;
    if(rows.length/months.size>1.6) return;                  /* a shop, not a subscription */
    const amts=rows.map(t=>t.amount);
    if(Math.max.apply(null,amts)/Math.min.apply(null,amts)>3) return;
    const last=rows.map(t=>t.date).sort().pop();
    out.push({ n:rows[0].note, cat:rows[0].category, c4:rows[0].cardLast4||null,
      a:amts.reduce((s,x)=>s+x,0)/amts.length, last:last,
      d:Math.round((now-new Date(last))/86400000) });
  });
  return out.sort((a,b)=>b.a-a.a);
}
export function renderWatch(){
  const el=document.getElementById('watchNote'); el.innerHTML='';
  const gone=subsLike().filter(g=>g.d>40);
  if(!gone.length) return;
  el.innerHTML=`<div class="note warn"><div class="note-body"><b>חיובים חוזרים שהפסיקו להופיע</b><br>`
    +gone.slice(0,5).map(g=>`${esc(g.n)} — כ־<span class="n">${money(g.a)}</span>, לא נראה ${g.d} יום`).join('<br>')
    +`<br><span style="font-size:11px;color:var(--ink-3)">או שהחיוב עבר לבנק, או שהמנוי נפסק. שווה בדיקה.</span></div></div>`;
}
export function renderSubs(){
  const box=document.getElementById('subsList'), no=document.getElementById('subsNo');
  box.innerHTML='';
  const s=subsLike();
  if(!s.length){ no.style.display='block'; return; }
  no.style.display='none';
  const tot=s.reduce((x,g)=>x+g.a,0);
  s.forEach(g=>{
    const d=document.createElement('div'); d.className='r';
    const bits=[g.cat]; if(g.c4) bits.push('····'+g.c4);
    bits.push(g.d>40?('לא נראה '+g.d+' יום'):('אחרון '+dLabel(g.last)));
    d.innerHTML=`<div class="r-mid"><span class="r-t">${esc(g.n)}${g.d>40?'<span class="tag">נעצר?</span>':''}</span>`
      +`<span class="r-s">${esc(bits.join(' · '))}</span></div>`
      +`<span class="r-v n">${money(g.a)}</span>`;
    box.appendChild(d);
  });
  const f=document.createElement('div'); f.className='r';
  f.innerHTML=`<div class="r-mid"><span class="r-t">סה״כ חוזר בחודש</span><span class="r-s">${s.length} ספקים · מעבר לתנועות הקבועות</span></div><span class="r-v n">${money(tot)}</span>`;
  box.appendChild(f);
}

export function cardName(l4){
  const c=(S.data.cards||[]).find(x=>x.last4===l4);
  const lb=(S.data.cardLabels||{})[l4]||(c&&c.label)||'';
  return (lb?lb+' · ':'')+((c&&c.company)?c.company+' ':'')+'····'+l4;
}

export function renderRemind(){
  const el=document.getElementById('remNote'); el.innerHTML='';
  const pm=shiftM(realM(),-1);
  if((S.data.uploadReminderDismissed||{})[pm]) return;
  const set=new Set(); (S.data.cards||[]).forEach(c=>set.add(c.last4));
  if(!set.size) return;
  const miss=[];
  set.forEach(c=>{
    const h=(S.data.importHistory||[]).some(x=>x.cardLast4===c&&(x.months||[]).indexOf(pm)!==-1);
    const t=S.data.transactions.some(x=>x.cardLast4===c&&mk(x.date)===pm);
    if(!h&&!t) miss.push(cardName(c));
  });
  if(!miss.length) return;
  const [,m]=pm.split('-').map(Number);
  el.innerHTML=`<div class="note warn"><div class="note-body">טרם הועלה דוח ${MONTHS[m-1]} עבור:<br>${esc(miss.join(', '))}</div><button class="note-act" type="button">לייבוא</button><button class="note-x" type="button">✕</button></div>`;
  el.querySelector('.note-act').onclick=()=>setTab('imp');
  el.querySelector('.note-x').onclick=()=>{ S.data.uploadReminderDismissed[pm]=true; save(); el.innerHTML=''; };
}

export function renderTrend(){
  const box=document.getElementById('trend'), no=document.getElementById('trendNo'), txt=document.getElementById('trendTxt');
  box.innerHTML='';
  const ms=Array.from(new Set(S.data.transactions.map(t=>mk(t.date)))).sort().slice(-6);
  if(ms.length<2){ no.style.display='block'; txt.textContent=''; return; }
  no.style.display='none';
  let st=ms.map(k=>Object.assign({k},sums(k)));
  /* Bi-monthly bills land as spikes; the rolling view makes months comparable. */
  if(S.trendNorm){
    const raw=st.slice();
    st=raw.map((x,i)=>{ const w=raw.slice(Math.max(0,i-2),i+1);
      return {k:x.k, inc:w.reduce((s,z)=>s+z.inc,0)/w.length, exp:w.reduce((s,z)=>s+z.exp,0)/w.length}; });
  }
  const max=Math.max(1,...st.map(x=>Math.max(x.inc,x.exp)));
  st.forEach(x=>{
    const [,m]=x.k.split('-').map(Number), part=x.k===realM();
    const c=document.createElement('div');
    c.className='tr-c'+(x.k===S.curM?' sel':'')+(part?' part':'');
    c.innerHTML=`<div class="tr-b"><div class="tr-bar p" style="height:${Math.round(Math.max(0,x.inc)/max*100)}%"></div><div class="tr-bar n" style="height:${Math.round(Math.max(0,x.exp)/max*100)}%"></div></div><span class="tr-l">${MONTHS[m-1].slice(0,3)}${part?'*':''}</span>`;
    c.onclick=()=>{ S.curM=x.k; S.lim=20; renderAll(); };
    box.appendChild(c);
  });
  const done=st.filter(x=>x.k!==realM()), base=done.length?done:st;
  const avg=base.reduce((s,x)=>s+x.exp,0)/base.length;
  const top=base.slice().sort((a,b)=>b.exp-a.exp)[0];
  txt.textContent=(S.trendNorm?'ממוצע נע 3 חודשים · ':'')
    +`ממוצע הוצאות ${money(avg)} לחודש · הגבוה ביותר: ${mLabel(top.k)} (${money(top.exp)})`
    +(st.some(x=>x.k===realM())?'  ·  * החודש עוד לא הסתיים':'');
  const btn=document.getElementById('trendMode');
  if(btn) btn.textContent=S.trendNorm?'בפועל':'מנורמל';
}

export function catTotals(k){
  const m={};
  mTx(k).filter(t=>t.type==='expense').forEach(t=>{ m[t.category]=(m[t.category]||0)+t.amount; });
  return m;
}

export function renderSplit(){
  const box=document.getElementById('split'), no=document.getElementById('splitNo');
  box.innerHTML='';
  const m=catTotals(S.curM), ent=Object.entries(m).filter(([,v])=>v!==0);
  if(!ent.length){ no.style.display='block'; return; }
  no.style.display='none';
  const tot=ent.reduce((s,[,v])=>s+Math.max(0,v),0)||1;
  const cats=expCats();
  ent.sort((a,b)=>b[1]-a[1]).forEach(([c,v])=>{
    const pct=Math.round(Math.max(0,v)/tot*100);
    const col=COLORS[Math.max(0,cats.indexOf(c))%COLORS.length];
    const d=document.createElement('div'); d.className='brow';
    d.innerHTML=`<div class="btop"><span>${esc(c)}</span><span class="r">${signed(v)} · ${pct}%</span></div><div class="btrack"><div class="bfill" style="width:${pct}%;background:${col}"></div></div>`;
    box.appendChild(d);
  });
}

export function renderByCard(){
  const box=document.getElementById('byCard'); box.innerHTML='';
  const tx=mTx(S.curM).filter(t=>t.type==='expense');
  const m={}; let none=0;
  tx.forEach(t=>{ if(t.cardLast4) m[t.cardLast4]=(m[t.cardLast4]||0)+t.amount; else none+=t.amount; });
  const rows=[];
  (S.data.cards||[]).forEach((c,i)=>{ rows.push({n:cardName(c.last4),v:m[c.last4]||0,c:COLORS[i%COLORS.length]}); delete m[c.last4]; });
  Object.keys(m).forEach(l4=>rows.push({n:'····'+l4,v:m[l4],c:'var(--ink-3)'}));
  if(none!==0) rows.push({n:'ללא כרטיס (הזנה ידנית)',v:none,c:'var(--ink-3)'});
  const tot=rows.reduce((s,r)=>s+Math.max(0,r.v),0)||1;
  rows.sort((a,b)=>b.v-a.v).forEach(r=>{
    const pct=Math.round(Math.max(0,r.v)/tot*100);
    const d=document.createElement('div'); d.className='brow';
    d.innerHTML=`<div class="btop"><span>${esc(r.n)}</span><span class="r">${r.v?signed(r.v)+' · '+pct+'%':'—'}</span></div><div class="btrack"><div class="bfill" style="width:${pct}%;background:${r.c}"></div></div>`;
    box.appendChild(d);
  });
}

export function catAvg(c){
  const ms=Array.from(new Set(S.data.transactions.map(t=>mk(t.date)))).filter(k=>k!==realM());
  if(!ms.length) return 0;
  const tot=S.data.transactions.filter(t=>t.type==='expense'&&t.category===c&&ms.indexOf(mk(t.date))!==-1).reduce((s,t)=>s+t.amount,0);
  return Math.max(0,tot/ms.length);
}

export function renderBudgets(){
  const box=document.getElementById('budg'); box.innerHTML='';
  const m=catTotals(S.curM);
  expCats().forEach(c=>{
    const spent=Math.max(0,m[c]||0), lim2=S.data.budgets[c]||0;
    const d=document.createElement('div'); d.className='brow';
    if(lim2>0){
      const pct=Math.min(spent/lim2*100,100);
      let col='var(--pos)'; if(pct>=100)col='var(--neg)'; else if(pct>=80)col='var(--warn)';
      d.innerHTML=`<div class="btop"><span>${esc(c)}</span><span class="bedit">${money(spent)} / ${money(lim2)}</span></div><div class="btrack"><div class="bfill" style="width:${pct}%;background:${col}"></div></div>`;
      d.querySelector('.bedit').onclick=()=>editBudget(c,d,lim2);
    } else {
      const a=catAvg(c);
      const sg=a>0?`<button class="blink" type="button">ממוצע ${money(a)} — קבע</button> `:'';
      d.innerHTML=`<div class="btop"><span>${esc(c)}</span><span>${sg}<span class="bedit">הגדר</span></span></div><div class="btrack"><div class="bfill" style="width:0%"></div></div>`;
      d.querySelector('.bedit').onclick=()=>editBudget(c,d,'');
      const b=d.querySelector('.blink'); if(b) b.onclick=()=>setBudget(c,Math.round(a/10)*10);
    }
    box.appendChild(d);
  });
}
export function editBudget(c,row,cur){
  const top=row.querySelector('.btop');
  top.innerHTML=`<span>${esc(c)}</span><span></span>`;
  const i=document.createElement('input');
  i.type='number'; i.className='bnum'; i.value=cur||''; i.placeholder='חודשי';
  top.lastChild.appendChild(i); i.focus();
  const done=()=>setBudget(c,parseFloat(i.value)||0);
  i.onkeydown=e=>{ if(e.key==='Enter') done(); };
  i.onblur=done;
}
export function setBudget(c,v){ S.data.budgets[c]=v>0?v:0; save(); renderBudgets(); }
