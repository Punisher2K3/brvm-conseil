"""Pages publiques complémentaires ; aucune donnée tierce n'écrase un bulletin BRVM."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen,Request
from urllib.error import HTTPError
from urllib.parse import urljoin,urlparse
from urllib.robotparser import RobotFileParser
from datetime import datetime,timezone,timedelta,date
from concurrent.futures import ThreadPoolExecutor
import json,re,hashlib,gzip,unicodedata,argparse

ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'collecte'/'sources'
HOSTS={'www.brvm.org','www.richbourse.com','www.sikafinance.com'}
UA='BRVMConseil/4.0 public-market-research'

def now():return datetime.now(timezone.utc).isoformat()
def normalized(s):return re.sub('[^A-Z0-9]','',unicodedata.normalize('NFKD',s.upper()).encode('ascii','ignore').decode())
def number(s):
    s=re.sub(r'[\s\u00a0\u202f%]','',s).replace(',','.')
    return float(s) if re.fullmatch(r'-?\d+(?:\.\d+)?',s) else None
def iso_date(s):
    m=re.search(r'(\d{2})/(\d{2})/(20\d{2})',s)
    if not m:return None
    try:return datetime(int(m[3]),int(m[2]),int(m[1])).date().isoformat()
    except ValueError:return None

class Page(HTMLParser):
    def __init__(self,base):
        super().__init__();self.base=base;self.rows=[];self.row=None;self.cell=None;self.links=[];self.anchor=None;self.current=None;self.news=[];self.item=None;self.depth=0;self.text=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='tr':self.row=[]
        if tag in ('td','th') and self.row is not None:self.cell={'text':'','links':[]}
        if tag=='li' and 'news-item' in a.get('class','').split():self.item={'title':'','url':None,'publishedAt':None};self.depth=1
        elif self.item is not None and tag=='li':self.depth+=1
        if self.item is not None and tag=='time':self.item['publishedAt']=a.get('datetime')
        if tag=='a' and a.get('href'):
            self.anchor={'url':urljoin(self.base,a['href']),'title':'','class':a.get('class','')}
            if self.cell is not None:self.cell['links'].append(self.anchor['url'])
    def handle_data(self,text):
        self.text.append(text)
        if self.cell is not None:self.cell['text']+=text
        if self.anchor is not None:self.anchor['title']+=text
    def handle_endtag(self,tag):
        if tag=='a' and self.anchor is not None:
            self.anchor['title']=' '.join(self.anchor['title'].split());self.links.append(self.anchor)
            if self.item is not None and 'news-title' in self.anchor['class'].split():self.item.update(title=self.anchor['title'],url=self.anchor['url'])
            self.anchor=None
        if tag in ('td','th') and self.cell is not None and self.row is not None:
            self.cell['text']=' '.join(self.cell['text'].split());self.row.append(self.cell);self.cell=None
        if tag=='tr' and self.row is not None:
            self.rows.append(self.row);self.row=None
        if tag=='li' and self.item is not None:
            self.depth-=1
            if self.depth==0:
                if self.item['url']:self.news.append(self.item)
                self.item=None

def parse_history(html,symbol,url,observed_at):
    p=Page(url);p.feed(html);out=[]
    for row in p.rows:
        if len(row)!=8:continue
        date=iso_date(row[0]['text'])
        if not date:continue
        values=[number(c['text']) for c in row[1:]]
        close,low,high,opening,volume,value,variation=values
        if any(v is None for v in values[:5]) or not 0<low<=min(close,opening)<=max(close,opening)<=high or volume<0:continue
        out.append(dict(symbol=symbol,date=date,close=close,low=low,high=high,opening=opening,volume=volume,reportedValue=value,variation=variation,provider='Sika Finance',source=url,firstSeenAt=observed_at,priceBasis='as_published'))
    return out

def match_symbols(title,stocks):
    n=normalized(title);found=[]
    aliases={'SNTS':['SONATEL'],'ORAC':['ORANGECOTEDIVOIRE'],'SLBC':['SOLIBRA'],'SCRC':['SUCRIVOIRE'],'CBIBF':['CORISBANK'],'BICB':['BIIC'],'ETIT':['ECOBANKTRANSNATIONAL'],'NSBC':['NSIABANQUE'],'SGBC':['SOCIETEGENERALECOTEDIVOIRE','SGCI'],'SIBC':['SOCIETEIVOIRIENNEDEBANQUE'],'FTSC':['FILTISAC'],'SPHC':['SAPH'],'SOGC':['SOGB'],'PALC':['PALMCI'],'STBC':['SITAB'],'SMBC':['SMBCI']}
    for s in stocks:
        variants=aliases.get(s['symbol'],[])+[normalized(s['name'])]
        if any(len(v)>=4 and v in n for v in variants) or re.search(r'\b'+re.escape(s['symbol'])+r'\b',title.upper()):found.append(s['symbol'])
    return sorted(set(found))

class Client:
    def __init__(self):self.blocked=set();self.robots={};self.pages=[];CACHE.mkdir(parents=True,exist_ok=True)
    def get(self,url,ttl=21600):
        host=urlparse(url).hostname
        if urlparse(url).scheme!='https' or host not in HOSTS:raise ValueError('Hôte hors périmètre')
        if host in self.blocked:raise PermissionError('Accès refusé à cette source pendant ce passage')
        path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
        if path.exists() and datetime.now(timezone.utc).timestamp()-path.stat().st_mtime<ttl:
            self.pages.append({'url':url,'state':'cached','sha256':hashlib.sha256(path.read_bytes()).hexdigest()});return path.read_text(encoding='utf-8')
        if host not in self.robots:
            try:
                with urlopen(Request('https://'+host+'/robots.txt',headers={'User-Agent':UA}),timeout=15) as r:text=r.read(200000).decode('utf-8','replace')
                robot=RobotFileParser();robot.parse(text.splitlines());self.robots[host]=robot
            except HTTPError as e:
                if e.code in (401,403,429):self.blocked.add(host);raise PermissionError('Accès automatique refusé (robots HTTP '+str(e.code)+')')
                self.robots[host]=None
            except OSError:self.robots[host]=None
        robot=self.robots[host]
        if robot and not robot.can_fetch(UA,url):raise PermissionError('Collecte interdite par robots.txt pour cette URL')
        try:
            with urlopen(Request(url,headers={'User-Agent':UA}),timeout=25) as r:
                if urlparse(r.url).hostname not in HOSTS:raise ValueError('Redirection hors périmètre')
                raw=r.read(8_000_001)
                if len(raw)>8_000_000:raise ValueError('Page trop volumineuse')
            text=raw.decode('utf-8');temp=path.with_suffix('.tmp');temp.write_bytes(raw);temp.replace(path)
            self.pages.append({'url':url,'state':'ok','sha256':hashlib.sha256(raw).hexdigest()});return text
        except HTTPError as e:
            if e.code in (401,403,429):self.blocked.add(host)
            raise

    def history_archive(self,ticker,start,end):
        """Même requête publique que le bouton de période ; maximum 90 jours par appel."""
        if (end-start).days>89:raise ValueError('Lot historique supérieur à 90 jours')
        url='https://www.sikafinance.com/api/general/GetHistos'
        self.get('https://www.sikafinance.com/marches/aaz',ttl=0 if 'www.sikafinance.com' not in self.robots else 21600)
        robot=self.robots.get('www.sikafinance.com')
        if 'www.sikafinance.com' in self.blocked or (robot and not robot.can_fetch(UA,url)):raise PermissionError('Accès historique automatique interdit')
        payload=json.dumps({'ticker':ticker,'datedeb':start.isoformat(),'datefin':end.isoformat(),'xperiod':'0'}).encode()
        path=CACHE/(hashlib.sha256(payload).hexdigest()+'.json')
        if path.exists():return json.loads(path.read_text(encoding='utf-8'))
        try:
            with urlopen(Request(url,data=payload,headers={'User-Agent':UA,'Content-Type':'application/json;charset=UTF-8'}),timeout=25) as response:
                result=json.loads(response.read(8_000_000))
            if result.get('error'):raise ValueError('Historique : '+str(result['error']))
            if not isinstance(result.get('lst'),list):raise ValueError('Format historique non reconnu')
            path.write_text(json.dumps(result),encoding='utf-8');return result
        except HTTPError as e:
            if e.code in (401,403,429):self.blocked.add('www.sikafinance.com')
            raise

def load():
    p=ROOT/'sources-complementaires.json.gz'
    if p.exists():return json.loads(gzip.decompress(p.read_bytes()))
    return {'version':1,'observations':[],'events':[]}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--lot',type=int,default=12);ap.add_argument('--archives-lot',type=int,default=2);args=ap.parse_args()
    old=load();market=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8'));stocks=market['stocks'];allowed={s['symbol'] for s in stocks};observed=now();client=Client();warnings=[];events=[];observations=[];states=[]
    pages=[('Richbourse','https://www.richbourse.com/common/variation/index'),('Sika Finance','https://www.sikafinance.com/marches/aaz'),('Sika Finance','https://www.sikafinance.com/marches/actualites_bourse_brvm'),('Sika Finance','https://www.sikafinance.com/marches/communiques_brvm')]+[('BRVM','https://www.brvm.org/fr/emetteurs/type-annonces/'+slug) for slug in ['communiques','notations-financieres','convocations-assemblees-generales']]
    mapping={}
    for provider,url in pages:
        try:
            html=client.get(url,ttl=3600);p=Page(url);p.feed(html);states.append({'provider':provider,'url':url,'state':'ok','checkedAt':observed})
            for link in p.links:
                m=re.fullmatch(r'/marches/cotation_([A-Za-z0-9]+\.[A-Za-z]+)',urlparse(link['url']).path)
                if m and m[1].split('.')[0].upper() in allowed:mapping[m[1].split('.')[0].upper()]=m[1]
            for item in p.news:
                events.append({**item,'provider':provider,'symbols':match_symbols(item['title'],stocks),'firstSeenAt':observed,'type':'news','sourceTimezone':'non_confirmed'})
            for row in p.rows:
                if provider=='BRVM' and len(row)>=3 and iso_date(row[0]['text']):
                    links=[u for c in row for u in c['links']]
                    if links:
                        title=row[2]['text'];events.append(dict(provider=provider,title=title[:260],url=links[-1],publishedAt=iso_date(row[0]['text']),firstSeenAt=observed,symbols=match_symbols(title+' '+row[1]['text'],stocks),type='publication'))
                if len(row)==2 and iso_date(row[0]['text']) and row[1]['links']:
                    title=row[1]['text'];events.append(dict(provider=provider,title=title[:260],url=row[1]['links'][0],publishedAt=iso_date(row[0]['text']),firstSeenAt=observed,symbols=match_symbols(title,stocks),type='publication'))
        except Exception as e:
            blocked=isinstance(e,PermissionError) or isinstance(e,HTTPError) and e.code in (401,403,429)
            states.append({'provider':provider,'url':url,'state':'blocked' if blocked else 'error','checkedAt':observed,'detail':str(e)[:160]});warnings.append(provider+' : '+str(e)[:140])
    # Rotation selon l'ancienne date de collecte : toutes les actions sont parcourues progressivement.
    checked=old.get('historyChecked',{});limit=48 if old.get('officialSession')!=market['session'] else args.lot
    items=sorted(mapping.items(),key=lambda item:(checked.get(item[0],''),item[0]))[:max(0,min(48,limit))]
    for symbol,ticker in items:
        url='https://www.sikafinance.com/marches/historiques/'+ticker
        try:
            html=client.get(url);rows=parse_history(html,symbol,url,observed)
            if not rows:raise ValueError('Aucune ligne historique reconnue')
            observations.extend(rows);checked[symbol]=observed
        except Exception as e:warnings.append(symbol+' : '+str(e)[:140])
    archive_checked=old.get('archiveChecked',{});cursors=old.get('archiveCursors',{})
    floor=date.fromisoformat(market['session'])-timedelta(days=1095)
    available_dates={symbol:min(r['date'] for r in old.get('observations',[])+observations if r['symbol']==symbol) for symbol in mapping if any(r['symbol']==symbol for r in old.get('observations',[])+observations)}
    eligible=[item for item in mapping.items() if item[0] in available_dates and date.fromisoformat(cursors.get(item[0],available_dates[item[0]]))-timedelta(days=1)>=floor]
    archive_items=sorted(eligible,key=lambda item:(archive_checked.get(item[0],''),item[0]))[:max(0,min(48,args.archives_lot))]
    for symbol,ticker in archive_items:
        previous_dates=[r['date'] for r in old.get('observations',[])+observations if r['symbol']==symbol]
        if not previous_dates:continue
        end=date.fromisoformat(cursors.get(symbol,min(previous_dates)))-timedelta(days=1)
        if end<floor:continue
        start=max(floor,end-timedelta(days=89))
        try:
            payload=client.history_archive(ticker,start,end)
            for row in payload['lst']:
                stamp=iso_date(str(row.get('Date',''))) or str(row.get('Date',''))[:10]
                try:date.fromisoformat(stamp)
                except ValueError:continue
                values={k:row.get(v) for k,v in [('close','Close'),('opening','Open'),('high','High'),('low','Low'),('volume','Volume')]}
                if not all(isinstance(v,(int,float)) for v in values.values()) or not start.isoformat()<=stamp<=end.isoformat():continue
                if not 0<values['low']<=values['close']<=values['high'] or values['volume']<0:continue
                observations.append(dict(symbol=symbol,date=stamp,**values,provider='Sika Finance',source='https://www.sikafinance.com/marches/historiques/'+ticker,firstSeenAt=observed,priceBasis='as_published'))
            cursors[symbol]=start.isoformat();archive_checked[symbol]=observed
        except Exception as e:
            warnings.append('Archives '+symbol+' : '+str(e)[:140])
            archive_checked[symbol]=observed
            if str(e)=='Historique : nodata':cursors[symbol]=start.isoformat()
            if 'www.sikafinance.com' in client.blocked:break
    merged={(r['provider'],r['symbol'],r['date']):r for r in old.get('observations',[])}
    revisions=old.get('revisions',[])
    for r in observations:
        key=(r['provider'],r['symbol'],r['date']);previous=merged.get(key)
        if previous:
            r['firstSeenAt']=previous['firstSeenAt']
            if any(previous.get(k)!=r.get(k) for k in ['close','volume','low','high','opening']):
                revisions.append({'symbol':r['symbol'],'date':r['date'],'provider':r['provider'],'observedAt':observed,'previous':previous});r['revisedAt']=observed
            elif previous.get('revisedAt'):r['revisedAt']=previous['revisedAt']
        merged[key]=r
    event_map={r['url']:r for r in old.get('events',[])}
    for event in events:
        if event['url'] in event_map:event['firstSeenAt']=event_map[event['url']]['firstSeenAt']
        event_map[event['url']]=event
    data=dict(version=1,checkedAt=observed,officialSession=market['session'],states=states,warnings=warnings,observations=sorted(merged.values(),key=lambda r:(r['symbol'],r['date'])),events=list(event_map.values())[-2000:],historyChecked=checked,archiveChecked=archive_checked,archiveCursors=cursors,revisions=revisions[-500:],pages=client.pages,
              scope='Pages publiques accessibles, historique visible et liens de publications ; non exhaustif. Aucun accès abonné contourné. Les articles ne sont pas reproduits.')
    payload=json.dumps(data,ensure_ascii=False).encode('utf-8');temp=ROOT/'sources-complementaires.json.gz.tmp';temp.write_bytes(gzip.compress(payload,mtime=0));temp.replace(ROOT/'sources-complementaires.json.gz')
    (ROOT/'sources-complementaires.json').write_bytes(payload)
    print(json.dumps({'observations':len(data['observations']),'symbols':len({r['symbol'] for r in data['observations']}),'events':len(data['events']),'states':states,'warnings':warnings},ensure_ascii=True),flush=True)
if __name__=='__main__':main()
