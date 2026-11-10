
const assert=require('node:assert/strict');
const {value,compare,gordon}=require('./valorisations.js');
assert.equal(gordon(100,.12,.02),1020.0000000000001);
assert.equal(gordon(100,.02,.03),null);
function stock(symbol,price,eps,sector='TEL'){
 return {symbol,name:symbol,sector,asOf:'2026-11-09',reference:price,verdict:'À surveiller',metrics:{yieldNet:4,turnover:1000000},deep:{
 annual:{periodEnd:'2025-12-31',published:'2026-04-01',profit:1000,scope:'Comptes sociaux',equity:10000},eps,
 equity:10000,roe:15,earningsGrowth:10,operatingMargin:20,debtEquity:.2,banking:sector==='FIN',
 capitalisationSnapshot:{shares:100,session:'2026-11-09'},
 dividends:[{year:2025,net:50},{year:2024,net:50},{year:2023,net:50}]
 }};}
const a=stock('A',1000,100),b=stock('B',1200,100),c=stock('C',1400,100),all=[a,b,c];
let v=value(a,all);
assert.equal(v.methods.find(x=>x.id==='per').values[1].value,1300);
assert.equal(v.methods.find(x=>x.id==='book').available,true);
assert.equal(v.methods.find(x=>x.id==='fcfe').available,false);
assert.equal(v.methods.find(m=>m.id==='quotedPer').available,false);
assert.ok(v.central>0); assert.ok(v.totals[0].value<=v.central&&v.central<=v.totals[2].value);
const higherRate=value(a,all,{}, {r:.16,g:.03});
assert.ok(higherRate.methods.find(x=>x.id==='ddm').values[1].value<v.methods.find(x=>x.id==='ddm').values[1].value);
const incomplete=stock('X',1000,null);incomplete.deep.dividends[1].net=null;
v=value(incomplete,[incomplete]);
assert.equal(v.central,null);assert.equal(v.methods.find(m=>m.id==='ddm').available,false);
const suspended={...a,verdict:'Avis suspendu'};
assert.equal(value(suspended,all).count,0);
assert.match(compare(suspended,b).conclusion,/suspendue/);
assert.match(compare(a,{...b,sector:'IND'}).conclusion,/même secteur/);
const incompatible=stock('D',1200,100);incompatible.deep.annual.periodEnd='2024-12-31';
assert.ok(compare(a,incompatible).n<3);
const winner=stock('W',800,100);winner.deep.roe=25;winner.deep.earningsGrowth=30;
assert.match(compare(winner,b).conclusion,/W présente/);
const consolidated=stock('G',1000,100);consolidated.deep.annual.scope='Groupe consolidé';
assert.equal(value(consolidated,[consolidated,b,c]).methods.find(m=>m.id==='book').available,false);
const future=stock('F',1000,100);future.deep.capitalisationSnapshot.session='2026-11-10';
assert.equal(value(future,[future,b,c]).methods.find(m=>m.id==='book').available,false);
const bank=stock('BANK',1000,100,'FIN');
assert.equal(compare(bank,{...bank,symbol:'BANK2'}).criteria.find(r=>r.label.includes('Dette')).comparable,false);
assert.equal(value(a,all).methods.find(m=>m.id==='ddm').available,true);
assert.equal(a.deep.dividends[0].net,50); // Aucun fait financier modifié.
const aa=stock('AA',1000,100),bb=stock('BB',1200,100),cc=stock('CC',1400,100);bb.per=12;cc.per=14;
aa.deep.capitalisationSnapshot=null;aa.deep.dividends=[];
const duplicate=value(aa,[aa,bb,cc]);
assert.equal(duplicate.count,2);assert.equal(duplicate.central,null);
console.log('Valorisations : scénarios, taux, données manquantes, périmètres, dates et comparaison vérifiés.');
