/* Lecture pédagogique des résultats : mêmes faits que le moteur, sans nouvelle donnée estimée. */
(function(root){
'use strict';
const f=(n,d=2)=>n===null||n===undefined||!Number.isFinite(n)?'Non disponible':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const p=n=>n===null||n===undefined?'Non disponible':(n>0?'+':'')+f(n)+' %';
const exists=n=>n!==null&&n!==undefined;
function summary(a){
 let title,text;
 if(a.verdict==='Avis suspendu'){
   title='Je ne donnerais pas d’avis d’achat pour le moment.';
   text=a.suspended?'L’action n’a pas été cotée normalement pendant cette séance. Le prix affiché sert de référence ; il ne prouve pas que vous pourriez acheter ou revendre à ce prix.':a.inconsistent?'Les chiffres du cours et de sa variation ne concordent pas. Il faut clarifier cet écart avant d’interpréter le prix.':a.financialIssues?.length?'Le document financier contient des chiffres ou des indications contradictoires. Ils doivent être clarifiés avant de soutenir un avis.':'La dernière séance disponible est trop ancienne pour donner un avis à jour.';
 }else if(a.financial?.profit<=0&&a.financial){
   title='Je serais prudent : l’entreprise publie encore une perte.';
   text='Sur '+a.financial.period+', le résultat net est négatif. Une hausse du cours ou un dividende ancien ne suffit pas à montrer que l’activité s’est rétablie. Il faut comprendre la cause de la perte et vérifier les publications suivantes.';
 }else if(!a.financial){
   title='Je peux analyser le marché, mais pas confirmer la situation actuelle de l’entreprise.';
   text=a.financialArchive?'Les derniers comptes contrôlés portent sur '+a.financialArchive.period+'. Ils sont trop anciens pour entrer dans le score actuel. Leur lecture sert de contexte historique, sans prouver la santé financière aujourd’hui.':'Des chiffres financiers récents et comparables manquent. Le score reflète donc surtout le prix, les dividendes publiés et les échanges ; il ne suffit pas à conclure à un bon achat.';
 }else if(a.verdict==='Intéressante à étudier'){
   title='Cette action mérite une étude supplémentaire avant un achat.';
   text='Les critères disponibles donnent un bilan plutôt favorable pour le profil choisi. Cela justifie de regarder le dossier de plus près, puis de vérifier les risques et votre prix d’entrée. Le score ne démontre ni une sous-évaluation certaine ni une hausse future.';
 }else if(a.verdict==='Prudence'){
   title='Je serais prudent avant d’acheter cette action.';
   text='Plusieurs critères disponibles sont défavorables avec le profil choisi. Un cours peu élevé en FCFA ne signifie pas que l’entreprise est bon marché : les bénéfices, les risques et la facilité de revente comptent aussi.';
 }else{
   title='Je garderais cette action sous surveillance avant de conclure.';
   text='Le dossier présente des éléments favorables et des réserves. Les calculs ne donnent pas un avantage assez net pour le classer parmi les pistes les plus intéressantes avec le profil choisi.';
 }
 const reasons=[];
 const m=a.metrics;
 if(a.financial){
   if(a.financial.profit>0)reasons.push('L’entreprise est bénéficiaire sur la période publiée'+(exists(m.profitGrowth)?', avec un résultat '+(m.profitGrowth>=0?'en hausse de ':'en baisse de ')+f(Math.abs(m.profitGrowth))+' % sur un an.':'. Le résultat antérieur ne permet pas de calculer un taux de croissance classique.'));
   if(exists(m.revenueGrowth))reasons.push('L’activité '+(m.revenueGrowth>=0?'progresse de ':'recule de ')+f(Math.abs(m.revenueGrowth))+' % sur des périodes comparables.');
 }
 if(exists(m.peerPER)&&a.per>0)reasons.push('Le prix rapporté au bénéfice est '+(a.per<m.peerPER?'plus bas':'plus élevé')+' que chez les autres entreprises retenues du secteur : '+f(a.per)+' contre '+f(m.peerPER)+'. Les différences de croissance et de risque restent à examiner.');
 if(exists(m.turnover))reasons.push('Le montant médian échangé est de '+f(m.turnover,0)+' FCFA par séance. '+(a.simulation.budget>m.positionLimit?'Votre montant dépasse le seuil indicatif de 5 % de ce montant : l’exécution pourrait être difficile.':'Ce repère donne une idée de la taille habituelle du marché ; il ne garantit pas une revente.'));
 const next=a.suspended?'Vérifier la reprise de cotation et les conditions d’exécution auprès de votre SGI.':!a.financial?'Chercher un rapport plus récent avant d’utiliser cette analyse pour décider.':a.financial.profit<=0?'Vérifier si la perte est exceptionnelle ou récurrente, puis examiner la trésorerie et la dette.':a.coverage<80?'Compléter les dimensions non évaluées et comparer avec des entreprises dont la couverture est similaire.':'Examiner la dette, la trésorerie, les risques du secteur et les derniers communiqués avant de décider.';
 return {title,text,reasons,next};
}
function metrics(a){
 const m=a.metrics,rows=[];
 const add=(key,label,value,meaning,reading,limit,component)=>{
   const impact=component?(a.components[component]===null?'Non retenu dans le score : la dimension ne dispose pas des données nécessaires.':'La dimension « '+({quality:'résultats',value:'valorisation',income:'dividendes',liquidity:'liquidité',trend:'tendance'})[component]+' » reçoit '+f(a.components[component],0)+'/100 et pèse '+a.weights[component]+' % dans ce profil.'): 'Repère explicatif ; cet indicateur ne donne pas à lui seul un ordre d’achat ou de vente.';
   rows.push({key,label,value,meaning,reading,limit,impact});
 };
 add('price','Prix de référence',f(a.reference,0)+' FCFA','C’est le prix publié qui sert de base à nos calculs et à votre simulation.',a.suspended?'Le titre est suspendu ou non coté : ce prix n’est pas un prix d’exécution disponible.':'Avec votre budget et les frais saisis, la simulation permet environ '+f(a.simulation.shares,0)+' action(s).','Le prix seul ne permet pas de dire si une entreprise est chère : il faut le rapprocher de ses bénéfices.');
 add('variation','Variation de la séance',p(a.variation),'Elle indique comment le cours a changé par rapport au cours précédent publié.',a.inconsistent?'Le contrôle détecte un écart entre les chiffres : l’avis est suspendu.':!exists(a.variation)?'La variation n’est pas disponible.':a.variation>0?'Le prix publié a augmenté pendant cette séance.':a.variation<0?'Le prix publié a diminué pendant cette séance.':'Le prix publié n’a pas changé pendant cette séance.','Une seule journée ne permet pas de prévoir le mouvement suivant.');
 add('per','PER : prix par rapport au bénéfice',f(a.per),'Le PER rapporte le prix d’une action au bénéfice annuel par action utilisé dans le bulletin.',a.per>0?'Ici, le prix représente environ '+f(a.per)+' fois ce bénéfice annuel publié.': 'Le PER n’est pas publié : une perte ou une information manquante peuvent l’expliquer.','Un PER faible peut signaler un prix attractif ou des risques élevés. Il ne signifie pas que votre investissement sera remboursé en autant d’années.','value');
 add('peer','PER des autres sociétés du secteur',f(m.peerPER),'La médiane est le PER au milieu du groupe : la moitié des pairs retenus se situe au-dessous, l’autre au-dessus.',exists(m.peerPER)?'Votre action affiche un PER '+(a.per<m.peerPER?'inférieur':'supérieur ou égal')+' à cette médiane, calculée sur '+m.peerCount+' autres entreprises.':'Seulement '+m.peerCount+' autre(s) société(s) répond(ent) aux critères ; le modèle en exige au moins trois.','Des sociétés d’un même secteur peuvent avoir des croissances, des dettes et des risques différents.','value');
 add('income','Dernier dividende récent / prix',exists(m.yieldNet)?f(m.yieldNet)+' %':'Non calculé','Ce ratio rapporte le dernier dividende net récent au prix actuel. Il décrit un versement passé.',exists(m.yieldNet)?'À ce prix, le dernier versement représentait environ '+f(m.yieldNet*1000,0)+' FCFA pour l’équivalent de 100 000 FCFA d’actions.':'Aucun paiement suffisamment récent n’est identifié ; un ancien rendement n’est pas réutilisé.','Acheter aujourd’hui ne donne pas droit rétroactivement au dividende passé. Le prochain montant et votre droit au versement dépendent des décisions et dates de détachement.','income');
 add('liquidity','Argent échangé par séance',exists(m.turnover)?f(m.turnover,0)+' FCFA':'Non calculé','C’est le montant médian réellement échangé sur jusqu’à 20 séances, pas le nombre d’ordres affichés.',exists(m.turnover)?'Lors d’environ la moitié des séances, le montant échangé était inférieur ou égal à ce repère. '+(a.simulation.budget>m.positionLimit?'Votre achat envisagé est important au regard de cette activité.':'Il sert à comparer la taille de votre achat à l’activité habituelle du titre.'):'Il faut au moins 15 séances pour calculer ce repère.','Un marché peu actif peut rendre une vente lente ou imposer un prix moins favorable. Même un montant élevé ne garantit pas votre exécution.','liquidity');
 add('active','Régularité des échanges',exists(m.active)?f(m.active,0)+' %':'Non calculé','Cette proportion mesure la fréquence des séances où des actions ont effectivement changé de mains.',exists(m.active)?f(m.active,0)+' % des séances récentes ont enregistré des échanges. '+(m.active<90?'Les jours sans échanges sont un signal de difficulté possible à revendre.':'Le titre a été régulièrement échangé, ce qui est plus favorable à la liquidité.'):'L’historique récent est insuffisant.','Des échanges chaque jour ne garantissent pas qu’un acheteur acceptera votre quantité et votre prix.','liquidity');
 add('trend','Évolution sur 20 observations',p(m.ret20),'Elle compare le dernier cours valide au cours observé 20 observations valides plus tôt.',exists(m.ret20)?'La tendance récente du prix est '+(m.ret20>0?'orientée à la hausse.':m.ret20<0?'orientée à la baisse.':'stable.'):'Un historique trop court ou une rupture détectée empêche ce calcul.','Les dividendes ne sont pas inclus. Une tendance passée peut se retourner.','trend');
 add('revenue','Croissance de l’activité',p(m.revenueGrowth),'Elle compare le chiffre d’affaires — ou le produit net bancaire pour une banque — à la même période précédente.',exists(m.revenueGrowth)?'L’activité '+(m.revenueGrowth>=0?'augmente':'diminue')+' de '+f(Math.abs(m.revenueGrowth))+' %. '+(m.revenueGrowth>=0?'L’entreprise génère davantage d’activité, mais il faut aussi vérifier ses coûts.':'Il faut comprendre si ce recul vient des volumes, des prix ou d’un changement de périmètre.'):'Les chiffres récents comparables manquent, ou l’agrégat publié ne correspond pas à un chiffre d’affaires isolé.','Une hausse des revenus peut coexister avec une baisse du bénéfice. Les périodes doivent être comparables.','quality');
 add('profit','Croissance du résultat net',p(m.profitGrowth),'Le résultat net correspond au bénéfice ou à la perte restant après les charges et les impôts.',!a.financial?'Les comptes récents ne permettent pas de conclure.':a.financial.profit<=0?'Le résultat est négatif : l’entreprise publie une perte. Une réduction de cette perte ne signifie pas qu’elle est redevenue bénéficiaire.':exists(m.profitGrowth)?'Le bénéfice '+(m.profitGrowth>=0?'progresse':'recule')+' de '+f(Math.abs(m.profitGrowth))+' % par rapport à la période comparable.':'L’entreprise est bénéficiaire, mais le résultat antérieur nul ou négatif empêche un pourcentage de croissance classique.','Un bénéfice peut provenir d’un événement exceptionnel. Il faut le rapprocher de la trésorerie et de la dette.','quality');
 add('score','Score d’analyse',f(a.score,0)+'/100','Il synthétise les critères disponibles avec les poids du profil que vous avez choisi.','L’avis actuel est « '+a.verdict+' ». Le détail montre les éléments qui augmentent ou diminuent cette note.','73/100 ne veut pas dire 73 % de chances de gagner. Le modèle ne calcule pas cette probabilité.');
 add('coverage','Couverture des calculs',a.coverage+' %','Elle indique quelle part des poids du modèle dispose des données nécessaires.',a.coverage===100?'Les cinq dimensions de ce modèle sont calculables.':'Certaines dimensions manquent ; la note est calculée sur les seules dimensions disponibles.','100 % de couverture ne signifie pas que tous les risques ont été étudiés ni que les données sont certaines.');
 add('ma20','Moyenne de prix sur 20 observations',f(m.ma20,0)+' FCFA','Elle lisse les variations en faisant la moyenne des 20 derniers cours valides.',exists(m.ma20)?'Le cours actuel est '+(a.reference>m.ma20?'au-dessus':'au-dessous ou au niveau')+' de cette moyenne.':'Pas assez de cours valides dans le dernier segment.','Ce repère réagit avec retard et ne prévoit pas le prochain prix.','trend');
 add('ma60','Moyenne de prix sur 60 observations',f(m.ma60,0)+' FCFA','Elle donne un repère de tendance plus long que la moyenne sur 20 observations.',exists(m.ma60)?'Le prix actuel est '+(a.reference>m.ma60?'supérieur':'inférieur ou égal')+' à cette moyenne.':'Le dernier segment ne contient pas 60 cours valides.','Une rupture ou un fractionnement peut interrompre la série ; nous évitons alors de mélanger les prix.','trend');
 add('rsi','RSI : équilibre des mouvements récents',f(m.rsi,0)+'/100','Il compare les hausses et les baisses des 14 dernières observations.',!exists(m.rsi)?'Historique insuffisant.':m.rsi>70?'Les hausses récentes dominent nettement.':m.rsi<30?'Les baisses récentes dominent nettement.':'Les mouvements récents sont moins déséquilibrés.','Un RSI élevé n’impose pas une baisse et un RSI bas ne garantit pas un rebond.');
 add('volatility','Volatilité annualisée',exists(m.volatility)?f(m.volatility,1)+' %':'Non calculée','Elle mesure l’amplitude des fluctuations quotidiennes, convertie en repère annuel.',exists(m.volatility)?'Plus ce chiffre est élevé, plus le prix a fluctué dans le segment étudié.':'Le segment ne contient pas assez de variations valides.','Ce n’est ni un rendement attendu ni une limite à la perte possible.');
 add('drawdown','Plus forte baisse depuis un sommet',p(m.drawdown),'Elle mesure la plus forte chute entre un sommet puis un point plus bas dans le segment observé.',exists(m.drawdown)?'La baisse maximale observée a été de '+f(Math.abs(m.drawdown))+' %, hors dividendes.':'Historique insuffisant dans le segment retenu.','Une baisse future pourrait être plus importante que celle observée.');
 return rows;
}
const api={summary,metrics};root.BRVM_EXPLAIN=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

/* FIN DU MODULE PEDAGOGIQUE */
'use strict';
let data=window.BRVM_DATA||{sessions:[],stocks:[]};
const $=id=>document.getElementById(id), selected=new Set();
let analyses=[], currentSymbol=null, polling=null;
const fmt=(n,d=0)=>n===null||n===undefined||!Number.isFinite(n)?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:d}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percent=n=>n===null||n===undefined?'—':(n>0?'+':'')+fmt(n,2)+' %';
const sectors={CB:'Consommation de base',CD:'Consommation discrétionnaire',ENE:'Énergie',FIN:'Services financiers',IND:'Industrie',SPU:'Services publics',TEL:'Télécommunications'};
const label={quality:'Résultats financiers',value:'Valorisation',income:'Dividendes',liquidity:'Liquidité',trend:'Tendance'};
const tone=s=>s==='Intéressante à étudier'?'good':s==='Prudence'||s==='Avis suspendu'?'bad':'warn';
const explain=window.BRVM_EXPLAIN;
function plainSummary(a){const s=explain.summary(a);return `<article class="plain-summary"><p class="eyebrow">L’AVIS EN LANGAGE SIMPLE</p><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${s.reasons.length?'<ul>'+s.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>':''}<p class="next-step"><strong>Avant de décider :</strong> ${esc(s.next)}</p></article>`;}
function indicatorCard(x){return `<article class="indicator-card"><div class="indicator-top"><h4>${esc(x.label)}</h4><strong>${esc(x.value)}</strong></div><p><b>À quoi cela sert :</b> ${esc(x.meaning)}</p><p class="reading"><b>Pour cette action :</b> ${esc(x.reading)}</p><p class="metric-limit">${esc(x.limit)}</p><p class="metric-impact">${esc(x.impact)}</p></article>`;}
function explainedIndicators(a){const all=explain.metrics(a),primary=new Set(['per','income','liquidity','revenue','profit','coverage']);return '<h3>Comprendre les chiffres de cette action</h3><p class="muted">Chaque indicateur répond à une question différente. Voici ce qu’il permet de comprendre et ce qu’il ne permet pas de conclure.</p><div class="indicator-grid">'+all.filter(x=>primary.has(x.key)).map(indicatorCard).join('')+'</div><details class="more-indicators"><summary>Expliquer les autres chiffres : prix, variation, score, tendance, moyennes, RSI et risque</summary><div class="indicator-grid">'+all.filter(x=>!primary.has(x.key)).map(indicatorCard).join('')+'</div></details>';}
function financialContext(a){
 const r=a.financial||a.financialArchive;if(!r)return '';
 const archived=!a.financial;
 const unit=r.unit.toLowerCase(),factor=unit.includes('milliards')?1e9:unit.includes('millions')?1e6:unit.includes('milliers')?1e3:1;
 const money=n=>Number.isFinite(n)?fmt(n*factor,0)+' FCFA':'Non disponible';
 return `<article class="card financial-context"><span class="badge ${archived?'bad':'warn'}">${archived?'Archive · exclue du score actuel':'Publication financière examinée'}</span><h3>${esc(r.period)}</h3><p>${archived?'Ces comptes sont clos depuis '+fmt(a.metrics.financialAge)+' jours à la date de la séance. Ils servent de contexte historique, sans confirmer la santé financière actuelle.':'Ces chiffres décrivent la période du rapport, pas forcément la situation aujourd’hui.'}</p><div class="table-wrap"><table><thead><tr><th>Chiffre publié</th><th>Période actuelle du rapport</th><th>Période précédente</th></tr></thead><tbody><tr><td>${r.revenueComparable===false?'Chiffre d’affaires isolé':'Activité : chiffre d’affaires ou PNB'}</td><td>${money(r.revenue)}</td><td>${money(r.previousRevenue)}</td></tr><tr><td>Résultat net</td><td>${money(r.profit)}</td><td>${money(r.previousProfit)}</td></tr></tbody></table></div><p class="muted">Les montants ci-dessus sont affichés en FCFA. Unité d’origine du document : ${esc(r.unit)}. Une valeur non disponible n’est pas remplacée par zéro.</p>${r.missingReason?'<p>'+esc(r.missingReason)+'</p>':''}${[...(r.notes||[]),...(r.dataIssues||[])].length?'<ul>'+[...(r.notes||[]),...(r.dataIssues||[])].map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':''}<details><summary>Voir les détails de vérification et la source</summary><p class="muted">${esc(r.scope)}<br>Publié le ${esc(r.published)}. ${esc(r.evidence)}</p><a href="${esc(r.source)}#page=${r.page}" target="_blank" rel="noopener">Consulter le tableau officiel · page ${r.page} ↗</a></details></article>`;
}
function options(){return {profile:$('profile').value,budget:Math.max(0,Math.min(1e9,Number($('budget').value)||0)),fee:Math.max(0,Math.min(5,Number($('fee').value)||0))};}
function recalculate(){
 analyses=BRVM_ENGINE.analyse(data,options());
 analyses.forEach(a=>{a.deep=BRVM_DEEP.analyse(a,window.BRVM_FUNDAMENTALS||{},options());const live=window.BRVM_FUNDAMENTALS?.liveMarket;a.liveQuote=live&&live.session>=a.asOf?live.stocks.find(q=>q.symbol===a.symbol):null;if(a.deep.equity!==null&&a.deep.equity<=0){a.warnings.push('Capitaux propres annuels nuls ou négatifs : fragilité du bilan.');if(a.verdict!=='Avis suspendu')a.verdict='Prudence';}if(a.deep.debtEquity>2){a.warnings.push('Dette financière supérieure à deux fois les fonds propres : vigilance renforcée, à interpréter selon le secteur.');if(a.verdict==='Intéressante à étudier')a.verdict='À surveiller';}});
 $('count').textContent=analyses.length;$('sessions').textContent=(data.sessions||[]).length;
 $('financialCount').textContent=analyses.filter(a=>a.financial).length+'/48';
 $('scenarioCount').textContent=analyses.filter(a=>a.scenarios[0].available).length;
 $('session').textContent=data.session?'Séance du '+new Date(data.session+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'Aucune séance validée';
 $('collection').textContent=data.fetched?'Collecte : '+new Date(data.fetched).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})+' · heure de Paris':'';
 const full=analyses.filter(a=>a.coverage===100).length;
 $('statusNotice').innerHTML='<strong>Un score de 70/100 ne veut pas dire 70 % de chances de gagner.</strong> '+full+' action(s) disposent des cinq dimensions calculables. '+analyses.filter(a=>a.financialArchive).length+' dossier(s) ont des comptes trop anciens pour entrer dans le score actuel. Ouvrez « Lire l’avis » pour comprendre les raisons et les données manquantes.';
 const ranked=analyses.filter(a=>a.verdict==='Intéressante à étudier').sort((a,b)=>(b.coverage>=90)-(a.coverage>=90)||b.score-a.score).slice(0,3);
 $('opportunities').innerHTML=ranked.length?ranked.map(a=>`<article class="card opportunity"><span class="symbol">${esc(a.symbol)} · ${esc(sectors[a.sector]||'Secteur non identifié')}</span><h3>${esc(a.name)}</h3><div class="score">${fmt(a.score)}<small> /100 · couverture ${a.coverage} %</small></div><p>${esc(explain.summary(a).reasons.slice(0,2).join(" ")||explain.summary(a).text)}</p><p class="pill">${a.financial?'Comptes comparables intégrés':'Analyse partielle · comptes non normalisés'}</p><button data-detail="${esc(a.symbol)}">Comprendre l’avis ↗</button></article>`).join(''):'<div class="card"><p>Aucune action ne remplit actuellement les critères de cette sélection. Consultez les fiches et la qualité des données.</p></div>';
 render();compare();method();renderLiveMarket();if(currentSymbol&&$('detail').open)detail(currentSymbol,false);
}
const forecastCache=new WeakMap();
function forecastBrief(a){
 let f=forecastCache.get(a);
 if(!f){f=BRVM_DEEP_UI.forecastNextClose(a);forecastCache.set(a,f);}
 if(!f.available)return '<small>Prévision indisponible : historique ou qualité insuffisants. Voir la fiche.</small>';
 const target=BRVM_DEEP_UI.nextWeekday(f.date);
 return '<small><strong>Clôture estimée : '+fmt(f.expected)+' FCFA</strong><br>Séance attendue du '+esc(target)+'<br>Fourchette : '+fmt(f.low)+' à '+fmt(f.high)+' FCFA<br>'+(f.better?'Erreur réduite sur le test historique.':'Avantage prédictif non établi.')+'</small>';
}
function renderForecastSection(){
 const select=$('forecastAction');if(!select)return;
 const previous=select.value;
 const entries=analyses.map(a=>{let f=forecastCache.get(a);if(!f){f=BRVM_DEEP_UI.forecastNextClose(a);forecastCache.set(a,f);}return {a,f};});
 select.innerHTML=entries.map(({a,f})=>'<option value="'+esc(a.symbol)+'">'+esc(a.symbol+' · '+a.name)+(f.available?'':' · prévision indisponible')+'</option>').join('');
 const chosen=entries.find(x=>x.a.symbol===previous)||entries.find(x=>x.a.symbol==='SNTS'&&x.f.available)||entries.find(x=>x.f.available)||entries[0];
 if(chosen)select.value=chosen.a.symbol;
 $('forecastCoverage').textContent=entries.filter(x=>x.f.available).length+' prévisions calculables sur '+entries.length+' actions. Une valeur indisponible signifie que les données ne permettent pas le calcul.';
 const show=()=>{const item=analyses.find(a=>a.symbol===select.value);$('forecastPanel').innerHTML=item?BRVM_DEEP_UI.renderForecast(item):'<p>Aucune action disponible.</p>';};
 select.onchange=show;show();
}
function render(){
 BRVM_RESEARCH_UI.mount(analyses,window.BRVM_FUNDAMENTALS||{});
 renderForecastSection();
 BRVM_SIGNALS_UI.mount(window.BRVM_FORECAST_REPORT,analyses,symbol=>{const select=$('forecastAction');select.value=symbol;select.onchange();$('previsions').scrollIntoView({behavior:'smooth'});});
 const q=$('search').value.toLocaleLowerCase('fr');
 const rows=analyses.filter(a=>(a.name+' '+a.symbol).toLocaleLowerCase('fr').includes(q)&&($('sector').value==='all'||a.sector===$('sector').value)&&($('filter').value==='all'||a.verdict===$('filter').value));
 const key=$('sort').value;
 rows.sort((a,b)=>key==='name'?a.name.localeCompare(b.name,'fr'):key==='yield'?(b.metrics.yieldNet??-1)-(a.metrics.yieldNet??-1):key==='liquidity'?(b.metrics.turnover??-1)-(a.metrics.turnover??-1):key==='coverage'?b.coverage-a.coverage:(b.score??-1)-(a.score??-1));
 $('rows').innerHTML=rows.map(a=>`<tr><td><input type="checkbox" data-select="${esc(a.symbol)}" aria-label="Comparer ${esc(a.symbol)}" ${selected.has(a.symbol)?'checked':''}></td><td><strong>${esc(a.symbol)}</strong><small>${esc(a.name)}<br>${esc(sectors[a.sector]||'Secteur non identifié')}</small></td><td>${a.liveQuote?.price?fmt(a.liveQuote.price):fmt(a.reference)} FCFA${a.liveQuote?'<small>Cours web · '+esc(window.BRVM_FUNDAMENTALS.liveMarket.session)+'</small>':''}<small class="${a.variation>=0?'positive':'negative'}">${percent(a.liveQuote?.variation??a.variation)}${a.suspended?' · suspendue':''}</small></td><td><span class="badge ${tone(a.verdict)}">${esc(a.verdict)}</span><small class="row-reading">Analyse bulletin du ${a.asOf}. ${esc(explain.summary(a).title)}</small></td><td><strong>${fmt(a.score)} /100</strong><small>Couverture ${a.coverage} %</small><div class="meter"><i style="width:${a.coverage}%"></i></div></td><td>${fmt(a.per,2)}</td><td>${a.metrics.yieldNet===null?'—':fmt(a.metrics.yieldNet,2)+' %'}</td><td>${fmt(a.metrics.turnover)}<small>FCFA · jusqu’à 20 séances</small></td><td><button data-detail="${esc(a.symbol)}">Prévision et avis ↗</button>${forecastBrief(a)}</td></tr>`).join('')||'<tr><td colspan="9" class="empty">Aucune action ne correspond à ces critères.</td></tr>';
 $('result').textContent=rows.length+' action(s) affichée(s) · Les données absentes ne sont jamais remplacées par des résultats financiers nuls.';
}
function compare(){
 $('comparison').hidden=!selected.size;
 $('compareGrid').innerHTML=analyses.filter(a=>selected.has(a.symbol)).map(a=>`<article class="card"><span class="symbol">${esc(a.symbol)}</span><h3>${esc(a.name)}</h3><span class="badge ${tone(a.verdict)}">${esc(a.verdict)}</span><p>Score ${fmt(a.score)} /100 · couverture ${a.coverage} %<br>PER : ${fmt(a.per,2)}<br>Dividende / cours : ${fmt(a.metrics.yieldNet,2)} %<br>Montant médian : ${fmt(a.metrics.turnover)} FCFA<br>Tendance 20 observations : ${percent(a.metrics.ret20)}<br>Volatilité annualisée : ${fmt(a.metrics.volatility,1)} %</p><button data-detail="${esc(a.symbol)}">Ouvrir la fiche</button></article>`).join('');
}
function chart(a){
 const h=a.history.filter(x=>x.reference>0),w=880,height=220,pad=40;if(h.length<2)return '<p class="muted">Historique trop court pour tracer un graphique.</p>';
 const min=Math.min(...h.map(x=>x.reference)),max=Math.max(...h.map(x=>x.reference)),range=max-min||1;
 const x=i=>pad+i/(h.length-1)*(w-2*pad),y=v=>height-pad-(v-min)/range*(height-2*pad);
 // Une rupture détectée coupe la courbe pour éviter de présenter un fractionnement comme une perte.
 let segments=[],points=[];h.forEach((r,i)=>{if(a.events.some(e=>e.date===r.date)&&points.length){segments.push(points);points=[];}points.push(x(i).toFixed(1)+','+y(r.reference).toFixed(1));});if(points.length)segments.push(points);
 return `<svg class="chart" role="img" aria-label="Cours de référence historiques de ${esc(a.symbol)}, sans ajustement des dividendes" viewBox="0 0 ${w} ${height}"><line x1="${pad}" x2="${w-pad}" y1="${height-pad}" y2="${height-pad}" stroke="#dce4d3"/>${segments.map(ps=>`<polyline points="${ps.join(' ')}" fill="none" stroke="#3c7651" stroke-width="2.2"/>`).join('')}<text x="${pad}" y="20" class="chart-label">${fmt(max)} FCFA</text><text x="${pad}" y="${height-25}" class="chart-label">${fmt(min)} FCFA</text><text x="${pad}" y="${height-5}" class="chart-label">${h[0].date}</text><text x="${w-pad}" text-anchor="end" y="${height-5}" class="chart-label">${h.at(-1).date}</text></svg><p class="muted">Cours de référence ajustés des fractionnements vérifiés. Courbe interrompue aux ruptures détectées. Rendement total avec dividendes non représenté.</p>`;
}
function scenarioHTML(s,a){
 if(!s.available)return `<div class="scenario-card"><strong>${s.horizon} séances · échantillon insuffisant</strong><p class="muted">${esc(s.reason)} ${s.n} fenêtres disponibles.</p></div>`;
 const net=v=>((1+v/100)*(1-a.simulation.fee/100)/(1+a.simulation.fee/100)-1)*100;
 return `<div class="scenario-card"><strong>${s.horizon} séances · distribution historique</strong><div class="scenario-values"><div class="negative">${percent(s.low)}<small>Scénario bas du passé</small></div><div>${percent(s.median)}<small>Milieu de l’échantillon</small></div><div class="positive">${percent(s.high)}<small>Scénario haut du passé</small></div></div><p class="muted">Au prix actuel, cela correspond à ${fmt(a.reference*(1+s.low/100))} / ${fmt(a.reference*(1+s.median/100))} / ${fmt(a.reference*(1+s.high/100))} FCFA. Le niveau bas correspond au 10e percentile, le milieu à la médiane et le niveau haut au 90e percentile : ces trois repères résument le passé. Ce ne sont pas des objectifs de cours ni les limites des pertes possibles.</p><p class="muted">${s.n} fenêtres, dont plusieurs se chevauchent (environ ${s.effective} blocs de ${s.horizon} séances). ${fmt(s.positiveRate,1)} % ont terminé en hausse. C’est une fréquence passée, pas une probabilité prédictive. Les scénarios médians après frais estimés donnent ${percent(net(s.median))}, hors fiscalité complémentaire et glissement de prix.</p></div>`;
}
function detail(symbol,open=true){
 const a=analyses.find(x=>x.symbol===symbol);if(!a)return;currentSymbol=symbol;
 const m=a.metrics,sim=a.simulation;
 const list=items=>items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="muted">Aucun élément calculable dans cette catégorie.</p>';
 $('detailBody').innerHTML=`<div class="detail-title"><div><p class="eyebrow">${esc(a.symbol)} · ${esc(sectors[a.sector]||'Secteur non identifié')}</p><h2>${esc(a.name)}</h2></div><div class="price">${fmt(a.reference)} <small>FCFA</small><p class="muted">Cours de référence · ${a.asOf}</p></div></div><span class="badge ${tone(a.verdict)}">${esc(a.verdict)}</span><div class="notice"><strong>Score ${fmt(a.score)} /100 · couverture ${a.coverage} %.</strong> ${a.financial&&a.components.quality!==null?'Les résultats comparables sont intégrés.':a.financial?'Un résultat récent est disponible, mais la dimension financière ne peut pas être entièrement notée.':'Les comptes récents manquent : l’analyse financière reste partielle.'} Ce score reflète les règles du modèle ; il n’est pas une probabilité de gain.</div>
 ${a.liveQuote?`<aside class="notice"><strong>Dernier cours web : ${fmt(a.liveQuote.price)} FCFA · ${esc(window.BRVM_FUNDAMENTALS.liveMarket.session)} à ${esc(window.BRVM_FUNDAMENTALS.liveMarket.time)} (Abidjan).</strong><br>Les avis et simulations ci-dessous utilisent le bulletin complet du ${a.asOf}, au cours de référence de ${fmt(a.reference)} FCFA. Le cours web est un instantané distinct et peut évoluer.</aside>`:''}
 ${plainSummary(a)}
 ${BRVM_DEEP_UI.render(a)}${BRVM_RESEARCH_UI.detail(a,analyses,window.BRVM_FUNDAMENTALS||{})}
 <details class="compact-metrics"><summary>Voir les chiffres en un coup d’œil</summary><div class="metrics">${[['PER',fmt(a.per,2)],['Médiane PER du secteur',fmt(m.peerPER,2)],['Dividende net récent / cours',fmt(m.yieldNet,2)+' %'],['Montant médian échangé',fmt(m.turnover)+' FCFA'],['Séances avec échanges',fmt(m.active)+' %'],['Variation sur 20 observations',percent(m.ret20)],['Volatilité annualisée',fmt(m.volatility,1)+' %'],['Baisse maximale du segment',percent(m.drawdown)]].map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div></details>
 ${explainedIndicators(a)}
 ${chart(a)}<div class="detail-grid"><article class="card"><h3>Ce qui soutient le dossier</h3>${list(a.positives)}</article><article class="card"><h3>Ce qui appelle à la prudence</h3>${list([...a.negatives,...a.warnings])}</article></div>
 <h3>Ce qui compose le score</h3><div class="table-wrap"><table><thead><tr><th>Dimension</th><th>Note /100</th><th>Poids du profil</th></tr></thead><tbody>${Object.keys(label).map(k=>`<tr><td>${label[k]}</td><td>${fmt(a.components[k])}${a.components[k]===null?' · non évalué':''}</td><td>${a.weights[k]} %</td></tr>`).join('')}</tbody></table></div><p class="muted">Score = somme(note × poids disponible) / somme(poids disponibles). Couverture = somme des poids des dimensions évaluées. Les scores partiels doivent être comparés avec prudence. RSI simple 14 observations : ${fmt(m.rsi,1)} ; moyenne 20 : ${fmt(m.ma20)} FCFA ; moyenne 60 : ${fmt(m.ma60)} FCFA.</p>
 ${financialContext(a)}
 <h3>Repère de valorisation</h3><p class="muted">${m.indicativeValue!==null?'À bénéfice implicite inchangé, appliquer le PER médian sectoriel donnerait '+fmt(m.indicativeValue)+' FCFA. Ce simple repère ne mesure pas la valeur intrinsèque et ne tient pas compte des différences de risque ou de croissance.':'Ce repère n’est pas calculé lorsque des comptes récents exploitables, un bénéfice positif ou au moins trois autres entreprises comparables manquent, ni lorsque le bénéfice recule de plus de 30 %. Cela évite de transformer un bénéfice ancien ou fragilisé en faux objectif de prix.'}</p>
 <h3>Scénarios : ce que le passé permet d’illustrer</h3><p class="muted">Aucune prévision garantie. Les distributions utilisent les fenêtres valides du dernier segment sans rupture détectée. Elles ne sont pas conditionnées à la situation actuelle. Leur fiabilité future n’est pas établie.</p>${a.scenarios.map(s=>scenarioHTML(s,a)).join('')}
 <details class="card"><summary>Contrôle d’une règle de tendance passée</summary><p class="muted">Règle testée : clôture au-dessus de la moyenne 20, entrée à l’ouverture suivante, sortie après 5 séances. Positions sans chevauchement, ${fmt(sim.fee,2)} % de frais à l’achat et à la vente. ${a.backtest.n} opérations ; rendement moyen ${percent(a.backtest.mean)} ; opérations positives ${fmt(a.backtest.winRate,1)} %. ${a.backtest.validated?'Échantillon minimal atteint, sans garantie de performance future.':'Moins de 30 opérations : validation statistique insuffisante.'} Les ouvertures et clôtures sont des hypothèses d’exécution ; carnet d’ordres, glissement et fiscalité supplémentaire non modélisés. Aucun réglage du modèle n’est choisi à partir de ce test.</p></details>
 <h3>Simuler votre achat</h3><article class="card"><p>Budget ${fmt(sim.budget)} FCFA · frais ${fmt(sim.fee,2)} % par opération.<br><strong>${fmt(sim.shares)} action(s)</strong> au cours de référence · coût estimé ${fmt(sim.cost)} FCFA.<br>Prix de revente pour couvrir ces frais : <strong>${fmt(sim.breakEven,2)} FCFA</strong>, hors autres taxes et glissement.</p><p class="muted">Repère de taille : 5 % du montant médian échangé = ${fmt(m.positionLimit)} FCFA. Il s’agit d’un seuil de vigilance indicatif, sans garantie d’exécution. Les frais fixes et minimums ne sont pas modélisés.</p></article>
 <h3>Sources et publications</h3><ul class="source-list"><li><a href="${esc(a.source)}#page=${a.page}" target="_blank" rel="noopener">Bulletin officiel du ${a.asOf} · page ${a.page} ↗</a></li>${a.reports.slice(0,5).map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a></li>`).join('')}<li><a href="${esc(a.issuerUrl)}" target="_blank" rel="noopener">Toutes les publications de l’émetteur ↗</a></li></ul>${a.events.length?'<h3>Ruptures et événements détectés</h3>'+list(a.events.map(e=>e.date+' · '+e.type)):''}`;
 BRVM_DEEP_UI.bind(a);
 if(open&&!$('detail').open)$('detail').showModal();
}
function method(){
 const w=analyses[0]?.weights||{};
 $('methodContent').innerHTML=`<p>Version ${BRVM_ENGINE.VERSION}. Poids du profil courant : ${Object.keys(w).map(k=>label[k]+' '+w[k]+' %').join(' ; ')}.</p><ul><li>Résultats : 50 points si le résultat est positif, plus sa croissance plafonnée entre −30 et +30 points, plus la croissance d’activité plafonnée entre −20 et +20. Une perte retire les 50 points de base. Les banques utilisent le PNB, pas le chiffre d’affaires industriel. Ce volet ne mesure pas à lui seul la solvabilité.</li><li>Valorisation : 50 + 65 × (PER médian des autres entreprises du secteur / PER de l’action − 1), borné entre 0 et 100. Au moins 3 pairs avec un PER positif inférieur à 100. Un PER absent n’est jamais assimilé à zéro.</li><li>Dividende : dernier montant net / cours de référence, puis note plafonnée à 100 pour un rendement de 8 %. Seuls les paiements datant de moins de 400 jours sont retenus. Ce montant peut être exceptionnel ; sa récurrence n’est pas établie.</li><li>Liquidité : note logarithmique du montant médian réel échangé (0 à 100 entre 100 000 et 1 milliard FCFA), multipliée par la proportion de séances actives. Minimum 15 séances disponibles.</li><li>Tendance : 50 + 2 × variation sur 20 observations valides, avec +10 ou −10 selon la position face à la moyenne 60, borné entre 0 et 100. RSI simple sur 14 observations, volatilité logarithmique annualisée sur 252 séances.</li><li>Avis : score ≥65 « Intéressante à étudier », 45 à 65 « À surveiller », &lt;45 « Prudence ». Couverture &lt;45 % : « Données insuffisantes ». Une suspension, un écart de variation &gt;0,16 point ou une séance vieille de plus de 7 jours suspend l’avis. Une perte publiée force « Prudence ». Un recul du bénéfice supérieur à 30 % ou un PER &gt;100 empêchent un avis « Intéressante à étudier ».</li><li>Scénarios : percentiles 10/50/90 des variations de prix sur 5 ou 20 séances. Au moins 40 fenêtres valides, potentiellement chevauchantes. Ce sont des fréquences historiques, pas un modèle prédictif validé.</li><li>Les fractionnements vérifiés sont appliqués aux cours, volumes et montants par action avant les calculs. Les autres opérations sur titres peuvent encore limiter la série. Les divergences &gt;2 % entre référence antérieure et cours précédent publié, les mouvements &gt;16 % et les changements de date de dividende coupent les séries. Les fenêtres suspendues ou incohérentes sont exclues.</li></ul><p>Données et limites : ${data.missingDates?.length||0} dates de semaine sans bulletin récupéré (jours fériés possibles). Cours web officiels datés en complément des bulletins complets ; pas de carnet d’ordres ni de flux continu. Bilans annuels normalisés pour une partie des sociétés, avec données absentes explicites. Une dette financière supérieure à deux fois les fonds propres empêche un avis favorable ; des fonds propres nuls ou négatifs imposent la prudence. Ces garde-fous ne modifient pas le score. Pas d’analyse exhaustive de la gouvernance, du risque pays ou de l’actualité. Les comptes vérifiés peuvent être plus anciens que la dernière publication : les rapports récents restent accessibles dans chaque fiche. Les scores et seuils sont des choix explicites de conception, non des normes BRVM. Un contrôle historique ne prouve pas une capacité de prédiction.</p>`;
 $('version').textContent='Moteur '+BRVM_ENGINE.VERSION+' · Sources officielles et calculs explicables.';
}
for(const [k,v] of Object.entries(sectors))$('sector').add(new Option(v,k));
['search','sort','filter','sector'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',render));
['profile','budget','fee'].forEach(id=>$(id).addEventListener('change',recalculate));
$('closeDetail').onclick=()=>{$('detail').close();currentSymbol=null;};
$('detail').addEventListener('close',()=>currentSymbol=null);
$('clearCompare').onclick=()=>{selected.clear();compare();render();};
$('rows').addEventListener('change',e=>{const s=e.target.dataset.select;if(!s)return;if(e.target.checked){if(selected.size>=3){e.target.checked=false;alert('Trois actions maximum pour garder une comparaison lisible.');return;}selected.add(s);}else selected.delete(s);compare();});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)detail(b.dataset.detail);});
async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(j.error||'Opération indisponible');return j;}
$('export').onclick=async()=>{if(window.BRVM_PUBLIC_MODE){exportPublic();return;}try{const r=await api('/api/export',{options:options(),rows:analyses.map(a=>({symbol:a.symbol,name:a.name,date:a.asOf,verdict:a.verdict,score:a.score,coverage:a.coverage,per:a.per,yield:a.metrics.yieldNet,turnover:a.metrics.turnover,source:a.source}))});alert('Analyse enregistrée dans le dossier du projet : '+r.file);}catch(e){alert('Ouvrez le site avec « Ouvrir le site.cmd » pour exporter dans le dossier du projet. '+e.message);}};
function currentRevision(){return (data.revision||data.fetched||'')+'|'+(window.BRVM_FINANCIALS_REVISION||'legacy')+'|'+(window.BRVM_FUNDAMENTALS_REVISION||'legacy')+'|'+(window.BRVM_FORECAST_REPORT?.inputSha256||'none');}
let appliedRevision=currentRevision(), dataRefreshRunning=false, automaticStatusRunning=false, pendingRevision=null;
let lastCalendarDate=new Date().toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'});
function loadDataScript(name,integrity){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=name+'?verification='+Date.now();if(integrity){script.integrity=integrity;script.crossOrigin='anonymous';}script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(Error('Chargement des données interrompu'));};document.head.appendChild(script);});}
async function applyPublishedData(revision,manifest={}){
 if(revision===appliedRevision||dataRefreshRunning)return;
 if($('detail').open){pendingRevision={revision,manifest};$('job').textContent='De nouvelles données sont disponibles. Elles seront chargées automatiquement à la fermeture de cette fiche.';return;}
 dataRefreshRunning=true;
 const keys=['BRVM_DATA','BRVM_FINANCIALS','BRVM_FINANCIALS_REVISION','BRVM_FUNDAMENTALS','BRVM_FUNDAMENTALS_REVISION','BRVM_FORECAST_REPORT','BRVM_OFFICIAL'];
 const saved=Object.fromEntries(keys.map(k=>[k,window[k]])),previousApplied=appliedRevision;
 try{
 for(const name of ['donnees.js','finances.js','fondamentaux.js','previsions-calcul.js',...(window.BRVM_PUBLIC_MODE?['brvm-officiel-public.js']:[])])await loadDataScript(name,manifest.assets?.[name]);
 const next=window.BRVM_DATA,report=window.BRVM_FORECAST_REPORT;
 const candidate=(next.revision||next.fetched||'')+'|'+(window.BRVM_FINANCIALS_REVISION||'legacy')+'|'+(window.BRVM_FUNDAMENTALS_REVISION||'legacy')+'|'+(report?.inputSha256||'none');
 if(candidate!==revision||report?.asOf!==next.session||report?.dataRevision!==(next.revision||next.fetched))throw Error('Publication partielle');
 data=next;window.BRVM_OFFICIAL_UI?.mount(window.BRVM_OFFICIAL);appliedRevision=currentRevision();$('autoStatus').dataset.appliedRevision=appliedRevision;pendingRevision=null;recalculate();$('job').textContent='Nouvelles données chargées et avis recalculés automatiquement.';}
 catch(e){for(const key of keys)window[key]=saved[key];data=saved.BRVM_DATA;appliedRevision=previousApplied;window.BRVM_OFFICIAL_UI?.mount(saved.BRVM_OFFICIAL);try{recalculate();}catch{}$('job').textContent='Les nouvelles données n’ont pas pu être chargées de façon cohérente. Les dernières données affichées sont conservées ; nouvel essai automatique.';}
 finally{dataRefreshRunning=false;}
}
function automaticLabel(j){
 const target=$('autoStatus');if(!target)return;
 if(!j.auto){target.textContent='Relancez « Ouvrir le site.cmd » pour activer le nouveau serveur automatique.';return;}
 let text=j.auto.enabled?'Automatique : vérification toutes les '+j.auto.intervalMinutes+' min tant que le serveur fonctionne.':'Vérification automatique désactivée.';
 if(j.auto.scheduledTask)text+=' Tâche quotidienne programmée à '+j.auto.scheduledTime+' (Paris).';
 if(j.lastSuccess)text+=' Dernière vérification réussie : '+new Date(j.lastSuccess).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})+'.';
 if(j.state==='running')text+=' Vérification en cours…';
 if(j.state==='error')text+=' Échec de la dernière tentative ; nouvel essai automatique dans '+j.auto.retryMinutes+' min. Les données précédentes restent disponibles.';
 target.textContent=text;
 $('refreshStatus').textContent='Actualisation locale : '+(j.lastSuccess||'aucune collecte réussie confirmée')+'. Le bouton lance la collecte sur le serveur local.';
}
async function checkJob(){
 if(window.BRVM_PUBLIC_MODE)return checkPublicData();
 if(automaticStatusRunning)return;automaticStatusRunning=true;
 try{
  const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('Serveur indisponible');const j=await r.json();
  automaticLabel(j);$('autoStatus').dataset.appliedRevision=appliedRevision;$('update').disabled=j.state==='running';
  const date=new Date().toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'});if(date!==lastCalendarDate){lastCalendarDate=date;recalculate();}
  if(j.state==='running')$('job').textContent=j.message||'Vérification automatique en cours…';
  else{if(polling){clearInterval(polling);polling=null;}$('job').textContent=j.message||'';if(j.revision&&j.revision!==appliedRevision)await applyPublishedData(j.revision);}
 }catch(e){$('autoStatus').textContent='Le serveur local est inaccessible. Les données enregistrées restent consultables ; relancez « Ouvrir le site.cmd » pour rétablir les mises à jour automatiques.';$('update').disabled=false;}
 finally{automaticStatusRunning=false;}
}
$('update').onclick=async()=>{if(window.BRVM_PUBLIC_MODE){await checkPublicData(true);return;}try{await api('/api/update',{});$('update').disabled=true;if(!polling)polling=setInterval(checkJob,2500);checkJob();}catch(e){$('job').textContent='Actualisation indisponible : '+e.message+'. Utilisez le lanceur du site.';}};
$('refreshPublished').onclick=()=>{if(!automaticStatusRunning)$('update').click();};
$('detail').addEventListener('close',()=>{if(pendingRevision)applyPublishedData(pendingRevision.revision,pendingRevision.manifest);});
recalculate();
if(location.protocol==='http:'||location.protocol==='https:'){checkJob();setInterval(checkJob,30000);}
else $('autoStatus').textContent='Pour activer les mises à jour automatiques, ouvrez le site avec « Ouvrir le site.cmd ».';

async function checkPublicData(manual=false){
 if(automaticStatusRunning)return;automaticStatusRunning=true;
 if(manual){$('update').disabled=true;$('refreshPublished').disabled=true;$('job').textContent='Recherche de la dernière publication…';}
 try{const r=await fetch('status-public.json?verification='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Publication inaccessible');const j=await r.json();
 const health=window.BRVM_UPDATE_HEALTH?.label(j,new Date(),window.BRVM_OFFICIAL?.calendar);
 $('autoStatus').textContent=health?.text||'Actualisation automatique : dernier bulletin '+j.session;
 $('autoStatus').dataset.health=health?.state||'unknown';
 $('refreshStatus').textContent=window.BRVM_UPDATE_HEALTH?.details(j)||'Dernier bulletin : '+j.session;
 if(j.codeRevision&&window.BRVM_CODE_REVISION&&j.codeRevision!==window.BRVM_CODE_REVISION){$('job').textContent='Une nouvelle version du site est disponible. Appuyez sur Actualiser pour la charger.';if(manual&&!$('detail').open)location.reload();return;}
 if(j.revision!==appliedRevision)await applyPublishedData(j.revision,j);else if(manual)$('job').textContent='Vous consultez déjà la dernière publication disponible. La collecte est exécutée sur GitHub, pas depuis votre navigateur.';
 const date=new Date().toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'});if(date!==lastCalendarDate){lastCalendarDate=date;recalculate();}
 }catch(e){$('autoStatus').textContent='Vérification de la nouvelle publication impossible. Les dernières données chargées sont conservées.';if(manual)$('job').textContent='Actualisation impossible pour le moment. Les dernières données restent affichées ; réessayez dans quelques instants.';}
 finally{automaticStatusRunning=false;$('update').disabled=false;$('refreshPublished').disabled=false;}
}
function exportPublic(){
 const fields=['symbol','name','asOf','verdict','score','coverage'];
 const cell=x=>'"'+String(x??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 const csv='\ufeff'+[fields.join(';'),...analyses.map(a=>fields.map(k=>cell(a[k])).join(';'))].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='analyse-brvm.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderLiveMarket(){
 const live=window.BRVM_FUNDAMENTALS?.liveMarket;
 let el=document.getElementById('liveMarketNotice');
 if(!el){el=document.createElement('aside');el.id='liveMarketNotice';el.className='notice';document.querySelector('.hero').after(el);}
 if(!live){el.textContent='Instantané des cours web non disponible. Dernier bulletin analysé : '+data.session;return;}
 el.innerHTML='<strong>Cours officiels disponibles : '+esc(live.session)+' à '+esc(live.time)+' (Abidjan).</strong> Dernier bulletin complet analysé : '+esc(data.session)+'. '+(live.session>data.session?'Les cours de cette nouvelle séance sont affichés dans le tableau ; son bulletin PDF n’est pas encore intégré aux avis.':'Les cours web sont présentés séparément du cours de référence des calculs.')+' <a href="'+esc(live.source)+'" target="_blank" rel="noopener">Vérifier sur la BRVM ↗</a>';
 $('session').textContent='Cours web : '+live.session+' · bulletin : '+data.session;
}

