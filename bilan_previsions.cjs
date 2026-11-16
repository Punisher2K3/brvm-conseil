'use strict';
// Uniquement les résultats issus des bulletins ; aucun cours web provisoire n'est noté.
function audit(journal,currentVersion){
 const records=journal.records||[],eligible=records.filter(r=>r.outcome?.eligible&&r.outcome.close>0&&Number.isFinite(r.expected));
 const versions=[...new Set(records.map(r=>r.version))];
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 const daily=[...new Set(eligible.map(r=>r.version+'|'+r.outcome.date))].map(key=>{
  const [version,date]=key.split('|'),all=eligible.filter(r=>r.version===version&&r.outcome.date===date);
  const rows=all.filter(r=>r.originPrice>0),directional=all.filter(r=>['up','down'].includes(r.signal?.direction));
  const mae=mean(rows.map(r=>Math.abs(r.outcome.close-r.expected)/r.originPrice*100));
  const baseline=mean(rows.map(r=>Math.abs(r.outcome.close-r.originPrice)/r.originPrice*100));
  return {version,date,n:all.length,paired:rows.length,exact:all.filter(r=>r.expected===r.outcome.close).length,
   exactUnchanged:rows.filter(r=>r.expected===r.outcome.close&&r.outcome.close===r.originPrice).length,
   exactMoved:rows.filter(r=>r.expected===r.outcome.close&&r.outcome.close!==r.originPrice).length,
   maePct:mae,baselinePct:baseline,gainPct:baseline>0?(1-mae/baseline)*100:null,
   within1Pct:rows.length?mean(rows.map(r=>Math.abs(r.outcome.close-r.expected)/r.originPrice<=.01?1:0))*100:null,
   coveragePct:rows.some(r=>Number.isFinite(r.low)&&Number.isFinite(r.high))?mean(rows.filter(r=>Number.isFinite(r.low)&&Number.isFinite(r.high)).map(r=>r.outcome.close>=r.low&&r.outcome.close<=r.high?1:0))*100:null,
   directionalN:directional.length,directionalHits:directional.filter(r=>r.signal.direction===r.outcome.direction).length,
   rows:all.map(r=>({symbol:r.symbol,expected:r.expected,actual:r.outcome.close,originPrice:r.originPrice??null,
    error:r.outcome.close-r.expected,errorPct:r.originPrice>0?Math.abs(r.outcome.close-r.expected)/r.originPrice*100:null,
    baselineErrorPct:r.originPrice>0?Math.abs(r.outcome.close-r.originPrice)/r.originPrice*100:null,
    signal:r.signal?.direction||'uncertain',observed:r.outcome.direction,model:r.model,recordedAt:r.recordedAt})).sort((a,b)=>a.symbol.localeCompare(b.symbol))};
 }).sort((a,b)=>b.date.localeCompare(a.date)||(a.version===currentVersion?-1:b.version===currentVersion?1:a.version.localeCompare(b.version)));
 return {currentVersion,daily,versions:versions.map(version=>{
  const all=records.filter(r=>r.version===version),rows=eligible.filter(r=>r.version===version);
  const comparable=rows.filter(r=>r.originPrice>0),directional=rows.filter(r=>['up','down'].includes(r.signal?.direction));
  return {version,recorded:all.length,scored:rows.length,sessions:new Set(rows.map(r=>r.outcome.date)).size,
   exact:rows.filter(r=>r.expected===r.outcome.close).length,
   meanAbsolutePct:mean(comparable.map(r=>Math.abs(r.outcome.close-r.expected)/r.originPrice*100)),
   baselinePct:mean(comparable.map(r=>Math.abs(r.outcome.close-r.originPrice)/r.originPrice*100)),
   directionalN:directional.length,directionalHits:directional.filter(r=>r.signal.direction===r.outcome.direction).length};
 }),latest:eligible.slice().sort((a,b)=>b.outcome.date.localeCompare(a.outcome.date)||b.recordedAt.localeCompare(a.recordedAt)).slice(0,10).map(r=>({symbol:r.symbol,version:r.version,date:r.outcome.date,expected:r.expected,actual:r.outcome.close,error:r.outcome.close-r.expected,recordedAt:r.recordedAt})),
 scope:'Chaque version est évaluée séparément. Un prix inchangé exactement prévu ne démontre pas une capacité à prévoir les hausses et baisses.'};
}
function capturedForecast(records,f,version,today){return records.find(r=>r.version===version&&r.origin===f.date&&r.symbol===f.symbol)
 ||(f.target<=today?records.filter(r=>r.origin===f.date&&r.symbol===f.symbol).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt))[0]:null);}
module.exports={audit,capturedForecast};
