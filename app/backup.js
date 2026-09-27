import { today } from './format.js';
import { renderAll } from './shell.js';
import { S, emptyData } from './state.js';
import { normalize, save } from './storage.js';

/* Download, restore and reset. Restore writes tombstones for rows absent from
   the backup, because save() merges and would otherwise never remove anything. */

export function backup(){
  try{
    const b=new Blob([JSON.stringify(S.data,null,2)],{type:'application/json'});
    const u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download='budget-backup-'+today()+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
  }catch(e){ alert('ההורדה נכשלה: '+e.message); }
}
export function restore(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const p=JSON.parse(ev.target.result);
      if(!p||!Array.isArray(p.transactions)) throw new Error('לא נראה כמו קובץ גיבוי');
      if(!confirm('לשחזר '+p.transactions.length+' תנועות?\nכל הנתונים הנוכחיים יוחלפו.')){ e.target.value=''; return; }
      /* save() merges with the server by id, so without tombstones a restore
         only ever added rows back — the dialog promised a replacement. */
      const keep=new Set([].concat((p.transactions||[]).map(t=>t.id),(p.recurring||[]).map(r=>r.id)));
      const tomb=[].concat(S.data.transactions.map(t=>t.id),(S.data.recurring||[]).map(r=>r.id)).filter(id=>!keep.has(id));
      S.data=normalize(p);
      S.data.deleted=Array.from(new Set([].concat(S.data.deleted||[],tomb)));
      save(); renderAll();
      alert('השחזור הושלם: '+S.data.transactions.length+' תנועות');
    }catch(err){ alert('השחזור נכשל: '+err.message); }
    e.target.value='';
  };
  rd.readAsText(f);
}
export function wipeAll(){
  if(!confirm('לפני האיפוס יורד גיבוי אוטומטית. להמשיך?')) return;
  backup();
  if(!confirm('הגיבוי ירד.\nלמחוק סופית את כל הנתונים? לא ניתן לשחזר.')) return;
  S.data.transactions.forEach(t=>S.data.deleted.push(t.id));
  (S.data.recurring||[]).forEach(r=>S.data.deleted.push(r.id));
  const keep=S.data.deleted.slice();
  S.data=emptyData(); S.data.deleted=keep;
  save(); renderAll();
}
