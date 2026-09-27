import { MONTHS } from './config.js';
import { renderMissing, renderTrack } from './coverage.js';
import { mLabel, shiftM } from './format.js';
import { renderCards, renderHist } from './importer.js';
import { renderCats } from './maintenance.js';
import { renderRec } from './recurring.js';
import { S } from './state.js';
import { renderAllowed } from './storage.js';
import { renderBig, renderBudgets, renderByCard, renderForecast, renderGap, renderHero, renderLockOpen, renderRemind, renderSplit, renderSubs, renderTrend, renderWatch } from './views/overview.js';
import { fillCatSelects, renderTx } from './views/transactions.js';

/* The frame: which panel is showing, the month stepper, and renderAll(),
   which every mutation calls after save(). */

export function renderAll(){
  renderMonth(); renderHero(); renderLockOpen(); renderGap(); renderMissing(); renderForecast(); renderBig(); renderWatch(); renderRemind(); renderTrend();
  renderSplit(); renderByCard(); renderBudgets(); renderTx();
  renderRec(); renderSubs(); renderTrack(); renderHist(); renderCards(); renderCats(); fillCatSelects(); renderAllowed();
}

export function setTab(p){
  document.querySelectorAll('.panel').forEach(s=>s.classList.toggle('on',s.dataset.p===p));
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.go===p));
  document.getElementById('monthbar').style.display=(p==='over'||p==='tx')?'flex':'none';
  window.scrollTo(0,0);
}

export function renderMonth(){
  document.getElementById('mNow').textContent=mLabel(S.curM);
  document.getElementById('mPrev').textContent='› '+MONTHS[Number(shiftM(S.curM,-1).split('-')[1])-1];
  document.getElementById('mNext').textContent=MONTHS[Number(shiftM(S.curM,1).split('-')[1])-1]+' ‹';
}
