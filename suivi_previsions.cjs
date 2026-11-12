'use strict';
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function monitoring(journal,version){
 const records=journal.records.filter(r=>r.version===version),scored=records.filter(r=>r.outcome?.eligible),dates=[...new Set(scored.map(r=>r.outcome.date))].sort(),bySymbol=[];
 for(const symbol of [...new Set(records.map(r=>r.symbol))]){
  const all=scored.filter(r=>r.symbol===symbol).sort((a,b)=>a.outcome.date.localeCompare(b.outcome.date)),recent=all.slice(-20),previous=all.slice(-40,-20);
  const loss=a=>mean(a.map(r=>Math.abs(r.outcome.error))),mae=loss(all),recentMae=loss(recent),previousMae=loss(previous);
  const baselines=all.filter(r=>Number.isFinite(r.outcome.baselineError)),baseline=mean(baselines.map(r=>Math.abs(r.outcome.baselineError)));
  const directional=all.filter(r=>['up','down'].includes(r.signal?.direction)),hits=directional.filter(r=>r.signal.direction===r.outcome.direction).length;
  const candidates=new Map();
  for(const row of all)for(const candidate of row.outcome.candidateErrors||[]){if(!Number.isFinite(row.outcome.baselineError))continue;if(!candidates.has(candidate.name))candidates.set(candidate.name,[]);candidates.get(candidate.name).push({date:row.outcome.date,error:Math.abs(candidate.error),production:Math.abs(row.outcome.error),baseline:Math.abs(row.outcome.baselineError)});}
  const challengers=[...candidates].map(([name,rows])=>({name,n:rows.length,sessions:new Set(rows.map(r=>r.date)).size,mae:mean(rows.map(r=>r.error)),productionMae:mean(rows.map(r=>r.production)),baselineMae:mean(rows.map(r=>r.baseline))}));
  bySymbol.push({symbol,n:all.length,sessions:new Set(all.map(r=>r.outcome.date)).size,mae,recentMae,baselineMae:baseline,
   degrading:recent.length>=20&&previous.length>=20&&previousMae>0&&recentMae>previousMae*1.5,
   coverage:all.length?mean(all.map(r=>r.outcome.close>=r.low&&r.outcome.close<=r.high?1:0))*100:null,
   directionalN:directional.length,directionalHits:hits,directionalPrecision:directional.length?hits/directional.length*100:null,
   challengers,reviewCandidates:challengers.filter(c=>c.sessions>=30&&c.mae<c.productionMae*.95&&c.mae<c.baselineMae*.95).map(c=>c.name)});
 }
 return {version,recorded:records.length,scored:scored.length,distinctSessions:dates.length,first:dates[0]||null,last:dates.at(-1)||null,bySymbol,
  degrading:bySymbol.filter(s=>s.degrading).map(s=>s.symbol),readyForReview:bySymbol.filter(s=>s.reviewCandidates.length).map(s=>s.symbol),
  message:dates.length<30?'Collecte des résultats futurs : moins de 30 séances réellement observées pour cette version.':'Suivi prospectif disponible, à examiner action par action.'};
}
module.exports={monitoring};
