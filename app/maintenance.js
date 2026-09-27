import { dupKey, guessCat } from './classify.js';
import { dLabel, esc, lastDay, mLabel, mk, money, shiftM, signed } from './format.js';
import { renderAll } from './shell.js';
import { S, expCats } from './state.js';
import { msg, save } from './storage.js';

/* One-off repair tools, each of which shows exactly what it will do before it
   touches anything. Also the category editor. */

export function renderCats(){
  const box=document.getElementById('catList'); box.innerHTML='';
  expCats().forEach(c=>{
    const custom=(S.data.customCats||[]).indexOf(c)!==-1;
    const used=S.data.transactions.filter(t=>t.category===c).length;
    const d=document.createElement('div'); d.className='r';
    d.innerHTML=`<div class="r-mid"><span class="r-t">${esc(c)}${custom?'<span class="tag">שלכם</span>':''}</span><span class="r-s">${used} תנועות</span></div>`
      +(custom?'<button class="mini" type="button" aria-label="הסר">✕</button>':'');
    const b=d.querySelector('.mini');
    if(b) b.onclick=()=>{
      if(used&&!confirm('ל-'+c+' יש '+used+' תנועות. הן יעברו ל"אחר". להמשיך?')) return;
      S.data.transactions.forEach(t=>{ if(t.category===c) t.category='אחר'; });
      S.data.deleted.push('cat:'+c);
      S.data.customCats=(S.data.customCats||[]).filter(x=>x!==c);
      save(); renderAll();
    };
    box.appendChild(d);
  });
}
export function addCat(){
  const e=document.getElementById('ncat'), v=e.value.trim();
  if(!v) { e.focus(); return; }
  if(expCats().indexOf(v)!==-1){ alert('הקטגוריה כבר קיימת'); return; }
  S.data.customCats=S.data.customCats||[]; S.data.customCats.push(v);
  S.data.deleted=(S.data.deleted||[]).filter(x=>x!=='cat:'+v);
  e.value=''; save(); renderAll();
}

export function findDups(){
  const seen=new Map(), dups=[];
  S.data.transactions.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(t=>{
    const k=dupKey(t.date,t.note,t.amount);
    if(seen.has(k)) dups.push(t); else seen.set(k,t);
  });
  if(!dups.length){ msg('fixMsg','לא נמצאו כפילויות'); return; }
  const tot=dups.reduce((s,t)=>s+t.amount,0);
  const lines=dups.slice(0,12).map(t=>'· '+(t.note||t.category)+' '+money(t.amount)+' ('+dLabel(t.date)+')').join('\n');
  if(!confirm('נמצאו '+dups.length+' תנועות כפולות בסך '+money(tot)+':\n\n'+lines+(dups.length>12?'\n…ועוד':'')+'\n\nלמחוק את העותקים הכפולים?')) return;
  const ids=new Set(dups.map(t=>t.id));
  ids.forEach(id=>S.data.deleted.push(id));
  S.data.transactions=S.data.transactions.filter(t=>!ids.has(t.id));
  save(); renderAll(); msg('fixMsg','נמחקו '+dups.length+' כפילויות בסך '+money(tot));
}
export function fixRefunds(){
  const bad=S.data.transactions.filter(t=>t.type==='income'&&t.cardLast4);
  if(!bad.length){ msg('fixMsg','לא נמצאו החזרים שסומנו בטעות כהכנסה'); return; }
  const tot=bad.reduce((s,t)=>s+t.amount,0);
  const lines=bad.slice(0,10).map(t=>'· '+(t.note||t.category)+' '+money(t.amount)).join('\n');
  if(!confirm('נמצאו '+bad.length+' תנועות שהגיעו מדוח אשראי אך נרשמו כהכנסה, בסך '+money(tot)+':\n\n'+lines+'\n\nלהמיר להחזרים? (יקטינו את ההוצאה בקטגוריה במקום לנפח את ההכנסות)')) return;
  bad.forEach(t=>{ t.type='expense'; t.amount=-Math.abs(t.amount); });
  save(); renderAll(); msg('fixMsg','הומרו '+bad.length+' תנועות להחזרים');
}
export function recat(){
  const cand=S.data.transactions.filter(t=>t.type==='expense'&&t.category==='אחר');
  const plan=[];
  cand.forEach(t=>{ const g=guessCat(t.note||''); if(g!=='אחר') plan.push({t,g}); });
  if(!plan.length){ msg('fixMsg','אין תנועות ב"אחר" שאפשר לסווג אוטומטית'); return; }
  const by={}; plan.forEach(p=>{ by[p.g]=(by[p.g]||0)+1; });
  const lines=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([c,n])=>'· '+c+': '+n).join('\n');
  if(!confirm('אפשר לסווג מחדש '+plan.length+' מתוך '+cand.length+' תנועות ב"אחר":\n\n'+lines+'\n\nלבצע?')) return;
  plan.forEach(p=>{ p.t.category=p.g; });
  save(); renderAll(); msg('fixMsg','סווגו מחדש '+plan.length+' תנועות');
}

/* One-shot repair of the twelve rows imported before the timezone fix, keyed by
   id so it cannot touch anything else. Each row moves only if it still holds the
   exact wrong date, which makes a second run a no-op. */
export const SHIFTED=[
  ['17823914762493as6q','2026-04-30','2026-05-01'],
  ['1782391476249rck1r','2026-04-30','2026-05-01'],
  ['1782391476249ryygn','2026-04-30','2026-05-01'],
  ['1782391476249y4dt3','2026-04-30','2026-05-01'],
  ['1782391476249d8pt4','2026-04-30','2026-05-01'],
  ['1783501635286ngm7b','2026-05-31','2026-06-01'],
  ['1783501635286wr9xw','2026-05-31','2026-06-01'],
  ['1784707838572wm2iv','2026-06-30','2026-07-01'],
  ['17847078385726t2u3','2026-06-30','2026-07-01'],
  ['1783499418963z8ihe','2026-06-30','2026-07-01'],
  ['17834994189630cfls','2026-06-30','2026-07-01'],
  ['1784707838572sd182','2026-06-30','2026-07-01']
];
export function fixShiftedDates(){
  const byId=new Map(S.data.transactions.map(t=>[t.id,t]));
  const todo=[], done=[], gone=[];
  SHIFTED.forEach(([id,from,to])=>{
    const t=byId.get(id);
    if(!t) gone.push(id);
    else if(t.date===from) todo.push([t,to]);
    else done.push(t);
  });
  if(!todo.length){
    msg('fixMsg', gone.length===SHIFTED.length ? 'התנועות לא נמצאו — כנראה כבר תוקנו או נמחקו' : 'כל 12 התאריכים כבר מתוקנים');
    return;
  }
  const lines=todo.map(([t,to])=>'· '+(t.note||t.category)+' '+money(t.amount)+'  '+dLabel(t.date)+' ← '+dLabel(to)).join('\n');
  if(!confirm('להזיז '+todo.length+' תנועות ביום אחד קדימה?\n\n'+lines
    +'\n\nרק התאריך משתנה. סכומים, קטגוריות וכרטיסים לא נוגעים.')) return;
  todo.forEach(([t,to])=>{ t.date=to; });
  save(); renderAll();
  msg('fixMsg','תוקנו '+todo.length+' תאריכים'+(done.length?(' · '+done.length+' כבר היו מתוקנים'):''));
}

/* Imported rows created before the timezone fix are stored one day early, so a
   purchase truly made on the 1st sits on the last day of the previous month.
   This measures how much money that moved between months. It only reads. */
export function dateAudit(){
  const imp=S.data.transactions.filter(t=>t.cardLast4&&!t.recurringId);
  if(!imp.length){ msg('fixMsg','אין תנועות מיובאות לבדיקה'); return; }
  const ms=Array.from(new Set(imp.map(t=>mk(t.date)))).sort();
  const span=[shiftM(ms[0],-1)].concat(ms);
  const L={},N={};
  span.forEach(k=>{ const d=lastDay(k), r=imp.filter(t=>t.date===d);
    L[k]=r.reduce((s,t)=>s+t.amount,0); N[k]=r.length; });
  const rows=ms.map(k=>({k,err:(L[k]||0)-(L[shiftM(k,-1)]||0),n:N[k]||0}));
  const e=rows.map(r=>r.err);
  const mean=e.reduce((s,x)=>s+x,0)/e.length;
  const sd=Math.sqrt(e.reduce((s,x)=>s+(x-mean)*(x-mean),0)/e.length);
  const moved=ms.reduce((s,k)=>s+(N[k]||0),0);
  const mabs=rows.reduce((s,r)=>s+Math.abs(r.err),0)/rows.length;
  const worst=rows.slice().sort((a,b)=>Math.abs(b.err)-Math.abs(a.err)).slice(0,5)
    .filter(r=>r.err!==0)
    .map(r=>'· '+mLabel(r.k)+': '+(r.err>0?'+':'-')+money(r.err)+'  ('+r.n+' תנועות)').join('\n');
  alert('בדיקת הזזת תאריכים\n\n'
    +'חודשים שנבדקו: '+rows.length+'\n'
    +'תנועות מיובאות: '+imp.length+'\n'
    +'תנועות שזזו בין חודשים: '+moved+'\n\n'
    +'סטיית תקן של השגיאה החודשית: '+money(sd)+'\n'
    +'הטיה ממוצעת: '+signed(Math.round(mean))+'\n'
    +'שגיאה מוחלטת ממוצעת: '+money(mabs)+'\n\n'
    +(worst?('החודשים שסטו הכי הרבה:\n'+worst+'\n\n'):'')
    +'הסכום הכולל לכל התקופה מדויק — הכסף רק זז בין חודשים סמוכים.');
  msg('fixMsg','סטיית תקן '+money(sd)+' · '+moved+' תנועות זזו');
}
