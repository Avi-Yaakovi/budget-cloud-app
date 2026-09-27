import { MONTHS } from './config.js';

/* Dates, money and string helpers. Every number the user sees goes through
   money() or signed(); every date through dLabel() or mLabel(). */

export const pad=n=>String(n).padStart(2,'0');
export const mk=d=>d.slice(0,7);
export function today(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
export function realM(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
export function shiftM(k,n){ const [y,m]=k.split('-').map(Number); const d=new Date(y,m-1+n,1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
export function dim(y,m){ return new Date(y,m,0).getDate(); }
export function money(n){ return '₪'+Math.round(Math.abs(n)).toLocaleString('he-IL'); }
export function signed(n){ return (n<0?'-':'')+money(n); }
export function dLabel(s){ const p=s.split('-'); return p[2]+'.'+p[1]; }
export function mLabel(k){ const [y,m]=k.split('-').map(Number); return MONTHS[m-1]+' '+y; }
export function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
export function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
export function lastDay(k){ const [y,m]=k.split('-').map(Number); return `${k}-${pad(dim(y,m))}`; }
