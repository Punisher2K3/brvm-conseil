"""Actualités IPO : collecte publique, conservation datée et rendu sans ordre transmis."""
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlparse
from html import escape,unescape
from datetime import datetime,timezone,date
import re,json
ROOT=Path(__file__).resolve().parent
HOST='https://coris-bourse.com'
SEED=HOST+'/produits-services/souscription-actionnariat/01a1cfdd-c4c7-73ab-ad43-2ba60b0146aa'
def get(url):
    return urlopen(Request(url,headers={'User-Agent':'BRVMConseil public-data-monitor'}),timeout=20).read().decode('utf-8')
def plain(html):
    html=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',html,flags=re.S|re.I)
    return ' '.join(unescape(re.sub('<[^>]+>',' ',html)).split())
def parse_page(html,url,now):
    text=plain(html)
    title=re.search(r'<h1[^>]*>(.*?)</h1>',html,re.S|re.I)
    if not title or not re.search(r'introduction.*BRVM',text,re.I):return None
    issuer=plain(title[1])
    # Parse only explicit subscription range. Never infer a listing date.
    months={'janvier':1,'février':2,'mars':3,'avril':4,'mai':5,'juin':6,'juillet':7,'août':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12}
    m=re.search(r'du\s+(\d{1,2})\s+('+'|'.join(months)+r')\s+(20\d{2})\s+au\s+(\d{1,2})\s+('+'|'.join(months)+r')\s+(20\d{2})',text,re.I)
    row={'id':url.rsplit('/',1)[-1],'issuer':issuer,'source':url,'lastVerified':now,'openDate':None,'closeDate':None,'price':None,'visa':None,'listingDate':None}
    if m:
        row['openDate']=date(int(m[3]),months[m[2].lower()],int(m[1])).isoformat()
        row['closeDate']=date(int(m[6]),months[m[5].lower()],int(m[4])).isoformat()
    p=re.search(r'Prix de l.action\s*[·:–-]?\s*grand public\s*([\d\s\u202f\u00a0]+)\s*FCFA',text,re.I)
    if p:row['price']=int(re.sub(r'\s','',p[1]))
    v=re.search(r'Visa AMF.UMOA\s*n[°o]\s*([A-Z]+/\d{2}-\d+)',text,re.I)
    if v:row['visa']=v[1]
    row['earlyClosePossible']=bool(re.search(r'cl[oô]ture anticip[eé]e',text,re.I))
    row['earlyClosed']=bool(re.search(r'(?:cl[oô]tur[eé]e? par anticipation|cl[oô]ture anticip[eé]e effective)',text,re.I))
    row['cancelled']=bool(re.search(r'(?:op[eé]ration|offre).{0,30}(?:annul[eé]e|report[eé]e|suspendue)',text,re.I))
    return row
def collect():
    p=ROOT/'actualites-ipo.json'
    old=json.loads(p.read_text(encoding='utf-8')) if p.exists() else {'events':[]}
    now=datetime.now(timezone.utc).isoformat(); events={r['id']:r for r in old.get('events',[])};warnings=[];urls={SEED,HOST+'/produits-services/souscription-actionnariat/01a1d651-3551-713d-aed6-b672bdb6f3fe'}
    try:
        listing=get(HOST+'/fr/operations-de-marche')
        urls.update(urljoin(HOST,unescape(u)) for u in re.findall(r'href=["\']([^"\']*souscription-actionnariat/[^"\']+)',listing))
    except Exception as exc:warnings.append('Découverte Coris Bourse indisponible : '+type(exc).__name__)
    for url in sorted(urls)[:12]:
        if urlparse(url).hostname!='coris-bourse.com':continue
        try:
            row=parse_page(get(url),url,now)
            if row:events[row['id']]=row
            else:warnings.append('Page sans caractéristiques IPO exploitables : '+url)
        except Exception as exc:warnings.append('Vérification indisponible : '+url+' ('+type(exc).__name__+')')
    result={'checkedAt':now,'events':list(events.values()),'warnings':warnings,'scope':'Pages publiques Coris Bourse et catalogue officiel BRVM. Couverture partielle ; les dates de cotation ne sont pas déduites des souscriptions.'}
    p.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    return result
def render(data,today=None):
    today=today or datetime.now(timezone.utc).date().isoformat();e=lambda v:escape(str(v or 'Non confirmé'),quote=True)
    cards=[]
    for row in sorted(data.get('events',[]),key=lambda r:r.get('openDate') or '9999'):
        if row.get('closeDate') and row['closeDate']<today:continue
        state='Calendrier à confirmer'
        if row.get('openDate') and row.get('closeDate'):state='À venir' if today<row['openDate'] else 'Période annoncée en cours'
        if row.get('earlyClosed'):state='Clôture anticipée annoncée'
        if row.get('cancelled'):state='Opération suspendue, reportée ou annulée : consulter la source'
        fresh=(data.get('checkedAt')==row.get('lastVerified'))
        if not fresh:state+=' · dernière information conservée'
        if urlparse(row.get('source','')).scheme!='https' or urlparse(row.get('source','')).hostname!='coris-bourse.com':continue
        cards.append('<article class="card"><p class="eyebrow">'+e(state)+'</p><h3>'+e(row['issuer'])+'</h3><p>OPV suivie d’une introduction à la BRVM</p><p><strong>Souscription : '+e(row.get('openDate'))+' au '+e(row.get('closeDate'))+'</strong></p><p>Prix grand public : '+(e(row['price'])+' FCFA' if row.get('price') else 'Non confirmé')+' · Visa : '+e(row.get('visa'))+'</p><p>Date de première cotation : non confirmée dans cette collecte. '+('Possibilité de clôture anticipée.' if row.get('earlyClosePossible') else '')+'</p><p>Dernière vérification réussie : '+e(row.get('lastVerified'))+'</p><a target="_blank" rel="noopener noreferrer" href="'+e(row['source'])+'">Source officielle de l’arrangeur ↗</a></article>')
    warning='<p class="notice">Certaines pages n’ont pas pu être vérifiées. Consultez la date de vérification de chaque annonce.</p>' if data.get('warnings') else ''
    return '<p>Dernière tentative de collecte : '+e(data.get('checkedAt'))+'</p>'+warning+('<div class="grid">'+''.join(cards)+'</div>' if cards else '<p>Aucune IPO à venir confirmée dans les pages collectées. La couverture ne permet pas de conclure à une absence d’IPO.</p>')+'<p class="muted">'+e(data.get('scope'))+' Le prix de souscription n’est pas une prévision du futur cours. Les projets sans calendrier restent à vérifier ; une souscription se fait auprès d’un intermédiaire habilité.</p>'
if __name__=='__main__':
    d=collect();print(json.dumps({'events':len(d['events']),'warnings':d['warnings']},ensure_ascii=False))
