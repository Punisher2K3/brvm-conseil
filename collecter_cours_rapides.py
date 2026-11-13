"""Un seul instantané officiel ; pas de PDF, rapports ni recalcul si les cours sont identiques."""
from pathlib import Path
from datetime import datetime,timezone,timedelta
from email.utils import parsedate_to_datetime
from urllib.request import urlopen,Request
from urllib.error import HTTPError
from urllib.robotparser import RobotFileParser
import argparse,json,hashlib,os,time,threading,math
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from collecter_fondamentaux import parse_live_market,publish

ROOT=Path(__file__).resolve().parent
URL='https://www.brvm.org/fr/cours-actions/0'
UA='BRVMConseil/5.0 public-market-research'
STATE=ROOT/'collecte'/'cours-rapides-etat.json'
SNAPSHOT=ROOT/'collecte'/'cours-minute.json'

def now():return datetime.now(timezone.utc)
def read(path,default):
 try:return json.loads(path.read_text(encoding='utf-8'))
 except (OSError,ValueError):return default
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');tmp.replace(path)
def fingerprint(quote):
 return hashlib.sha256(json.dumps({'session':quote.get('session'),'stocks':sorted(quote.get('stocks',[]),key=lambda r:r['symbol'])},sort_keys=True).encode()).hexdigest()
def retry_delay(value,at):
 try:return max(60,int(value))
 except (ValueError,TypeError):
  try:return max(60,int((parsedate_to_datetime(value)-at).total_seconds()))
  except Exception:return 300
def validate(quote,previous=None,at=None):
 at=at or now();rows=quote.get('stocks',[])
 stamp=datetime.fromisoformat(quote['session']+'T'+quote['time']+':00+00:00')
 if stamp>at+timedelta(minutes=5):raise ValueError('Horodatage futur')
 if len(rows)<40 or len({r['symbol'] for r in rows})!=len(rows):raise ValueError('Instantané incomplet')
 if any(not isinstance(r.get('price'),(float,int)) or not 0<r['price']<1e9 or not isinstance(r.get('volume'),(float,int)) or not math.isfinite(r['volume']) or r['volume']<0 for r in rows):raise ValueError('Cours ou volume invalide')
 if previous and (quote['session'],quote['time'])<(previous.get('session',''),previous.get('time','')):raise ValueError('Régression de l’instantané')
 return quote
def fetch_quote(stocks,state,at):
 # Robots vérifié une fois par jour ; un refus ne déclenche pas de contournement.
 if state.get('robotsDate')!=at.date().isoformat():
  try:
   with urlopen(Request('https://www.brvm.org/robots.txt',headers={'User-Agent':UA}),timeout=15) as r:raw=r.read(200000).decode('utf-8','replace')
  except HTTPError as e:
   if e.code in (401,403,429):raise
   if e.code!=404:raise
   raw=''
  robot=RobotFileParser();robot.parse(raw.splitlines())
  if not robot.can_fetch(UA,URL):raise PermissionError('Collecte refusée par robots.txt')
  state['robotsDate']=at.date().isoformat()
 headers={'User-Agent':UA}
 for name,key in [('If-None-Match','etag'),('If-Modified-Since','lastModified')]:
  if state.get(key):headers[name]=state[key]
 try:
  with urlopen(Request(URL,headers=headers),timeout=30) as response:
   if response.geturl().split('/')[2] not in ('www.brvm.org','brvm.org'):raise ValueError('Redirection hors source officielle')
   raw=response.read(2_000_001)
   if len(raw)>2_000_000:raise ValueError('Page trop volumineuse')
   state['etag']=response.headers.get('ETag');state['lastModified']=response.headers.get('Last-Modified')
 except HTTPError as e:
  if e.code==304:return None
  raise
 return parse_live_market(raw.decode('utf-8'),stocks)
def collect(at=None,fetcher=fetch_quote,apply=True):
 at=at or now();state=read(STATE,{})
 if state.get('nextAttemptAt','')>at.isoformat():return {'changed':False,'state':'backoff'}
 fundamentals=read(ROOT/'fondamentaux.json',{})
 stocks=fundamentals.get('capitalisations') or fundamentals.get('liveMarket',{}).get('stocks',[])
 previous=read(SNAPSHOT,None) if not apply else fundamentals.get('liveMarket')
 if fingerprint(previous or {})!=state.get('quoteFingerprint'):
  state.pop('etag',None);state.pop('lastModified',None)
 state['checkedAt']=at.isoformat()
 try:
  quote=fetcher(stocks,state,at)
  if quote is not None:validate(quote,previous,at)
  changed=quote is not None and fingerprint(quote)!=fingerprint(previous or {})
  if changed:
   write(SNAPSHOT,quote)
   if apply:fundamentals['liveMarket']=quote;publish(fundamentals)
  if quote is not None:state['quoteFingerprint']=fingerprint(quote)
  state.update(state='ok',failures=0,lastSuccess=at.isoformat(),nextAttemptAt=(at+timedelta(seconds=60)).isoformat())
  if changed:state['lastChangeAt']=at.isoformat()
 except Exception as e:
  state.pop('etag',None);state.pop('lastModified',None)
  delay=retry_delay(e.headers.get('Retry-After'),at) if isinstance(e,HTTPError) and e.code==429 else min(3600,60*2**min(6,state.get('failures',0)+1))
  if isinstance(e,PermissionError) or isinstance(e,HTTPError) and e.code in (401,403):delay=86400
  retry_at=(at+timedelta(seconds=delay)).isoformat() if delay<=31536000 else '9999-12-31T23:59:59+00:00'
  state.update(state='degraded',failures=state.get('failures',0)+1,nextAttemptAt=retry_at,error=type(e).__name__+': dernière copie conservée.')
  changed=False
 write(STATE,state)
 return {'changed':changed,'state':state['state'],'checkedAt':state['checkedAt']}
def server(port):
 class Handler(BaseHTTPRequestHandler):
  def do_GET(self):
   origin=self.headers.get('Origin')
   if origin and origin!='https://punisher2k3.github.io':self.send_error(403);return
   paths={'/cours.json':SNAPSHOT,'/sante.json':STATE}
   if self.path not in paths:self.send_error(404);return
   data=read(paths[self.path],None)
   if data is None:self.send_error(503);return
   raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(200)
   self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store')
   self.send_header('Access-Control-Allow-Origin','https://punisher2k3.github.io');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(raw)
 return ThreadingHTTPServer(('127.0.0.1',port),Handler)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--daemon',action='store_true');ap.add_argument('--port',type=int,default=8876);args=ap.parse_args()
 if args.daemon:
  if not 1<=args.port<=65535:ap.error('Port invalide')
  httpd=server(args.port)
  threading.Thread(target=httpd.serve_forever,daemon=True).start()
  while True:
   print(json.dumps(collect(apply=False)),flush=True);time.sleep(60)
 else:
  result=collect();print(json.dumps(result))
  if os.environ.get('GITHUB_OUTPUT'):
   with open(os.environ['GITHUB_OUTPUT'],'a',encoding='utf-8') as f:f.write('changed='+str(result['changed']).lower()+'\n')
  if result['state']=='degraded':print('::warning::Cours web non actualisés ; dernière copie conservée.')
if __name__=='__main__':main()
