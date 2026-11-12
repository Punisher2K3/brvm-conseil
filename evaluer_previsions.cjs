'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const model=require('./previsions.js');
const directions=require('./signaux.js'),{reconcile,eventsFor,extendHistory}=require('./rapprocher_sources.cjs');
const data=JSON.parse(fs.readFileSync('base-marche.json','utf8'));
const fundamentals=JSON.parse(fs.readFileSync('fondamentaux.json','utf8'));
const supplement=fs.existsSync('sources-complementaires.json.gz')?JSON.parse(zlib.gunzipSync(fs.readFileSync('sources-complementaires.json.gz'))):{};
const sources=reconcile(data,fundamentals,supplement);
const generatedAt=new Date().toISOString(),today=generatedAt.slice(0,10),asOf=data.session;
const ctx=model.context(data,asOf),predictions=[];
for(const stock of data.sessions.at(-1).stocks){
 const extended=extendHistory(data,fundamentals,supplement,stock.symbol,sources),history=extended.history;
 const a={symbol:stock.symbol,asOf,history},options={data,fundamentals,context:ctx,bars:sources.bars};
 const f=model.forecast(a,options);
 const signal=f.available?directions.forecast(model.prepare(a,options)):{available:false,reason:f.reason};
 const currentConflict=sources.conflicts.some(c=>c.symbol===stock.symbol&&c.date===asOf);
 if(currentConflict&&signal.available){signal.direction='uncertain';signal.label='Signal suspendu : sources divergentes';signal.support='blocked';}
 predictions.push({symbol:stock.symbol,name:stock.name,...f,signal,secondaryHistory:extended.added,trainingStart:history[0]?.date,recentEvents:eventsFor(supplement,stock.symbol,asOf),sourceConflict:currentConflict});
}
const inputHash=crypto.createHash('sha256');for(const name of ['base-marche.json','fondamentaux.json','previsions.js','signaux.js','sources-complementaires.json.gz'])if(fs.existsSync(name))inputHash.update(name).update(fs.readFileSync(name));
const report={version:model.VERSION,generatedAt,asOf,dataRevision:data.revision||data.fetched,inputSha256:inputHash.digest('hex'),
 sessions:data.sessions.length,firstSession:data.sessions[0].date,sourceSummary:sources.summary,sourceConflicts:sources.conflicts.slice(-200),scope:'Clôture de la prochaine séance avec échange valide ; transitions révisées et séances sans transaction exclues du test.',predictions};
const readJournal=()=>fs.existsSync('previsions-journal.json')?JSON.parse(fs.readFileSync('previsions-journal.json','utf8')):{version:1,records:[]};
const {updateJournal}=require('./journal_previsions.cjs');
const settled=updateJournal(readJournal(),data,[],generatedAt,report.inputSha256);
const previousMonitoring=require('./suivi_previsions.cjs').monitoring(settled,model.VERSION);
for(const f of predictions){
 const recorded=settled.records.find(r=>r.version===model.VERSION&&r.origin===f.date&&r.symbol===f.symbol);
 if(recorded&&f.available){
  for(const key of ['expected','low','high','model'])f[key]=recorded[key];
  f.capturedAt=recorded.recordedAt;f.capturedInputSha256=recorded.inputSha256;f.expectedReturn=f.expected/f.price-1;f.modelId=f.candidates.findIndex(c=>c.name===f.model);
  if(recorded.signal&&f.signal?.available){f.signal={...f.signal,...recorded.signal};f.signal.label=f.signal.direction==='up'?'Hausse envisagée':f.signal.direction==='down'?'Baisse envisagée':'Signal incertain';}
 }
 if(f.sourceConflict&&f.signal?.available){f.signal.direction='uncertain';f.signal.label='Signal suspendu : sources divergentes';f.signal.support='blocked';}
}
for(const f of predictions)if(previousMonitoring.degrading.includes(f.symbol)&&f.signal?.available){f.signal.direction='uncertain';f.signal.label='Signal suspendu : erreurs récentes en hausse';f.signal.support='blocked';}
const journal=updateJournal(settled,data,predictions,generatedAt,report.inputSha256);
report.continuous=require('./suivi_previsions.cjs').monitoring(journal,model.VERSION);
const currentRecords=journal.records.filter(r=>r.version===model.VERSION),prospective=currentRecords.filter(r=>r.outcome?.eligible);
const directional=prospective.filter(r=>['up','down'].includes(r.signal?.direction)&&r.outcome.direction);
report.prospective={version:model.VERSION,recorded:currentRecords.length,scored:prospective.length,maeFcfa:prospective.length?prospective.reduce((s,r)=>s+Math.abs(r.outcome.error),0)/prospective.length:null,
 directionalCount:directional.length,directionalHits:directional.filter(r=>r.signal.direction===r.outcome.direction).length};
const signaled=predictions.filter(f=>f.signal?.available&&f.signal.direction!=='uncertain');
report.monitoring={status:report.continuous.distinctSessions>=30?'monitoring':'collecting',message:report.continuous.message,
 signals:signaled.length,up:signaled.filter(f=>f.signal.direction==='up').length,down:signaled.filter(f=>f.signal.direction==='down').length,validated:signaled.filter(f=>f.signal.support==='historical').length,
 policy:'Révision quotidienne des erreurs, des scores de Brier et de la couverture ; un changement de version impose une nouvelle période prospective. Aucun passage automatique à un modèle modifié sans comparaison chronologique.'};
function write(name,value){const tmp=name+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,name);}
write('previsions-calcul.json',report);write('previsions-journal.json',journal);
write('sources-complementaires.json',supplement);
fs.writeFileSync('previsions-calcul.js','window.BRVM_FORECAST_REPORT = '+JSON.stringify(report)+';\n');
const available=predictions.filter(f=>f.available);
console.log(JSON.stringify({asOf,sessions:report.sessions,available:available.length,total:predictions.length,measuredBetter:available.filter(f=>f.better).length,prospective:report.prospective,
 sample:available.filter(f=>['SNTS','ORAC','ETIT'].includes(f.symbol)).map(f=>({symbol:f.symbol,target:f.target,expected:f.expected,model:f.model,metrics:f.metrics}))},null,2));
