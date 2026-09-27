import { mk } from './format.js';
import { S } from './state.js';

/* Guessing a category from a merchant name.

   Order matters: the first rule that matches wins, which is why electricity
   sits in utilities and not in housing. Keys of three characters or fewer need
   a word boundary, because short ones used to fire inside longer words. */

/* order matters: first match wins */
export const RULES = [
  [['כללית','מאוחדת','מכבי','לאומית','בריאות','פארם','מרקחת','רוקח','רפואה','ד"ר','דנטל','שיניים','אופטיק','קופת חולים'],'בריאות'],
  [['ביטוח לאומי','ביטוח','הראל','מגדל','מנורה','הפניקס','איילון','שלמה ביטוח','AIG','ILC','פוליסה'],'ביטוח'],
  [['עיריי','עירית','ארנונה','מילגם','מועצה מקומית','מים','מי אונו','תאגיד המים'],'ארנונה ורשות מקומית'],
  [['NETFLIX','SPOTIFY','GOOGLE ONE','YOUTUBE','APPLE.COM','ITUNES','DISNEY','AMAZON PRIME','OPENAI','ANTHROPIC','מנוי'],'מנויים'],
  [['חסכון','חיסכון','קרן השתלמות','גמל','פקדון'],'חיסכון'],
  [['פנגו','חניון','חניה','דלק','פז','סונול','דור אלון','רכבת','אגד','דן','מוניות','GETT','גט','יאנגו','רב קו','תחבורה','מוסך','צמיג'],'תחבורה'],
  [['מזון','משקאות','סופר','מרכול','קצב','מאפי','קונדיטור','אוף קייק','ירקות','שוק','יין','קפה','מסעד','פיצה','בורגר','AMPM','CARREFOUR','שופרסל','רמי לוי','ויקטורי','טיב טעם','אושר עד'],'מזון'],
  [['ריהוט','עיצוב','איקאה','הום סנטר','ACE','כלי בית','מוצרי חשמל','חשמל ביתי','מחסני חשמל','שקם אלקטריק','א.ל.מ','ביתילי','מזגן'],'דיור'],
  [['ביגוד','הנעלה','אופנה','קסטרו','ZARA','זארה','פוקס','גולף','H&M','נעלי'],'ביגוד'],
  [['חינוך','לימוד','גן ','גני ','צהרון','חוג','בית ספר','אוניברסיט','מכללה'],'חינוך'],
  [['סלולר','פלאפון','סלקום','פרטנר','הוט','בזק','יס','אינטרנט','תקשורת','חשמל','חברת החשמל','פזגז','אמישראגז','סופרגז','דורגז','טריפל סי','TRIPLE C','סלולרי'],'חשבונות ותקשורת'],
  [['פנאי','בידור','תרבות','נופש','תיירות','מלון','ספרים','ספורט','חדר כושר','פיטנס','קולנוע','תיאטרון','הבימה','בריכה'],'פנאי ובילויים'],
];

export function clean(s){ return String(s==null?'':s).replace(/בע\?מ/g,'בע"מ').replace(/\?/g,'').replace(/~/g,' ').replace(/\s+/g,' ').trim(); }
export const CITIES=/^(AMSTERDAM|MOUNTAINVIEW|SANFRANCISCO|NEWYORK|LONDON|DUBLIN|SEATTLE|CUPERTINO|TELAVIV|SINGAPORE|LUXEMBOURG)/;
export function normName(s){ return String(s==null?'':s).toUpperCase().replace(/[^\u0590-\u05FFA-Z0-9]/g,'').replace(CITIES,''); }
export function dupKey(date,note,amt){ return date+'|'+normName(note)+'|'+Number(amt).toFixed(2); }

/* Short keys ('דן','גט','שוק') used to match inside longer words:
   'בגט' read as Gett, 'גן עדן' read as the Dan bus company. Keys of up to
   three characters now need a word boundary; Hebrew three-letter keys still
   tolerate a single attached prefix letter, so 'בשוק' keeps matching 'שוק'. */
export const KWORD=/[\u0590-\u05FFA-Za-z0-9]/;
export const KPFX='בהולמשכד';
export function hasKey(t,k){
  if(k.length>3||k.indexOf(' ')!==-1) return t.indexOf(k)!==-1;
  const heb=/[\u0590-\u05FF]/.test(k);
  let i=-1;
  while((i=t.indexOf(k,i+1))!==-1){
    const a=t[i+k.length];
    if(a&&KWORD.test(a)) continue;
    const b=t[i-1];
    if(!b||!KWORD.test(b)) return true;
    if(heb&&k.length===3&&KPFX.indexOf(b)!==-1) return true;
  }
  return false;
}

export function guessCat(text){
  const t=String(text||'');
  for(const [keys,cat] of RULES){ for(const k of keys){ if(hasKey(t,k)) return cat; } }
  const up=t.toUpperCase();
  for(const [keys,cat] of RULES){ for(const k of keys){ if(k===k.toUpperCase() && hasKey(up,k)) return cat; } }
  return 'אחר';
}

/* transaction semantics: expense w/ amount<0 == refund */
export const isRef = t => t.type==='expense' && t.amount<0;
export function mTx(k){ return S.data.transactions.filter(t=>mk(t.date)===k); }
export function sums(k){
  const tx=mTx(k);
  return { inc: tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0),
           exp: tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0) };
}
