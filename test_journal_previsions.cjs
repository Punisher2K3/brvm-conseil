'use strict';
const assert=require('node:assert/strict'),{updateJournal}=require('./journal_previsions.cjs');
const price=(date,close,previous,volume=100)=>({symbol:'TEST',date,close,reference:close,previous,volume});
const data={sessions:[{date:'2026-11-12',stocks:[price('2026-11-12',100,99)]}]};
const forecast={symbol:'TEST',date:'2026-11-12',target:'2026-11-13',available:true,expected:101,low:95,high:107,model:'Test'};
const original=updateJournal(null,data,[forecast],'2026-11-12T20:00:00.000Z','a');
assert.equal(original.records.length,1);
const again=updateJournal(original,data,[{...forecast,expected:999}],'2026-11-12T21:00:00.000Z','b');
assert.equal(again.records[0].expected,101);assert.equal(again.records[0].inputSha256,'a');assert.equal(again.records[0].recordedAt,'2026-11-12T20:00:00.000Z');
const stale=updateJournal(null,data,[forecast],'2026-11-13T20:00:00.000Z','a');assert.equal(stale.records.length,0);
// Le prochain jour effectivement observé remplace une date indicative tombant un jour fermé.
const actual={sessions:[...data.sessions,{date:'2026-11-16',stocks:[price('2026-11-16',102,100)]}]};
const settled=updateJournal(original,actual,[],'2026-11-16T20:00:00.000Z','a');
assert.equal(settled.records[0].outcome.date,'2026-11-16');assert.equal(settled.records[0].outcome.error,1);assert.equal(settled.records[0].outcome.eligible,true);assert.equal(original.records[0].outcome,undefined);
const late=JSON.parse(JSON.stringify(original));late.records[0].recordedAt='2026-11-16T12:00:00.000Z';assert.equal(updateJournal(late,actual,[],'2026-11-16T20:00:00.000Z','a').records[0].outcome.eligible,false);
const revised={sessions:[...data.sessions,{date:'2026-11-13',stocks:[price('2026-11-13',10,10)]}]};assert.equal(updateJournal(original,revised,[],'2026-11-13T20:00:00.000Z','a').records[0].outcome.eligible,false);
console.log('Journal : non-réécriture, absence de prévisions rétroactives, dates effectives et exclusions vérifiées.');
