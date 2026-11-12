'use strict';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function category(title){
 const t=normalize(title);
 if(/profit warning|avertissement.*resultat|alerte.*resultat/.test(t))return 'avertissement';
 if(/fractionnement|augmentation.*capital|droit.*souscription|attribution|reduction.*capital/.test(t))return 'capital';
 if(/dividende|detachement|distribution|coupon/.test(t))return 'dividende';
 if(/resultat|benefice|rapport.*activite|chiffre.*affaires|perte|semestr|trimestr/.test(t))return 'resultats';
 if(/notation|rating/.test(t))return 'notation';
 if(/assemblee|dirigeant|gouvernance|administrateur/.test(t))return 'gouvernance';
 return 'autre';
}
function exposure(events,symbol,capturedAt){
 const out=new Map(),day=capturedAt.slice(0,10),floor=Date.parse(capturedAt)-86400000;
 for(const e of events||[]){
  if(e.symbols&&!e.symbols.includes(symbol))continue;
  const seen=Date.parse(e.firstSeenAt);
  if(!Number.isFinite(seen)||seen>Date.parse(capturedAt)||seen<floor||!e.publishedAt)continue;
  const published=e.publishedAt.slice(0,10),age=(Date.parse(day)-Date.parse(published))/86400000;
  if(!Number.isFinite(age)||age<0||age>1)continue;
  const kind=category(e.title),key=[symbol,kind,published].join('|');
  if(!out.has(key))out.set(key,{key,category:kind,symbol,publishedDate:published,firstSeenAt:e.firstSeenAt,title:e.title,url:e.url,provider:e.provider});
 }
 return [...out.values()];
}
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function study(journal,version,asOf){
 const rows=journal.records.filter(r=>r.version===version&&r.eventsTracked===true&&r.outcome?.eligible&&r.outcome.date<=asOf&&Number.isFinite(r.outcome.returnPct));
 const categories=[...new Set(rows.flatMap(r=>(r.events||[]).map(e=>e.category)))];
 const studies=categories.map(kind=>{
  const events=rows.filter(r=>(r.events||[]).some(e=>e.category===kind));
  const dates=new Set(events.map(r=>r.outcome.date)),symbols=new Set(events.map(r=>r.symbol));
  const controls=[];
  for(const r of events){const peers=rows.filter(p=>p.symbol!==r.symbol&&p.sector===r.sector&&p.outcome.date===r.outcome.date&&p.events.length===0);if(peers.length)controls.push({event:r.outcome.returnPct,control:mean(peers.map(p=>p.outcome.returnPct))});}
  return {category:kind,n:events.length,distinctSessions:dates.size,symbols:symbols.size,meanReturnPct:mean(events.map(r=>r.outcome.returnPct)),positiveRatePct:mean(events.map(r=>r.outcome.returnPct>0?100:0)),
   matchedControls:controls.length,relativeReturnPct:controls.length?mean(controls.map(r=>r.event-r.control)):null,
   readyForResearch:events.length>=30&&dates.size>=10&&symbols.size>=3&&controls.length>=20};
 });
 return {version:'events-1.0.0',observed:rows.length,exposed:rows.filter(r=>r.events.length).length,categories:studies,
  status:studies.some(s=>s.readyForResearch)?'research_ready':'collecting',
  scope:'Étude descriptive après la première observation. Aucun effet causal n’est établi et aucune correction automatique du cours n’est appliquée.'};
}
function newsChallenger(f,events,journal,version){
 const prior=journal.records.filter(r=>r.version===version&&r.eventsTracked&&r.outcome?.eligible&&r.outcome.date<=f.date&&r.originPrice>0);
 const coefficients=[];
 for(const kind of [...new Set(events.map(e=>e.category))]){
  const exposed=prior.filter(r=>r.events.some(e=>e.category===kind)),controls=prior.filter(r=>r.events.length===0);
  if(exposed.length<30||new Set(exposed.map(r=>r.outcome.date)).size<10||new Set(exposed.map(r=>r.symbol)).size<3||controls.length<30)continue;
  const residual=r=>(r.outcome.close-r.expected)/r.originPrice;
  const adjustment=(mean(exposed.map(residual))-mean(controls.map(residual)))*exposed.length/(exposed.length+30);
  coefficients.push({category:kind,n:exposed.length,adjustment});
 }
 if(!f.available||!coefficients.length)return {available:false,reason:'Données prospectives et groupe témoin insuffisants pour tester un effet d’annonce.'};
 const offset=Math.max(-.02,Math.min(.02,mean(coefficients.map(c=>c.adjustment))));
 return {available:true,name:'Cours + annonces horodatées (candidat)',expected:f.expected+f.price*offset,coefficients,
  scope:'Candidat enregistré pour comparaison future ; ne remplace pas la prévision publiée.'};
}
module.exports={category,exposure,study,newsChallenger};
