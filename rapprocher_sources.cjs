'use strict';
function reconcile(data,fundamentals,supplement={}){
 const official=new Map(data.sessions.flatMap(s=>s.stocks.map(r=>[r.symbol+'|'+s.date,r]))),bars=new Map(),conflicts=[],counts={};
 for(const r of supplement.observations||[]){
  const key=r.symbol+'|'+r.date,base=official.get(key);if(!base||!(base.close>0))continue;
  const factor=(fundamentals.splits||[]).filter(s=>s.symbol===r.symbol&&s.date<=data.session&&r.date<s.date).reduce((p,s)=>p*s.factor,1);
  const adjusted=base.close/factor,tolerance=Math.max(1,adjusted*.0005),difference=r.close-adjusted;
  const valid=Number.isFinite(r.close)&&r.close>0&&Number.isFinite(r.low)&&Number.isFinite(r.high)&&r.low>0&&r.low<=r.close&&r.close<=r.high;
  const agree=valid&&Math.abs(difference)<=tolerance;
  counts[r.provider]??={matched:0,conflicts:0};counts[r.provider][agree?'matched':'conflicts']++;
  if(agree&&!r.revisedAt){bars.set(key,{...r,verified:true,officialClose:adjusted});}
  else if(!agree)conflicts.push({symbol:r.symbol,date:r.date,provider:r.provider,officialClose:adjusted,reportedClose:r.close,source:r.source,reason:valid?'Clôtures divergentes après ajustement vérifié':'OHLC invalides'});
 }
 const observations=supplement.observations||[],dates=observations.map(r=>r.date).sort();
 return {bars,conflicts,summary:{collectedRows:observations.length,symbols:new Set(observations.map(r=>r.symbol)).size,first:dates[0]||null,last:dates.at(-1)||null,verifiedBars:bars.size,conflicts:conflicts.length,providers:counts,lastCollection:supplement.checkedAt||null,states:supplement.states||[],events:(supplement.events||[]).length,scope:supplement.scope||'Collecte complémentaire non encore effectuée.'}};
}
function eventsFor(supplement,symbol,at){
 // La date de première observation protège contre le réemploi d'une nouvelle découverte après coup.
 const cutoff=at+'T23:59:59.999Z';
 const floor=new Date(Date.parse(at+'T00:00:00Z')-14*86400000).toISOString().slice(0,10);
 return (supplement.events||[]).filter(e=>e.symbols?.includes(symbol)&&e.firstSeenAt<=cutoff&&e.publishedAt&&e.publishedAt.slice(0,10)>=floor&&e.publishedAt.slice(0,10)<=at).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,5).map(e=>({title:e.title,url:e.url,provider:e.provider,publishedAt:e.publishedAt,firstSeenAt:e.firstSeenAt,type:e.type}));
}
function extendHistory(data,fundamentals,supplement,symbol,reconciled){
 const model=require('./previsions.js');
 const original=data.sessions.map(s=>s.stocks.find(r=>r.symbol===symbol)).filter(Boolean);
 const official=model.normalise(original,symbol,data.session,fundamentals.splits||[]).map(r=>({...r,adjustedTo:data.session}));
 const overlap=[...reconciled.bars.values()].filter(r=>r.symbol===symbol).length;
 if(overlap<30||reconciled.conflicts.some(r=>r.symbol===symbol))return {history:official,added:0};
 const older=(supplement.observations||[]).filter(r=>r.symbol===symbol&&r.provider==='Sika Finance'&&r.date<official[0].date&&!r.revisedAt).sort((a,b)=>a.date.localeCompare(b.date));
 const first=official[0],last=older.at(-1);
 if(last&&Math.abs(first.close/last.close-1)>.16)return {history:official,added:0};
 const prefix=older.map((r,i)=>({...r,sector:first.sector,previous:i?older[i-1].close:r.close,reference:r.close,adjustedTo:data.session,sourceKind:'secondary_history',basis:'Unités publiées par Sika Finance, cohérence vérifiée sur au moins 30 dates de chevauchement.'}));
 for(const r of prefix)reconciled.bars.set(symbol+'|'+r.date,{...r,verified:true,verification:'provider_overlap'});
 return {history:[...prefix,...official],added:prefix.length};
}
module.exports={reconcile,eventsFor,extendHistory};
