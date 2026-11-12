(function(root){
'use strict';
function expectedSession(at,calendar={}){
 const d=new Date(at),closed=new Set(calendar.closedDates||[]);
 if(d.getUTCHours()<18)d.setUTCDate(d.getUTCDate()-1);
 while([0,6].includes(d.getUTCDay())||closed.has(d.toISOString().slice(0,10)))d.setUTCDate(d.getUTCDate()-1);
 return d.toISOString().slice(0,10);
}
function label(status,at=new Date(),calendar={}){
 const expected=expectedSession(at,calendar),late=status.session<expected;
 const checked=status.lastSuccessfulCollection||status.checkedAt;
 const old=checked&&Date.parse(at)-Date.parse(checked)>30*3600000;
 const state=late||old?'stale':status.collectionState==='degraded'?'degraded':'ok';
 let text='Actualisation automatique sur GitHub, même quand votre ordinateur est éteint. Dernier bulletin : '+status.session+'.';
 if(checked)text+=' Dernière vérification : '+new Date(checked).toLocaleString('fr-FR',{timeZone:'Africa/Abidjan'})+' (Abidjan).';
 if(state==='stale')text+=' Données à actualiser : le dernier bulletin attendu ou la dernière vérification manque. Les estimations doivent être revérifiées.';
 else if(state==='degraded')text+=' Certaines sources sont indisponibles ; les dernières données valides sont conservées.';
 return {state,text,expected};
}
const api={label,expectedSession};root.BRVM_UPDATE_HEALTH=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
