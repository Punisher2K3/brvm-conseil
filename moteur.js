/* Moteur déterministe, calculs auditables. Aucun appel externe. */
(function(root){
'use strict';
const VERSION='3.0.0';
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>quantile(a,.5);
function quantile(a,p){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*p,l=Math.floor(i);return b[l]+(b[Math.ceil(i)]-b[l])*(i-l);}
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const days=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
const pct=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?(a/b-1)*100:null;
function today(value=new Date()){const p=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');}
function rsi(prices,n=14){if(prices.length<=n)return null;let g=0,l=0;for(let i=prices.length-n;i<prices.length;i++){let d=prices[i]-prices[i-1];g+=Math.max(0,d);l+=Math.max(0,-d);}return g+l===0?50:l===0?100:100-100/(1+g/l);}
function maxDrawdown(prices){let peak=prices[0],dd=0;for(const p of prices){peak=Math.max(peak,p);dd=Math.min(dd,(p/peak-1)*100);}return dd;}
function wilson(k,n){if(!n)return null;const z=1.96,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [100*(c-h),100*(c+h)];}
function cleanSegment(history){let start=0,events=[];for(let i=1;i<history.length;i++){
 const prev=history[i-1],cur=history[i];
 // Le cours précédent du bulletin tient compte d'éventuelles opérations sur titres.
 const boundary=prev.reference>0&&cur.previous>0&&Math.abs(cur.previous/prev.reference-1)>.02;
 const jump=prev.reference>0&&cur.reference>0&&Math.abs(cur.reference/prev.reference-1)>.16;
 const detached=cur.dividendDate&&cur.dividendDate!==prev.dividendDate;
 if(boundary||jump||detached){events.push({date:cur.date,type:boundary||jump?'Rupture de référence / opération à examiner':'Changement de dividende publié'});start=i;}
 }return {rows:history.slice(start),events};}
function scenarios(history,h=5){
 const {rows}=cleanSegment(history); const returns=[];
 for(let i=0;i+h<rows.length;i++){
   const w=rows.slice(i,i+h+1);
   if(w.some(r=>r.suspended||r.inconsistent||!r.close||r.volume<=0))continue;
   returns.push(pct(w[h].close,w[0].close));
 }
 const n=returns.length;
 if(n<40)return {horizon:h,n,available:false,reason:'Au moins 40 fenêtres valides sont nécessaires après la dernière rupture de série.'};
 const positive=returns.filter(x=>x>0).length;
 return {available:true,horizon:h,n,effective:Math.floor(n/h),low:quantile(returns,.1),median:median(returns),high:quantile(returns,.9),positiveRate:positive/n*100,interval:wilson(positive,n),overlapping:true};
}
function backtest(history,fee=.01){
 const {rows}=cleanSegment(history),trades=[];let holdUntil=-1;
 for(let i=20;i+5<rows.length;i++){
   if(i<=holdUntil)continue;
   const w=rows.slice(i-20,i+6);
   if(w.some(r=>r.inconsistent||r.suspended||!r.close||r.volume<=0))continue;
   // Signal après la clôture i ; entrée à l'ouverture i+1, sortie clôture i+5.
   const ma=mean(rows.slice(i-19,i+1).map(r=>r.close));
   if(rows[i].close<=ma)continue;
   const entry=rows[i+1].opening,exit=rows[i+5].close;
   if(!entry||!exit)continue;
   trades.push({signal:rows[i].date,entry:rows[i+1].date,exit:rows[i+5].date,return:(exit*(1-fee)/(entry*(1+fee))-1)*100});holdUntil=i+5;
 }
 return {n:trades.length,mean:mean(trades.map(t=>t.return)),winRate:trades.length?trades.filter(t=>t.return>0).length/trades.length*100:null,fee,validated:trades.length>=30,trades};
}
const ISSUERS={"SNTS": "sonatel", "ORAC": "orange-ci", "ONTBF": "onatel-bf", "PALC": "palm-ci", "SPHC": "saph-ci", "SGBC": "sgci", "SIBC": "sib", "ECOC": "ecobank-ci", "ETIT": "ecobank-tg", "BOAB": "bank-africa-bn", "BOABF": "bank-africa-bf", "BOAC": "bank-africa-ci", "BOAM": "bank-africa-ml", "BOAN": "bank-africa-ng", "BOAS": "bank-africa-sn", "STBC": "sitab", "SLBC": "solibra", "NTLC": "nestle-ci", "CIEC": "cie-ci", "SDCC": "sodeci", "ABJC": "servair-abidjan-ci", "NEIC": "nei-ceda-ci", "SAFC": "safca-ci", "CABC": "sicable", "SICC": "sicor", "SMBC": "smb", "SCRC": "sucrivoire", "ORGT": "oragroup", "NSBC": "nsbc", "UNXC": "uniwax-ci", "UNLC": "unilever-ci", "FTSC": "filtisac-ci", "TTLC": "total", "TTLS": "totalenergies-marketing-sn", "BICC": "bici-ci", "BNBC": "bernabe-ci", "CBIBF": "coris-bank-international", "CFAC": "cfao-motors-ci", "SDSC": "bollore-transport-logistics", "SIVC": "air-liquide-ci", "SEMC": "crown-siem-ci", "BBGC": "bbgci", "BICB": "biic", "LNBB": "lnb", "PRSC": "tractafric-ci", "SHEC": "vivo-energy-ci", "SOGC": "sogb", "STAC": "setao-ci"};

function adjustHistory(history, symbol, asOf) {
 const defaultSplits=[{symbol:'SNTS',date:'2026-10-26',factor:10}];
 const splits=(root.BRVM_FUNDAMENTALS?.splits||defaultSplits).filter(event=>event.symbol===symbol && event.date<=asOf);
 return history.map(row=>{
  if(row.adjustedTo===asOf)return row;
  const priceFactor=splits.filter(event=>row.date<event.date).reduce((product,event)=>product*event.factor,1);
  const dividendFactor=splits.filter(event=>row.dividendDate && row.dividendDate<event.date).reduce((product,event)=>product*event.factor,1);
  const adjusted={...row,adjustedTo:asOf,originalClose:row.originalClose??row.close};
  for(const field of ['close','reference','previous','opening']){
   if(Number.isFinite(row[field]))adjusted[field]=row[field]/priceFactor;
  }
  if(Number.isFinite(row.volume))adjusted.volume=row.volume*priceFactor;
  if(Number.isFinite(row.dividend))adjusted.dividend=row.dividend/dividendFactor;
  return adjusted;
 });
}

function analyse(data,options={}){
 const asOf=options.asOf||today(),profile=options.profile||'equilibre',fee=options.fee??1,budget=options.budget??100000;
 const weights=profile==='revenu'?{quality:25,value:20,income:30,liquidity:20,trend:5}:profile==='prudent'?{quality:30,value:20,income:15,liquidity:30,trend:5}:{quality:25,value:25,income:15,liquidity:20,trend:15};
 const sessions=[...(data.sessions||[])].filter(x=>x.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date));
 if(!sessions.length)return [];
 const latest=sessions.at(-1),stale=days(asOf,latest.date)>7;
 const financials=root.BRVM_FINANCIALS||[];
 return latest.stocks.map(raw=>{
   const s=adjustHistory([raw],raw.symbol,latest.date)[0];
   const history=adjustHistory(sessions.map(x=>x.stocks.find(y=>y.symbol===s.symbol)).filter(Boolean),s.symbol,latest.date);
   const segment=cleanSegment(history),valid=segment.rows.filter(r=>r.close>0&&!r.suspended&&!r.inconsistent);
   const last20=history.slice(-20),prices=valid.map(r=>r.close),p=s.reference;
   const peers=latest.stocks.filter(x=>x.sector===s.sector&&x.per>0&&x.per<100&&x.symbol!==s.symbol);
   const peerPER=peers.length>=3?median(peers.map(x=>x.per)):null;
   const dividendAge=s.dividendDate?days(latest.date,s.dividendDate):null;
   const recentDividend=dividendAge!==null&&dividendAge>=0&&dividendAge<=400;
   const yieldNet=recentDividend&&s.dividend!==null?s.dividend/p*100:null;
   const turnover=last20.length>=15?median(last20.map(r=>r.value||0)):null;
   const active=last20.length>=15?last20.filter(r=>r.volume>0&&!r.suspended).length/last20.length*100:null;
   const ret20=prices.length>=21?pct(prices.at(-1),prices.at(-21)):null;
   const ma20=prices.length>=20?mean(prices.slice(-20)):null,ma60=prices.length>=60?mean(prices.slice(-60)):null;
   const returns=prices.slice(1).map((v,i)=>Math.log(v/prices[i]));
   const volatility=returns.length>=20?Math.sqrt(mean(returns.map(v=>(v-mean(returns))**2)))*Math.sqrt(252)*100:null;
   const financialRecord=financials.filter(f=>f.symbol===s.symbol&&f.published<=latest.date&&f.verified).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.published.localeCompare(a.published))[0]||null;
   const financialAge=financialRecord?days(latest.date,financialRecord.periodEnd):null;
   const fin=financialRecord&&financialAge>=0&&financialAge<=550?financialRecord:null;
   const financialIssues=fin?.dataIssues||[];
   const revenueGrowth=fin&&fin.revenueComparable!==false?(fin.revenueGrowthReported??pct(fin.revenue,fin.previousRevenue)):null,profitGrowth=fin&&fin.profitReliable!==false?(fin.profitGrowthReported??pct(fin.profit,fin.previousProfit)):null;
   const components={quality:fin&&revenueGrowth!==null&&Number.isFinite(fin.profit)&&!financialIssues.length?clamp((fin.profit>0?50:0)+clamp(profitGrowth??0,-30,30)+clamp(revenueGrowth,-20,20)):null,value:s.per>0&&peerPER?clamp(50+(peerPER/s.per-1)*65):null,income:yieldNet!==null?clamp(yieldNet/8*100):null,liquidity:turnover!==null?clamp((Math.log10(Math.max(1,turnover))-5)*25)*((active||0)/100):null,trend:ret20!==null?clamp(50+ret20*2+(ma60?(p>ma60?10:-10):0)):null};
   const coverage=Object.keys(weights).reduce((v,k)=>v+(components[k]!==null?weights[k]:0),0);
   const score=coverage?Object.keys(weights).reduce((v,k)=>v+(components[k]??0)*weights[k],0)/coverage:null;
   const warnings=[],positives=[],negatives=[];
   if(stale)warnings.push('Dernière séance vieille de plus de sept jours : avis suspendu.');
   if(s.suspended)warnings.push('Valeur suspendue ou non cotée pendant cette séance.');
   if(s.inconsistent)warnings.push('Variation incohérente dans le bulletin : avis suspendu.');
   if(!fin)warnings.push('Situation financière actuelle non confirmée : aucun compte suffisamment récent n’est utilisable dans le score.');
   if(!fin&&financialRecord)warnings.push('Derniers comptes contrôlés : '+financialRecord.period+', clos depuis '+financialAge+' jours à la date de séance. Au-delà de 550 jours, ils sont exclus du score courant.');
   if(fin?.revenueComparable===false)warnings.push(fin.missingReason+' La dimension résultats n’est pas notée.');
   if(fin?.notes)warnings.push(...fin.notes);
   if(financialIssues.length)warnings.push(...financialIssues);
   if(segment.events.length)warnings.push(segment.events.length+' rupture(s) ou changement(s) de dividende : indicateurs de tendance limités au dernier segment.');
   if(!recentDividend)warnings.push('Aucun dividende récent identifié ; le rendement ancien n’est pas utilisé.');
   if(s.per===null)warnings.push('PER absent : cela peut refléter une perte ou une information indisponible.');
   if(s.per>100)negatives.push('PER supérieur à 100 : bénéfice très faible au regard du prix.');
   if(fin&&Number.isFinite(fin.profit)&&fin.profit<=0)negatives.push('L’entreprise publie une perte sur la période étudiée.');
   if(profitGrowth!==null&&profitGrowth< -30)negatives.push('Le bénéfice recule de plus de 30 % : le PER historique peut masquer cette détérioration.');
   if(yieldNet!==null&&yieldNet>15)warnings.push('Rendement du dernier dividende supérieur à 15 % : possible versement exceptionnel ; ne pas extrapoler.');
   if(peerPER&&s.per>0){const gap=(s.per/peerPER-1)*100;(gap<0?positives:negatives).push('PER '+Math.abs(gap).toFixed(1)+' % '+(gap<0?'sous':'au-dessus de')+' la médiane de '+peers.length+' autres sociétés du secteur.');}
   if(yieldNet!==null)(yieldNet>=5?positives:negatives).push('Dernier dividende net récent / cours : '+yieldNet.toFixed(2)+' %. Ce versement n’est pas garanti à l’avenir.');
   if(active!==null)(active>=90?positives:negatives).push('Échanges lors de '+active.toFixed(0)+' % des '+last20.length+' dernières séances.');
   if(ret20!==null)(ret20>=0?positives:negatives).push('Variation sur 20 observations valides : '+ret20.toFixed(2)+' %, hors dividendes.');
   if(fin){if(profitGrowth!==null)(profitGrowth>=0?positives:negatives).push('Résultat net : '+profitGrowth.toFixed(1)+' % sur périodes comparables ('+fin.period+').');else warnings.push('Résultat antérieur nul ou négatif : taux de croissance du bénéfice non calculé.');}
   let verdict=score===null||coverage<45?'Données insuffisantes':score>=65?'Intéressante à étudier':score>=45?'À surveiller':'Prudence';
   if(s.per>100&&verdict==='Intéressante à étudier')verdict='À surveiller';
   if(fin&&Number.isFinite(fin.profit)&&fin.profit<=0)verdict='Prudence';
   if(profitGrowth!==null&&profitGrowth< -30&&verdict==='Intéressante à étudier')verdict='À surveiller';
   if(stale||s.suspended||s.inconsistent||financialIssues.length)verdict='Avis suspendu';
   const positionLimit=turnover!==null?turnover*.05:null;
   if(positionLimit!==null&&budget>positionLimit)negatives.push('Votre montant dépasse 5 % du montant médian quotidien échangé : exécution potentiellement difficile.');
   const shares=Math.max(0,Math.floor(budget/(p*(1+fee/100))));
   const eps=s.per>0?p/s.per:null;
   const indicativeValue=fin&&Number.isFinite(fin.profit)&&fin.profit>0&&!financialIssues.length&&!(profitGrowth!==null&&profitGrowth< -30)&&eps&&peerPER?eps*peerPER:null;
   const issuer=(data.catalogue||[]).find(c=>c.slug===ISSUERS[s.symbol]);
   if(fin&&issuer?.reports.some(r=>{const m=r.url.match(/\/(20\d{6})/);return m&&m[1]>fin.published.replaceAll('-','');}))warnings.push('Une publication plus récente est disponible : ses comptes ne sont pas encore normalisés dans ce score.');
   return {...s,close:s.close||s.reference,asOf:latest.date,history,events:segment.events,score,coverage,weights,components,verdict,positives,negatives,warnings,metrics:{peerPER,peerCount:peers.length,yieldNet,dividendAge,turnover,active,ret20,ma20,ma60,rsi:rsi(prices),volatility,drawdown:prices.length>=20?maxDrawdown(prices):null,revenueGrowth,profitGrowth,indicativeValue,positionLimit,financialAge},financial:fin||null,financialArchive:!fin?financialRecord:null,financialIssues,reports:issuer?.reports||[],issuerUrl:issuer?.url||'https://www.brvm.org/fr/rapports-societes-cotees',scenarios:[scenarios(history,5),scenarios(history,20)],backtest:backtest(history,fee/100),simulation:{budget,fee,shares,cost:shares*p*(1+fee/100),breakEven:p*(1+fee/100)/(1-fee/100)},method:VERSION};
 });
}
const api={adjustHistory,analyse,scenarios,backtest,cleanSegment,quantile,median,rsi,today,VERSION};
root.BRVM_ENGINE=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
