import { dim, esc, mLabel, mk, money, pad, realM, signed, uid } from './format.js';
import { renderAll } from './shell.js';
import { S } from './state.js';
import { msg, save } from './storage.js';

/* Standing transactions. Ids are deterministic (rec_{rule}_{YYYY-MM}) so two
   devices generating this month's rent produce the same row, not two. */

/* Deterministic id: if two devices generate this month's charge at the same
   moment they produce the identical id, so the merge collapses them into one. */
export function recId(rule,k){ return 'rec_'+rule.id+'_'+k; }
export function recRow(rule,k){
  const [y,m]=k.split('-').map(Number);
  return { id:recId(rule,k), type:rule.type, amount:rule.amount, category:rule.category,
           note:rule.note, date:`${k}-${pad(Math.min(rule.day,dim(y,m)))}`, recurringId:rule.id };
}

export function applyRec(){
  const k=realM(); let n=0;
  const gone=new Set(S.data.deleted||[]);
  (S.data.recurring||[]).forEach(r=>{
    if(gone.has(recId(r,k))) return;                                  /* respect a manual delete */
    if(S.data.transactions.some(t=>t.recurringId===r.id&&mk(t.date)===k)) return;
    S.data.transactions.push(recRow(r,k));
    n++;
  });
  if(n) save();
  return n;
}
export function renderRec(){
  const box=document.getElementById('recList'), no=document.getElementById('recNo');
  box.innerHTML='';
  const ri=(S.data.recurring||[]).filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const re=(S.data.recurring||[]).filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  document.getElementById('rIn').textContent=money(ri);
  document.getElementById('rOut').textContent=money(re);
  const n=document.getElementById('rNet'); n.textContent=signed(ri-re);
  n.style.color=(ri-re)<0?'var(--neg)':'var(--pos)';
  if(!(S.data.recurring||[]).length){ no.style.display='block'; return; }
  no.style.display='none';
  S.data.recurring.forEach(r=>{
    const d=document.createElement('div'); d.className='r';
    d.innerHTML=`<div class="r-mid"><span class="r-t">${esc(r.note||r.category)}</span><span class="r-s">${esc(r.category)} · כל ${r.day} בחודש</span></div>
      <span class="r-v ${r.type==='income'?'p':'n'}">${r.type==='income'?'+':'-'}${money(r.amount)}</span>
      <button class="mini" type="button" aria-label="מחק">✕</button>`;
    d.querySelector('.mini').onclick=()=>{
      if(!confirm('למחוק את "'+(r.note||r.category)+'"?\nתנועות שכבר נוצרו יישארו.')) return;
      S.data.deleted.push(r.id);
      S.data.recurring=S.data.recurring.filter(x=>x.id!==r.id);
      save(); renderAll();
    };
    box.appendChild(d);
  });
}
export function addRec(){
  const el=document.getElementById('rAmt'), v=parseFloat(el.value);
  if(!v||v<=0){ el.focus(); return; }
  S.data.recurring.push({ id:uid(), type:S.recKind, amount:Math.abs(v),
    category:document.getElementById('rCat').value,
    note:document.getElementById('rNote').value.trim(),
    day:Math.min(Math.max(parseInt(document.getElementById('rDay').value)||1,1),31) });
  el.value=''; document.getElementById('rNote').value=''; document.getElementById('rDay').value='';
  const n=applyRec(); save(); renderAll();
  if(n) msg('recMsg','נוספה גם לחודש הנוכחי');
}
export function backfill(){
  const rules=S.data.recurring||[];
  if(!rules.length){ msg('recMsg','אין תנועות קבועות להחיל'); return; }
  const ms=Array.from(new Set(S.data.transactions.map(t=>mk(t.date)))).sort().filter(k=>k<=realM());
  const plan=[];
  ms.forEach(k=>rules.forEach(r=>{
    if(!S.data.transactions.some(t=>t.recurringId===r.id&&mk(t.date)===k)){
      const [y,m]=k.split('-').map(Number);
      plan.push({r,date:`${k}-${pad(Math.min(r.day,dim(y,m)))}`});
    }
  }));
  if(!plan.length){ msg('recMsg','כל התנועות הקבועות כבר קיימות בכל החודשים'); return; }
  const touched=Array.from(new Set(plan.map(p=>mk(p.date)))).sort().map(mLabel).join(', ');
  if(!confirm('להוסיף '+plan.length+' תנועות לחודשים: '+touched+'?\nעשו זאת רק אם התשלומים באמת בוצעו אז.')) return;
  plan.forEach(p=>S.data.transactions.push(recRow(p.r,mk(p.date))));
  save(); renderAll(); msg('recMsg','נוספו '+plan.length+' תנועות');
}
