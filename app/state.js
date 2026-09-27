import { BASE_EXP, INC_CATS } from './config.js';


/* Everything mutable the app shares, held on one object.
 *
 * ES module imports are read-only bindings, so `export let data` could be read
 * elsewhere but never reassigned. Keeping the state on an exported object lets
 * any module do `S.data = ...`, which the load/merge/save cycle needs.
 */

export function emptyData(){
  return { transactions:[], budgets:{}, recurring:[], cardLabels:{},
           importHistory:[], uploadReminderDismissed:{}, cards:[],
           customCats:[], deleted:[] };
}

export const S = {
  data: emptyData(),
  curM: '', addKind:'expense', recKind:'expense', fType:'all', fCard:'all', q:'', lim:20,
  pendImport: [], pendMeta:null, chat:[], appCode:'', codeRequired:true, saving:false, queued:false,
  allowed: [],
  trendNorm: false,   /* trend chart: actual months, or a 3-month rolling average */
  loaded: false,      /* never write to the server before a successful read */
  gTries: 0
};

try{ S.appCode = localStorage.getItem('budget-app-code')||''; }catch(e){}

export function expCats(){
  const c=BASE_EXP.slice();
  (S.data.customCats||[]).forEach(x=>{ if(c.indexOf(x)===-1) c.splice(c.length-1,0,x); });
  return c;
}
export function catsFor(kind){ return kind==='income'?INC_CATS:expCats(); }
