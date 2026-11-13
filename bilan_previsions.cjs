'use strict';
// Uniquement les résultats issus des bulletins ; aucun cours web provisoire n'est noté.
function audit(journal,currentVersion){
 const records=journal.records||[],eligible=records.filter(r=>r.outcome?.eligible&&r.outcome.close>0&&Number.isFinite(r.expected));
 const versions=[...new Set(records.map(r=>r.version))];
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 return {currentVersion,versions:versions.map(version=>{
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
