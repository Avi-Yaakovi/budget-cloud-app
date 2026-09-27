import { clean, dupKey, guessCat } from './classify.js';
import { dLabel, esc, mLabel, mk, money, pad, today, uid } from './format.js';
import { renderAll } from './shell.js';
import { S, catsFor } from './state.js';
import { msg, save } from './storage.js';

/* Reading credit-card exports from CAL, MAX and Isracard: sniffing the issuer
   and card, parsing dates, guessing categories, and flagging duplicates before
   anything is written. */

export function detectCo(a){
  const t=a.flat().filter(Boolean).map(String).join(' ');
  if(t.indexOf('כאל')!==-1) return 'כאל';
  if(t.indexOf('כל המשתמשים')!==-1||t.indexOf('כל הכרטיסים')!==-1) return 'MAX';
  if(t.indexOf('ישראכרט')!==-1) return 'ישראכרט';
  if(t.indexOf('לאומי קארד')!==-1) return 'לאומי קארד';
  return 'לא ידוע';
}
export function detect4(a,idx){
  if(idx!==-1) for(const row of a){ if(row&&row[idx]!=null){ const v=String(row[idx]).trim(); if(/^\d{3,4}$/.test(v)) return v; } }
  const t=a.flat().filter(Boolean).map(String).join(' ');
  const m=t.match(/מסתיים ב-?(\d{4})/); if(m) return m[1];
  for(const row of a){ if(!row) continue;
    for(let j=0;j<row.length;j++){ const c=row[j]==null?'':String(row[j]);
      if(c.indexOf('כרטיס')!==-1&&c.indexOf('מס')!==-1){
        for(let k2=j+1;k2<row.length;k2++){ const v=row[k2]==null?'':String(row[k2]).trim(); if(/^\d{3,4}$/.test(v)) return v; } } } }
  return null;
}
export function detectHolder(a){
  for(const row of a){ if(!row) continue;
    for(let j=0;j<row.length;j++){ const c=row[j]==null?'':String(row[j]);
      if(c.indexOf('מחזיק')!==-1&&c.indexOf('כרטיס')!==-1){
        for(let k2=j+1;k2<row.length;k2++){ const v=row[k2]==null?'':String(row[k2]).trim(); if(v&&!/\d/.test(v)) return v; } } } }
  return null;
}
export function toDate(v){
  if(v==null||v==='') return null;
  if(typeof v==='number'&&v>20000&&v<80000){ const d=new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; }
  /* SheetJS builds Date objects at LOCAL midnight. Reading them back with the
     UTC getters shifted every imported row one day earlier in Israel (UTC+2/+3),
     which moved first-of-month purchases into the previous month. */
  if(v instanceof Date&&!isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())}`;
  const m=String(v).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if(m){ let[,d,mo,y]=m; if(y.length===2)y='20'+y; return `${y}-${pad(parseInt(mo))}-${pad(parseInt(d))}`; }
  return null;
}
export function parseSheet(a){
  let h=-1,di=-1,mi=-1,ai=-1,ci=-1,si=-1,ki=-1;
  for(let i=0;i<a.length;i++){
    const row=a[i]; if(!row) continue;
    const cs=row.map(c=>c==null?'':String(c));
    if(cs.some(c=>c.indexOf('תאריך')!==-1)&&cs.some(c=>c.indexOf('סכום')!==-1)){
      h=i;
      cs.forEach((c,x)=>{
        if(c.indexOf('תאריך')!==-1&&di===-1) di=x;
        else if(c.indexOf('בית')!==-1&&c.indexOf('עסק')!==-1) mi=x;
        else if(c.indexOf('תיאור')!==-1&&mi===-1) mi=x;
        else if(c.indexOf('סכום')!==-1&&c.indexOf('חיוב')!==-1) ci=x;
        else if(c.indexOf('סכום')!==-1&&ai===-1) ai=x;
        else if(c.indexOf('ענף')!==-1||c.indexOf('קטגוריה')!==-1) si=x;
        else if(c.indexOf('ספרות')!==-1&&c.indexOf('כרטיס')!==-1) ki=x;
      });
      break;
    }
  }
  if(h===-1||mi===-1) return {rows:[],co:'לא ידוע',c4:null,holder:null};
  const co=detectCo(a), c4=detect4(a,ki), holder=detectHolder(a), out=[];
  for(let i=h+1;i<a.length;i++){
    const row=a[i]; if(!row) continue;
    const merch=row[mi]; if(!merch) continue;
    let raw = ci!==-1?row[ci]:null;
    if(raw==null||raw==='') raw = ai!==-1?row[ai]:null;
    const n=parseFloat(raw); if(isNaN(n)||n===0) continue;
    const date=toDate(di!==-1?row[di]:null); if(!date) continue;
    const name=clean(merch);
    const sect=si!==-1?String(row[si]||''):'';
    /* MAX exports cover every card on the account, so the last-4 has to be read
       per row; using the file-level value tagged the whole report to one card. */
    let rc4=null;
    if(ki!==-1&&row[ki]!=null){ const rv=String(row[ki]).trim(); if(/^\d{3,4}$/.test(rv)) rc4=rv; }
    out.push({ date, note:name, amount:n, type:'expense',
      category: guessCat(sect||name)==='אחר' ? guessCat(name) : guessCat(sect||name),
      include:true, cardLast4:rc4||c4 });
  }
  return {rows:out,co,c4,holder};
}
export function markDups(rows){
  const have=new Set(S.data.transactions.map(t=>dupKey(t.date,t.note,t.amount)));
  const seen=new Set();
  rows.forEach(r=>{
    const k=dupKey(r.date,r.note,r.amount);
    r.dup = have.has(k)||seen.has(k);
    seen.add(k);
    r.include=!r.dup;
  });
}
export function onFile(e){
  const f=e.target.files[0]; if(!f) return;
  msg('impMsg','');
  const csv=/\.csv$/i.test(f.name), rd=new FileReader();
  rd.onload=ev=>{
    try{
      const wb = csv ? XLSX.read(ev.target.result,{type:'string',cellDates:true})
                     : XLSX.read(new Uint8Array(ev.target.result),{type:'array',cellDates:true});
      let rows=[],co='לא ידוע',c4=null,holder=null;
      wb.SheetNames.forEach(n=>{
        const p=parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:null}));
        rows=rows.concat(p.rows);
        if(p.co!=='לא ידוע') co=p.co;
        if(p.c4) c4=p.c4;
        if(p.holder) holder=p.holder;
      });
      if(!c4){ const dg=(f.name.match(/\d{3,4}/g)||[]); const hit=dg.find(d=>(S.data.cards||[]).some(c=>c.last4===d)); if(hit) c4=hit; }
      if(co==='לא ידוע'&&c4){ const rc=(S.data.cards||[]).find(c=>c.last4===c4); if(rc&&rc.company) co=rc.company; }
      rows.forEach(r=>{ if(!r.cardLast4) r.cardLast4=c4; });
      if(!rows.length){ msg('impMsg','לא זיהיתי תנועות בקובץ הזה. שלחו לי אותו ואתאים את הקורא.'); return; }
      markDups(rows);
      S.pendImport=rows; S.pendMeta={co,c4,holder,file:f.name};
      showPreview();
    }catch(err){ msg('impMsg','קריאת הקובץ נכשלה: '+err.message); }
  };
  csv?rd.readAsText(f):rd.readAsArrayBuffer(f);
}
export function showPreview(){
  document.getElementById('prev').style.display='block';
  document.getElementById('file').style.display='none';
  const rows=S.pendImport, m=S.pendMeta;
  const dups=rows.filter(r=>r.dup).length;
  const tot=rows.filter(r=>r.include).reduce((s,r)=>s+r.amount,0);
  document.getElementById('prevSum').textContent = dups
    ? `${rows.length} תנועות, מתוכן ${dups} כבר קיימות ולא סומנו · ${money(tot)} לייבוא`
    : `${rows.length} תנועות · ${money(tot)}`;
  const months=Array.from(new Set(rows.map(r=>mk(r.date)))).sort();
  const known=m.c4?((S.data.cardLabels||{})[m.c4]||''):'';
  let h=`<div class="meta-r"><span class="meta-k">חברה</span><span class="meta-v">${esc(m.co)}</span></div>`;
  if(m.c4) h+=`<div class="meta-r"><span class="meta-k">כרטיס</span><span class="meta-v">····${m.c4}</span></div>`;
  h+=`<div class="meta-r"><span class="meta-k">חודשים</span><span class="meta-v">${months.map(mLabel).join(', ')}</span></div>`;
  h+=`<div class="meta-r"><span class="meta-k">כינוי</span><input type="text" id="lbl" placeholder="למי שייך" value="${esc(known||m.holder||'')}"></div>`;
  if(m.c4){
    const ov=(S.data.importHistory||[]).filter(x=>x.cardLast4===m.c4&&(x.months||[]).some(k=>months.indexOf(k)!==-1));
    if(ov.length) h+=`<div class="meta-r"><span style="color:var(--warn);font-size:11.5px;line-height:1.5">⚠ כבר יובא דוח לכרטיס הזה עבור חלק מהחודשים — תנועות זהות ידלגו</span></div>`;
  }
  document.getElementById('prevMeta').innerHTML=h;
  const list=document.getElementById('prevList'); list.innerHTML='';
  rows.forEach((r,i)=>{
    const cats=catsFor('expense');
    const d=document.createElement('div'); d.className='r'+(r.dup?' dup':'');
    d.innerHTML=`<input type="checkbox" class="chk" ${r.include?'checked':''}>
      <div class="r-mid"><span class="r-t">${esc(r.note)}${r.dup?'<span class="tag">כבר קיים</span>':''}${r.amount<0?'<span class="tag">החזר</span>':''}</span><span class="r-s">${dLabel(r.date)}</span></div>
      <select class="csel">${cats.map(c=>`<option value="${esc(c)}" ${c===r.category?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <span class="r-v ${r.amount<0?'p':'n'}">${r.amount<0?'+':'-'}${money(r.amount)}</span>`;
    d.querySelector('.chk').onchange=e=>{ rows[i].include=e.target.checked; };
    d.querySelector('.csel').onchange=e=>{ rows[i].category=e.target.value; };
    list.appendChild(d);
  });
}
export function doImport(){
  const have=new Set(S.data.transactions.map(t=>dupKey(t.date,t.note,t.amount)));
  let n=0,last=null;
  S.pendImport.forEach(r=>{
    if(!r.include) return;
    const k=dupKey(r.date,r.note,r.amount);
    if(have.has(k)) return;
    have.add(k);
    S.data.transactions.push({id:uid(),type:'expense',amount:r.amount,category:r.category,note:r.note,date:r.date,cardLast4:r.cardLast4||null});
    n++; last=r.date;
  });
  const li=document.getElementById('lbl'), lv=li?li.value.trim():'';
  if(S.pendMeta&&S.pendMeta.c4){
    if(lv) S.data.cardLabels[S.pendMeta.c4]=lv;
    const rc=(S.data.cards||[]).find(c=>c.last4===S.pendMeta.c4);
    if(!rc) S.data.cards.push({last4:S.pendMeta.c4,company:S.pendMeta.co,label:lv});
    else { if(lv) rc.label=lv; if((!rc.company||rc.company==='לא ידוע')&&S.pendMeta.co!=='לא ידוע') rc.company=S.pendMeta.co; }
  }
  if(S.pendMeta&&n){
    S.data.importHistory.unshift({ id:uid(), file:S.pendMeta.file, company:S.pendMeta.co, cardLast4:S.pendMeta.c4,
      cardLabel: lv||(S.data.cardLabels||{})[S.pendMeta.c4]||'',
      months: Array.from(new Set(S.pendImport.filter(r=>r.include).map(r=>mk(r.date)))).sort(),
      count:n, at:today() });
  }
  cancelImport();
  if(last) S.curM=mk(last);
  save(); renderAll();
  msg('impMsg', n?('יובאו '+n+' תנועות'):'כל התנועות בקובץ כבר קיימות');
}
export function cancelImport(){
  S.pendImport=[]; S.pendMeta=null;
  document.getElementById('prevMeta').innerHTML='';
  document.getElementById('prev').style.display='none';
  document.getElementById('file').style.display='block';
  document.getElementById('file').value='';
}
export function renderHist(){
  const box=document.getElementById('hist'), no=document.getElementById('histNo');
  box.innerHTML='';
  const h=S.data.importHistory||[];
  if(!h.length){ no.style.display='block'; return; }
  no.style.display='none';
  h.slice(0,10).forEach(x=>{
    const d=document.createElement('div'); d.className='r';
    d.innerHTML=`<div class="r-mid"><span class="r-t">${esc((x.cardLabel?x.cardLabel+' · ':'')+x.company+(x.cardLast4?' ····'+x.cardLast4:''))}</span>
      <span class="r-s">${(x.months||[]).map(mLabel).join(', ')} · ${x.count} תנועות</span></div>`;
    box.appendChild(d);
  });
}
export function renderCards(){
  const box=document.getElementById('cardList'); box.innerHTML='';
  (S.data.cards||[]).forEach(c=>{
    const used=S.data.transactions.filter(t=>t.cardLast4===c.last4).length;
    const d=document.createElement('div'); d.className='r';
    d.innerHTML=`<div class="r-mid" style="flex:0 0 auto"><span class="r-t">${esc(c.company||'כרטיס')} ····${c.last4}</span><span class="r-s">${used} תנועות</span></div>
      <input type="text" class="lb" placeholder="כינוי" value="${esc(c.label||'')}" style="flex:1;padding:6px 8px;font-size:16px;border-radius:9px">
      <button class="mini" type="button" aria-label="הסר">✕</button>`;
    const i=d.querySelector('.lb');
    i.onchange=()=>{ c.label=i.value.trim(); if(c.label) S.data.cardLabels[c.last4]=c.label; else delete S.data.cardLabels[c.last4]; save(); renderAll(); };
    d.querySelector('.mini').onclick=()=>{
      if(!confirm('להסיר את ····'+c.last4+' מהרשימה?\n'+used+' תנועות יישארו.')) return;
      S.data.deleted.push('card:'+c.last4);
      S.data.cards=S.data.cards.filter(x=>x.last4!==c.last4);
      save(); renderAll();
    };
    box.appendChild(d);
  });
  if(!(S.data.cards||[]).length) box.innerHTML='<p class="blank">אין כרטיסים רשומים</p>';
}
export function addCard(){
  const e=document.getElementById('nc4'), v=e.value.trim();
  if(!/^\d{3,4}$/.test(v)){ e.focus(); return; }
  if((S.data.cards||[]).some(c=>c.last4===v)){ alert('הכרטיס כבר רשום'); return; }
  const lb=document.getElementById('ncLb').value.trim();
  S.data.cards.push({last4:v,company:document.getElementById('ncCo').value.trim()||'לא ידוע',label:lb});
  if(lb) S.data.cardLabels[v]=lb;
  e.value=''; document.getElementById('ncCo').value=''; document.getElementById('ncLb').value='';
  save(); renderAll();
}
