/* Prévisions J+1 : toutes les décisions au point t utilisent uniquement les données <= t. */
(function(root){
'use strict';
const VERSION='j1-1.0.0';
const CONFIG=Object.freeze({warmup:30,selection:20,testStart:60,minimum:80,window:80,calibration:60});
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const clamp=(x,l=-.10,h=.10)=>Math.max(l,Math.min(h,x));
function quantile(a,p){if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.max(0,Math.ceil(p*b.length)-1))];}
const median=a=>quantile(a,.5);
const valid=r=>r&&Number.isFinite(r.close)&&r.close>0&&r.volume>0&&!r.suspended&&!r.inconsistent;
const dayGap=(a,b)=>(Date.parse(a)-Date.parse(b))/86400000;
function nextSession(date,closedDates=[]){const closed=new Set(closedDates),d=new Date(date+'T12:00:00Z');do{d.setUTCDate(d.getUTCDate()+1);}while([0,6].includes(d.getUTCDay())||closed.has(d.toISOString().slice(0,10)));return d.toISOString().slice(0,10);}
function normalise(history,symbol,asOf,splits=[]){
 return history.filter(r=>r.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date)).map(r=>{
  const events=splits.filter(s=>s.symbol===symbol&&s.date<=asOf&&r.date<s.date);
  const factor=events.filter(s=>!r.adjustedTo||s.date>r.adjustedTo).reduce((p,s)=>p*s.factor,1);
  return {...r,close:r.close/factor,reference:r.reference/factor,previous:r.previous/factor,opening:r.opening/factor,volume:r.volume*factor};
 });
}
function pairReturn(a,b){
 if(!valid(a)||!valid(b)||dayGap(b.date,a.date)>7||b.date<=a.date)return null;
 // Une référence révisée (détachement, opération non ajustée) exclut seulement cette transition.
 if(a.reference>0&&b.previous>0&&Math.abs(b.previous/a.reference-1)>.02)return null;
 const y=b.close/a.close-1;
 return Math.abs(y)>.16?null:y;
}
function context(data,asOf){
 const out=new Map(),sessions=(data?.sessions||[]).filter(s=>s.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date));
 for(let i=1;i<sessions.length;i++){
  const prior=new Map(sessions[i-1].stocks.map(r=>[r.symbol,r]));
  const values=sessions[i].stocks.map(r=>({symbol:r.symbol,sector:r.sector,value:pairReturn(prior.get(r.symbol),r)})).filter(r=>Number.isFinite(r.value));
  out.set(sessions[i].date,values);
 }
 return {values:out,indices:new Map(sessions.map((s,i)=>[s.date,i]))};
}
function prepare(a,options={}){
 const asOf=a.asOf||a.history.at(-1)?.date;
 const rows=normalise(a.history,a.symbol,asOf,options.fundamentals?.splits||[]);
 const ctx=options.context||context(options.data,asOf),samples=[];let excluded=0;
 const own=rows.map((r,i)=>i?pairReturn(rows[i-1],r):null);
 function features(i){
  const w=rows.slice(Math.max(0,i-19),i+1),past=own.slice(Math.max(1,i-19),i+1).filter(Number.isFinite);
  if(w.length<20||past.length<10||!valid(rows[i]))return null;
  const current=rows[i],vmean=mean(past),vol=Math.sqrt(mean(past.map(v=>(v-vmean)**2)));
  const book=current.orderBook,spread=Number.isFinite(book?.spreadPct)?book.spreadPct:book?.ask>0&&book?.bid>0?(book.ask-book.bid)/((book.ask+book.bid)/2)*100:null;
  const hasBook=!!(book?.usable&&book.date===current.date&&Number.isFinite(book.imbalance)&&Number.isFinite(spread)&&spread>=0);
  const peers=(ctx.values.get(current.date)||[]).filter(r=>r.symbol!==a.symbol);
  const sector=peers.filter(r=>r.sector===current.sector);
  const volumeBase=median(w.map(r=>r.volume).filter(v=>Number.isFinite(v)&&v>0));
  return {x:[(own[i]||0)/.03,mean(past.slice(-5))/.03,vmean/.03,vol/.03,clamp(Math.log(Math.max(1,current.volume)/Math.max(1,volumeBase)),-4,4)/4,past.filter(v=>v===0).length/past.length,
   peers.length>=10?mean(peers.map(r=>r.value))/.03:0,sector.length>=2?mean(sector.map(r=>r.value))/.03:0,peers.length>=10?1:0,sector.length>=2?1:0,
   hasBook?book.imbalance:0,hasBook?clamp(spread/10,0,3):0,hasBook?1:0],hasBook,market:peers.length>=10,sector:sector.length>=2,
   median:median(past),average:vmean,momentum:mean(past.slice(-5)),reversal:-(own[i]||0)*.25};
 }
 for(let i=19;i<rows.length-1;i++){
  const f=features(i),y=pairReturn(rows[i],rows[i+1]);
  const origin=ctx.indices.get(rows[i].date),target=ctx.indices.get(rows[i+1].date);
  const consecutive=origin===undefined||target===undefined||target-origin===1;
  if(!f||!Number.isFinite(y)||!consecutive){excluded++;continue;}
  const sample={...f,y,origin:rows[i].date,date:rows[i+1].date,price:rows[i].close,index:i};samples.push(sample);
 }
 return {asOf,rows,samples,last:rows.at(-1),current:features(rows.length-1),excluded};
}
function solve(matrix,b){
 const a=matrix.map((row,i)=>[...row,b[i]]),n=b.length;
 for(let i=0;i<n;i++){
  let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
  [a[i],a[pivot]]=[a[pivot],a[i]];const d=a[i][i];if(Math.abs(d)<1e-12)return null;
  for(let k=i;k<=n;k++)a[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){const f=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=f*a[i][k];}
 }return a.map(row=>row[n]);
}
function ridge(past,current,dim,lambda){
 const train=past.slice(-CONFIG.window),n=dim+1;
 const mu=Array.from({length:dim},(_,k)=>mean(train.map(s=>s.x[k])));
 const sd=mu.map((m,k)=>Math.max(.05,Math.sqrt(mean(train.map(s=>(s.x[k]-m)**2)))));
 const vec=s=>[1,...s.x.slice(0,dim).map((v,k)=>(v-mu[k])/sd[k])];
 const gram=Array.from({length:n},()=>Array(n).fill(0)),rhs=Array(n).fill(0);
 for(const s of train){const x=vec(s);for(let j=0;j<n;j++){rhs[j]+=x[j]*s.y;for(let k=0;k<n;k++)gram[j][k]+=x[j]*x[k];}}
 for(let j=0;j<n;j++)gram[j][j]+=j?lambda:1e-6;
 const beta=solve(gram,rhs);return beta?clamp(vec(current).reduce((sum,v,k)=>sum+v*beta[k],0)):0;
}
const NAMES=['Cours inchangé','Médiane récente','Moyenne atténuée','Tendance atténuée','Retour partiel','Cours et volumes (régression)','Marché et secteur (régression)','Cours, volumes et limites résiduelles','Combinaison pondérée'];
function candidates(past,current,previous){
 const train=past.slice(-CONFIG.window),books=train.filter(s=>s.hasBook).length;
 const p=[0,current.median*.5,current.average*.5,current.momentum*.5,current.reversal,ridge(train,current,6,40),ridge(train,current,10,60),null,null];
 if(current.hasBook&&books>=30)p[7]=ridge(train,current,13,80);
 const eligible=[0,1,2,3,4,5,6,7].filter(k=>p[k]!==null&&previous.filter(r=>r.p[k]!==null).length>=CONFIG.selection);
 if(eligible.length>=2){const weights=eligible.map(k=>1/(1e-5+mean(previous.slice(-40).filter(r=>r.p[k]!==null).map(r=>Math.abs(r.y-r.p[k])))));p[8]=eligible.reduce((v,k,i)=>v+p[k]*weights[i],0)/weights.reduce((s,v)=>s+v,0);}
 return p.map(v=>v===null?null:clamp(v));
}
function choose(previous,current){
 if(previous.length<CONFIG.selection)return 0;
 const recent=previous.slice(-60);let selected=0,best=mean(recent.map(r=>Math.abs(r.y)));
 for(let k=1;k<NAMES.length;k++){
  if(current[k]===null||recent.some(r=>r.p[k]===null))continue;
  const loss=mean(recent.map(r=>Math.abs(r.y-r.p[k]))),base=mean(recent.map(r=>Math.abs(r.y)));
  const folds=Array.from({length:3},(_,i)=>recent.slice(Math.floor(i*recent.length/3),Math.floor((i+1)*recent.length/3)));
  const wins=folds.filter(f=>mean(f.map(r=>Math.abs(r.y-r.p[k])))<mean(f.map(r=>Math.abs(r.y)))).length;
  if(loss<base*.98&&wins>=2&&loss<best){selected=k;best=loss;}
 }return selected;
}
function radius(past){const scores=past.slice(-CONFIG.calibration).map(r=>Math.abs(r.error));if(scores.length<20)return null;return quantile(scores,Math.min(1,Math.ceil((scores.length+1)*.8)/scores.length));}
function summarize(records){
 if(!records.length)return null;
 const errors=records.map(r=>Math.abs(r.error)),base=records.map(r=>Math.abs(r.y));
 const intervals=records.filter(r=>r.radius!==null);
 const directions=records.filter(r=>r.y!==0&&r.predicted!==0);
 return {n:records.length,mae:mean(errors)*100,maeFcfa:mean(records.map(r=>Math.abs(r.error)*r.price)),baseline:mean(base)*100,baselineFcfa:mean(records.map(r=>Math.abs(r.y)*r.price)),
  gain:mean(base)>0?(1-mean(errors)/mean(base))*100:0,p90:quantile(errors,.9)*100,within05:mean(errors.map(v=>v<=.005?1:0))*100,within1:mean(errors.map(v=>v<=.01?1:0))*100,
  coverage:intervals.length?mean(intervals.map(r=>Math.abs(r.error)<=r.radius?1:0))*100:null,intervalN:intervals.length,
  directionN:directions.length,direction:directions.length?mean(directions.map(r=>Math.sign(r.y)===Math.sign(r.predicted)?1:0))*100:null,
  unchanged:mean(records.map(r=>r.y===0?1:0))*100,start:records[0].date,end:records.at(-1).date};
}
function forecast(a,options={}){
 const prepared=prepare(a,options),{samples,last,current}=prepared;
 const unavailable=reason=>({available:false,reason,version:VERSION,date:last?.date,n:samples.length,excluded:prepared.excluded});
 if(!valid(last)||!current)return unavailable('Dernière clôture échangée ou historique récent insuffisant.');
 if(last.date!==prepared.asOf)return unavailable('La dernière séance de cette action manque dans le bulletin courant.');
 if(samples.length<CONFIG.minimum)return unavailable('Au moins 80 transitions valides sont nécessaires, dont 20 séances réservées à l’évaluation chronologique.');
 const trace=[];
 for(let i=CONFIG.warmup;i<samples.length;i++){
  const s=samples[i],p=candidates(samples.slice(0,i),s,trace),selected=choose(trace,p);
  const predicted=p[selected],r=radius(trace);
  trace.push({...s,p,selected,predicted,error:s.y-predicted,radius:r,test:i>=CONFIG.testStart});
 }
 const tested=trace.filter(r=>r.test),metrics=summarize(tested),predictions=candidates(samples,current,trace),selected=choose(trace,predictions),expectedReturn=predictions[selected],r=radius(trace);
 const target=nextSession(last.date,options.calendar?.closedDates||[]);
 return {available:true,version:VERSION,date:last.date,target,targetConfirmed:false,price:last.close,n:samples.length,tests:tested.length,model:NAMES[selected],modelId:selected,
  expected:last.close*(1+expectedReturn),low:last.close*(1+expectedReturn-r),high:last.close*(1+expectedReturn+r),expectedReturn,
  mae:metrics.mae,maeFcfa:metrics.maeFcfa,baseline:metrics.baseline,coverage:metrics.coverage,better:metrics.gain>5,metrics,
  folds:Array.from({length:3},(_,i)=>summarize(tested.slice(Math.floor(i*tested.length/3),Math.floor((i+1)*tested.length/3)))),
  orderCandidate:current.hasBook&&samples.slice(-CONFIG.window).filter(s=>s.hasBook).length>=30,orderTraining:samples.filter(s=>s.hasBook).length,orderTests:tested.filter(s=>s.hasBook).length,
  book:last.orderBook||null,usesMarket:current.market,usesSector:current.sector,excluded:prepared.excluded,
  candidates:NAMES.map((name,k)=>{const rows=tested.filter(t=>t.p[k]!==null);return {name,n:rows.length,mae:rows.length?mean(rows.map(t=>Math.abs(t.y-t.p[k])))*100:null};}),
  trace:options.trace?trace:undefined};
}
const api={VERSION,CONFIG,forecast,prepare,context,nextSession,normalise,pairReturn,summarize,quantile};
root.BRVM_FORECAST=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
