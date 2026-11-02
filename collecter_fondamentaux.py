"""Collecte officielle des distributions et fiches émetteurs, sans estimation."""
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
from urllib.request import urlopen, Request
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import re, json, hashlib, argparse

ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'collecte'/'fondamentaux';CACHE.mkdir(parents=True,exist_ok=True)
HOST='https://www.brvm.org'
class Table(HTMLParser):
    def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None;self.cells=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='tr':self.row=[]
        if tag=='td' and self.row is not None:self.cell={'text':'','links':[],'dates':[],'class':a.get('class','')}
        if self.cell is not None:
            if tag=='a' and a.get('href'):self.cell['links'].append(urljoin(HOST,a['href']))
            if a.get('content','').startswith(('19','20')):self.cell['dates'].append(a['content'][:10])
    def handle_data(self,text):
        if self.cell is not None:self.cell['text']+=text
    def handle_endtag(self,tag):
        if tag=='td' and self.cell is not None:
            self.cell['text']=' '.join(self.cell['text'].split());self.row.append(self.cell);self.cell=None
        if tag=='tr' and self.row is not None:
            if self.row:self.rows.append(self.row)
            self.row=None
def fetch(url,name,refresh=False):
    p=CACHE/name
    if refresh or not p.exists():
        b=urlopen(Request(url,headers={'User-Agent':'BRVMConseil/3.0 public-data-research'}),timeout=45).read()
        tmp=p.with_suffix('.part');tmp.write_bytes(b);tmp.replace(p)
    return p.read_text(encoding='utf-8')
def normalize(s):
    import unicodedata
    return re.sub(r'[^A-Z0-9]','',unicodedata.normalize('NFKD',s.upper()).encode('ascii','ignore').decode())
ALIASES={'BOLLORETRANSPORTLOGISTICS':'SDSC','AFRICAGLOBALLOGISTICSAGLCOTEDIVOIRE':'SDSC','SONATEL':'SNTS','ONATELBF':'ONTBF','ORANGECI':'ORAC','NESTLECI':'NTLC','SITAB':'STBC','SOGB':'SOGC','NSBC':'NSBC','LNB':'LNBB','SOLIBRA':'SLBC','CIECI':'CIEC','BIIC':'BICB','SERVAIRABIDJANCI':'ABJC','CFAOMOTORSCI':'CFAC','CFAOCI':'CFAC','SAPHCI':'SPHC','PALMCI':'PALC','SICABLE':'CABC','SICOR':'SICC','SOCIETEGENERALECI':'SGBC','SIBCI':'SIBC','SIB':'SIBC','BANKOFAFRICABENIN':'BOAB','BANKOFAFRICABURKINAFASO':'BOABF','BANKOFAFRICACOTEDIVOIRE':'BOAC','BANKOFAFRICAMALI':'BOAM','BANKOFAFRICANIGER':'BOAN','BANKOFAFRICASENEGAL':'BOAS','BOABENIN':'BOAB','BOABURKINAFASO':'BOABF','BOACI':'BOAC','BOAMALI':'BOAM','BOANIGER':'BOAN','BOASENEGAL':'BOAS','ECOBANKCI':'ECOC','ECOBANKTRANSNATIONALINCORPORATED':'ETIT','TOTALCI':'TTLC','TOTALENERGIESMARKETINGCI':'TTLC','TOTALSENEGAL':'TTLS','TOTALENERGIESMARKETINGSENEGAL':'TTLS','SODECI':'SDCC','CORISBANKINTERNATIONAL':'CBIBF','BERNABE':'BNBC','BERNABECI':'BNBC','AIRLIQUIDECI':'SIVC','ERIUMCI':'SIVC','SMB':'SMBC','BICICI':'BICC','SUCRIVOIRE':'SCRC','SETAOCI':'STAC','FILTISACCI':'FTSC','UNIWAXCI':'UNXC','UNILEVERCI':'UNLC','VIVOENERGYCI':'SHEC','NEICEDACI':'NEIC','SAFCACI':'SAFC','ORAGROUP':'ORGT','CROWNSIEM':'SEMC','SONOCOPACKAGINGCI':'SEMC','BBGCI':'BBGC'}
def symbol_for(name,stocks):
    n=normalize(name)
    extra={'BANKOFAFRICASN':'BOAS','CROWNSIEMCI':'SEMC','ECOBANKTG':'ETIT','SGCI':'SGBC','TOTAL':'TTLC','TOTALSENEGALSA':'TTLS','TRACTAFRICCI':'PRSC'}
    if n in extra:return extra[n]
    if n in ALIASES:return ALIASES[n]
    matches=[s['symbol'] for s in stocks if normalize(s['name'])==n or s['symbol']==n]
    return matches[0] if len(matches)==1 else None
def collect_dividends(stocks,refresh=False):
    url=HOST+'/fr/esv/paiement-de-dividendes'
    first=fetch(url,'dividendes-0.html',refresh)
    pages=[int(x) for x in re.findall(r'page=(\d+)',first)]
    last=max(pages,default=0)
    if last>150:raise ValueError('Pagination dividendes inattendue')
    def page(n):return n,fetch(url+f'?page={n}',f'dividendes-{n}.html',refresh)
    documents=[(0,first)]
    with ThreadPoolExecutor(max_workers=4) as pool:documents+=list(pool.map(page,range(1,last+1)))
    records=[];unmatched=set()
    for n,html in documents:
        parser=Table();parser.feed(html)
        for row in parser.rows:
            if len(row)<8 or 'field-emetteur-esv' not in row[0]['class']:continue
            def field(key):return next((c for c in row if ('views-field-field-'+key) in c['class'].split()),{'text':'','links':[],'dates':[]})
            name=field('emetteur-esv')['text'];symbol=symbol_for(name,stocks)
            if not symbol:unmatched.add(name);continue
            year=re.fullmatch(r'20\d{2}',field('exercice-comptable-esv')['text'])
            amount=field('montant-du-dividende-net')['text'];m=re.fullmatch(r'([\d\s.,]+)\s*(?:FCFA|F CFA|F\s*CFA)',amount,re.I)
            if not year or not m:continue
            value=float(re.sub(r'\s','',m[1]).replace(',','.'))
            payment=field('date-de-paiement-esv');ex=field('date-ex-dividende');avis=field('avis-dividende-esv')
            records.append(dict(symbol=symbol,issuer=name,year=int(year[0]),net=value,payment=payment['dates'][0] if payment['dates'] else None,exDate=ex['dates'][0] if ex['dates'] else None,source=avis['links'][0] if avis['links'] else url+f'?page={n}',listing=url+f'?page={n}',basis='Montant net par action affiché par la BRVM ; unités historiques non retraitées des fractionnements.'))
    unique={}
    for row in records:
        key=(row['symbol'],row['year'],row['payment'] or row['exDate'],row['net'])
        if key not in unique or (row['exDate'] and not unique[key]['exDate']):unique[key]=row
    if len(unique)<150:raise ValueError('Historique dividendes incomplet : publication annulée')
    return sorted(unique.values(),key=lambda r:(r['symbol'],r['year'],r['payment'] or '')),sorted(unmatched)
def collect_profiles(stocks,refresh=False):
    base=HOST+'/fr/emetteurs/societes-cotees';urls=set()
    for n in range(5):
        html=fetch(base+(f'?page={n}' if n else ''),f'societes-{n}.html',refresh)
        urls.update(urljoin(HOST,unescape(u)) for u in re.findall(r'href="(/fr/emetteurs/societes-cotees/[^"?]+)"',html))
    def profile(url):
        slug=url.rsplit('/',1)[-1];html=fetch(url,'profil-'+slug+'.html',refresh)
        # Garde le contenu principal, à l'exclusion des cours du bandeau.
        start=html.find('<h1');end=html.find('Investissons pour',start);body=html[start:end if end>start else None]
        text=unescape(re.sub('<[^>]+>',' ',body));text=' '.join(text.split())
        candidates=[s['symbol'] for s in stocks if re.search(r'(?<![A-Z])'+re.escape(s['symbol'])+r'(?![A-Z])',text)]
        return dict(symbol=candidates[0] if len(candidates)==1 else None,url=url,text=text,slug=slug)
    with ThreadPoolExecutor(max_workers=4) as pool:profiles=list(pool.map(profile,sorted(urls)))
    return profiles
def collect_capitalisations(stocks,refresh=False):
    url=HOST+'/fr/capitalisations/0';html=fetch(url,'capitalisations.html',refresh)
    parser=Table();parser.feed(html);records=[]
    for row in parser.rows:
        if len(row)<6:continue
        symbol=row[0]['text'].strip()
        if symbol not in {s['symbol'] for s in stocks}:continue
        def number(i):return float(row[i]['text'].replace(' ','').replace('\u00a0','').replace(',','.'))
        try:records.append(dict(symbol=symbol,shares=number(2),price=number(3),marketCap=number(5),source=url))
        except ValueError:continue
    if len(records)<40:raise ValueError('Capitalisations incomplètes : dernière version conservée')
    return records
def collect_live_market(stocks,refresh=True):
    url=HOST+'/fr/cours-actions/0';html=fetch(url,'cours-actions.html',refresh)
    m=re.search(r'Dernière mise à jour\s*:\s*[^,]+,\s*(\d+)\s+([a-zéû]+),?\s+(20\d{2})\s*-\s*(\d{2}:\d{2})',html)
    months={'janvier':1,'février':2,'mars':3,'avril':4,'mai':5,'juin':6,'juillet':7,'août':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12}
    if not m:raise ValueError('Horodatage des cours officiels absent')
    session=f'{m[3]}-{months[m[2]]:02d}-{int(m[1]):02d}'
    parser=Table();parser.feed(html);records=[]
    symbols={s['symbol'] for s in stocks}
    for row in parser.rows:
        if len(row)!=7 or row[0]['text'] not in symbols:continue
        def number(i):
            value=row[i]['text'].replace(' ','').replace('\u00a0','').replace(',','.').replace('%','')
            try:return float(value)
            except ValueError:return None
        records.append(dict(symbol=row[0]['text'],name=row[1]['text'],volume=number(2),previous=number(3),opening=number(4),price=number(5),variation=number(6)))
    if len(records)<40 or len({s['symbol'] for s in records})!=len(records):raise ValueError('Table des cours officiels incomplète')
    if any(s['price'] is not None and s['price']<=0 for s in records):raise ValueError('Cours officiel invalide')
    return dict(session=session,time=m[4],timezone='Africa/Abidjan',source=url,stocks=records,kind='snapshot',collected=datetime.now(timezone.utc).isoformat())
def publish(payload):
    content=json.dumps(payload,ensure_ascii=False,sort_keys=True)
    revision=hashlib.sha256(content.encode()).hexdigest()
    for name,value in [('fondamentaux.json',content),('fondamentaux.js','window.BRVM_FUNDAMENTALS = '+content+';\nwindow.BRVM_FUNDAMENTALS_REVISION = "'+revision+'";\n')]:
        p=ROOT/name;t=p.with_suffix(p.suffix+'.part');t.write_text(value,encoding='utf-8');t.replace(p)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--refresh',action='store_true');args=ap.parse_args()
    stocks=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8'))['sessions'][-1]['stocks']
    records,unmatched=collect_dividends(stocks,args.refresh)
    profiles=collect_profiles(stocks,args.refresh)
    (ROOT/'collecte'/'profils-bruts.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2),encoding='utf-8')
    old=json.loads((ROOT/'fondamentaux.json').read_text(encoding='utf-8')) if (ROOT/'fondamentaux.json').exists() else {}
    old.update(dividends=records,dividendUnmatched=unmatched,dividendCollection=datetime.now(timezone.utc).isoformat(),capitalisations=collect_capitalisations(stocks,args.refresh))
    publish(old);print(json.dumps({'dividends':len(records),'profiles':len(profiles),'unmatched':unmatched},ensure_ascii=False))
if __name__=='__main__':main()
