/* Évolution observée en séance : instantanés différés, sans modifier les prévisions initiales. */
(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,n=2)=>Number.isFinite(x)?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:n}).format(x):'Non disponible';
const money=x=>Number.isFinite(x)?fmt(x)+' FCFA':'Non disponible';
const percent=x=>Number.isFinite(x)?(x>0?'+':'')+fmt(x)+' %':'Non disponible';
let selected='SNTS';
function inspect(fundamentals,data,symbol){
 const live=fundamentals?.liveMarket,history=fundamentals?.intraday?.snapshots||[];
 if(!live)return null;
 const previous=(data?.sessions||[]).filter(s=>s.date<live.session).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 const prior=new Map((previous?.stocks||[]).map(r=>[r.symbol,r]));
 const current=live.stocks.map(q=>{
  const p=prior.get(q.symbol);
  return {...q,previousClose:p?.close>0&&!p.inconsistent&&!p.suspended?p.close:null,
   daily:p?.close>0&&!p.inconsistent&&!p.suspended?(q.price/p.close-1)*100:null};
 });
 const active=current.filter(q=>q.volume>0&&Number.isFinite(q.daily));
 const chosen=current.find(q=>q.symbol===symbol)||current[0];
 const points=history.filter(s=>s.session===live.session&&s.time<=live.time).map(s=>{const row=s.rows.find(r=>r[0]===chosen?.symbol);return row?{time:s.time,collected:s.collected,price:row[1],volume:row[2]}:null;}).filter(Boolean);
 const first=points[0],last=points.at(-1),previousPoint=points.at(-2);
 return {live,previousDate:previous?.date,chosen,current,points,
  pressure:{up:active.filter(q=>q.daily>0).length,down:active.filter(q=>q.daily<0).length,flat:active.filter(q=>q.daily===0).length,n:active.length},
  fromFirst:first&&first.price>0?(chosen.price/first.price-1)*100:null,
  volumeDelta:previousPoint&&last&&last.volume>=previousPoint.volume?last.volume-previousPoint.volume:null,
  volumeRevised:!!(previousPoint&&last&&last.volume<previousPoint.volume),
  revisions:points.some((p,i)=>i>0&&p.time===points[i-1].time&&p.price!==points[i-1].price)};
}
function plot(points){
 if(points.length<2)return '<p>Il faut au moins deux instantanés de cette séance pour afficher l’évolution observée.</p>';
 const w=760,h=170,pad=30,lo=Math.min(...points.map(p=>p.price)),hi=Math.max(...points.map(p=>p.price)),range=hi-lo||1;
 const mins=p=>Number(p.time.slice(0,2))*60+Number(p.time.slice(3)),start=mins(points[0]),span=Math.max(1,mins(points.at(-1))-start);
 const coords=points.map(p=>(pad+(mins(p)-start)/span*(w-pad*2)).toFixed(1)+','+(h-pad-(p.price-lo)/range*(h-pad*2)).toFixed(1)).join(' ');
 return '<svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Derniers cours publiés observés aux heures collectées"><polyline points="'+coords+'" fill="none" stroke="#3c7651" stroke-width="2.5"/><text x="'+pad+'" y="18">'+fmt(hi)+' FCFA</text><text x="'+pad+'" y="'+(h-7)+'">'+esc(points[0].time)+'</text><text x="'+(w-pad)+'" text-anchor="end" y="'+(h-7)+'">'+esc(points.at(-1).time)+'</text></svg><p class="muted">Les lignes relient uniquement les instantanés collectés ; les transactions intermédiaires ne sont pas connues. Les extrêmes de cette courbe ne sont pas les plus haut et plus bas réels de la journée.</p>';
}
function panel(d){
 const q=d.chosen;if(!q)return '<p>Aucune action disponible.</p>';
 return '<article class="card"><h3>'+esc(q.symbol)+' · '+esc(q.name)+'</h3><div class="metrics"><div><span>Dernier cours publié</span><strong>'+money(q.price)+'</strong><small>'+esc(d.live.session)+' à '+esc(d.live.time)+' (Abidjan)</small></div><div><span>Depuis la clôture du '+esc(d.previousDate)+'</span><strong>'+percent(q.daily)+'</strong><small>Clôture de comparaison : '+money(q.previousClose)+'</small></div><div><span>Depuis le premier instantané conservé aujourd’hui</span><strong>'+percent(d.fromFirst)+'</strong><small>'+esc(d.points[0]?.time||'Pas encore disponible')+'</small></div></div>'+
 '<p>'+d.points.length+' instantané(s) conservé(s) pour cette action aujourd’hui. Volume publié : '+fmt(q.volume,0)+' titres. '+(d.volumeDelta!==null?'Variation du volume entre les deux derniers instantanés : '+fmt(d.volumeDelta,0)+' titres.':'')+'</p>'+
 (d.volumeRevised?'<p class="notice">Le volume publié a diminué : révision ou incohérence possible. Aucune quantité négative d’échanges n’est déduite.</p>':'')+(d.revisions?'<p class="notice">Plusieurs contenus ont été publiés au même horodatage ; les révisions sont conservées.</p>':'')+
 plot(d.points)+'<details><summary>Voir les observations horodatées</summary><div class="table-wrap"><table><thead><tr><th>Heure officielle (Abidjan)</th><th>Cours</th><th>Volume publié</th><th>Collecté à (UTC)</th></tr></thead><tbody>'+d.points.slice(-100).map(p=>'<tr><td>'+esc(p.time)+'</td><td>'+money(p.price)+'</td><td>'+fmt(p.volume,0)+'</td><td>'+esc(p.collected)+'</td></tr>').join('')+'</tbody></table></div></details><p class="muted">Données publiques BRVM différées de 15 minutes. Ceci décrit la séance en cours ; ce n’est ni une clôture confirmée ni une nouvelle prévision. Les estimations enregistrées avant la séance sont conservées séparément.</p></article>';
}
function mount(fundamentals,data){
 const el=document.getElementById('evolution-seance');if(!el)return;
 const d=inspect(fundamentals,data,selected);
 if(!d){el.innerHTML='<h2>Évolution de la séance</h2><p>Aucun instantané officiel disponible.</p>';return;}
 selected=d.chosen?.symbol||selected;
 el.innerHTML='<p class="eyebrow">OBSERVATIONS DE LA SÉANCE EN COURS</p><h2>Comment les cours évoluent aujourd’hui</h2><p>Instantané du '+esc(d.live.session)+' à '+esc(d.live.time)+' (Abidjan), récupéré à '+esc(d.live.collected)+' (UTC). Comparaison avec le bulletin confirmé du '+esc(d.previousDate)+'.</p><p><strong>'+d.pressure.up+' hausse(s) · '+d.pressure.down+' baisse(s) · '+d.pressure.flat+' inchangée(s)</strong> sur '+d.pressure.n+' actions ayant échangé et une clôture comparable.</p><label>Action à suivre <select id="intradaySymbol">'+d.current.map(q=>'<option value="'+esc(q.symbol)+'" '+(q.symbol===selected?'selected':'')+'>'+esc(q.symbol+' · '+q.name)+'</option>').join('')+'</select></label><div id="intradayPanel">'+panel(d)+'</div><p class="muted">Archivage automatique au fil des publications : au plus 400 instantanés et 10 séances. La fréquence programmée est d’environ cinq minutes en séance, mais GitHub peut retarder les passages. Un historique complet à la seconde n’est pas disponible.</p>';
 el.querySelector('#intradaySymbol').onchange=e=>{selected=e.target.value;const next=inspect(fundamentals,data,selected);document.getElementById('intradayPanel').innerHTML=panel(next);};
}
root.BRVM_INTRADAY_UI={mount,inspect,panel};
if(typeof module!=='undefined')module.exports=root.BRVM_INTRADAY_UI;
})(typeof window!=='undefined'?window:globalThis);
