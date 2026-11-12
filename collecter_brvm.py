"""Archive publique officielle : pagination, documents, indices et traçabilité.

Les chiffres extraits des PDF restent des candidats à vérifier, jamais des comptes validés.
"""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlparse, urljoin, unquote, parse_qs
from urllib.robotparser import RobotFileParser
from urllib.error import HTTPError
from datetime import datetime, timezone
import argparse, hashlib, json, re, time, gzip
import pdfplumber
from collecter_sources import Page, match_symbols, iso_date, number

ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'collecte'/'brvm-officiel'
HOST='https://www.brvm.org'
UA='BRVMConseil/5.0 public-market-research'
SEEDS={
 'communiques':'/fr/emetteurs/type-annonces/communiques',
 'notations':'/fr/emetteurs/type-annonces/notations-financieres',
 'assemblees':'/fr/emetteurs/type-annonces/convocations-assemblees-generales',
 'resolutions':'/fr/emetteurs/type-annonces/projets-de-resolution',
 'dirigeants':'/fr/emetteurs/type-annonces/changements-de-dirigeants',
 'seuils':'/fr/emetteurs/type-annonces/franchissements-de-seuil',
 'informations':'/fr/informations-permanentes',
 'fractionnements':'/fr/esv/fractionnement',
 'augmentations':'/fr/esv/augmentation-de-capital',
 'reductions':'/fr/esv/reduction-de-capital',
 'fusions':'/fr/taxonomy/term/124',
 'consolidations':'/fr/esv/consolidation',
 'radiations':'/fr/esv/radiation',
 'avis':'/fr/marche/avis-et-publications/avis',
 'mensuels':'/fr/bulletins-mensuels',
 'trimestriels':'/fr/statistiques-trimestrielles',
 'annuels':'/fr/annees-boursieres',
}

def now():return datetime.now(timezone.utc).isoformat()
def safe(url):return urlparse(url).scheme=='https' and urlparse(url).hostname in ('www.brvm.org','bfin.brvm.org')
def symbols_for(title,stocks):
 from collecter_sources import normalized
 if re.search(r'\b(FCTC|FCTCEPT|FCTCSNTS|OBLIGATION|EMPRUNT)\b',title,re.I):return []
 n=normalized(title);found=set(match_symbols(title,stocks))
 aliases={'SIBC':['SIB','SOCIETE IVOIRIENNE DE BANQUE'],'SGBC':['SGCI'],'SDSC':['BOLLORE TRANSPORT LOGISTICS','AFRICA GLOBAL LOGISTICS'],'SDCC':['SODECI','SODE CI'],'ORGT':['ORAGROUP'],'CABC':['SICABLE'],'UNXC':['UNIWAX'],'UNLC':['UNILEVER'],'NTLC':['NESTLE'],'TTLC':['TOTALENERGIES MARKETING CI','TOTAL CI'],'TTLS':['TOTALENERGIES MARKETING SN','TOTAL SN'],'SEMC':['EVIOSYS','SONOCO METAL','CROWN SIEM'],'SIVC':['AIR LIQUIDE','ERIUM'],'SAFC':['SAFCA'],'BICC':['BICICI','BICI CI']}
 for symbol,country in [('BOAB','BN'),('BOABF','BF'),('BOAC','CI'),('BOAM','ML'),('BOAN','NG'),('BOAS','SN')]:aliases[symbol]=['BANK OF AFRICA '+country,'BOA '+country]
 allowed={s['symbol'] for s in stocks}
 for symbol,names in aliases.items():
  if symbol in allowed and any((len(normalized(a))>4 and normalized(a) in n) or re.search(r'\b'+re.escape(a)+r'\b',title,re.I) for a in names):found.add(symbol)
 return sorted(found)
def atomic(path,data):
 temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(path)

class Client:
 def __init__(self,budget=120):
  CACHE.mkdir(parents=True,exist_ok=True);self.budget=budget;self.requests=0;self.last=0;self.robots={};self.stopped=set()
 def request(self,url):
  if not safe(url):raise ValueError('Source hors BRVM')
  host=urlparse(url).hostname
  if host in self.stopped:raise PermissionError('Accès refusé pendant ce passage')
  delay=max(10,self.robots[host].crawl_delay(UA) or 0) if host in self.robots else 10
  time.sleep(max(0,delay-(time.monotonic()-self.last)))
  if self.requests>=self.budget:raise RuntimeError('Budget de requêtes atteint ; reprise au prochain passage')
  self.last=time.monotonic();self.requests+=1
  try:
   with urlopen(Request(url,headers={'User-Agent':UA}),timeout=35) as r:
    if not safe(r.url):raise ValueError('Redirection hors BRVM')
    raw=r.read(30_000_001)
    if len(raw)>30_000_000:raise ValueError('Document de plus de 30 Mo')
    return raw
  except HTTPError as e:
   if e.code in (401,403,429):self.stopped.add(host)
   raise
 def get(self,url,ttl=86400):
  if not safe(url):raise ValueError('Source hors BRVM')
  path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+('.pdf' if urlparse(url).path.lower().endswith('.pdf') else '.html'))
  if path.exists() and (ttl is None or time.time()-path.stat().st_mtime<ttl):return path,path.read_bytes()
  host=urlparse(url).hostname
  if host not in self.robots:
   robot=RobotFileParser()
   try:robot.parse(self.request('https://'+host+'/robots.txt').decode().splitlines())
   except HTTPError as e:
    if e.code!=404:raise
    robot.parse([])
   self.robots[host]=robot
  if not self.robots[host].can_fetch(UA,url):raise PermissionError('URL exclue par robots.txt')
  raw=self.request(url)
  if path.suffix=='.pdf' and not raw.startswith(b'%PDF'):raise ValueError('Contenu non PDF')
  temp=path.with_suffix('.tmp');temp.write_bytes(raw);temp.replace(path)
  return path,raw

def parse_listing(html,url,kind,stocks,observed):
 p=Page(url);p.feed(html);out=[];headers=[]
 for row in p.rows:
  if len(row)<2:continue
  if any(re.search(r'^(Emetteur|Société|Date|Titre de l.annonce)$',c['text'],re.I) for c in row) and not any(c['links'] for c in row):headers=[c['text'] for c in row]
  docs=list(dict.fromkeys(u for c in row for u in c['links'] if safe(u) and urlparse(u).path.lower().endswith('.pdf')))
  if not docs:continue
  from collecter import french_date
  cells=[c['text'] for c in row];dates=[iso_date(t) or french_date(t) for t in cells]
  title=' · '.join(t for t in cells if t and t.lower() not in ('télécharger','avis') and not iso_date(t))
  for doc in docs:
   out.append(dict(url=doc,title=title[:500] or unquote(urlparse(doc).path.rsplit('/',1)[-1]),kind=kind,
    publishedAt=None if '/esv/' in urlparse(url).path else next((d for d in dates if d),None),firstSeenAt=observed,symbols=symbols_for(title,stocks),listing=url,
    fields=[{'label':headers[i] if len(headers)==len(cells) else None,'value':t,'date':dates[i]} for i,t in enumerate(cells) if t],provider='BRVM',type='publication'))
 pages=[]
 for a in p.links:
  u=urlparse(a['url']);q=parse_qs(u.query)
  if safe(a['url']) and u.path==urlparse(url).path and 'page' in q:
   try:pages.append(int(q['page'][0]))
   except ValueError:pass
 return out,max(pages,default=0)

def pdf_facts(path):
 """Lignes candidates uniquement : les unités et périmètres doivent être vérifiés."""
 facts=[]
 with pdfplumber.open(path) as pdf:
  for i,pg in enumerate(pdf.pages):
   text=pg.extract_text() or ''
   for line in text.splitlines():
    if re.search(r'(chiffre d.affaires|produit net bancaire|r[ée]sultat net|capitaux propres|total (?:du )?bilan|date de d[ée]tachement|date d.effet)',line,re.I) and re.search(r'\d',line):
     facts.append({'page':i+1,'text':line[:240],'status':'a_verifier'})
   if len(facts)>=20:break
  return {'pages':len(pdf.pages),'candidateFacts':facts[:20],'textAvailable':any((p.extract_text() or '').strip() for p in pdf.pages[:2])}

def indices(html,url,observed):
 p=Page(url);p.feed(html)
 text=' '.join(p.text);m=re.search(r'Derni[eè]re mise [àa] jour\s*:\s*([^\n]+)',text)
 from collecter import french_date
 session=french_date(m[1]) if m else None
 rows=[]
 for row in p.rows:
  if len(row)==5 and row[0]['text'].startswith('BRVM'):
   vals=[number(c['text']) for c in row[1:]]
   if vals[0] and vals[1] and vals[0]>0 and vals[1]>0:rows.append(dict(name=row[0]['text'],previous=vals[0],value=vals[1],variationPct=vals[2],annualPct=vals[3]))
 return dict(session=session,source=url,observedAt=observed,kind='web_snapshot',final=False,rows=rows)

def calendar(html,url,observed):
 p=Page(url);p.feed(html);rows=[]
 for row in p.rows:
  if len(row)==2 and iso_date(row[0]['text']):rows.append({'date':iso_date(row[0]['text']),'label':row[1]['text'],'provisional':'*' in row[0]['text']})
 if not rows:raise ValueError('Calendrier non reconnu')
 return {'source':url,'observedAt':observed,'rows':rows,'closedDates':sorted(r['date'] for r in rows if not r['provisional'])}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--requetes',type=int,default=45);ap.add_argument('--documents',type=int,default=12);ap.add_argument('--pages-par-rubrique',type=int,default=3);ap.add_argument('--depuis',default='2024-01-01');args=ap.parse_args()
 path=ROOT/'brvm-officiel.json';old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
 data={**old,'version':1,'checkedAt':now(),'scope':'Publications publiques BRVM ; collecte progressive avec couverture explicite. Chiffres PDF candidats non intégrés aux comptes ni au modèle sans vérification.'}
 docs={r['url']:r for r in old.get('documents',[])};states={r['kind']:r for r in old.get('collections',[])}
 market=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8'));stocks=market['stocks'];client=Client(args.requetes);observed=now()
 try:
  url=HOST+'/fr/jours-feries';_,raw=client.get(url);data['calendar']=calendar(raw.decode('utf-8'),url,observed)
 except Exception as e:data['calendarError']=str(e)
 # Les liens du catalogue existant sont conservés, avec une première observation prudente.
 for issuer in json.loads((ROOT/'catalogue.json').read_text(encoding='utf-8')):
  for doc in issuer.get('reports',[]):
   if safe(doc['url']):
    docs.setdefault(doc['url'],{**doc,'kind':'rapport','firstSeenAt':observed,'publishedAt':None,'listing':issuer['url'],'provider':'BRVM','type':'publication'})
    docs[doc['url']]['symbols']=symbols_for(issuer['slug'].replace('-',' ')+' '+doc['title'],stocks)
 try:
  _,raw=client.get(HOST+'/fr/indices',ttl=3600);snap=indices(raw.decode('utf-8'),HOST+'/fr/indices',observed)
  if snap['rows'] and snap['session']:
   snapshots={s['session']:s for s in old.get('indexSnapshots',[])};snapshots[snap['session']]=snap;data['indexSnapshots']=sorted(snapshots.values(),key=lambda s:s['session'])
 except Exception as e:data['indexError']=str(e)
 # Relecture de la première page et progression conservée pour les pages anciennes.
 for kind,base in SEEDS.items():
  state=states.get(kind,{})
  pages=[0]+([] if state.get('complete') else list(range(max(1,state.get('nextPage',1)),max(1,state.get('nextPage',1))+args.pages_par_rubrique-1)))
  state={**state,'kind':kind,'url':HOST+base,'checkedAt':observed,'state':'ok'}
  state.pop('error',None)
  try:
   for page in pages:
    url=HOST+base+(f'?page={page}' if page else '')
    _,raw=client.get(url);records,last=parse_listing(raw.decode('utf-8'),url,kind,stocks,observed)
    for item in records:
     prior=docs.get(item['url'],{});docs[item['url']]={**prior,**item,'firstSeenAt':prior.get('firstSeenAt',observed),'extraction':prior.get('extraction')}
    state['lastPage']=last;state['nextPage']=max(state.get('nextPage',1),page+1)
    dated=[r['publishedAt'] for r in records if r['publishedAt']]
    if page>=last or (dated and max(dated)<args.depuis):state['complete']=True;break
    state['complete']=False
   print(kind+': '+str(sum(d['kind']==kind for d in docs.values()))+' documents repérés',flush=True)
  except Exception as e:state.update(state='partial',complete=False,error=str(e))
  states[kind]=state
  data.update(documents=sorted(docs.values(),key=lambda r:(r.get('publishedAt') or '',r['url']),reverse=True),collections=list(states.values()));atomic(path,data)
  if client.requests>=args.requetes:break
 # Le catalogue initial était limité à huit liens par émetteur. Rotation des pages
 # officielles pour découvrir les autres rapports, sans recharger tous les émetteurs.
 issuers=[r for r in json.loads((ROOT/'catalogue.json').read_text(encoding='utf-8')) if symbols_for(r['slug'].replace('-',' '),stocks)]
 checked=data.get('issuerChecked',{})
 issuers.sort(key=lambda r:checked.get(r['url'],''))
 for issuer in issuers[:8]:
  if client.requests>=args.requetes:break
  if checked.get(issuer['url'],'')[:10]==observed[:10]:continue
  try:
   _,raw=client.get(issuer['url']);page=Page(issuer['url']);page.feed(raw.decode('utf-8'))
   for link in page.links:
    if safe(link['url']) and urlparse(link['url']).path.lower().endswith('.pdf'):
     title=link['title'] if len(link['title'])>15 and 'télécharger' not in link['title'].lower() else unquote(urlparse(link['url']).path.rsplit('/',1)[-1]).replace('_',' ')
     docs.setdefault(link['url'],dict(url=link['url'],title=title,kind='rapport',publishedAt=None,firstSeenAt=observed,symbols=symbols_for(issuer['slug'].replace('-',' ')+' '+title,stocks),listing=issuer['url'],provider='BRVM',type='publication'))
   checked[issuer['url']]=observed
  except Exception as e:data.setdefault('issuerErrors',{})[issuer['url']]=str(e)
 data['issuerChecked']=checked
 # Rotation : un document récent par société en premier, puis événements matériels.
 latest={}
 for doc in sorted(docs.values(),key=lambda d:(d.get('publishedAt') or (re.search(r'20\d{6}',d['url'])[0] if re.search(r'20\d{6}',d['url']) else ''),d['url']),reverse=True):
  if doc['kind']=='rapport':
   for symbol in doc['symbols']:latest.setdefault(symbol,doc['url'])
 targets=set(latest.values())
 pending=sorted((d for d in docs.values() if (d['symbols'] or d['kind'] in ('mensuels','trimestriels','annuels')) and not d.get('extraction') and (not d.get('documentError') or (datetime.now(timezone.utc)-datetime.fromisoformat(d['documentError']['at'])).total_seconds()>86400)),
  key=lambda d:(d['url'] not in targets, d['kind'] not in ('fractionnements','augmentations','reductions','radiations','fusions'),-(int(re.search(r'20\d{6}',d['url'])[0]) if re.search(r'20\d{6}',d['url']) else 0)))
 done=0
 for doc in pending:
  if done>=args.documents or client.requests>=args.requetes:break
  try:
   pdf,raw=client.get(doc['url'],ttl=None);doc['extraction']={**pdf_facts(pdf),'sha256':hashlib.sha256(raw).hexdigest(),'extractedAt':now(),'bytes':len(raw)};done+=1
   print('PDF archivé : '+doc['title'][:95],flush=True)
  except Exception as e:doc['documentError']={'at':now(),'message':str(e)}
  data.update(documents=list(docs.values()),collections=list(states.values()));atomic(path,data)
 for d in docs.values():
  if d['kind']!='rapport':d['symbols']=symbols_for(d['title'],stocks)
 data['summary']={'documents':len(docs),'downloaded':sum(bool(d.get('extraction')) for d in docs.values()),'candidateFacts':sum(len((d.get('extraction') or {}).get('candidateFacts',[])) for d in docs.values()),'matchedSymbols':len({s for d in docs.values() for s in d['symbols']}),'collectionsComplete':sum(s.get('complete') is True for s in states.values()),'collectionsTotal':len(SEEDS),'requestsThisRun':client.requests}
 data.update(documents=sorted(docs.values(),key=lambda r:(r.get('publishedAt') or '',r['url']),reverse=True),collections=list(states.values()),finishedAt=now());atomic(path,data)
 print(json.dumps(data['summary'],ensure_ascii=False),flush=True)
if __name__=='__main__':main()
