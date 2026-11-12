'use strict';
const model=require('./previsions.js');
function updateJournal(previous,data,predictions,recordedAt,inputSha256){
 const journal=JSON.parse(JSON.stringify(previous||{version:1,records:[]})),today=recordedAt.slice(0,10);
 const sessions=[...data.sessions].sort((a,b)=>a.date.localeCompare(b.date));
 for(const record of journal.records){
  if(record.outcome)continue;
  const next=sessions.find(s=>s.date>record.origin);if(!next)continue;
  const origin=sessions.find(s=>s.date===record.origin)?.stocks.find(s=>s.symbol===record.symbol);
  const actual=next.stocks.find(s=>s.symbol===record.symbol),y=model.pairReturn(origin,actual);
  const timely=record.recordedAt<next.date+'T00:00:00.000Z',eligible=timely&&Number.isFinite(y);
  record.outcome={date:next.date,close:actual?.close??null,eligible,reason:eligible?null:!timely?'Enregistrement trop tardif':'Séance non échangée, incohérente ou référence modifiée',error:eligible?actual.close-record.expected:null};
 }
 for(const f of predictions){
  if(!f.available||f.target<=today||f.date>today)continue;
  const id=[f.symbol,f.date,model.VERSION].join('|');if(journal.records.some(r=>r.id===id))continue;
  journal.records.push({id,symbol:f.symbol,origin:f.date,targetIndicative:f.target,recordedAt,version:model.VERSION,inputSha256,model:f.model,expected:f.expected,low:f.low,high:f.high});
 }
 return journal;
}
module.exports={updateJournal};
