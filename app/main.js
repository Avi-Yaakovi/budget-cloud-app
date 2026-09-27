import { backup, restore, wipeAll } from './backup.js';
import { ask } from './chat.js';
import { APP_VERSION } from './config.js';
import { realM, shiftM, today } from './format.js';
import { addCard, cancelImport, doImport, onFile } from './importer.js';
import { addCat, dateAudit, findDups, fixRefunds, fixShiftedDates, recat } from './maintenance.js';
import { addRec, backfill } from './recurring.js';
import { renderAll, setTab } from './shell.js';
import { S } from './state.js';
import { addMail, load, logout, sendCode } from './storage.js';
import { renderTrend } from './views/overview.js';
import { addTx, fillCatSelects, renderTx } from './views/transactions.js';

/* Entry point: wires every control to its handler, then boots. Loaded as a
   module, so it runs after the document is parsed. */

export function bind(){
  document.getElementById('lockGo').onclick=sendCode;
  document.getElementById('lockIn').onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();sendCode();} };
  document.getElementById('outBtn').onclick=logout;
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.go));
  document.getElementById('mPrev').onclick=()=>{ S.curM=shiftM(S.curM,-1); S.lim=20; renderAll(); };
  document.getElementById('mNext').onclick=()=>{ S.curM=shiftM(S.curM,1); S.lim=20; renderAll(); };
  document.querySelectorAll('#addSeg button').forEach(b=>b.onclick=()=>{
    S.addKind=b.dataset.k;
    document.querySelectorAll('#addSeg button').forEach(x=>x.classList.toggle('on',x===b));
    document.getElementById('aNote').placeholder = S.addKind==='income'?'מקור ההכנסה':(S.addKind==='refund'?'על מה ההחזר?':'היכן? מה קניתם?');
    fillCatSelects();
  });
  document.querySelectorAll('#recSeg button').forEach(b=>b.onclick=()=>{
    S.recKind=b.dataset.k;
    document.querySelectorAll('#recSeg button').forEach(x=>x.classList.toggle('on',x===b));
    fillCatSelects();
  });
  document.getElementById('aGo').onclick=addTx;
  document.getElementById('rGo').onclick=addRec;
  document.getElementById('rFill').onclick=backfill;
  document.getElementById('trendMode').onclick=()=>{ S.trendNorm=!S.trendNorm; renderTrend(); };
  document.getElementById('q').oninput=e=>{ S.q=e.target.value.trim(); S.lim=20; renderTx(); };
  document.getElementById('fType').onchange=e=>{ S.fType=e.target.value; S.lim=20; renderTx(); };
  document.getElementById('fCard').onchange=e=>{ S.fCard=e.target.value; S.lim=20; renderTx(); };
  document.getElementById('more').onclick=()=>{ S.lim+=30; renderTx(); };
  document.getElementById('file').onchange=onFile;
  document.getElementById('impGo').onclick=doImport;
  document.getElementById('impNo').onclick=cancelImport;
  document.getElementById('ncGo').onclick=addCard;
  document.getElementById('ncatGo').onclick=addCat;
  document.getElementById('fixDup').onclick=findDups;
  document.getElementById('fixRef').onclick=fixRefunds;
  document.getElementById('fixCat').onclick=recat;
  document.getElementById('fixDate').onclick=dateAudit;
  document.getElementById('fixShift').onclick=fixShiftedDates;
  document.getElementById('askGo').onclick=()=>ask(document.getElementById('ask').value);
  document.getElementById('ask').onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();ask(e.target.value);} };
  document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>ask(c.textContent));
  document.getElementById('bkGo').onclick=backup;
  document.getElementById('rsLbl').onclick=()=>document.getElementById('rsFile').click();
  document.getElementById('rsFile').onchange=restore;
  document.getElementById('wipe').onclick=wipeAll;
  document.getElementById('addMail').onclick=addMail;
  document.getElementById('newMail').onkeydown=e=>{ if(e.key==='Enter'){e.preventDefault();addMail();} };
}

export function init(){
  S.curM=realM();
  document.getElementById('verLine').textContent='תקציב הבית · גרסה '+APP_VERSION;
  document.getElementById('aDate').value=today();
  fillCatSelects();
  bind();
  load();
}
init();
