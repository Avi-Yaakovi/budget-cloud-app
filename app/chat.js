import { mTx, sums } from './classify.js';
import { covered } from './coverage.js';
import { mLabel, mk } from './format.js';
import { S } from './state.js';
import { api } from './storage.js';
import { catTotals } from './views/overview.js';

/* The budget assistant. ctx() assembles what the model is allowed to see;
   anything missing from it is something the model will say it cannot answer. */

export function ctx(){
  let s='אתה עוזר תקציב למשק בית. ענה בעברית, קצר ולעניין, והתבסס רק על הנתונים כאן. אם משהו לא ברור מהם, אמור זאת. אינך יועץ פיננסי מורשה — הימנע מהמלצות השקעה.\n\nהערה: סכום שלילי בהוצאה הוא החזר כספי.\n\n';
  const ms=Array.from(new Set(S.data.transactions.map(t=>mk(t.date)))).sort().slice(-3);
  ms.forEach(k=>{ const x=sums(k);
    s+=`${mLabel(k)}: הכנסות ${Math.round(x.inc)}, הוצאות ${Math.round(x.exp)}, מאזן ${Math.round(x.inc-x.exp)}\n`;
    Object.entries(catTotals(k)).forEach(([c,v])=>{ s+=`  ${c}: ${Math.round(v)}\n`; });
  });
  const b=Object.entries(S.data.budgets||{}).filter(([,v])=>v>0);
  if(b.length){ s+='\nתקציבים חודשיים:\n'; b.forEach(([c,v])=>s+=`  ${c}: ${Math.round(v)}\n`); }
  if((S.data.recurring||[]).length){ s+='\nתנועות קבועות:\n'; S.data.recurring.forEach(r=>s+=`  ${r.note||r.category} ${r.type==='income'?'+':'-'}${Math.round(r.amount)} (${r.category}, כל ${r.day})\n`); }
  /* The assistant used to answer "I have no access to the import history"
     because none of this was ever put in front of it. */
  if((S.data.cards||[]).length){
    s+='\nכרטיסי אשראי רשומים:\n';
    (S.data.cards||[]).forEach(c=>{
      const lb=(S.data.cardLabels||{})[c.last4]||c.label||'';
      const n=S.data.transactions.filter(t=>t.cardLast4===c.last4).length;
      s+=`  ····${c.last4} | ${c.company||'לא ידוע'}${lb?' | '+lb:''} | ${n} תנועות\n`;
    });
  }
  const ih=S.data.importHistory||[];
  if(ih.length){
    s+=`\nהיסטוריית ייבוא (${ih.length} קבצים, האחרונים ראשונים):\n`;
    ih.slice(0,25).forEach(x=>{
      s+=`  ${x.at||'—'} | ${x.company||'—'}${x.cardLast4?' ····'+x.cardLast4:''}${x.cardLabel?' ('+x.cardLabel+')':''}`
       +` | חודשים: ${(x.months||[]).join(', ')||'—'} | ${x.count||0} תנועות${x.file?' | '+x.file:''}\n`;
    });
    const covered={};
    S.data.transactions.forEach(t=>{ if(t.cardLast4){ const k=mk(t.date); (covered[k]=covered[k]||new Set()).add(t.cardLast4); } });
    const known=(S.data.cards||[]).map(c=>c.last4);
    const gaps=Object.keys(covered).sort().map(k=>{
      const miss=known.filter(l=>!covered[k].has(l));
      return miss.length?`  ${mLabel(k)}: חסר ${miss.map(l=>'····'+l).join(', ')}`:null;
    }).filter(Boolean);
    if(gaps.length) s+='\nחודשים שבהם לא נראו תנועות מכרטיס רשום:\n'+gaps.join('\n')+'\n';
  }
  const allM=Array.from(new Set(S.data.transactions.map(t=>mk(t.date)))).sort();
  s+=`\nסך הכל ${S.data.transactions.length} תנועות, מ${allM.length?mLabel(allM[0]):'—'} ואילך.\n`;
  /* Detail rows used to cover only the displayed month, so a question about any
     other month got category totals and nothing to itemise. */
  const detail=Array.from(new Set(allM.concat([S.curM]))).sort().slice(-3);
  if(detail.indexOf(S.curM)===-1) detail.push(S.curM);
  detail.forEach(k=>{
    const rows=mTx(k).slice().sort((a,b)=>a.date.localeCompare(b.date));
    if(!rows.length) return;
    s+=`\nתנועות ב${mLabel(k)}${k===S.curM?' (החודש המוצג)':''} — ${rows.length} שורות:\n`;
    rows.forEach(t=>{
      const src=t.cardLast4?' | ····'+t.cardLast4:(t.recurringId?' | קבוע':' | ידני');
      s+=`${t.date} | ${t.note||t.category} | ${t.category}${src} | ${t.type==='income'?'+':(t.amount<0?'החזר +':'-')}${Math.abs(Math.round(t.amount))}\n`;
    });
  });
  s+='\nלחודשים מוקדמים יותר יש כאן סיכומי קטגוריות בלבד, לא פירוט שורות. אם נשאלת על חודש כזה, אמור זאת והצע לעבור אליו באפליקציה.\n';
  return s;
}
export function bubble(role,text){
  const l=document.getElementById('log'), d=document.createElement('div');
  d.className='msg '+(role==='u'?'u':'a'); d.textContent=text;
  l.appendChild(d); l.scrollTop=l.scrollHeight; return d;
}
export async function ask(text){
  text=(text||'').trim(); if(!text) return;
  bubble('u',text);
  document.getElementById('ask').value='';
  const btn=document.getElementById('askGo'); btn.disabled=true;
  const t=bubble('a','חושב…');
  try{
    const r=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages:S.chat.concat([{role:'user',content:ctx()+'\nשאלה: '+text}])})});
    const j=await r.json();
    if(j.error){ t.textContent=j.message||'הצ\'אט לא זמין כרגע.'; }
    else{
      const ans=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')||'לא התקבלה תשובה.';
      t.textContent=ans;
      S.chat.push({role:'user',content:text}); S.chat.push({role:'assistant',content:ans});
      S.chat=S.chat.slice(-6);
    }
  }catch(e){ t.textContent='שגיאה: '+e.message; }
  btn.disabled=false;
}
