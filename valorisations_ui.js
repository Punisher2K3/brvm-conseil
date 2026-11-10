(function(root){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number.isFinite(x)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(x):'Non disponible';
const money=x=>Number.isFinite(x)?fmt(x)+' FCFA':'Non disponible';
const state={symbol:'SNTS',peer:'',r:.12,g:.03};
const engine=()=>root.BRVM_VALUATIONS;
function detail(a,all,store,settings=state){
 const v=engine().value(a,all,store,settings);
 const sources=a.deep?.annual;
 const synthesis=v.central!==null?'<p><strong>Repère central : '+money(v.central)+'</strong> par action · écart au cours : '+fmt(v.upside)+' %.</p><p>Scénario prudent : '+money(v.totals[0].value)+' · favorable : '+money(v.totals[2].value)+'.</p>':'<p class="notice">'+esc(v.assessment)+' Les méthodes disponibles restent consultables ci-dessous ; aucune moyenne artificielle n’est créée.</p>';
 return '<article class="card"><h3>Combien pourrait valoir '+esc(a.symbol)+' ?</h3><p>'+esc(v.price.label)+' au '+esc(v.price.date)+(v.price.time?' à '+esc(v.price.time)+' (Abidjan)':'')+' : <strong>'+money(v.price.price)+'</strong>.</p>'+synthesis+(v.central!==null?'<p><strong>'+esc(v.assessment)+'</strong></p>':'')+
 '<p>'+v.count+' méthodes exploitables, regroupées en '+v.families+' familles. Les méthodes relatives partagent des hypothèses et ne sont pas des confirmations indépendantes. Écart entre estimations centrales : '+fmt(v.dispersion)+' %.</p>'+
 '<div class="table-wrap"><table><thead><tr><th>Méthode</th><th>Prudent</th><th>Central</th><th>Favorable</th></tr></thead><tbody>'+v.methods.map(m=>'<tr><th>'+esc(m.name)+'</th>'+(m.available?m.values.map(x=>'<td>'+money(x.value)+'</td>').join(''):'<td colspan="3">'+esc(m.reason)+'</td>')+'</tr>').join('')+'</tbody></table></div>'+
 '<details><summary>Hypothèses, formules et qualité des données</summary><p>Taux de rendement exigé : '+fmt(v.r*100)+' % par an ; croissance perpétuelle supposée : '+fmt(v.g*100)+' %. Ce sont des hypothèses illustratives modifiables, pas des prévisions validées ni un taux de marché calibré.</p><p>Prudent : taux +2 points, croissance −1 point, bénéfice/actif net/flux −20 % selon méthode. Favorable : taux −2 points, croissance +1 point, bases +20 %. Dividendes : médiane stable de trois exercices ; formule D × (1 + g) / (r − g).</p><p>La synthèse est la médiane des valeurs par scénario lorsqu’au moins deux méthodes fonctionnent. Si les deux variantes PER sont calculables, seule la variante sur BPA vérifiés entre dans la synthèse. La fourchette exprime une sensibilité aux hypothèses ; elle n’est pas un intervalle de confiance statistique. Une dispersion supérieure à 50 % est signalée comme forte divergence.</p><ul>'+v.methods.map(m=>'<li><strong>'+esc(m.name)+' :</strong> '+esc(m.note)+'</li>').join('')+'</ul><p>Comptes : '+esc(sources?.periodEnd)+' ; publication : '+esc(sources?.published)+'. '+(sources?'<a href="'+esc(sources.source)+'" target="_blank" rel="noopener">États financiers utilisés</a>':'Comptes annuels récents non vérifiés.')+'</p><p>Les distributions sont ajustées des fractionnements connus. Le nombre d’actions doit être cohérent avec un instantané récent ; les fonds propres consolidés ou élargis sont écartés du calcul strict par action.</p><p><a href="https://pages.stern.nyu.edu/adamodar/pdfiles/eqnotes/ddm.pdf" target="_blank" rel="noopener">Méthode d’actualisation des dividendes</a> · <a href="https://pages.stern.nyu.edu/~adamodar/pdfiles/eqnotes/finsvc.pdf" target="_blank" rel="noopener">Valorisation des entreprises financières</a></p></details>'+
 '<p><strong>Ce qui peut faire évoluer cette valeur :</strong> prochains bénéfices, distributions, dette, rentabilité et taux exigé. Une valeur économique estimée ne donne pas le cours de clôture de demain. Consultez la rubrique Prévisions pour cet autre horizon.</p></article>';
}
function comparison(a,b,store){
 if(!b)return '<p>Pas d’autre entreprise du même secteur dans la base.</p>';
 const c=engine().compare(a,b,store);
 return '<article class="card"><h3>'+esc(a.symbol)+' ou '+esc(b.symbol)+' : laquelle mérite davantage d’étude ?</h3><p><strong>'+esc(c.conclusion)+'</strong></p><p>'+esc(c.trading||'')+'</p><p>Horizon fondamental : long terme, sans objectif de cours daté. Secteur BRVM commun ; les modèles économiques peuvent différer.</p>'+
 '<div class="table-wrap"><table><thead><tr><th>Critère</th><th>'+esc(a.symbol)+'</th><th>'+esc(b.symbol)+'</th><th>Lecture</th></tr></thead><tbody>'+c.criteria.map(r=>'<tr><th>'+esc(r.label)+'</th><td>'+fmt(r.a)+' '+r.unit+'</td><td>'+fmt(r.b)+' '+r.unit+'</td><td>'+esc(r.winner)+'</td></tr>').join('')+'</tbody></table></div>'+
 '<p class="muted">Comparaison sur les mêmes critères disponibles chez les deux sociétés. Au moins trois critères comparables et deux avantages nets sont nécessaires à une préférence. Les critères comptables exigent le même exercice et des périmètres de consolidation et de fonds propres compatibles. Un PER faible ou un rendement élevé peut refléter un risque ; les critères ne constituent pas un classement universel. Les banques n’utilisent pas les ratios industriels de dette et de marge.</p></article>';
}
function mount(all,store){
 const select=document.getElementById('valueAction');if(!select)return;
 const peer=document.getElementById('valuePeer'),rate=document.getElementById('valueRate'),growth=document.getElementById('valueGrowth');
 select.innerHTML=all.map(a=>'<option value="'+esc(a.symbol)+'">'+esc(a.symbol+' · '+a.name)+'</option>').join('');
 if(!all.some(a=>a.symbol===state.symbol))state.symbol=all[0]?.symbol;
 select.value=state.symbol;rate.value=state.r*100;growth.value=state.g*100;
 const show=()=>{
  const a=all.find(a=>a.symbol===state.symbol);if(!a)return;
  document.getElementById('valuePanel').innerHTML=detail(a,all,store);
  const candidates=all.filter(b=>b.sector===a.sector&&b.symbol!==a.symbol);
  peer.innerHTML=candidates.map(b=>'<option value="'+esc(b.symbol)+'">'+esc(b.symbol+' · '+b.name)+'</option>').join('');
  if(!candidates.some(b=>b.symbol===state.peer))state.peer=candidates[0]?.symbol||'';
  peer.value=state.peer;
  document.getElementById('sectorPanel').innerHTML=comparison(a,candidates.find(b=>b.symbol===state.peer),store);
 };
 select.onchange=()=>{state.symbol=select.value;show();};
 peer.onchange=()=>{state.peer=peer.value;show();};
 const hypotheses=()=>{
  const r=Number(rate.value),g=Number(growth.value);
  const warning=document.getElementById('valueHypothesisWarning');
  if(rate.value===''||growth.value===''||!Number.isFinite(r)||!Number.isFinite(g)||r<8||r>30||g<0||g>5||r-2<=g+1){warning.textContent='Saisissez un rendement de 8 à 30 %, une croissance de 0 à 5 %, et un rendement supérieur de plus de 3 points à la croissance. Les derniers calculs valides restent affichés.';return;}
  warning.textContent='';state.r=r/100;state.g=g/100;show();
 };
 rate.onchange=hypotheses;growth.onchange=hypotheses;show();
}
root.BRVM_RESEARCH_UI={mount,detail,comparison};
})(window);
