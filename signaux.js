/* Trois issues : baisse, stabilité relative (±0,5 %), hausse. Validation dans l'ordre du temps. */
(function(root){
'use strict';
const VERSION='direction-2.1.0',THRESHOLD=.005;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const label=y=>y< -THRESHOLD?0:y>THRESHOLD?2:1;
const brier=(p,y)=>p.reduce((s,v,k)=>s+(v-(k===y?1:0))**2,0);
function frequencies(train){const counts=[1,1,1];for(const s of train)counts[label(s.y)]++;return counts.map(v=>v/(train.length+3));}
function neighbors(train,current,base){
 const dim=current.x.length;
 const mu=Array.from({length:dim},(_,k)=>mean(train.map(s=>s.x[k])));
 const sd=mu.map((v,k)=>Math.max(.1,Math.sqrt(mean(train.map(s=>(s.x[k]-v)**2)))));
 const neighbors=train.map(s=>({s,d:s.x.reduce((sum,v,k)=>sum+((v-current.x[k])/sd[k])**2,0)/dim})).sort((a,b)=>a.d-b.d).slice(0,25);
 const counts=base.map(p=>p*20);let mass=20;
 for(const {s,d} of neighbors){const weight=1/(1+d);counts[label(s.y)]+=weight;mass+=weight;}
 return counts.map(v=>v/mass);
}
function probabilities(past,current){
 const train=past.slice(-100),base=frequencies(train),same=past.slice(-240).filter(s=>s.regime===current.regime).slice(-100);
 return {base,conditional:neighbors(train,current,base),regimeConditional:same.length>=40?neighbors(same,current,frequencies(same)):null};
}
function picked(p){
 const direction=p[2]>=p[0]?2:0,other=direction===2?0:2;
 return p[direction]>=.45&&p[direction]-Math.max(p[1],p[other])>=.10?direction:null;
}
function wilson(k,n){if(!n)return null;const z=1.96,p=k/n,d=1+z*z/n;return (p+z*z/(2*n)-z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/d;}
function select(trace,regime,current){
 const same=trace.slice(-100).filter(r=>r.regime===regime),rows=(same.length>=24?same:trace).slice(-40);if(rows.length<20)return 0;
 const base=mean(rows.map(r=>r.baseLoss));let selected=0,best=base*.98;
 const conditional=mean(rows.map(r=>r.conditionalLoss));if(conditional<best){selected=1;best=conditional;}
 if(current.regimeConditional&&rows.every(r=>r.regimeLoss!==null)){const loss=mean(rows.map(r=>r.regimeLoss));if(loss<best)selected=2;}
 return selected;
}
function incumbent(trace){const rows=trace.slice(-40);return rows.length>=20&&mean(rows.map(r=>r.conditionalLoss))<mean(rows.map(r=>r.baseLoss))*.98?1:0;}
function metrics(rows){
 const signals=rows.filter(r=>r.pick!==null),hits=signals.filter(r=>r.pick===r.actual).length;
 const baseLoss=mean(rows.map(r=>r.baseLoss)),loss=mean(rows.map(r=>r.loss));
 const baselineHits=signals.filter(r=>r.base.indexOf(Math.max(...r.base))===r.actual).length;
 const bins=Array.from({length:5},(_,i)=>rows.filter(r=>Math.min(4,Math.floor(Math.max(...r.p)*5))===i));
 const calibration=rows.length?bins.reduce((sum,bin)=>sum+(bin.length?bin.length*Math.abs(mean(bin.map(r=>Math.max(...r.p)))-mean(bin.map(r=>r.p.indexOf(Math.max(...r.p))===r.actual?1:0))):0),0)/rows.length:null;
 return {n:rows.length,brier:loss,baselineBrier:baseLoss,skill:baseLoss>0?(1-loss/baseLoss)*100:0,signals:signals.length,hits,precision:signals.length?hits/signals.length*100:null,
  majorityPrecision:signals.length?baselineHits/signals.length*100:null,lower95:wilson(hits,signals.length),calibrationError:calibration===null?null:calibration*100,
  sides:[0,2].map(side=>{const s=signals.filter(r=>r.pick===side),h=s.filter(r=>r.actual===side).length;return {side,n:s.length,hits:h,precision:s.length?h/s.length*100:null,lower95:wilson(h,s.length)};})};
}
function forecast(prepared,options={}){
 const {samples,current,last}=prepared;
 if(!current||samples.length<80)return {available:false,version:VERSION,reason:'Historique insuffisant pour tester un signal directionnel.'};
 const trace=[];
 for(let i=40;i<samples.length;i++){
  const s=samples[i],pred=probabilities(samples.slice(0,i),s),selected=incumbent(trace),p=[pred.base,pred.conditional][selected],alternative=select(trace,s.regime,pred),actual=label(s.y);
  const experiment=[pred.base,pred.conditional,pred.regimeConditional][alternative];
  trace.push({origin:s.origin,date:s.date,regime:s.regime,p,base:pred.base,pick:picked(p),actual,baseLoss:brier(pred.base,actual),conditionalLoss:brier(pred.conditional,actual),regimeLoss:pred.regimeConditional?brier(pred.regimeConditional,actual):null,experimentLoss:brier(experiment,actual),loss:brier(p,actual),test:i>=60});
 }
 const test=trace.filter(r=>r.test),score=metrics(test),pred=probabilities(samples,current),selected=incumbent(trace),p=[pred.base,pred.conditional][selected],pick=picked(p);
 const alternative=select(trace,current.regime,pred),experiment=[pred.base,pred.conditional,pred.regimeConditional][alternative];
 const side=score.sides.find(s=>s.side===pick);
 const supported=pick!==null&&side.n>=30&&side.lower95>.5&&score.skill>0&&score.precision>score.majorityPrecision;
 return {available:true,version:VERSION,date:last.date,thresholdPct:THRESHOLD*100,probabilities:{down:p[0]*100,stable:p[1]*100,up:p[2]*100},
  direction:pick===2?'up':pick===0?'down':'uncertain',label:pick===2?'Hausse envisagée':pick===0?'Baisse envisagée':'Signal incertain',
  support:supported?'historical':'fragile',model:['Fréquences récentes régularisées','Voisins historiques régularisés','Voisins de situation comparable'][selected],metrics:score,
  experiment:{name:'Direction selon la situation (candidat)',probabilities:{down:experiment[0]*100,stable:experiment[1]*100,up:experiment[2]*100},brier:mean(test.map(t=>t.experimentLoss)),incumbentBrier:score.brier,status:'candidate'},
  recent:metrics(test.slice(-20)),trace:options.trace?trace:undefined};
}
const api={VERSION,THRESHOLD,label,probabilities,picked,metrics,forecast};root.BRVM_DIRECTION=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
