(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n):'—';
const money=n=>fmt(n,2)+' FCFA';
let universe='all';
const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['www.brvm.org','bfin.brvm.org','www.sikafinance.com','www.richbourse.com'].includes(u.hostname)?esc(u.href):'#';}catch{return '#';}};
function card(f,options={}){
 const s=f.signal,p=s.probabilities,up=s.direction==='up',main=up?p.up:p.down,side=s.metrics.sides.find(v=>v.side===(up?2:0));
 return `<article class="direction-card ${up?'direction-up':'direction-down'}"><div class="direction-label">${up?'↗ Hausse envisagée':'↘ Risque de baisse'}</div>
 <h3>${esc(f.symbol)} <small>${esc(f.name)}</small></h3><p class="signal-probability">${fmt(main)} % <span>estimation du modèle pour cette issue</span></p>
 <div class="probability-row" aria-label="Trois issues estimées"><span>↘ Baisse ${fmt(p.down)} %</span><span>≈ Stabilité ${fmt(p.stable)} %</span><span>↗ Hausse ${fmt(p.up)} %</span></div>
 <p class="signal-support"><strong>${s.support==='historical'?'Appui historique à confirmer':'Signal fragile — fiabilité non établie'}</strong></p>
 <p>Clôture estimée : <strong>${money(f.expected)}</strong><br><span class="muted">${esc(f.target)} · dernier cours ${money(f.price)}</span></p>
 ${root.BRVM_PILOT_UI?.card(f,options)||''}
 <p class="muted">Baisse et hausse : variation dépassant 0,5 %. Stabilité : entre −0,5 % et +0,5 %. Les probabilités restent expérimentales.</p>
 ${f.capturedAt?'<p class="muted">Estimation enregistrée le '+esc(f.capturedAt.replace('T',' ').slice(0,16))+' UTC, puis conservée pour cette séance.</p>':''}
 <details><summary>Fiabilité et informations récentes</summary>
 <p>Sur ${s.metrics.n} tests chronologiques, ${side.n} signaux de ce sens ont été observés. Réussite : ${fmt(side.precision)} %. Cette fréquence historique ne garantit pas la probabilité affichée.</p>
 <p>Score probabiliste : ${fmt(s.metrics.brier,3)} ; repère par fréquences récentes : ${fmt(s.metrics.baselineBrier,3)}. Plus bas est préférable. Écart moyen de calibration : ${fmt(s.metrics.calibrationError)} points. ${esc(s.model)}.</p>
 <p>Fourchette de prix : ${money(f.low)} à ${money(f.high)}. Erreur moyenne historique : ${fmt(f.mae)} %.</p>
 ${f.capturedModelVersion?'<p>Version de la prévision conservée : '+esc(f.capturedModelVersion)+'. Les calculs historiques de diagnostic peuvent provenir du moteur actuel.</p>':''}
 ${(f.recentEvents||[]).slice(0,2).map(e=>'<p><a target="_blank" rel="noopener" href="'+safe(e.url)+'">'+esc(e.title)+'</a><br><small>'+esc(e.provider)+' · publication '+esc(e.publishedAt||'non datée')+' · relevée le '+esc(e.firstSeenAt.slice(0,10))+'</small></p>').join('')||'<p>Aucune publication récente rattachée dans la collecte.</p>'}
 <p>Les nouvelles collectées aujourd’hui sont un contexte de vérification. Leur effet sur le cours n’est pas chiffré sans historique horodaté validé.</p></details>
 <button data-forecast-symbol="${esc(f.symbol)}">Examiner la prévision</button></article>`;
}
function render(report,analyses,today,options={}){
 const live=new Map(analyses.map(a=>[a.symbol,a]));
 const predictions=(report?.predictions||[]).filter(f=>live.has(f.symbol)&&(options.universe!=='pilot'||report?.pilot?.members.includes(f.symbol)));
 const available=predictions.filter(f=>f.available&&f.signal?.available&&live.get(f.symbol).verdict!=='Avis suspendu');
 const expired=available.length>0&&available[0].target<today;
 const ups=available.filter(f=>f.signal.direction==='up').sort((a,b)=>b.signal.probabilities.up-a.signal.probabilities.up);
 const downs=available.filter(f=>f.signal.direction==='down').sort((a,b)=>b.signal.probabilities.down-a.signal.probabilities.down);
 const noSignal=predictions.filter(f=>!available.includes(f)||f.signal.direction==='uncertain');
 const title=available[0]?.target||'à confirmer';
 const summary=report?.sourceSummary||{},continuous=report?.continuous||{};
 const panel=(label,items,empty)=>'<div><h3>'+label+' <span class="direction-count">'+items.length+'</span></h3>'+(items.length?'<div class="signal-card-grid">'+items.map(f=>card(f,options)).join('')+'</div>':'<p class="signal-empty">'+empty+'</p>')+'</div>';
 const grouped=new Map();for(const state of summary.states||[]){if(!grouped.has(state.provider))grouped.set(state.provider,[]);grouped.get(state.provider).push(state);}
 return `<p class="eyebrow">PRÉVISIONS AVANT LA PROCHAINE SÉANCE</p><h2>Hausse ou baisse : les signaux à surveiller.</h2>
 <p>Séance attendue du <strong>${esc(title)}</strong> · données du bulletin du ${esc(report?.asOf||'—')}.</p>
 <p class="signal-caution"><strong>Une tendance estimée, avec son incertitude.</strong> ${expired?'Échéance passée : attendre une nouvelle collecte.':'Un signal peut être erroné. Il ne suffit pas à décider d’un achat ; les frais, le prix proposé et la facilité de revente comptent aussi.'}</p>
 ${root.BRVM_PILOT_UI?.panel(report,options)||''}
 <details class="forecast-audit"><summary>Prévu contre observé : bilan réel par version</summary><p>Comparaison aux bulletins officiels après la séance. Les résultats des versions précédentes restent visibles après une amélioration du moteur.</p>
 <div class="table-wrap"><table><thead><tr><th>Version</th><th>Résultats évalués</th><th>Séances</th><th>Prix exacts</th><th>Erreur moyenne</th><th>Repère cours inchangé</th><th>Directions réussies</th></tr></thead><tbody>${(report?.audit?.versions||[]).map(v=>'<tr><td>'+esc(v.version)+'</td><td>'+v.scored+' / '+v.recorded+'</td><td>'+v.sessions+'</td><td>'+v.exact+'</td><td>'+fmt(v.meanAbsolutePct,3)+' %</td><td>'+fmt(v.baselinePct,3)+' %</td><td>'+v.directionalHits+' / '+v.directionalN+'</td></tr>').join('')}</tbody></table></div>
 ${(report?.audit?.latest||[]).length?'<div class="table-wrap"><table><thead><tr><th>Action</th><th>Séance</th><th>Version</th><th>Prix prévu</th><th>Prix observé</th><th>Écart</th></tr></thead><tbody>'+report.audit.latest.map(r=>'<tr><td>'+esc(r.symbol)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.version)+'</td><td>'+money(r.expected)+'</td><td>'+money(r.actual)+'</td><td>'+money(r.error)+'</td></tr>').join('')+'</tbody></table></div>':'<p>Aucun résultat définitif évaluable à ce stade ; attendre le bulletin de la séance suivante.</p>'}
 <p>${esc(report?.audit?.scope||'Les prévisions sont conservées avant leur échéance.')} Les erreurs en pourcentage sont rapportées au cours connu au moment de la prévision.</p></details>
 <div class="direction-summary"><span>↗ ${ups.length} hausse(s) envisagée(s)</span><span>↘ ${downs.length} risque(s) de baisse</span><span>≈ ${noSignal.length} sans signal exploitable</span></div>
 ${expired?'<p class="notice">Ces signaux sont archivés et ne décrivent pas la prochaine séance actuelle.</p>':''}
 <div class="direction-columns">${panel('↗ Hausses envisagées',ups,'Aucune hausse assez nette selon les critères actuels. Aucune action n’est ajoutée pour remplir cette liste.')}${panel('↘ Risques de baisse',downs,'Aucun biais de baisse assez net selon les critères actuels.')}</div>
 <details class="uncertain-list"><summary>Voir les ${noSignal.length} actions sans signal exploitable</summary><div class="table-wrap"><table><thead><tr><th>Action</th><th>Lecture</th><th>Baisse / stabilité / hausse</th></tr></thead><tbody>${noSignal.map(f=>'<tr><td>'+esc(f.symbol)+' · '+esc(f.name)+'</td><td>'+esc(!f.available?f.reason:f.sourceConflict?'Sources divergentes':live.get(f.symbol).verdict==='Avis suspendu'?'Avis suspendu':'Signal incertain')+'</td><td>'+(f.signal?.probabilities?[f.signal.probabilities.down,f.signal.probabilities.stable,f.signal.probabilities.up].map(p=>fmt(p)+' %').join(' / '):'—')+'</td></tr>').join('')}</tbody></table></div></details>
 <div class="signal-followup"><div><h3>Un système qui mesure ses progrès</h3><p><strong>${continuous.scored||0}</strong> prévisions évaluées après leur enregistrement, sur <strong>${continuous.distinctSessions||0}</strong> séances futures distinctes.</p><p>${esc(continuous.message||'Le suivi commence avec les prochaines séances.')}</p><p>Chaque jour : comparaison aux résultats réels et au dernier cours, contrôle des erreurs et de la couverture. Les méthodes candidates sont enregistrées avant la séance pour comparer leurs résultats futurs.</p></div>
 <div><h3>Données et sources contrôlées</h3><p>${fmt(summary.collectedRows||0,0)} observations complémentaires collectées pour ${summary.symbols||0} valeurs. ${fmt(summary.verifiedBars||0,0)} clôtures rapprochées des bulletins ; ${summary.conflicts||0} divergence(s) ; ${summary.events||0} liens d’actualité et de publication archivés.</p>
 ${[...grouped].map(([provider,states])=>'<p class="source-state"><a href="'+safe(states[0].url)+'" target="_blank" rel="noopener">'+esc(provider)+'</a> : '+(states.every(s=>s.state==='ok')?states.length+' page(s) de synthèse collectée(s)':states.some(s=>s.state==='blocked')?'collecte automatique refusée':'collecte partielle')+'</p>').join('')}
 <p class="muted">Dernière vérification : ${esc(summary.lastCollection||'non effectuée')}. Couverture non exhaustive ; données réservées aux abonnés et carnet complet non inclus.</p></div></div>`;
}
function mount(report,analyses,onSelect){
 const el=document.getElementById('signaux');if(!el)return;
 if(report?.asOf!==analyses[0]?.asOf||report?.dataRevision!==(root.BRVM_DATA?.revision||root.BRVM_DATA?.fetched)){el.innerHTML='<h2>Prévisions de hausse et de baisse</h2><p>Actualisation des signaux en attente du rapport correspondant à ce bulletin.</p>';return;}
 const today=new Intl.DateTimeFormat('fr-CA',{timeZone:'Africa/Abidjan',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const options={universe};
 el.innerHTML=render(report,analyses,today,options);el.querySelectorAll('[data-forecast-symbol]').forEach(b=>b.onclick=()=>onSelect(b.dataset.forecastSymbol));
 const filter=el.querySelector('#signalUniverse');if(filter)filter.onchange=()=>{universe=filter.value;mount(report,analyses,onSelect);};
}
root.BRVM_SIGNALS_UI={render,mount};if(typeof module!=='undefined')module.exports={render};
})(typeof window!=='undefined'?window:globalThis);
