'use strict';
const assert=require('node:assert/strict'),{selectPilot}=require('./pilote.cjs'),news=require('./annonces.cjs'),{updateJournal}=require('./journal_previsions.cjs');
let n=0;function test(name,fn){fn();n++;console.log('OK '+name);}
function pilotFixture(){const symbols=Array.from({length:18},(_,i)=>({symbol:'T'+i,name:'Titre '+i,sector:'S'+Math.floor(i/6)}));
 const sessions=Array.from({length:20},(_,i)=>({date:new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),stocks:symbols.map((s,k)=>({...s,date:new Date(Date.UTC(2026,9,1+i)).toISOString().slice(0,10),close:100,reference:100,previous:100,volume:100,value:30e6-k*1e6}))}));
 return {session:sessions.at(-1).date,sessions};}
test('Pilote : régularité, montants, qualité, diversité et ordre déterministe',()=>{
 const d=pilotFixture(),forecasts=d.sessions.at(-1).stocks.map(r=>({symbol:r.symbol,date:d.session,available:true}));
 const p=selectPilot(d,forecasts);assert.equal(p.members.length,9);assert.ok(p.rows.filter(r=>r.selected).every(r=>r.activePct===100));
 assert.ok([...new Set(p.rows.map(r=>r.sector))].every(s=>p.rows.filter(r=>r.selected&&r.sector===s).length<=3));
 const changed=structuredClone(d);for(const s of changed.sessions)s.stocks.find(r=>r.symbol==='T0').value=null;
 const conflict=forecasts.map(f=>({...f,sourceConflict:f.symbol==='T1'}));
 const q=selectPilot(changed,conflict);assert.ok(!q.members.includes('T0'));assert.ok(!q.members.includes('T1'));
 const sparse=structuredClone(d);for(const s of sparse.sessions.slice(0,2))s.stocks.find(r=>r.symbol==='T2').volume=0;
 assert.ok(!selectPilot(sparse,forecasts).members.includes('T2'));
});
test('Le pilote n’utilise aucune séance future et ne prétend pas backtester la composition actuelle',()=>{
 const d=pilotFixture(),f=d.sessions.at(-1).stocks.map(r=>({symbol:r.symbol,date:d.session,available:true}));
 const future={date:'2099-01-01',stocks:d.sessions.at(-1).stocks.map(r=>({...r,value:1e12}))};
 assert.deepEqual(selectPilot({...d,sessions:[...d.sessions,future]},f,d.session).members,selectPilot(d,f).members);
 assert.equal(selectPilot(d,f.map(r=>({...r,date:'2099-01-01'}))).members.length,0);
});
test('Annonces : date connue, publication récente, doublons et association à la société',()=>{
 const event={title:'SONATEL : Rapport d’activités du troisième trimestre',publishedAt:'2026-11-12',firstSeenAt:'2026-11-12T19:00:00Z',symbols:['SNTS'],url:'https://www.brvm.org/test.pdf'};
 assert.equal(news.exposure([event,{...event,url:'https://www.sikafinance.com/test.pdf'}],'SNTS','2026-11-12T20:00:00Z').length,1);
 assert.equal(news.exposure([{...event,firstSeenAt:'2026-11-13T00:00:00Z'}],'SNTS','2026-11-12T20:00:00Z').length,0);
 assert.equal(news.exposure([{...event,publishedAt:'2026-11-01'}],'SNTS','2026-11-12T20:00:00Z').length,0);
 assert.equal(news.exposure([{...event,firstSeenAt:'date invalide'}],'SNTS','2026-11-12T20:00:00Z').length,0);
 assert.equal(news.exposure([event],'AUTRE','2026-11-12T20:00:00Z').length,0);
 assert.equal(news.category(event.title),'resultats');assert.equal(news.category('Avertissement sur les résultats'),'avertissement');
});
function observedRows(){return Array.from({length:60},(_,i)=>({version:'study',symbol:'T'+i%3,sector:'FIN',eventsTracked:true,originPrice:100,expected:100,events:i<30?[{category:'resultats'}]:[],outcome:{eligible:true,date:'2026-10-'+String(1+i%10).padStart(2,'0'),close:i<30?102:100,returnPct:i<30?2:0}}));}
test('Étude descriptive : témoins, dates distinctes, pas de résultat futur ni d’absence d’annonce inventée',()=>{
 const records=observedRows(),s=news.study({records},'study','2026-11-12');assert.equal(s.exposed,30);assert.equal(s.categories[0].readyForResearch,true);
 assert.equal(news.study({records:records.map(r=>({...r,eventsTracked:false}))},'study','2026-11-12').observed,0);
 assert.equal(news.study({records:records.map(r=>({...r,outcome:{...r.outcome,date:'2099-01-01'}}))},'study','2026-11-12').observed,0);
 assert.equal(news.study({records:records.map(r=>({...r,outcome:{...r.outcome,date:'2026-10-01'}}))},'study','2026-11-12').categories[0].readyForResearch,false);
});
test('Le candidat annonces ne modifie jamais la prévision principale',()=>{
 const f={available:true,date:'2026-11-12',price:100,expected:100},j={records:observedRows()};
 const c=news.newsChallenger(f,[{category:'resultats'}],j,'study');assert.equal(c.available,true);assert.equal(c.expected,101);assert.equal(f.expected,100);
 assert.equal(news.newsChallenger(f,[{category:'resultats'}],{records:j.records.slice(0,12)},'study').available,false);
});
test('Résultat futur et conservation de l’exposition initiale',()=>{
 const data={sessions:[{date:'2026-11-12',stocks:[{symbol:'T',date:'2026-11-12',close:100,reference:100,previous:100,volume:100}]}]};
 const f={symbol:'T',sector:'IND',date:'2026-11-12',target:'2026-11-13',available:true,price:100,expected:105,low:95,high:110,pilot:{selected:true},eventsTracked:true,events:[{category:'resultats'}]};
 const first=updateJournal(null,data,[f],'2026-11-12T20:00:00Z','hash');
 const again=updateJournal(first,data,[{...f,events:[]}],'2026-11-12T21:00:00Z','autre');assert.equal(again.records[0].events.length,1);
 const actual={...data,sessions:[...data.sessions,{date:'2026-11-13',stocks:[{symbol:'T',date:'2026-11-13',previous:100,reference:105,opening:104,close:105,volume:100}]}]};
 const scored=updateJournal(first,actual,[],'2026-11-13T20:00:00Z','hash');
 assert.equal(scored.records[0].outcome.returnPct,5.000000000000004);
 assert.ok(!('openToCloseNetPct' in scored.records[0].outcome));
 assert.ok(!('executionHypotheses' in first.records[0]));
 assert.equal(scored.records[0].pilotMember,true);
});
test('Les nouvelles méthodes restent des candidats, avec probabilités finies et échappement HTML',()=>{
 const model=require('./previsions.js'),direction=require('./signaux.js');let value=100;
 const history=Array.from({length:180},(_,i)=>{const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),previous=value;value*=1+.005*Math.sin(i);return {date,close:value,reference:value,previous,volume:100+i%20};});
 const a={symbol:'T',asOf:history.at(-1).date,history},f=model.forecast(a),s=direction.forecast(model.prepare(a));assert.ok(f.modelId<10);assert.equal(f.nextCandidates.length,12);assert.equal(s.experiment.status,'candidate');
 assert.ok(Math.abs(Object.values(s.experiment.probabilities).reduce((a,b)=>a+b,0)-100)<1e-10);
 const ui=require('./pilote_ui.js'),html=ui.panel({pilot:{members:['T'],rows:[]},predictions:[{symbol:'T',pilot:{activePct:100,medianValue:1e7},regime:{label:'<script>'},available:false}]});
 assert.ok(!html.includes('<script>'));assert.match(html,/Groupe pilote/);assert.match(html,/Annonces d’entreprise/);assert.doesNotMatch(html,/signalFee|signalSlippage|Net central simulé|execution-reading/);
 const fs=require('node:fs');assert.match(fs.readFileSync('index.html','utf8'),/id="fee"/);assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/src="decision.js"/);
});
console.log(n+' contrôles du pilote et des annonces réussis.');
