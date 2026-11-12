/* Scénarios d'exécution, sans transmission d'ordre. Pourcentages par opération. */
(function(root){
'use strict';
const DEFAULTS=Object.freeze({feePct:1,slippagePct:.25});
function settings(options={}){
 const fee=options.feePct??DEFAULTS.feePct,slippage=options.slippagePct??DEFAULTS.slippagePct;
 if(!Number.isFinite(fee)||fee<0||fee>5||!Number.isFinite(slippage)||slippage<0||slippage>5)throw new RangeError('Frais et écart par opération attendus entre 0 et 5 %.');
 return {feePct:fee,slippagePct:slippage};
}
function fromPrices(entry,exit,options={}){
 const s=settings(options);if(!Number.isFinite(entry)||entry<=0||!Number.isFinite(exit)||exit<=0)return {available:false};
 const fee=s.feePct/100,slip=s.slippagePct/100,buy=entry*(1+slip)*(1+fee),sell=exit*(1-slip)*(1-fee);
 const breakEven=buy/((1-slip)*(1-fee));
 return {available:true,...s,entryReference:entry,exitReference:exit,buyCost:buy,saleNet:sell,breakEven,grossReturnPct:(exit/entry-1)*100,netReturnPct:(sell/buy-1)*100,requiredRisePct:(breakEven/entry-1)*100};
}
function execution(f,options={}){
 if(!f?.available)return {available:false};
 const central=fromPrices(f.price,f.expected,options),low=fromPrices(f.price,f.low,options),high=fromPrices(f.price,f.high,options);
 if(!central.available||!low.available||!high.available)return {available:false};
 if(f.low>f.expected||f.expected>f.high)return {available:false};
 const status=low.netReturnPct>0?'covered':high.netReturnPct<=0?'notCovered':'uncertain';
 return {...central,lowNetPct:low.netReturnPct,highNetPct:high.netReturnPct,status,
  label:status==='covered'?'Oui dans la fourchette estimée':status==='notCovered'?'Non dans la fourchette estimée':'Indéterminé dans la fourchette',
  assumption:'Achat simulé au dernier cours, corrigé des hypothèses. Le prix réellement accessible à la prochaine séance reste inconnu.'};
}
const api={DEFAULTS,settings,fromPrices,execution};root.BRVM_EXECUTION=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
