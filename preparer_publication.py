"""Produit uniquement les fichiers publics du site, sans journaux ni archives de travail."""
from pathlib import Path
import json,shutil,hashlib,re
ROOT=Path(__file__).resolve().parent
PUBLIC=['index.html','style.css','app.js','moteur.js','donnees.js','finances.js','fondamentaux.js','analyse_fondamentale.js','fiche_fondamentale.js']
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
    # Sépare les versions de code et de données afin que les caches de CDN ne mélangent pas des schémas.
    version=hashlib.sha256(''.join((out/name).read_text(encoding='utf-8') for name in PUBLIC if name!='index.html').encode()).hexdigest()[:16]
    html=re.sub(r'(src|href)="([^"?]+\.(?:js|css))"',lambda m:f'{m[1]}="{m[2]}?v={version}"',html)
    (out/'index.html').write_text(html,encoding='utf-8')
    (out/'.nojekyll').write_text('',encoding='utf-8')
    import actualisation_auto
    (out/'status-public.json').write_text(json.dumps({'revision':actualisation_auto.revision(),'session':market['session'],'published':market.get('revision') or market.get('fetched'),'mode':'github-pages','intervalMinutes':60},ensure_ascii=False),encoding='utf-8')
    print('Site public prêt : '+str(out))
if __name__=='__main__':main()
