'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const m=require('./previsions.js');
let count=0;function test(name,fn){fn();count++;console.log('OK '+name);}
function fixture(n=190){
 let price=1000;
 return Array.from({length:n},(_,i)=>{
  const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),previous=price;
  price*=1+.005*Math.sin(i*.7);
  return {symbol:'TEST',sector:'FIN',date,previous,reference:price,close:price,opening:previous,volume:100+i%13,
   orderBook:{date,usable:true,imbalance:Math.sin(i),spreadPct:1,bid:price*.99,ask:price*1.01}};
 });
}
const rows=fixture(),run=(history=rows,options={})=>m.forecast({symbol:'TEST',history,asOf:history.at(-1).date},{trace:true,...options});
test('Prévisions finies, intervalles et métriques sur les mêmes séances',()=>{const f=run();assert.ok(f.available);assert.ok(f.tests>=20);assert.ok(f.low<=f.expected&&f.expected<=f.high);assert.equal(f.metrics.n,f.metrics.intervalN);assert.ok(Number.isFinite(f.metrics.maeFcfa));});
test('Aucune cible future ne modifie les prévisions ou leur sélection',()=>{
 const full=run(),prefix=run(rows.slice(0,150));
 const observed=full.trace.find(t=>t.origin===prefix.date);
 assert.ok(Math.abs(observed.predicted-prefix.expectedReturn)<1e-12);assert.equal(observed.selected,prefix.modelId);
 assert.ok(Math.abs(observed.radius-(prefix.high-prefix.expected)/prefix.price)<1e-12);
 const extreme=rows.map((r,i)=>i<150?r:{...r,close:r.close*10,reference:r.reference*10,previous:r.previous*10,volume:1e9,orderBook:{...r.orderBook,imbalance:1}});
 const changed=run(extreme).trace.filter(t=>t.origin<prefix.date);
 assert.deepEqual(changed.map(t=>[t.origin,t.predicted,t.selected,t.radius]),full.trace.filter(t=>t.origin<prefix.date).map(t=>[t.origin,t.predicted,t.selected,t.radius]));
});
test('Le contexte est borné à la date demandée',()=>{
 const data={sessions:rows.map(r=>({date:r.date,stocks:[r,...Array.from({length:12},(_,i)=>({...r,symbol:'PEER'+i}))]}))};
 const short=rows.slice(0,140),asOf=short.at(-1).date;
 const a=m.forecast({symbol:'TEST',asOf,history:short},{data});
 const b=m.forecast({symbol:'TEST',asOf,history:rows},{data:{sessions:data.sessions.map(s=>s.date>asOf?{...s,stocks:[]}:s)}});
 assert.equal(a.expected,b.expected);assert.equal(a.model,b.model);
});
test('Un changement de dividende publié ne supprime pas l’historique',()=>{
 const changed=rows.map((r,i)=>({...r,dividendDate:i<150?'2024-06-01':'2025-06-01'}));assert.equal(run(changed).n,run().n);
});
test('Une référence révisée exclut une seule transition',()=>{
 const changed=rows.map((r,i)=>i===100?{...r,previous:r.previous*.9}:r);assert.equal(run(changed).n,run().n-1);
});
test('Fractionnement : cours et volumes cohérents, pas de rendement fictif',()=>{
 const splitDate=rows[100].date,splits=[{symbol:'TEST',date:splitDate,factor:10}];
 const split=rows.map((r,i)=>i<100?{...r,close:r.close*10,previous:r.previous*10,reference:r.reference*10,opening:r.opening*10,volume:r.volume/10}:r);
 const original=run(),adjusted=run(split,{fundamentals:{splits}});
 assert.ok(Math.abs(original.expected-adjusted.expected)<1e-7);assert.equal(original.n,adjusted.n);
 const normal=m.normalise(split,'TEST',rows.at(-1).date,splits);
 const again=m.normalise(normal.map(r=>({...r,adjustedTo:rows.at(-1).date})),'TEST',rows.at(-1).date,splits);
 assert.deepEqual(again.map(r=>r.close),normal.map(r=>r.close));
});
test('Carnets manquants, futurs ou croisés exclus',()=>{
 for(const book of [undefined,{date:'2099-01-01',usable:true,imbalance:1,spreadPct:1},{date:rows.at(-1).date,usable:true,imbalance:1,spreadPct:-1}]){
  const changed=rows.map(r=>({...r,orderBook:book}));assert.equal(run(changed).orderCandidate,false);
 }
});
test('Un intervalle sans séance observée ne devient pas une cible J+1',()=>{
 const history=rows.filter((_,i)=>i!==100),data={sessions:rows.map(r=>({date:r.date,stocks:[r]}))};
 const p=m.prepare({symbol:'TEST',asOf:history.at(-1).date,history},{data});
 assert.ok(!p.samples.some(s=>s.origin===rows[99].date&&s.date===rows[101].date));
});
test('Sans échange, suspension et historique court restent indisponibles',()=>{
 assert.equal(run(rows.slice(0,50)).available,false);
 assert.equal(run(rows.map((r,i)=>i===rows.length-1?{...r,volume:0}:r)).available,false);
 assert.equal(run(rows.map((r,i)=>i===rows.length-1?{...r,suspended:true}:r)).available,false);
});
test('Une série constante ne crée pas un faux gain prédictif',()=>{
 const constant=rows.map(r=>({...r,close:1000,reference:1000,previous:1000})),f=run(constant);
 assert.equal(f.expected,1000);assert.equal(f.metrics.mae,0);assert.equal(f.metrics.gain,0);assert.equal(f.better,false);
});
test('Week-ends et fermetures configurées',()=>{
 assert.equal(m.nextSession('2026-11-06'),'2026-11-09');assert.equal(m.nextSession('2026-11-06',['2026-11-09']),'2026-11-10');
});
test('Rapport précalculé périmé ignoré',()=>{
 const c={window:{BRVM_FORECAST_REPORT:{version:m.VERSION,asOf:rows.at(-1).date,dataRevision:'ancienne',predictions:[{symbol:'TEST',available:true,expected:999999}]},BRVM_DATA:{revision:'nouvelle'}},Intl,Date};vm.createContext(c);
 for(const name of ['moteur.js','previsions.js','fiche_fondamentale.js'])vm.runInContext(fs.readFileSync(name,'utf8'),c);
 const f=c.window.BRVM_DEEP_UI.forecastNextClose({symbol:'TEST',asOf:rows.at(-1).date,history:rows,verdict:'À surveiller'});assert.notEqual(f.expected,999999);
});
console.log(count+' contrôles J+1 réussis.');
