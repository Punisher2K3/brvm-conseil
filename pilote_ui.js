(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n):'—';
const pct=n=>Number.isFinite(n)?(n>0?'+':'')+fmt(n)+' %':'—';
function card(f){
 return `${f.pilot?.selected?'<p class="pilot-badge">Groupe pilote · suivi renforcé</p>':''}<p class="muted">Situation de l’action : <strong>${esc(f.regime?.label||'Non évaluée')}</strong>.</p>`;
}
function panel(report,options={}){
 const pilot=report.pilot||{members:[],rows:[]},bySymbol=new Map((report.predictions||[]).map(f=>[f.symbol,f])),selected=pilot.members.map(symbol=>bySymbol.get(symbol)).filter(Boolean),study=report.eventStudy||{};
 const currentlyObserved=(report.predictions||[]).filter(f=>(f.events||[]).length>0).length;
 return `<div class="pilot-panel"><div class="pilot-panel-heading"><h3>Groupe pilote : ${selected.length} actions suivies de près</h3><label>Afficher les signaux <select id="signalUniverse"><option value="all" ${options.universe!=='pilot'?'selected':''}>Toutes les actions</option><option value="pilot" ${options.universe==='pilot'?'selected':''}>Groupe pilote uniquement</option></select></label></div>
 <p>Choix sur les 20 dernières séances : échanges lors d’au moins 95 % des séances, montant médian d’au moins 5 millions FCFA, qualité exploitable. Au plus dix titres et trois par secteur. Cette sélection de suivi ne constitue pas une liste d’achats.</p>
 <div class="pilot-chips">${selected.map(f=>'<button type="button" class="pilot-chip" data-forecast-symbol="'+esc(f.symbol)+'">'+esc(f.symbol)+'</button>').join('')||'<p>Aucune action ne remplit actuellement les critères.</p>'}</div>
 <details><summary>Comparer le groupe pilote et les situations</summary><div class="table-wrap"><table><thead><tr><th>Action</th><th>Séances échangées</th><th>Montant médian</th><th>Situation</th></tr></thead><tbody>${selected.map(f=>'<tr><td>'+esc(f.symbol)+'</td><td>'+fmt(f.pilot.activePct,0)+' %</td><td>'+fmt(f.pilot.medianValue,0)+' FCFA</td><td>'+esc(f.regime?.label||'—')+'</td></tr>').join('')}</tbody></table></div><p>Le pilote sera évalué avec la composition enregistrée avant chaque séance. Les tests historiques de chaque action ne constituent pas un test du groupe sélectionné aujourd’hui.</p>
 <p>Les candidats liés à la situation de l’action sont calculés et enregistrés pour comparer leurs résultats futurs. La méthode principale est conservée tant qu’un gain n’est pas confirmé.</p></details>
 <details class="event-study"><summary>Annonces d’entreprise : suivi et apprentissage</summary><p>${currentlyObserved} action(s) avec une annonce récente enregistrée avant la prévision du jour. ${study.exposed||0} prévision(s) avec annonce ont déjà un résultat futur évaluable.</p>
 ${study.categories?.length?'<div class="table-wrap"><table><thead><tr><th>Catégorie</th><th>Observations</th><th>Séances distinctes</th><th>Variation suivante moyenne</th><th>Écart aux témoins comparables</th></tr></thead><tbody>'+study.categories.map(s=>'<tr><td>'+esc(s.category)+'</td><td>'+s.n+'</td><td>'+s.distinctSessions+'</td><td>'+pct(s.meanReturnPct)+'</td><td>'+pct(s.relativeReturnPct)+'</td></tr>').join('')+'</tbody></table></div>':'<p>Les premières mesures arriveront avec les prochaines séances. Aucune influence chiffrée des annonces sur le prix n’est encore validée.</p>'}
 <p>Les premières dates d’observation sont conservées. Les publications anciennes découvertes aujourd’hui et les doublons ne sont pas traités comme de nouvelles annonces indépendantes. Les réactions mesurées sont descriptives, sans preuve de causalité.</p>
 <p>Un candidat « cours + annonces » ne sera calculable qu’avec au moins 30 cas d’annonce antérieurs par catégorie, dix dates distinctes, trois sociétés et 30 observations sans annonce repérée. Il sera enregistré pour comparaison et ne modifiera pas automatiquement le prix publié.</p></details></div>`;
}
const api={panel,card};root.BRVM_PILOT_UI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
