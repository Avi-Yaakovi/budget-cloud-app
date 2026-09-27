import { isRef, mTx } from '../classify.js';
import { COLORS } from '../config.js';
import { dLabel, esc, mk, money, today, uid } from '../format.js';
import { renderAll } from '../shell.js';
import { S, catsFor, expCats } from '../state.js';
import { save } from '../storage.js';

/* The transactions panel: the filtered list, inline editing, quick add. */

export function renderTx(){
  fillCardFilter();
  const wide=!!S.q;                       /* a search should look everywhere, not only this month */
  let tx=wide?S.data.transactions.slice():mTx(S.curM);
  if(S.fType==='refund') tx=tx.filter(isRef);
  else if(S.fType==='expense') tx=tx.filter(t=>t.type==='expense'&&t.amount>=0);
  else if(S.fType==='income') tx=tx.filter(t=>t.type==='income');
  if(S.fCard!=='all') tx=tx.filter(t=>S.fCard==='none'?!t.cardLast4:t.cardLast4===S.fCard);
  if(S.q){ const s=S.q.toLowerCase(); tx=tx.filter(t=>(t.note||'').toLowerCase().indexOf(s)!==-1||(t.category||'').toLowerCase().indexOf(s)!==-1); }
  tx=tx.slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.id).localeCompare(String(a.id)));
  const box=document.getElementById('txList'), no=document.getElementById('txNo'), more=document.getElementById('more');
  box.innerHTML=''; more.style.display='none';
  document.getElementById('txCount').textContent=tx.length?(tx.length+(wide?' בכל החודשים':' בחודש זה')):'';
  if(!tx.length){ no.style.display='block'; no.textContent=S.q?'לא נמצאו תנועות תואמות באף חודש':'אין תנועות בחודש הזה'; return; }
  no.style.display='none';
  if(tx.length>S.lim){ more.style.display='block'; more.textContent=`הצג עוד (${tx.length-S.lim} מתוך ${tx.length})`; }
  const cats=expCats();
  tx.slice(0,S.lim).forEach(t=>{
    const ref=isRef(t), inc=t.type==='income';
    const col=inc?'var(--pos)':COLORS[Math.max(0,cats.indexOf(t.category))%COLORS.length];
    const r=document.createElement('div'); r.className='r';
    const bits=[esc(t.category), wide?(dLabel(t.date)+'.'+t.date.slice(2,4)):dLabel(t.date)];
    if(t.cardLast4) bits.push('····'+t.cardLast4);
    if(t.recurringId) bits.push('קבוע');
    r.innerHTML=`<span class="dot" style="background:${col}"></span>
      <div class="r-mid"><span class="r-t">${esc(t.note||t.category)}${ref?'<span class="tag">החזר</span>':''}</span><span class="r-s">${bits.join(' · ')}</span></div>
      <span class="r-v ${(inc||ref)?'p':'n'}">${(inc||ref)?'+':'-'}${money(t.amount)}</span>
      <button class="mini" type="button" aria-label="ערוך">✎</button>
      <button class="mini" type="button" aria-label="מחק">✕</button>`;
    const b=r.querySelectorAll('.mini');
    b[0].onclick=()=>editTx(t,r); b[1].onclick=()=>delTx(t);
    box.appendChild(r);
  });
}

export function editTx(t,row){
  const kind = t.type==='income'?'income':(t.amount<0?'refund':'expense');
  const opts=k=>catsFor(k==='income'?'income':'expense').map(c=>`<option value="${esc(c)}" ${c===t.category?'selected':''}>${esc(c)}</option>`).join('');
  row.className='ed';
  row.innerHTML=`<div class="grid2">
      <select class="e-k">
        <option value="expense" ${kind==='expense'?'selected':''}>הוצאה</option>
        <option value="income" ${kind==='income'?'selected':''}>הכנסה</option>
        <option value="refund" ${kind==='refund'?'selected':''}>החזר</option>
      </select>
      <input type="number" class="e-a num" value="${Math.abs(t.amount)}" step="0.01" min="0" inputmode="decimal">
      <select class="e-c">${opts(kind)}</select>
      <input type="date" class="e-d" value="${t.date}">
      <input type="text" class="e-n wide" value="${esc(t.note||'')}" placeholder="תיאור">
    </div>
    <div class="ed-a"><button class="go sm e-s" type="button">שמור</button><button class="go ghost sm e-x" type="button">ביטול</button></div>`;
  const k=row.querySelector('.e-k'), c=row.querySelector('.e-c');
  k.onchange=()=>{ c.innerHTML=catsFor(k.value==='income'?'income':'expense').map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(''); };
  row.querySelector('.e-s').onclick=()=>{
    const v=parseFloat(row.querySelector('.e-a').value);
    if(!v||v<=0){ row.querySelector('.e-a').focus(); return; }
    const kk=k.value;
    t.type = kk==='income'?'income':'expense';
    t.amount = kk==='refund' ? -Math.abs(v) : Math.abs(v);
    t.category=c.value;
    t.date=row.querySelector('.e-d').value||t.date;
    t.note=row.querySelector('.e-n').value.trim();
    save(); renderAll();
  };
  row.querySelector('.e-x').onclick=()=>renderTx();
}

export function delTx(t){
  if(!confirm('למחוק את התנועה?\n'+(t.note||t.category)+' · '+money(t.amount))) return;
  S.data.deleted.push(t.id);
  S.data.transactions=S.data.transactions.filter(x=>x.id!==t.id);
  save(); renderAll();
}

export function addTx(){
  const el=document.getElementById('aAmt'), v=parseFloat(el.value);
  if(!v||v<=0){ el.focus(); return; }
  const d=document.getElementById('aDate').value||today();
  S.data.transactions.push({ id:uid(),
    type: S.addKind==='income'?'income':'expense',
    amount: S.addKind==='refund'?-Math.abs(v):Math.abs(v),
    category: document.getElementById('aCat').value,
    note: document.getElementById('aNote').value.trim(), date:d });
  el.value=''; document.getElementById('aNote').value='';
  S.curM=mk(d); S.lim=20; save(); renderAll();
}

export function fillCatSelects(){
  const set=(id,kind,keep)=>{ const s=document.getElementById(id); const old=keep?s.value:null;
    s.innerHTML=catsFor(kind).map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    if(old&&catsFor(kind).indexOf(old)!==-1) s.value=old; };
  set('aCat',S.addKind==='income'?'income':'expense',true);
  set('rCat',S.recKind==='income'?'income':'expense',true);
}
export function fillCardFilter(){
  const s=document.getElementById('fCard'), seen=[];
  (S.data.cards||[]).forEach(c=>{ if(seen.indexOf(c.last4)===-1) seen.push(c.last4); });
  S.data.transactions.forEach(t=>{ if(t.cardLast4&&seen.indexOf(t.cardLast4)===-1) seen.push(t.cardLast4); });
  s.innerHTML='<option value="all">כל הכרטיסים</option>'+seen.map(l=>`<option value="${l}">····${l}</option>`).join('')+'<option value="none">ללא כרטיס</option>';
  s.value=(S.fCard==='all'||S.fCard==='none'||seen.indexOf(S.fCard)!==-1)?S.fCard:'all'; S.fCard=s.value;
}
