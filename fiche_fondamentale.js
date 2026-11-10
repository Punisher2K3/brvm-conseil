(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=2)=>Number.isFinite(x)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(x):'Non disponible';
const money=x=>Number.isFinite(x)?fmt(x)+' FCFA':'Non disponible';
const pct=x=>Number.isFinite(x)?fmt(x)+' %':'Non disponible';
function renderValuation(a){
 const d=a.deep,m=a.metrics;
 const eps=d.eps ?? d.epsImplicit;
 if(a.verdict==='Avis suspendu'||!(m.indicativeValue>0)||!(eps>0)||!(m.peerPER>0)){
  return '<article class="card"><h4>Combien pourrait valoir cette action ?</h4><p>Estimation indisponible. Le calcul exige un bénéfice positif exploitable, des comptes récents et au moins trois autres sociétés du secteur avec un PER utilisable.</p></article>';
 }
 const central=eps*m.peerPER;
 const low=central*.8,high=central*1.2;
 const gap=(central/a.reference-1)*100;
 const difference=central-a.reference;
 const discount=Math.abs(difference)/central*100;
 const assessment=difference>0?'Cours inférieur à la valeur estimée':difference<0?'Cours supérieur à la valeur estimée':'Cours égal à la valeur estimée';
 const reading=a.reference<low?'Sous la fourchette':a.reference>high?'Au-dessus de la fourchette':'Dans la fourchette';
 return `<article class="card"><h4>Valeur estimée de l’action</h4>
 <p><strong>${money(central)} par action</strong> · estimation centrale</p>
 <p>Cours de référence au ${esc(a.asOf)} : <strong>${money(a.reference)}</strong></p>
 <p><strong>${assessment}</strong>${difference===0?'':' · '+money(Math.abs(difference))+' d’écart, soit une '+(difference>0?'décote':'prime')+' de '+pct(discount)+' par rapport à la valeur estimée'}. Pour atteindre l’estimation centrale, le cours devrait varier de ${gap>0?'+':''}${pct(gap)}.</p>
 <details><summary>Voir la fourchette et les hypothèses</summary>
 <p>${money(low)} à ${money(high)} · ${reading.toLowerCase()}.</p>
 <div class="table-wrap"><table><thead><tr><th>Scénario</th><th>Hypothèse de BPA</th><th>Valeur estimée</th></tr></thead><tbody>
 <tr><td>Prudent</td><td>${money(eps*.8)} (−20 %)</td><td>${money(low)}</td></tr>
 <tr><td>Central</td><td>${money(eps)}</td><td>${money(central)}</td></tr>
 <tr><td>Favorable</td><td>${money(eps*1.2)} (+20 %)</td><td>${money(high)}</td></tr></tbody></table></div>
 <p class="muted">Chaque scénario multiplie le BPA ${d.eps!==null?'publié, ajusté des fractionnements connus':'implicite du PER du bulletin'} par le PER médian de ${fmt(m.peerCount,0)} autres sociétés du secteur (${fmt(m.peerPER)}×). Les variations de ±20 % servent à mesurer la sensibilité au bénéfice. Croissance annuelle du bénéfice observée dans les comptes vérifiés : ${pct(d.earningsGrowth)}.</p>
 <p class="muted">Les écarts de croissance, de dette et de qualité du business peuvent justifier un autre multiple. L’estimation dépend aussi du prix auquel le marché valorise les comparables.</p></details></article>`;
}

function forecastNextClose(a) {
 if(a.verdict==='Avis suspendu')return {available:false,reason:'Avis suspendu ou données périmées. Prévision différée jusqu’à réception de données exploitables.'};
 const rows=window.BRVM_ENGINE.cleanSegment(a.history).rows;
 const last=rows.at(-1);
 const valid=row=>row && row.close>0 && row.volume>0 && !row.suspended && !row.inconsistent;
 if(!valid(last))return {available:false,reason:'Dernière séance sans clôture échangée exploitable.'};
 const returns=[];
 for(let i=1;i<rows.length;i++){
  if(valid(rows[i-1]) && valid(rows[i]) && (Date.parse(rows[i].date)-Date.parse(rows[i-1].date))/86400000<=7){
   returns.push(rows[i].close/rows[i-1].close-1);
  }
 }
 if(returns.length<100)return {available:false,reason:'Au moins 100 variations quotidiennes valides sont nécessaires après la dernière rupture de série.'};
 const average=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
 const quantile=(values,p)=>window.BRVM_ENGINE.quantile(values,p);
 const predict=(past,model)=>{
  const recent=past.slice(-40);
  if(model===0)return 0;
  if(model===1)return average(recent);
  return average(recent.slice(-5))*.5;
 };
 const names=['Cours inchangé','Moyenne des 40 dernières variations','Tendance récente atténuée'];
 const split=Math.floor(returns.length*.6);
 const selectionErrors=[0,1,2].map(model=>{
  const errors=[];
  for(let i=25;i<split;i++)errors.push(Math.abs(returns[i]-predict(returns.slice(0,i),model)));
  return average(errors);
 });
 const selected=selectionErrors.indexOf(Math.min(...selectionErrors));
 const errors=[],baselineErrors=[],coverage=[];
 for(let i=split;i<returns.length;i++){
  const past=returns.slice(0,i);
  const predicted=predict(past,selected);
  const previousErrors=[];
  for(let j=25;j<i;j++)previousErrors.push(returns[j]-predict(returns.slice(0,j),selected));
  if(previousErrors.length>=30){
   const low=predicted+quantile(previousErrors,.1),high=predicted+quantile(previousErrors,.9);
   coverage.push(returns[i]>=low && returns[i]<=high?1:0);
  }
  errors.push(Math.abs(returns[i]-predicted));
  baselineErrors.push(Math.abs(returns[i]));
 }
 const residuals=[];
 for(let i=25;i<returns.length;i++)residuals.push(returns[i]-predict(returns.slice(0,i),selected));
 const expected=predict(returns,selected);
 const positive=returns.filter(value=>value>0).length;
 return {available:true,date:last.date,price:last.close,n:returns.length,tests:errors.length,model:names[selected],
  expected:last.close*(1+expected),low:last.close*(1+expected+quantile(residuals,.1)),high:last.close*(1+expected+quantile(residuals,.9)),
  mae:average(errors)*100,baseline:average(baselineErrors)*100,coverage:coverage.length?average(coverage)*100:null,
  positiveRate:positive/returns.length*100,better:average(errors)<average(baselineErrors)*.95};
}
function renderForecast(a) {
 const f=forecastNextClose(a);
 if(!f.available)return '<article class="card"><h4>Prévision de la prochaine clôture</h4><p>'+esc(f.reason)+'</p><p>Prévision non calculable pour cette action avec cet historique.</p></article>';
 return `<article class="card"><h4>Prévision de la prochaine clôture</h4>
 <p><strong>${money(f.expected)}</strong> · estimation pour la prochaine séance après le ${esc(f.date)}.</p>
 <p>Dernière clôture échangée ${money(f.price)}. Fourchette empirique visant 80 % des observations ${money(f.low)} à ${money(f.high)}.</p>
 <p><strong>${f.better?'Erreur réduite de plus de 5 % face au cours inchangé sur le test':'Avantage prédictif non établi face au cours inchangé'}</strong></p>
 <p>Sur ${f.tests} prévisions gardées pour le test, erreur absolue moyenne ${pct(f.mae)} du cours de départ. Repère cours inchangé ${pct(f.baseline)}. Couverture effectivement observée de la fourchette ${pct(f.coverage)}.</p>
 <details><summary>Comprendre le calcul et sa fiabilité</summary>
 <p>Trois modèles comparés chronologiquement sur la première partie de l’historique. Modèle sélectionné ${esc(f.model)}. Évaluation sur la dernière partie, avec un entraînement utilisant uniquement les données antérieures à chaque prévision. ${f.n} variations valides après la dernière rupture détectée. L’intervalle utilise les quantiles 10 % et 90 % des erreurs antérieures. La couverture de 80 % est une cible, à confronter au taux observé.</p>
 <p>Fréquence historique des séances en hausse ${pct(f.positiveRate)}. Cette fréquence décrit l’échantillon et sa validité comme probabilité de hausse future reste à établir. Frais, glissement, liquidité et nouvelles annonces peuvent modifier le résultat d’un achat.</p>
 <p>Horizon de la prévision fixé à la prochaine séance boursière. Une actualisation de cours pendant la séance ne transforme pas ce modèle quotidien en prévision de clôture du jour. Les suspensions, incohérences et ruptures détectées limitent les données utilisables.</p></details>
 <h4>Maximum de la journée et ordres à la seconde</h4>
 <p>Ces estimations restent indisponibles. Le jeu de données actuel contient les cours quotidiens et volumes agrégés. Il faut un flux horodaté de transactions et de carnet d’ordres, puis un historique intrajournalier pour entraîner et tester ces modèles.</p>
 <p><a href="https://www.brvm.org/fr/node/185" target="_blank" rel="noopener">Flux de données BRVM</a> · <a href="https://otexts.com/fpp3/tscv.html" target="_blank" rel="noopener">Validation chronologique des prévisions</a></p>
 </article>`;
}

function render(a){
 const d=a.deep,f=d.annual,b=d.profile;
 const source=f?`<p class="muted">Bilan et résultats annuels au ${esc(f.periodEnd)} · ${esc(f.scope)}. Publié le ${esc(f.published)}. <a href="${esc(f.source)}" target="_blank" rel="noopener">États officiels ↗</a> · pages ${esc(f.pages.join(', '))}. ${esc(f.notes||'')}</p>`:'<p class="notice">Le bilan annuel n’est pas encore normalisé et vérifié pour cette société. Les données manquantes ci-dessous ne sont pas remplacées par zéro et ne prouvent ni une bonne ni une mauvaise santé financière.</p>';
 const card=(title,value,meaning,reading,limit)=>`<article class="indicator-card"><div class="indicator-top"><h4>${esc(title)}</h4><strong>${esc(value)}</strong></div><p><b>À quoi cela sert :</b> ${esc(meaning)}</p><p class="reading">${esc(reading)}</p><p class="metric-limit">${esc(limit)}</p></article>`;
 const p=d.performance;
 let perf=p.available?`<p>Simulation du ${p.start} au ${p.end}, sur 20 intervalles de cotation : cours ${pct(p.priceReturn)}, dividendes nets identifiés ${money(p.distribution)} par action, frais ${fmt(p.fee)} % à l’achat et à la vente.</p><p><strong>Rendement nominal simulé après ces frais : ${pct(p.nominal)}</strong></p><label>Inflation annuelle supposée (%) <input id="inflationScenario" type="number" step="0.1" min="-99" max="100" placeholder="Ex. 3" aria-describedby="inflationHelp"></label><p id="inflationHelp" class="muted">Hypothèse personnelle, aucune statistique d’inflation n’est injectée. Le taux annuel est appliqué aux ${p.days} jours écoulés.</p><p id="realReturn" aria-live="polite">Rendement corrigé de l’inflation : renseignez une hypothèse.</p><p class="muted">Simulation illustrative, pas la rentabilité de votre portefeuille : absence possible de distributions dans l’archive, dates d’exécution théoriques, fiscalité additionnelle et glissement exclus. Les dividendes sont inclus selon le détachement, même si leur paiement survient après la vente ; leur valeur temps est ignorée. Formule réelle = (1 + rendement nominal) / (1 + inflation annuelle)^(jours / 365,25) − 1.</p>`:`<p class="notice">${esc(p.reason)} Une opération sur titres peut empêcher cette simulation. Aucune rentabilité totale fiable n’est inventée.</p>`;
 return `<section class="deep-analysis">${renderForecast(a)}<h3>Comprendre l’entreprise et ses fondamentaux</h3><article class="card"><p class="eyebrow">CE QUE FAIT L’ENTREPRISE</p><h4>${esc(a.name)}</h4><p>${esc(b?.description||'Description détaillée à documenter à partir des publications de l’émetteur.')}</p><p><strong>Points à examiner dans ce business :</strong> ${esc(b?.risks||'Modèle économique, clientèle, concurrence, réglementation et gouvernance.')}</p><p class="muted">Présentation éditoriale générale, pas une évaluation exhaustive de la qualité du management ni de l’avantage concurrentiel. <a href="${esc(b?.source||a.issuerUrl)}" target="_blank" rel="noopener">Publications de référence ↗</a></p></article>${source}${renderValuation(a)}<div class="indicator-grid">
 ${card('Bénéfice par action (BPA / EPS)',money(d.eps),'Part du résultat annuel attribuable à une action, lorsqu’un BPA officiel est publié.',d.eps===null?'BPA annuel publié non vérifié. Le BPA implicite du PER vaut '+money(d.epsImplicit)+' ; c’est une approximation issue d’un PER arrondi.':'BPA publié, ramené à l’unité actuelle de l’action'+(d.epsFactor!==1?' : division par '+d.epsFactor+' après fractionnement.':'.'),'Le BPA implicite n’est pas assimilé au bénéfice annuel audité ; aucune division du bénéfice du groupe par un nombre de titres d’un autre périmètre.')}
 ${card('Capitaux propres',money(d.equity),'Coussin comptable laissé aux actionnaires après déduction des dettes.',d.equity===null?'Bilan non vérifié.':d.equity>0?'Capitaux propres positifs à la date du bilan.':'Capitaux propres nuls ou négatifs : fragilité du bilan.','Une valeur comptable n’est pas la valeur de revente de l’entreprise. '+(f?.equityBasis||''))}
 ${card('Dette financière brute',money(d.debt),'Financements financiers à rembourser, selon le périmètre explicité du bilan.',d.debt===null?'La dette financière complète n’est pas isolée de manière fiable.':f.debtBasis,'Les dettes fournisseurs, les provisions et les dépôts bancaires ne sont pas automatiquement assimilés à des emprunts. Dette brute, sans déduction de trésorerie.')}
 ${card('Dette / capitaux propres (Debt-to-equity)',d.banking?'Lecture bancaire spécifique':Number.isFinite(d.debtEquity)?fmt(d.debtEquity)+' ×':'Non disponible','Mesure le poids de la dette financière face aux fonds propres.',d.banking?'Pour une banque, les dépôts font partie du modèle économique : ce ratio industriel est écarté. Examiner plutôt solvabilité réglementaire, créances en souffrance et coût du risque.':d.debtEquity===null?'Dette complète et fonds propres positifs nécessaires.':d.debtEquity>1?'La dette financière dépasse les capitaux propres.':'La dette financière est inférieure ou égale aux capitaux propres.','Un seuil universel ne suffit pas : comparer au secteur, aux flux de trésorerie et aux échéances.')}
 ${card('ROE annuel',pct(d.roe),'Résultat annuel / moyenne des capitaux propres d’ouverture et de clôture.',d.roe===null?'Deux bilans comparables avec fonds propres positifs sont nécessaires.':d.roe>0?'L’entreprise a dégagé un bénéfice sur les capitaux comptables mobilisés.':'La rentabilité comptable des fonds propres est négative.','Même périmètre pour bénéfice et fonds propres. Un ROE élevé peut aussi venir d’un endettement élevé. '+(f?.equityBasis||''))}
 ${card('Marge opérationnelle (Operating margin)',d.banking?'Non pertinente sous cette forme':pct(d.operatingMargin),'Résultat d’exploitation / chiffre d’affaires : ce qui reste de l’activité avant le résultat financier et l’impôt.',d.banking?'Le produit net bancaire et le coefficient d’exploitation sont plus adaptés aux banques.':d.operatingMargin===null?'Chiffre d’affaires et résultat d’exploitation annuels comparables nécessaires.':d.operatingMargin>0?'L’exploitation est bénéficiaire sur l’exercice.':'L’exploitation est déficitaire sur l’exercice.','Ne pas confondre marge opérationnelle, marge nette et EBITDA. La comparaison doit rester sectorielle.')}
 ${card('Croissance annuelle du bénéfice (Earnings growth)',pct(d.earningsGrowth),'Évolution du résultat net entre deux exercices annuels comparables.',d.earningsGrowth===null?'Le bénéfice antérieur doit être strictement positif et comparable.':d.earningsGrowth>=0?'Le bénéfice annuel progresse.':'Le bénéfice annuel recule.','Un gain exceptionnel peut gonfler ce taux. Les résultats trimestriels récents restent présentés séparément.')}
 ${card('Capitalisation boursière',money(d.capitalisationSnapshot?.marketCap),'Cours × nombre total d’actions publié par la BRVM.',!d.capitalisationSnapshot?'Quantité de titres et séance cohérentes non confirmées.':fmt(d.capitalisationSnapshot.shares,0)+' actions · instantané du '+d.capitalisationSnapshot.session+'. Il s’agit de la valeur de marché des fonds propres.','Ce n’est ni le chiffre d’affaires ni le prix de rachat complet, qui dépend aussi de la dette. Source : '+(d.capitalisationSource||'BRVM'))}
 ${card('Valorisation : raisonnable ou exigeante ?',d.valuation,'Compare le PER au repère sectoriel déjà calculé.',a.metrics.indicativeValue>0?'Repère relatif : '+money(a.metrics.indicativeValue)+'. Un cours inférieur suggère une décote, à expliquer par les risques.':'Les conditions pour un repère sectoriel exploitable ne sont pas réunies.','Une décote ne suffit pas à dire « bon marché ». Croissance, dette, qualité des bénéfices et risques peuvent la justifier. Aucune valeur intrinsèque n’est affirmée.')}
 </div><article class="card"><h4>Qualité du business : ce que les faits permettent de dire</h4><p>${d.qualityCoverage} contrôles financiers renseignés sur 4. La qualité globale du business reste à approfondir ; aucun score artificiel n’est attribué à la réputation de l’entreprise.</p><ul>${d.criteria.map(x=>`<li><strong>${esc(x.label)} :</strong> ${esc(x.state)}</li>`).join('')}</ul><p class="muted">Le bénéfice et les ratios décrivent la performance financière, pas à eux seuls la fidélité des clients, la gouvernance, la solidité concurrentielle ou les risques réglementaires.</p></article>
 <h3>Plus haut et plus bas observés</h3><div class="metrics"><div><span>Clôture la plus basse</span><strong>${money(d.range.low?.close)}</strong><small>${esc(d.range.low?.date)}</small></div><div><span>Clôture la plus haute</span><strong>${money(d.range.high?.close)}</strong><small>${esc(d.range.high?.date)}</small></div></div><p class="muted">${d.range.count} clôtures valides du ${esc(d.range.start)} au ${esc(d.range.end)}. Clôtures ramenées à l’unité actuelle de l’action pour les fractionnements vérifiés. Les extrêmes portent sur la période archivée, avec dates affichées.</p>
 <h3>Dividendes des dix derniers exercices clos</h3><p>${d.dividendYears} exercices avec distribution identifiée sur 10. Montants nets par action ramenés à l’unité actuelle pour les fractionnements vérifiés. Une case manquante signifie « non retrouvé », jamais « aucun dividende ».</p><div class="table-wrap"><table><thead><tr><th>Exercice</th><th>Net par action publié</th><th>Détachement / sources officielles</th></tr></thead><tbody>${d.dividends.map(x=>`<tr><td>${x.year}</td><td>${money(x.net)}</td><td>${x.distributions.length?x.distributions.map(r=>`<a href="${esc(r.source)}" target="_blank" rel="noopener">${esc(r.exDate||'Paiement : '+r.payment)} ↗</a>`).join(' · '):'Non retrouvé dans les archives collectées'}</td></tr>`).join('')}</tbody></table></div><p class="muted">Source : calendrier des paiements BRVM. Les doublons stricts sont retirés ; plusieurs versements distincts sont additionnés par exercice. Une distribution passée ne garantit aucun versement futur.</p>
 <h3>Rentabilité après frais et pouvoir d’achat</h3><article class="card">${perf}</article></section>`;
}
function bind(a){
 const input=document.getElementById('inflationScenario');if(!input)return;
 input.oninput=()=>{const raw=input.value,n=Number(raw),p=a.deep.performance;document.getElementById('realReturn').textContent=raw===''?'Rendement corrigé de l’inflation : renseignez une hypothèse.':n<=-100||!Number.isFinite(n)||n>100?'Saisissez un taux annuel entre −99 et 100 %.':'Rendement réel simulé avec cette hypothèse : '+pct(((1+p.nominal/100)/Math.pow(1+n/100,p.days/365.25)-1)*100);};
}
root.BRVM_DEEP_UI={render,bind};
})(window);
