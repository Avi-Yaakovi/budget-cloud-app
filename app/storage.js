import { esc } from './format.js';
import { applyRec } from './recurring.js';
import { renderAll } from './shell.js';
import { S, emptyData } from './state.js';

/* Talking to the server, and the rules that keep two people from overwriting
   each other: read before write, merge by id, tombstones for deletions. */

export function api(url,opt){ opt=opt||{}; opt.headers=Object.assign({},opt.headers||{},S.appCode?{'x-app-code':S.appCode}:{}); return fetch(url,opt); }

export function normalize(p){
  const d=emptyData();
  if(!p) return d;
  d.transactions=p.transactions||[]; d.budgets=p.budgets||{}; d.recurring=p.recurring||[];
  d.cardLabels=p.cardLabels||{}; d.importHistory=p.importHistory||[]; d.uploadReminderDismissed=p.uploadReminderDismissed||{};
  d.cards=p.cards||[]; d.customCats=p.customCats||[]; d.deleted=p.deleted||[];
  return d;
}

export function merge(s,l){
  const o=emptyData();
  o.deleted=Array.from(new Set([].concat(s.deleted||[],l.deleted||[]))).slice(-800);
  const gone=new Set(o.deleted);
  const byId=(a,b)=>{ const m=new Map(); (a||[]).forEach(x=>m.set(x.id,x)); (b||[]).forEach(x=>m.set(x.id,x)); return Array.from(m.values()); };
  o.transactions=byId(s.transactions,l.transactions).filter(t=>!gone.has(t.id));
  o.recurring=byId(s.recurring,l.recurring).filter(r=>!gone.has(r.id));
  o.importHistory=byId(s.importHistory,l.importHistory).sort((a,b)=>String(b.id).localeCompare(String(a.id)));
  const cm=new Map(); (s.cards||[]).forEach(c=>cm.set(c.last4,c)); (l.cards||[]).forEach(c=>cm.set(c.last4,c));
  o.cards=Array.from(cm.values()).filter(c=>!gone.has('card:'+c.last4));
  o.budgets=Object.assign({},s.budgets||{},l.budgets||{});
  o.cardLabels=Object.assign({},s.cardLabels||{},l.cardLabels||{});
  o.uploadReminderDismissed=Object.assign({},s.uploadReminderDismissed||{},l.uploadReminderDismissed||{});
  o.customCats=Array.from(new Set([].concat(s.customCats||[],l.customCats||[]))).filter(c=>!gone.has('cat:'+c));
  return o;
}

export async function load(){
  let r;
  try{ r = await api('/api/data'); }
  catch(e){ document.getElementById('boot').textContent='אין חיבור לשרת. נסו לרענן.'; return; }
  if(r.status===401){
    const had=!!S.appCode; S.appCode='';
    try{ localStorage.removeItem('budget-app-code'); }catch(e){}
    S.codeRequired=true; showLock(had); return;
  }
  S.codeRequired=!!S.appCode;
  if(r.status!==200){
    document.getElementById('boot').style.display='block';
    document.getElementById('app').style.display='none';
    document.getElementById('boot').innerHTML='השרת החזיר שגיאה '+r.status+' בטעינת הנתונים.<br>'
      +'<span style="font-size:12px">הנתונים שלכם לא נפגעו — רק הקריאה נכשלה.</span><br><br>'
      +'<button class="go" style="max-width:200px;margin:0 auto" onclick="location.reload()">נסו שוב</button>';
    return;
  }
  let j={}; try{ j=await r.json(); }catch(e){}
  if(j && j.error==='no_database'){ document.getElementById('boot').textContent='מסד הנתונים לא מחובר לאתר.'; return; }
  try{ S.data = normalize(j && j.value ? JSON.parse(j.value) : null); }catch(e){ S.data=emptyData(); }
  if(!(S.data.cards||[]).length){
    S.data.cards=[{last4:'8622',company:'MAX',label:''},{last4:'5084',company:'כאל',label:''},{last4:'8318',company:'ישראכרט',label:''},{last4:'0682',company:'ישראכרט',label:''}]
      .map(c=>Object.assign(c,{label:(S.data.cardLabels||{})[c.last4]||''}));
  }
  S.loaded=true;
  const added=applyRec();
  document.getElementById('boot').style.display='none';
  document.getElementById('lock').style.display='none';
  document.getElementById('app').style.display='block';
  showWho();
  renderAll();
  loadAllowed();
  if(added) msg('recMsg','נוספו '+added+' תנועות קבועות לחודש הנוכחי');
}

export async function save(){
  if(!S.loaded) return;                 /* guard: nothing was ever read, so nothing may be written */
  if(S.saving){ S.queued=true; return; }
  S.saving=true;
  let good=false, pulled=false;
  try{
    const r=await api('/api/data');
    if(r.status!==200) throw new Error('pre-read failed with '+r.status);
    const j=await r.json();
    if(j&&j.value){ try{ const b=JSON.stringify(S.data); S.data=merge(normalize(JSON.parse(j.value)),S.data); pulled=JSON.stringify(S.data)!==b; }catch(e){} }
    const w=await api('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(S.data)});
    if(w.status!==200) throw new Error('write failed with '+w.status);
    good=true;
  }catch(e){
    console.error('save aborted:',e.message);
  }
  try{ saveWarn(!good); }catch(e){}   /* UI feedback must never affect the save verdict */
  /* the pre-read can pull in the other person's rows; without this the screen
     kept showing the pre-merge state until a manual refresh */
  if(good&&pulled){ try{ renderAll(); }catch(e){} }
  S.saving=false;
  if(S.queued){ S.queued=false; save(); }
}

export function saveWarn(on){
  let el=document.getElementById('saveWarn');
  if(!on){ if(el&&el.parentNode) el.parentNode.removeChild(el); return; }
  if(el) return;
  el=document.createElement('div');
  el.id='saveWarn';
  el.style.cssText='position:fixed;left:0;right:0;bottom:var(--tabh);z-index:40;background:var(--neg);color:#fff;font-size:12.5px;padding:9px 14px;text-align:center';
  el.textContent='השינוי האחרון לא נשמר בשרת. בדקו חיבור ורעננו — הנתונים בשרת לא נדרסו.';
  document.body.appendChild(el);
}

export const GCLIENT='461926098122-3ra07fpcd15te4gt4a5b0ij4d5g5ct7m.apps.googleusercontent.com';
export const GORIGIN='https://budget-cloud-app.vercel.app';

export function gDiag(html){
  const box=document.getElementById('gbtn');
  let d=document.getElementById('gdiag');
  if(!d){ d=document.createElement('div'); d.id='gdiag';
    d.style.cssText='margin-top:10px;font-size:11.5px;line-height:1.6;color:var(--neg);text-align:center';
    box.parentNode.appendChild(d); }
  d.innerHTML=html;
}
export let gTries=0;
export function mountGoogle(){
  const box=document.getElementById('gbtn');
  if(!(window.google&&google.accounts&&google.accounts.id)){
    if(S.gTries++<25) return setTimeout(mountGoogle,240);
    box.innerHTML='<span class="hint" style="text-align:center">התחברות Google לא זמינה כרגע</span>';
    return;
  }
  if(location.origin!==GORIGIN){
    box.innerHTML='';
    gDiag('<b>הכתובת הזו לא מאושרת ב-Google.</b><br>אתם נמצאים ב:<br><span style="direction:ltr;display:inline-block">'
      +esc(location.origin)+'</span><br>צריך להיכנס דרך:<br><a href="'+GORIGIN+'" style="direction:ltr;display:inline-block">'
      +GORIGIN+'</a>');
    return;
  }
  try{
    google.accounts.id.initialize({
      client_id:GCLIENT,
      callback:onGoogle,
      error_callback:function(err){ gDiag('Google החזיר שגיאה: '+esc((err&&(err.type||err.message))||'לא ידועה')); }
    });
    google.accounts.id.renderButton(box,{theme:'outline',size:'large',text:'signin_with',shape:'pill',locale:'he',width:270});
  }catch(e){ gDiag('שגיאה בטעינת Google: '+esc(e.message)); }
}
export async function onGoogle(resp){
  gDiag('מאמת מול השרת…');
  try{
    const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({credential:resp&&resp.credential})});
    let j={}; try{ j=await r.json(); }catch(e){}
    if(r.status===200&&j.ok){
      gDiag('');
      S.appCode=''; try{ localStorage.removeItem('budget-app-code'); }catch(e){}
      document.getElementById('lock').style.display='none';
      document.getElementById('boot').style.display='block';
      location.reload();
      return;
    }
    gDiag('השרת דחה את ההתחברות (HTTP '+r.status+')<br>'+esc(j.message||j.error||'ללא פירוט'));
  }catch(e){ gDiag('שגיאת רשת: '+esc(e.message)); }
}
export function showLock(bad){
  document.getElementById('boot').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('lock').style.display='block';
  const e=document.getElementById('lockErr');
  if(bad){ e.textContent='קוד שגוי, נסו שוב'; e.style.display='block'; } else e.style.display='none';
  document.getElementById('lockIn').value='';
  fetch('/api/auth').then(r=>r.json()).then(j=>{
    document.getElementById('codeBox').style.display=(j&&j.codeFallback===false)?'none':'block';
  }).catch(()=>{});
  mountGoogle();
}
export function sendCode(){
  const v=document.getElementById('lockIn').value.trim(); if(!v) return;
  S.appCode=v; try{ localStorage.setItem('budget-app-code',v); }catch(e){}
  document.getElementById('lock').style.display='none';
  document.getElementById('boot').style.display='block';
  load();
}
export async function logout(){
  if(!confirm('להתנתק מהמכשיר הזה?')) return;
  S.appCode=''; try{ localStorage.removeItem('budget-app-code'); }catch(e){}
  try{ await fetch('/api/auth',{method:'DELETE'}); }catch(e){}
  try{ if(window.google&&google.accounts&&google.accounts.id) google.accounts.id.disableAutoSelect(); }catch(e){}
  location.reload();
}
export async function showWho(){
  try{
    const r=await fetch('/api/auth');
    const j=await r.json();
    if(j&&j.signedInAs){ document.getElementById('guard').textContent=j.signedInAs.split('@')[0]; return; }
    if(j&&!j.codeFallback&&j.google){ document.getElementById('guard').textContent='מוגן'; return; }
  }catch(e){}
  document.getElementById('guard').textContent = S.codeRequired?'מוגן בקוד':'⚠ פתוח';
}
export async function loadAllowed(){
  try{
    const r=await api('/api/auth'); const j=await r.json();
    S.allowed=Array.isArray(j.allowed)?j.allowed:[];
  }catch(e){ S.allowed=[]; }
  renderAllowed();
}
export function renderAllowed(){
  const box=document.getElementById('allowList'), no=document.getElementById('allowNo');
  box.innerHTML='';
  if(!S.allowed.length){ no.style.display='block'; return; }
  no.style.display='none';
  S.allowed.forEach(function(m){
    const d=document.createElement('div'); d.className='r';
    d.innerHTML='<div class="r-mid"><span class="r-t">'+esc(m)+'</span></div><button class="mini" type="button" aria-label="הסר">✕</button>';
    d.querySelector('.mini').onclick=function(){
      if(!confirm('להסיר את '+m+'?\nהוא לא יוכל להתחבר יותר.')) return;
      S.allowed=S.allowed.filter(function(x){return x!==m;});
      saveAllowed();
    };
    box.appendChild(d);
  });
}
export async function saveAllowed(){
  try{
    const r=await api('/api/auth',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({allowed:S.allowed})});
    const j=await r.json();
    if(j&&j.ok){ S.allowed=j.allowed||[]; renderAllowed(); msg('allowMsg','נשמר'); }
    else msg('allowMsg','השמירה נכשלה');
  }catch(e){ msg('allowMsg','שגיאה: '+e.message); }
}
export function addMail(){
  const el=document.getElementById('newMail'), v=el.value.trim().toLowerCase();
  if(v.indexOf('@')<1){ el.focus(); return; }
  if(S.allowed.indexOf(v)!==-1){ msg('allowMsg','הכתובת כבר ברשימה'); return; }
  S.allowed.push(v); el.value=''; saveAllowed();
}

export function msg(id,t){ const e=document.getElementById(id); e.textContent=t; e.style.display=t?'block':'none'; }
