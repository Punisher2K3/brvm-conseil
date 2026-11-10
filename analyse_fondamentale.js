/* Analyse explicable. Les absences de données ne deviennent jamais des zéros. */
(function(root){
'use strict';
const finite=Number.isFinite;
const ratio=(a,b)=>finite(a)&&finite(b)&&b>0?a/b:null;
const growth=(a,b)=>{const r=ratio(a,b);return r===null?null:(r-1)*100;};
function analyse(a,store={},options={}){
 const end=a.asOf,year=Number(end.slice(0,4)),years=Array.from({length:10},(_,i)=>year-1-i);
 const annual=(store.accounts||[]).filter(x=>x.symbol===a.symbol&&x.verified&&x.published<=end&&x.periodEnd<=end).sort((x,y)=>y.periodEnd.localeCompare(x.periodEnd))[0]||null;
 const age=annual?(Date.parse(end)-Date.parse(annual.periodEnd))/86400000:null;
 const f=annual&&age<=550?annual:null;
 const cap=(store.capitalisations||[]).find(x=>x.symbol===a.symbol);
 // Une quantité actuelle de titres ne peut servir à un retour historique du moteur.
 const capDate=store.capitalisationSession;
 const marketCap=cap&&capDate===end&&cap.shares>0&&Math.abs(cap.marketCap-cap.shares*cap.price)<=Math.max(1,cap.marketCap*.00001)?cap.shares*a.reference:null;
 const capitalisationSnapshot=cap&&cap.shares>0&&Math.abs(cap.marketCap-cap.shares*cap.price)<=Math.max(1,cap.marketCap*.00001)?{...cap,session:capDate}:null;
 const profile=(store.businesses||[]).find(x=>x.symbol===a.symbol)||null;
 const events=(store.dividends||[]).filter(x=>x.symbol===a.symbol&&x.exDate&&x.exDate<=end);
 const historyEvents=(store.dividends||[]).filter(x=>x.symbol===a.symbol&&(x.exDate?x.exDate<=end:x.payment&&x.payment<=end));
 const dividends=years.map(year=>{
  const rows=historyEvents.filter(x=>x.year===year);
  const unique=new Map(rows.map(x=>[[x.exDate,x.payment,x.net].join('|'),x]));
  const distributions=[...unique.values()].map(row=>{
   const factor=(store.splits||[]).filter(event=>event.symbol===a.symbol && event.date<=end && (row.exDate||row.payment||String(row.year)+'-12-31')<event.date).reduce((product,event)=>product*event.factor,1);
   return {...row,originalNet:row.net,net:row.net/factor,adjustmentFactor:factor};
  });
  return {year,net:distributions.length?distributions.reduce((s,x)=>s+x.net,0):null,distributions};
 });
 const quotes=a.history.filter(x=>x.close>0&&!x.suspended&&!x.inconsistent);
 const low=quotes.length?quotes.reduce((x,y)=>y.close<x.close?y:x):null;
 const high=quotes.length?quotes.reduce((x,y)=>y.close>x.close?y:x):null;
 const splitEvents=(store.splits||[]).filter(s=>s.symbol===a.symbol&&s.date<=end);
 const epsFactor=f?splitEvents.filter(s=>s.date>f.periodEnd).reduce((v,s)=>v*s.factor,1):1;
 const eps=f&&finite(f.eps)?f.eps/epsFactor:null;
 const debt=f&&f.debtComplete===true&&finite(f.financialDebt)?f.financialDebt:null;
 const equity=f&&finite(f.equity)?f.equity:null;
 const banking=a.sector==='FIN';
 const averageEquity=f&&finite(f.previousEquity)&&f.previousEquity>0&&equity>0?(equity+f.previousEquity)/2:null;
 const roe=ratio(f?.profit,averageEquity);
 const margin=!banking?ratio(f?.operatingProfit,f?.revenue):null;
 const debtEquity=!banking?ratio(debt,equity):null;
 const earningsGrowth=f?growth(f.profit,f.previousProfit):null;
 let valuation='Non concluante';
 if(a.metrics.indicativeValue>0){const gap=(a.reference/a.metrics.indicativeValue-1)*100;valuation=gap< -20?'Décote relative aux pairs':gap>20?'Prime relative aux pairs':'Proche du repère sectoriel';}
 if(f&&finite(f.profit)&&f.profit<=0)valuation='PER peu pertinent : perte annuelle';
 const criteria=[
  {label:'Résultat annuel positif',state:f&&finite(f.profit)?(f.profit>0?'favorable':'défavorable'):'non évalué'},
  {label:'Croissance du bénéfice annuel',state:earningsGrowth===null?'non évalué':earningsGrowth>=0?'favorable':'défavorable'},
  {label:'Rentabilité des fonds propres',state:roe===null?'non évalué':roe>0?'positive, à comparer au secteur':'négative'},
  {label:'Dette financière / fonds propres',state:banking?'lecture bancaire spécifique requise':debtEquity===null?'non évalué':debtEquity<=1?'inférieure ou égale à 1':'supérieure à 1'},
  {label:'Avantage concurrentiel, gouvernance et dépendances',state:'analyse qualitative à approfondir'}
 ];
 const known=criteria.filter(x=>!['non évalué','analyse qualitative à approfondir','lecture bancaire spécifique requise'].includes(x.state)).length;
 // Simulation sur 20 séances effectives. Toute rupture de référence rend le résultat indisponible.
 const holding=quotes.slice(-21),start=holding[0],last=holding.at(-1);
 const breaks=start?a.events.filter(x=>x.date>start.date&&x.date<=last.date&&x.type!=='Changement de dividende publié'):[];
 let performance={available:false,reason:'Au moins 21 clôtures valides et une série sans rupture sont nécessaires.'};
 if(holding.length===21&&!breaks.length){
  const dividendsInWindow=events.filter(x=>x.exDate>start.date&&x.exDate<=last.date);
  const distribution=dividendsInWindow.reduce((v,x)=>v+x.net,0);
  const fee=(options.fee??1)/100;
  const nominal=((last.close*(1-fee)+distribution)/(start.close*(1+fee))-1)*100;
  const days=(Date.parse(last.date)-Date.parse(start.date))/86400000;
  const inflation=options.inflation;
  const real=finite(inflation)&&inflation>-100?((1+nominal/100)/Math.pow(1+inflation/100,days/365.25)-1)*100:null;
  performance={available:true,start:start.date,end:last.date,days,priceReturn:growth(last.close,start.close),distribution,nominal,real,inflation:finite(inflation)?inflation:null,fee:fee*100};
 }
 return {annual:f,archive:!f?annual:null,age,eps,epsImplicit:a.per>0?a.reference/a.per:null,epsFactor,equity,debt,debtEquity,roe:roe===null?null:roe*100,operatingMargin:margin===null?null:margin*100,earningsGrowth,marketCap,capitalisationSnapshot,shares:marketCap!==null?cap.shares:null,capitalisationSource:cap?.source,dividends,dividendYears:dividends.filter(x=>x.net!==null).length,range:{low,high,start:quotes[0]?.date,end:quotes.at(-1)?.date,count:quotes.length,unadjusted:false},valuation,profile,criteria,qualityCoverage:known,performance,banking};
}
root.BRVM_DEEP={analyse,ratio,growth};if(typeof module!=='undefined')module.exports=root.BRVM_DEEP;
})(typeof window!=='undefined'?window:globalThis);
