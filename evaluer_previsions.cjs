'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const model=require('./previsions.js');
const data=JSON.parse(fs.readFileSync('base-marche.json','utf8'));
const fundamentals=JSON.parse(fs.readFileSync('fondamentaux.json','utf8'));
const generatedAt=new Date().toISOString(),today=generatedAt.slice(0,10),asOf=data.session;
const ctx=model.context(data,asOf),predictions=[];
for(const stock of data.sessions.at(-1).stocks){
 const history=data.sessions.map(s=>s.stocks.find(r=>r.symbol===stock.symbol)).filter(Boolean);
 const f=model.forecast({symbol:stock.symbol,asOf,history},{data,fundamentals,context:ctx});
 predictions.push({symbol:stock.symbol,name:stock.name,...f});
}
const report={version:model.VERSION,generatedAt,asOf,dataRevision:data.revision||data.fetched,inputSha256:crypto.createHash('sha256').update(fs.readFileSync('base-marche.json')).digest('hex'),
 sessions:data.sessions.length,firstSession:data.sessions[0].date,scope:'Clôture de la prochaine séance avec échange valide ; transitions révisées et séances sans transaction exclues du test.',predictions};
const readJournal=()=>fs.existsSync('previsions-journal.json')?JSON.parse(fs.readFileSync('previsions-journal.json','utf8')):{version:1,records:[]};
const {updateJournal}=require('./journal_previsions.cjs');
const journal=updateJournal(readJournal(),data,predictions,generatedAt,report.inputSha256);
const prospective=journal.records.filter(r=>r.outcome?.eligible);
report.prospective={recorded:journal.records.length,scored:prospective.length,maeFcfa:prospective.length?prospective.reduce((s,r)=>s+Math.abs(r.outcome.error),0)/prospective.length:null};
function write(name,value){const tmp=name+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,name);}
write('previsions-calcul.json',report);write('previsions-journal.json',journal);
fs.writeFileSync('previsions-calcul.js','window.BRVM_FORECAST_REPORT = '+JSON.stringify(report)+';\n');
const available=predictions.filter(f=>f.available);
console.log(JSON.stringify({asOf,sessions:report.sessions,available:available.length,total:predictions.length,measuredBetter:available.filter(f=>f.better).length,prospective:report.prospective,
 sample:available.filter(f=>['SNTS','ORAC','ETIT'].includes(f.symbol)).map(f=>({symbol:f.symbol,target:f.target,expected:f.expected,model:f.model,metrics:f.metrics}))},null,2));
