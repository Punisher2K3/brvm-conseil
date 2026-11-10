/* Valorisation complémentaire : scénarios explicites, aucune donnée financière inventée. */
(function(root){
'use strict';
const finite=Number.isFinite, positive=x=>finite(x)&&x>0;
const median=a=>{const b=a.filter(finite).sort((x,y)=>x-y),i=(b.length-1)/2;return b.length?(b[Math.floor(i)]+b[Math.ceil(i)])/2:null;};
const scenarios=[{name:'Prudent',delta:.02,gdelta:-.01,factor:.8},{name:'Central',delta:0,gdelta:0,factor:1},{name:'Favorable',delta:-.02,gdelta:.01,factor:1.2}];
function datePrice(a,store){
 const live=store.liveMarket;
 const quote=a.liveQuote;
 return quote&&positive(quote.price)&&live?.session>=a.asOf?{price:quote.price,date:live.session,label:'Cours web différé',time:live.time}:{price:a.reference,date:a.asOf,label:'Référence du bulletin',time:null};
}
function basis(a,store){
 const f=a.deep?.annual,p=datePrice(a,store);
 const cap=a.deep?.capitalisationSnapshot;
 const age=cap?(Date.parse(p.date)-Date.parse(cap.session))/86400000:null;
 const shares=cap&&positive(cap.shares)&&age>=0&&age<=7?cap.shares:null;
 const strictEquity=f&&!/consolid|groupe|ressources assimil/i.test((f.scope||'')+' '+(f.equityBasis||''))&&positive(f.equity)?f.equity:null;
 return {f,p,shares,bvps:shares&&strictEquity?strictEquity/shares:null};
}
function gordon(dividend,r,g){return positive(dividend)&&finite(r)&&finite(g)&&r>g&&g> -1?dividend*(1+g)/(r-g):null;}
function value(a,all,store={},settings={}){
 const r=settings.r??.12,g=settings.g??.03;
 const b=basis(a,store),d=a.deep||{},f=b.f;
 const blocked=a.verdict==='Avis suspendu'||!positive(b.p.price);
 const methods=[];
 const add=(id,name,eligible,reason,calc,family,note)=>methods.push({id,name,family,note,available:!blocked&&eligible,reason:blocked?'Avis suspendu ou prix inexploitable.':reason,values:!blocked&&eligible?scenarios.map(s=>({name:s.name,value:calc(s)})):[]});
 const eps=positive(d.eps)?d.eps:null;
 const peers=all.filter(x=>x.symbol!==a.symbol&&x.sector===a.sector&&x.deep?.annual?.periodEnd===f?.periodEnd&&x.verdict!=='Avis suspendu');
 const perPeers=peers.filter(x=>positive(x.deep?.eps)).map(x=>datePrice(x,store).price/x.deep.eps).filter(positive);
 const per=perPeers.length>=2?median(perPeers):null;
 add('per','BPA publié × PER médian des pairs',!!(eps&&per&&f&&f.profit>0),'BPA publié positif, comptes récents et deux pairs du même exercice avec BPA publié nécessaires.',s=>eps*s.factor*per,'relative','BPA publié ajusté des fractionnements ; pairs du même secteur et du même exercice ('+perPeers.length+' pairs, échantillon limité). Les différences de périmètre et de croissance peuvent justifier un autre multiple.');
 const quotedPERs=peers.map(x=>x.per).filter(positive);
 const quotedPER=quotedPERs.length>=2?median(quotedPERs):null;
 add('quotedPer','BPA publié × PER sectoriels du bulletin',!!(eps&&quotedPER&&f&&f.profit>0),'BPA publié positif, comptes récents et deux PER sectoriels positifs du bulletin nécessaires.',s=>eps*s.factor*quotedPER,'relative','Variante utilisant les PER publiés du bulletin, dont le bénéfice sous-jacent et l’exercice ne sont pas toujours confirmés. Ce repère moins strict est distinct du PER recalculé sur BPA vérifié. Échantillon limité ; ne pas compter ces deux variantes comme deux méthodes indépendantes.');
 const bookPeers=peers.map(x=>basis(x,store)).filter(x=>positive(x.bvps)).map(x=>x.p.price/x.bvps);
 const pb=bookPeers.length>=2?median(bookPeers):null;
 add('book','Actif net par action × P/B médian des pairs',!!(b.bvps&&pb),'Deux pairs du même exercice et des fonds propres stricts de même périmètre avec nombre de titres récent nécessaires. Fonds propres consolidés ou ressources assimilées écartés.',s=>b.bvps*pb*s.factor,'relative','Repère comptable sectoriel ; les fonds propres ne sont pas un prix de liquidation. Particulièrement à examiner avec le ROE pour les banques.');
 const history=(d.dividends||[]).slice(0,3);
 const dividends=history.map(x=>x.net);
 const stable=history.length===3&&history.every((x,i)=>positive(x.net)&&x.year===history[0].year-i)&&Math.max(...dividends)/Math.min(...dividends)<=2;
 const div=stable?median(dividends):null;
 const ddmEligible=!!(div&&eps&&div<=eps&&f&&f.profit>0&&r-.02>g+.01);
 add('ddm','Dividendes nets futurs actualisés',ddmEligible,'Trois exercices consécutifs de dividendes positifs, variation maximale de 1 à 2, BPA publié positif couvrant le dividende et taux d’actualisation supérieur à la croissance nécessaires.',s=>gordon(div,r+s.delta,g+s.gdelta),'income','Hypothèse de dividende stable, fondée sur la médiane de trois exercices. Montants nets publiés ; fiscalité propre à l’investisseur et versements exceptionnels à examiner. Croissance perpétuelle supposée, non prévue.');
 // Aucun bénéfice comptable ne remplace un flux de trésorerie.
 const cash=positive(f?.freeCashFlowToEquity)&&f?.cashFlowVerified===true&&f?.cashFlowBasis==='equity'&&b.shares?f.freeCashFlowToEquity/b.shares:null;
 add('fcfe','Flux disponibles aux actionnaires actualisés',!!(cash&&!d.banking&&r-.02>g+.01),'Flux disponibles aux actionnaires non normalisés et vérifiés dans la base actuelle. Le résultat net ne les remplace pas.',s=>gordon(cash*s.factor,r+s.delta,g+s.gdelta),'cash','Flux d’équité positif vérifié, prolongé en croissance stable ; modèle très sensible aux hypothèses. Modèle industriel écarté pour les banques.');
 const available=methods.filter(m=>m.available&&m.values.every(x=>positive(x.value)));
 methods.forEach(m=>{if(m.available&&!available.includes(m)){m.available=false;m.reason='Scénarios non exploitables avec ces hypothèses.';}});
 const synthesisMethods=available.filter(m=>m.id!=='quotedPer'||!available.some(x=>x.id==='per'));
 const totals=scenarios.map((s,i)=>({name:s.name,value:synthesisMethods.length>=2?median(synthesisMethods.map(m=>m.values[i].value)):null}));
 const central=totals[1].value;
 const centers=available.map(m=>m.values[1].value);
 const dispersion=centers.length>=2?(Math.max(...centers)/Math.min(...centers)-1)*100:null;
 return {symbol:a.symbol,price:b.p,r,g,methods,available:available.length,count:available.length,families:new Set(available.map(m=>m.family)).size,totals,central,dispersion,upside:positive(central)?(central/b.p.price-1)*100:null,
 assessment:central===null?'Synthèse indisponible : moins de deux méthodes distinctes exploitables.':dispersion>50?'Méthodes divergentes : valeur très incertaine.':b.p.price<totals[0].value?'Cours sous tous les scénarios de synthèse : décote à expliquer.':b.p.price>totals[2].value?'Cours au-dessus des scénarios de synthèse : valorisation exigeante.':'Cours dans la fourchette des scénarios.'};
}
function compare(a,b,store={}){
 if(a.symbol===b.symbol)return {conclusion:'Choisissez deux entreprises différentes.',criteria:[],wins:0,losses:0};
 if(a.sector!==b.sector)return {conclusion:'Comparaison réservée au même secteur.',criteria:[],wins:0,losses:0};
 if(a.verdict==='Avis suspendu'||b.verdict==='Avis suspendu')return {conclusion:'Comparaison suspendue : au moins un dossier présente des données périmées, incohérentes ou une suspension.',criteria:[],wins:0,losses:0};
 const x=a.deep||{},y=b.deep||{};
 const criterion=(label,av,bv,higher,tolerance,unit)=>({label,a:finite(av)?av:null,b:finite(bv)?bv:null,unit,higher,tolerance});
 const rows=[
 criterion('PER sur BPA annuel publié',positive(x.eps)?datePrice(a,store).price/x.eps:null,positive(y.eps)?datePrice(b,store).price/y.eps:null,false,.05,'×'),
 criterion('ROE annuel',x.roe,y.roe,true,1,'%'),
 criterion('Croissance annuelle du bénéfice',x.earningsGrowth,y.earningsGrowth,true,2,'%'),
 criterion('Marge opérationnelle',x.banking||y.banking?null:x.operatingMargin,x.banking||y.banking?null:y.operatingMargin,true,1,'%'),
 criterion('Dette financière / fonds propres',x.banking||y.banking?null:x.debtEquity,x.banking||y.banking?null:y.debtEquity,false,.1,'×'),
 criterion('Dernier dividende net récent / cours',a.metrics.yieldNet,b.metrics.yieldNet,true,.5,'%')
 ];
 const samePeriod=x.annual&&y.annual&&x.annual.periodEnd===y.annual.periodEnd;
 const sameScope=x.annual&&y.annual&&/consolid|groupe/i.test(x.annual.scope||'')===/consolid|groupe/i.test(y.annual.scope||'')&&Boolean(/ressources assimil/i.test(x.annual.equityBasis||''))===Boolean(/ressources assimil/i.test(y.annual.equityBasis||''));
 let wins=0,losses=0;
 rows.forEach(row=>{
  row.comparable=finite(row.a)&&finite(row.b)&&(row.label.includes('dividende')||samePeriod&&sameScope);
  const delta=row.comparable?(row.a-row.b)*(row.higher?1:-1):0;
  row.winner=!row.comparable?'non comparable':Math.abs(delta)<=row.tolerance?'proches':delta>0?a.symbol:b.symbol;
  if(row.winner===a.symbol)wins++;if(row.winner===b.symbol)losses++;
 });
 const n=rows.filter(r=>r.comparable).length;
 const conclusion=n<3?'Données comparables insuffisantes pour départager ces entreprises.':wins-losses>=2?a.symbol+' présente davantage de critères favorables pour une étude à long terme.':losses-wins>=2?b.symbol+' présente davantage de critères favorables pour une étude à long terme.':'Résultats partagés : aucune entreprise ne se détache nettement.';
 const turnoverA=a.metrics.turnover,turnoverB=b.metrics.turnover;
 const trading=finite(turnoverA)&&finite(turnoverB)?(turnoverA>turnoverB?a.symbol:turnoverB>turnoverA?b.symbol:'Les deux')+' affiche le montant médian échangé le plus élevé : exécution potentiellement plus facile, sans preuve d’un meilleur rendement.':'Liquidité comparable non confirmée.';
 return {criteria:rows,n,wins,losses,conclusion,trading,period:samePeriod?x.annual.periodEnd:null};
}
root.BRVM_VALUATIONS={value,compare,gordon,basis};
if(typeof module!=='undefined')module.exports=root.BRVM_VALUATIONS;
})(typeof window!=='undefined'?window:globalThis);
