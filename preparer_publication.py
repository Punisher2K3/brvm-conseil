"""Produit uniquement les fichiers publics du site, sans journaux ni archives de travail."""
from pathlib import Path
import json,shutil,hashlib,re
import os
from pages_informations import generate,head_security,footer,config,manifest
from html import escape
from urllib.parse import urlparse
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent
PUBLIC=['index.html','style.css','app.js','moteur.js','donnees.js','finances.js','fondamentaux.js','analyse_fondamentale.js','fiche_fondamentale.js','valorisations.js','valorisations_ui.js','previsions.js','previsions-calcul.js','previsions-calcul.json','previsions-journal.json','signaux_ui.js','sources-complementaires.json','pilote_ui.js','etat_actualisation.js']
GENERATED={'brvm_officiel_ui.js','brvm-officiel-public.js','brvm-officiel-public.json','indices-brvm.json','mode-public.js','.nojekyll','status-public.json','integrite-publication.json','mentions-legales.html','confidentialite.html','conditions-utilisation.html','securite.html'}

GENERATED.add('fiabilite-sources.html')

def clean_public_dir(out):
    allowed=set(PUBLIC)|GENERATED
    for path in out.iterdir():
        if path.is_dir():raise ValueError('Sous-dossier public inattendu : '+path.name)
        if path.name not in allowed:
            if not path.resolve().is_relative_to(out.resolve()):raise ValueError('Chemin public hors périmètre')
            path.unlink()

def obligations_html():
    p=ROOT/'obligations.json'
    if not p.exists():return '<p>Collecte des annonces en attente.</p>'
    data=json.loads(p.read_text(encoding='utf-8'))
    today=datetime.now(timezone.utc).date().isoformat()
    e=lambda value:escape(str(value or 'Non confirmé'),quote=True)
    safe=lambda url:e(url) if urlparse(str(url)).scheme=='https' and urlparse(str(url)).hostname in ('www.umoatitres.org','umoatitres.org','www.africabourse.com','africabourse.com') else '#'
    cards=[]
    for item in data.get('events',[]):
        if item['date']<today:continue
        details=''.join('<li><strong>'+e(r['label'])+' :</strong> '+e(r['value'])+'</li>' for r in item.get('details',[]))
        docs=' · '.join('<a target="_blank" rel="noopener" href="'+safe(u)+'">Document officiel '+str(i+1)+'</a>' for i,u in enumerate(item.get('documents',[])))
        period=('Souscription du '+e(item['openDate'])+' au '+e(item['closeDate'])) if item.get('openDate') else 'Adjudication du '+e(item['date'])
        cards.append('<article class="card"><p class="eyebrow">'+e(item.get('kind'))+'</p><h3>'+e(item['title'])+'</h3><p><strong>'+period+'</strong></p><ul>'+details+'</ul><p>Date de publication : '+e(item.get('publicationDate'))+'. Taux net fiscal et rendement au prix obtenu : à vérifier.</p><p><a target="_blank" rel="noopener" href="'+safe(item['source'])+'">Annonce officielle</a> · '+docs+'</p></article>')
    status='<p class="muted">Dernière vérification : '+e(data.get('checkedAt'))+'. Dernière collecte réussie : '+e(data.get('lastSuccess'))+'.</p>'
    warning='<p class="notice">Certaines sources n’ont pas pu être vérifiées. Les dernières annonces connues sont conservées ; leur actualité reste à confirmer.</p>' if data.get('warnings') else ''
    return status+warning+('<div class="grid">'+''.join(cards)+'</div>' if cards else '<p>Aucune opération à venir retrouvée dans les annonces collectées. Cela ne prouve pas une absence d’émissions.</p>')+'<p class="muted">'+e(data.get('scope'))+' Pour un particulier, la souscription passe par un intermédiaire habilité. Les coupons annoncés ne sont pas nécessairement le rendement obtenu.</p>'

def main():
    market=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8-sig'))
    if not market.get('sessions') or len(market['sessions'][-1]['stocks'])<40:raise ValueError('Base marché incomplète')
    deep=json.loads((ROOT/'fondamentaux.json').read_text(encoding='utf-8-sig'))
    if len(deep.get('capitalisations',[]))<40:raise ValueError('Capitalisations incomplètes')
    out=ROOT/'site-public';out.mkdir(exist_ok=True);clean_public_dir(out)
    legal_footer=generate(out);site=config()
    official_public(out,market,deep)
    source=ROOT/'sources-complementaires.json'
    if not source.exists():source.write_text('{}',encoding='utf-8')
    for name in PUBLIC:shutil.copyfile(ROOT/name,out/name)
    shutil.copyfile(ROOT/'brvm_officiel_ui.js',out/'brvm_officiel_ui.js')
    code_files=[n for n in PUBLIC if n.endswith(('.js','.css')) and n not in ('donnees.js','finances.js','fondamentaux.js','previsions-calcul.js')]+['brvm_officiel_ui.js','index.html','site-config.json']
    code_revision=hashlib.sha256(''.join((ROOT/n).read_text(encoding='utf-8') for n in code_files).encode()).hexdigest()[:20]
    (out/'mode-public.js').write_text('window.BRVM_PUBLIC_MODE = true;\nwindow.BRVM_CODE_REVISION = '+json.dumps(code_revision)+';\n',encoding='utf-8')
    html=(out/'index.html').read_text(encoding='utf-8').replace('<script src="donnees.js">','<script src="mode-public.js"></script><script src="donnees.js">')
    html=re.sub(r'<section class="update-help">.*?</section>','<section class="update-help"><strong>Actualisation des données en ligne</strong><p>Une collecte GitHub Actions est programmée chaque heure. Les visiteurs consultent la dernière publication réussie ; le démarrage des tâches peut être retardé. Le bouton Actualiser recherche cette publication sans lancer une collecte depuis le navigateur.</p><p>Les cours web du jour et le dernier bulletin complet sont datés séparément. Les avis utilisent le bulletin complet. Les nouveaux bilans restent soumis à vérification avant intégration.</p></section>',html,flags=re.S)
    html=html.replace('<!-- OBLIGATIONS_AUTOMATIQUES -->',obligations_html())
    html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">'+head_security(),1)
    html=html.replace('<title>BRVM Conseil — Le marché, avec du recul</title>','<title>'+escape(site['publicTitle'])+'</title><meta name="author" content="'+escape(site['publisherName'],quote=True)+'"><link rel="canonical" href="'+escape(site['canonicalUrl'],quote=True)+'">')
    html=html.replace('<p id="version"></p>','<p id="version"></p>'+legal_footer)
    html=html.replace('rel="noopener"','rel="noopener noreferrer"')
    # Sépare les versions de code et de données afin que les caches de CDN ne mélangent pas des schémas.
    version=hashlib.sha256(''.join((out/name).read_text(encoding='utf-8') for name in PUBLIC+['brvm-officiel-public.js','brvm_officiel_ui.js'] if name!='index.html').encode()).hexdigest()[:16]
    html=re.sub(r'(src|href)="([^"?]+\.(?:js|css))"',lambda m:f'{m[1]}="{m[2]}?v={version}"',html)
    (out/'index.html').write_text(html,encoding='utf-8')
    (out/'.nojekyll').write_text('',encoding='utf-8')
    import actualisation_auto
    state_path=ROOT/'actualisation-publique.json'
    state=json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {}
    assets=manifest(out)
    (out/'status-public.json').write_text(json.dumps({'revision':actualisation_auto.revision(),'session':market['session'],'published':datetime.now(timezone.utc).isoformat(),'marketUpdatedAt':market.get('fetched'),'mode':'github-pages','intervalMinutes':60,'codeRevision':code_revision,'assets':assets,'checkedAt':state.get('lastAttemptAt'),'lastSuccessfulCollection':state.get('lastSuccessfulCollection'),'collectionState':state.get('state','unknown'),'runUrl':state.get('runUrl'),'stages':state.get('stages',[])},ensure_ascii=False),encoding='utf-8')
    print('Site public prêt : '+str(out))
def official_public(out,market,deep):
    source=ROOT/'brvm-officiel.json'
    data=json.loads(source.read_text(encoding='utf-8')) if source.exists() else {}
    indices=ROOT/'indices-brvm.json'
    index_data=json.loads(indices.read_text(encoding='utf-8')) if indices.exists() else {'sessions':[]}
    # Le texte des PDF est conservé dans l’archive privée de collecte ; le site publie les références.
    documents=[{k:d.get(k) for k in ['url','title','kind','publishedAt','firstSeenAt','symbols','listing']}|{'downloaded':bool(d.get('extraction'))} for d in data.get('documents',[])]
    today=datetime.now(timezone.utc).date().isoformat()
    payload={k:data.get(k) for k in ['checkedAt','summary','collections','scope','calendar']}
    payload.update(documents=documents,indices=index_data['sessions'],market={'sessions':len(market['sessions']),'first':market['sessions'][0]['date'],'last':market['session'],'warnings':market.get('collectionWarnings',[])},symbols=sorted(r['symbol'] for r in market['stocks']),upcomingDividends=[d for d in deep.get('dividends',[]) if max(d.get('exDate') or '',d.get('payment') or '')>=today])
    encoded=json.dumps(payload,ensure_ascii=False).replace('<','\\u003c')
    (out/'brvm-officiel-public.json').write_text(encoded,encoding='utf-8')
    (out/'brvm-officiel-public.js').write_text('window.BRVM_OFFICIAL = '+encoded+';\n',encoding='utf-8')
    (out/'indices-brvm.json').write_text(json.dumps(index_data,ensure_ascii=False),encoding='utf-8')
if __name__=='__main__':main()

