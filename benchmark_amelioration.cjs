'use strict';
// Validation historique exploratoire, jamais une preuve de performance future.
const fs=require('node:fs');
const before=require('./previsions_reference_2_1.cjs'),after=require('./previsions.js');
const data=JSON.parse(fs.readFileSync('base-marche.json','utf8')),fundamentals=JSON.parse(fs.readFileSync('fondamentaux.json','utf8'));
const dates=data.sessions.map(s=>s.date).sort(),start=dates.at(-30),rows=[];
for(const stock of data.sessions.at(-1).stocks){
 const history=data.sessions.flatMap(s=>s.stocks.filter(r=>r.symbol===stock.symbol)),a={symbol:stock.symbol,asOf:data.session,history},opts={data,fundamentals,trace:true};
 const old=before.forecast(a,opts),next=after.forecast(a,opts);if(!old.available||!next.available)continue;
 const prior=new Map(old.trace.filter(r=>r.test&&r.date>=start).map(r=>[r.date,r]));
 for(const r of next.trace.filter(r=>r.test&&r.date>=start)){
  const p=prior.get(r.date);if(!p)continue;
  rows.push({symbol:stock.symbol,date:r.date,old:Math.abs(p.error)*100,new:Math.abs(r.error)*100,baseline:Math.abs(r.y)*100,selected:r.selected});
 }
}
const mean=(a,k)=>a.reduce((s,r)=>s+r[k],0)/a.length;
const report={asOf:data.session,evaluationStart:start,evaluationEnd:data.session,scope:'Comparaison chronologique exploratoire sur les historiques actuellement disponibles, susceptibles de révision ; ne prouve aucun gain prospectif.',dataSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync('base-marche.json')).digest('hex'),n:rows.length,sessions:new Set(rows.map(r=>r.date)).size,oldMaePct:mean(rows,'old'),newMaePct:mean(rows,'new'),baselineMaePct:mean(rows,'baseline'),auctionSelections:rows.filter(r=>r.selected===12).length,
 symbols:[...new Set(rows.map(r=>r.symbol))].map(symbol=>{const a=rows.filter(r=>r.symbol===symbol);return {symbol,n:a.length,old:mean(a,'old'),new:mean(a,'new')};})};
console.log(JSON.stringify(report,null,2));
