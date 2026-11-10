
'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c={window:{},Intl,Date}; vm.createContext(c);
for(const name of ['moteur.js','fiche_fondamentale.js'])vm.runInContext(fs.readFileSync(name,'utf8'),c);
const api=c.window.BRVM_DEEP_UI;
assert.equal(api.nextWeekday('2026-11-06'),'2026-11-09');
assert.equal(api.nextWeekday('2026-11-09'),'2026-11-10');
function sample(n){
 let price=1000;
 return Array.from({length:n},(_,i)=>{
  const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);
  const previous=price; price*=1+(.002*Math.sin(i));
  return {date,close:price,reference:price,previous,volume:100,orderBook:{date,usable:true,imbalance:Math.sin(i+1),bid:price-1,ask:price+1,bidQuantity:20,askQuantity:10,page:11,source:'https://www.brvm.org/test.pdf'}};
 });
}
const a={history:sample(160),asOf:'2025-06-09',verdict:'À surveiller'};
const f=api.forecastNextClose(a);
assert.equal(f.available,true); assert.ok(Number.isFinite(f.expected));assert.equal(f.orderCandidate,true);
assert.ok(f.low<=f.high);assert.ok(f.tests>30);
assert.equal(api.forecastNextClose({...a,history:a.history.slice(0,50)}).available,false);
assert.equal(api.forecastNextClose({...a,verdict:'Avis suspendu'}).available,false);
const missing=sample(160).map(r=>({...r,orderBook:undefined}));
assert.equal(api.forecastNextClose({...a,history:missing}).orderCandidate,false);
assert.match(api.renderForecast(a),/Prévision de fin de cotation/);
assert.match(api.renderForecast(a),/échéance est passée/);
// Le premier tiers ne doit pas être équipé d'un faux carnet récent.
const sparse=sample(160).map((r,i)=>i<135?{...r,orderBook:undefined}:r);
assert.equal(api.forecastNextClose({...a,history:sparse}).orderCandidate,false);
console.log('Prévisions : dates, insuffisance, suspensions, carnets incomplets, fourchettes et affichage vérifiés.');
