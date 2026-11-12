(function(root){
'use strict';
const execution=root.BRVM_EXECUTION||(typeof require==='function'?require('./decision.js'):null);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n):'—';
const pct=n=>Number.isFinite(n)?(n>0?'+':'')+fmt(n)+' %':'—';
function costs(f,options){
 const x=execution.execution(f,options);if(!x.available)return '<p>Scénario de coûts indisponible.</p>';
 return `<div class="execution-reading"><p><strong>Après les coûts supposés : ${pct(x.netReturnPct)}</strong> dans le scénario central.</p><p>Seuil de revente pour couvrir ces coûts : <strong>${fmt(x.breakEven)} FCFA</strong>, soit ${pct(x.requiredRisePct)} au-dessus du cours de référence.</p><p>Coûts couverts ? <strong>${esc(x.label)}</strong>. Scénarios bas à haut : ${pct(x.lowNetPct)} à ${pct(x.highNetPct)}.</p><small>Simulation à partir du dernier cours, avec frais et écart d’exécution à l’achat et à la vente. Le prix accessible à la prochaine séance reste inconnu.</small></div>`;
}
function card(f,options){
 return `${f.pilot?.selected?'<p class="pilot-badge">Groupe pilote · suivi renforcé</p>':''}<p class="muted">Situation de l’action : <strong>${esc(f.regime?.label||'Non évaluée')}</strong>.</p>${costs(f,options)}`;
}
function panel(report,options={}){
 const pilot=report.pilot||{members:[],rows:[]},bySymbol=new Map((report.predictions||[]).map(f=>[f.symbol,f])),selected=pilot.members.map(symbol=>bySymbol.get(symbol)).filter(Boolean),study=report.eventStudy||{};
 const fees=options.feePct??1,slip=options.slippagePct??.25;
 const currentlyObserved=(report.predictions||[]).filter(f=>(f.events||[]).length>0).length;
 return `<div class="pilot-panel"><div class="pilot-panel-heading"><h3>Groupe pilote : ${selected.length} actions suivies de près</h3><label>Afficher les signaux <select id="signalUniverse"><option value="all" ${options.universe!=='pilot'?'selected':''}>Toutes les actions</option><option value="pilot" ${options.universe==='pilot'?'selected':''}>Groupe pilote uniquement</option></select></label></div>
 <p>Choix sur les 20 dernières séances : échanges lors d’au moins 95 % des séances, montant médian d’au moins 5 millions FCFA, qualité exploitable. Au plus dix titres et trois par secteur. Cette sélection de suivi ne constitue pas une liste d’achats.</p>
 <div class="pilot-chips">${selected.map(f=>'<button type="button" class="pilot-chip" data-forecast-symbol="'+esc(f.symbol)+'">'+esc(f.symbol)+'</button>').join('')||'<p>Aucune action ne remplit actuellement les critères.</p>'}</div>
 <div class="signal-cost-controls"><label>Frais par opération (%) <input type="number" min="0" max="5" step="0.1" id="signalFee" value="${fees}"></label><label>Écart d’exécution supposé par opération (%) <input type="number" min="0" max="5" step="0.05" id="signalSlippage" value="${slip}"></label></div><button type="button" id="signalCostApply">Recalculer les coûts</button><p id="signalCostError" role="status"></p>
 <p class="muted">Hypothèses modifiables, appliquées à l’achat et à la vente. Le scénario utilise le dernier cours comme prix d’entrée de référence ; il ne prouve pas qu’un ordre serait exécuté à ce prix.</p>
 <details><summary>Comparer le groupe pilote, les situations et les coûts</summary><div class="table-wrap"><table><thead><tr><th>Action</th><th>Séances échangées</th><th>Montant médian</th><th>Situation</th><th>Net central simulé</th></tr></thead><tbody>${selected.map(f=>{const x=execution.execution(f,options);return '<tr><td>'+esc(f.symbol)+'</td><td>'+fmt(f.pilot.activePct,0)+' %</td><td>'+fmt(f.pilot.medianValue,0)+' FCFA</td><td>'+esc(f.regime?.label||'—')+'</td><td>'+pct(x.netReturnPct)+'</td></tr>';}).join('')}</tbody></table></div><p>Le pilote sera évalué avec la composition enregistrée avant chaque séance. Les tests historiques de chaque action ne constituent pas un test du groupe sélectionné aujourd’hui.</p>
 <p>Les candidats liés à la situation de l’action sont calculés et enregistrés pour comparer leurs résultats futurs. La méthode principale est conservée tant qu’un gain n’est pas confirmé.</p></details>
 <details class="event-study"><summary>Annonces d’entreprise : suivi et apprentissage</summary><p>${currentlyObserved} action(s) avec une annonce récente enregistrée avant la prévision du jour. ${study.exposed||0} prévision(s) avec annonce ont déjà un résultat futur évaluable.</p>
 ${study.categories?.length?'<div class="table-wrap"><table><thead><tr><th>Catégorie</th><th>Observations</th><th>Séances distinctes</th><th>Variation suivante moyenne</th><th>Écart aux témoins comparables</th></tr></thead><tbody>'+study.categories.map(s=>'<tr><td>'+esc(s.category)+'</td><td>'+s.n+'</td><td>'+s.distinctSessions+'</td><td>'+pct(s.meanReturnPct)+'</td><td>'+pct(s.relativeReturnPct)+'</td></tr>').join('')+'</tbody></table></div>':'<p>Les premières mesures arriveront avec les prochaines séances. Aucune influence chiffrée des annonces sur le prix n’est encore validée.</p>'}
 <p>Les premières dates d’observation sont conservées. Les publications anciennes découvertes aujourd’hui et les doublons ne sont pas traités comme de nouvelles annonces indépendantes. Les réactions mesurées sont descriptives, sans preuve de causalité.</p>
 <p>Un candidat « cours + annonces » ne sera calculable qu’avec au moins 30 cas d’annonce antérieurs par catégorie, dix dates distinctes, trois sociétés et 30 observations sans annonce repérée. Il sera enregistré pour comparaison et ne modifiera pas automatiquement le prix publié.</p></details></div>`;
}
const api={panel,card,costs};root.BRVM_PILOT_UI=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
