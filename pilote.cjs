'use strict';
const {quantile}=require('./previsions.js');
const RULES=Object.freeze({sessions:20,minActivePct:95,minMedianValue:5_000_000,maxStocks:10,maxPerSector:3});
function selectPilot(data,predictions,asOf=data.session){
 const sessions=data.sessions.filter(s=>s.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date)).slice(-RULES.sessions),last=sessions.at(-1);
 const forecasts=new Map(predictions.map(p=>[p.symbol,p]));
 const rows=(last?.stocks||[]).map(stock=>{
  const samples=sessions.map(s=>s.stocks.find(r=>r.symbol===stock.symbol)),valid=samples.filter(r=>r&&r.volume>0&&r.close>0&&!r.suspended&&!r.inconsistent);
  const active=sessions.length?valid.length/sessions.length*100:0;
  const turnover=samples.map(r=>Number.isFinite(r?.value)&&r.value>=0?r.value:null);
  const complete=turnover.every(v=>v!==null),medianValue=complete?quantile(turnover,.5):null;
  const f=forecasts.get(stock.symbol),reasons=[];
  if(sessions.length<RULES.sessions)reasons.push('Moins de 20 séances');
  if(active<RULES.minActivePct)reasons.push('Échanges trop irréguliers');
  if(medianValue===null)reasons.push('Montants échangés incomplets');
  else if(medianValue<RULES.minMedianValue)reasons.push('Montant médian inférieur à 5 millions FCFA');
  if(!f?.available||f.date!==asOf||f.sourceConflict||stock.suspended||stock.inconsistent)reasons.push('Prévision ou qualité insuffisante');
  return {symbol:stock.symbol,name:stock.name,sector:stock.sector,activePct:active,medianValue,sessions:sessions.length,eligible:reasons.length===0,reasons,selected:false};
 }).sort((a,b)=>(b.medianValue??-1)-(a.medianValue??-1)||a.symbol.localeCompare(b.symbol));
 const sectors=new Map(),selected=[];
 for(const row of rows){if(!row.eligible||selected.length>=RULES.maxStocks)continue;if((sectors.get(row.sector)||0)>=RULES.maxPerSector)continue;row.selected=true;selected.push(row);sectors.set(row.sector,(sectors.get(row.sector)||0)+1);}
 return {asOf,version:'pilot-1.0.0',rules:RULES,members:selected.map(r=>r.symbol),rows,
  scope:'Sélection de suivi selon la liquidité observée, sans classement de rentabilité. Aucun résultat historique global n’est attribué au groupe sélectionné aujourd’hui.'};
}
module.exports={RULES,selectPilot};
