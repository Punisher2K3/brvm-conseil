"""Produit uniquement les fichiers publics du site, sans journaux ni archives de travail."""
from pathlib import Path
import json,shutil,hashlib,re
from html import escape
from urllib.parse import urlparse
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent
PUBLIC=['index.html','style.css','app.js','moteur.js','donnees.js','finances.js','fondamentaux.js','analyse_fondamentale.js','fiche_fondamentale.js','valorisations.js','valorisations_ui.js','previsions.js','previsions-calcul.js','previsions-calcul.json','previsions-journal.json']

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
    out=ROOT/'site-public';out.mkdir(exist_ok=True)
    for name in PUBLIC:shutil.copyfile(ROOT/name,out/name)
    (out/'mode-public.js').write_text('window.BRVM_PUBLIC_MODE = true;\n',encoding='utf-8')
    html=(out/'index.html').read_text(encoding='utf-8').replace('<script src="donnees.js">','<script src="mode-public.js"></script><script src="donnees.js">')
    html=re.sub(r'<section class="update-help">.*?</section>','<section class="update-help"><strong>Actualisation des données en ligne</strong><p>Une collecte GitHub Actions est programmée chaque heure. Les visiteurs consultent la dernière publication réussie ; le démarrage des tâches peut être retardé. Le bouton Actualiser recherche cette publication sans lancer une collecte depuis le navigateur.</p><p>Les cours web du jour et le dernier bulletin complet sont datés séparément. Les avis utilisent le bulletin complet. Les nouveaux bilans restent soumis à vérification avant intégration.</p></section>',html,flags=re.S)
    html=html.replace('<!-- OBLIGATIONS_AUTOMATIQUES -->',obligations_html())
    # Sépare les versions de code et de données afin que les caches de CDN ne mélangent pas des schémas.
    version=hashlib.sha256(''.join((out/name).read_text(encoding='utf-8') for name in PUBLIC if name!='index.html').encode()).hexdigest()[:16]
    html=re.sub(r'(src|href)="([^"?]+\.(?:js|css))"',lambda m:f'{m[1]}="{m[2]}?v={version}"',html)
    (out/'index.html').write_text(html,encoding='utf-8')
    (out/'.nojekyll').write_text('',encoding='utf-8')
    import actualisation_auto
    (out/'status-public.json').write_text(json.dumps({'revision':actualisation_auto.revision(),'session':market['session'],'published':market.get('revision') or market.get('fetched'),'mode':'github-pages','intervalMinutes':60},ensure_ascii=False),encoding='utf-8')
    print('Site public prêt : '+str(out))
if __name__=='__main__':main()

