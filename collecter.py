"""Sources officielles, cache local, validation et extraction reproductibles."""
from pathlib import Path
from datetime import date, timedelta, datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse, unquote
from html.parser import HTMLParser
import subprocess, json, re, hashlib, argparse, sys, os, shutil
import pdfplumber
from urllib.request import urlopen, Request

ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'collecte'; CACHE.mkdir(exist_ok=True)
HOST='https://www.brvm.org'
SECTORS={'CB':'Consommation de base','CD':'Consommation discrétionnaire','ENE':'Énergie','FIN':'Services financiers','IND':'Industrie','SPU':'Services publics','TEL':'Télécommunications'}
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a' and a.get('href'): self.links.append(a['href'])
def fetch(url, path, refresh=False):
    if path.exists() and not refresh: return path
    if urlparse(url).hostname not in ('www.brvm.org','bfin.brvm.org'): raise ValueError('Source non officielle')
    temp=path.with_suffix(path.suffix+'.part')
    try:
        if os.name=='nt':
            env=dict(os.environ,BRVM_URL=url,BRVM_DESTINATION=str(temp))
            r=subprocess.run([shutil.which('pwsh') or 'powershell','-NoProfile','-Command',"$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing -Uri $env:BRVM_URL -OutFile $env:BRVM_DESTINATION -TimeoutSec 35"],capture_output=True,env=env)
            if r.returncode:raise RuntimeError(f'Téléchargement impossible : {url}')
        else:
            with urlopen(Request(url,headers={'User-Agent':'BRVMConseil/3.0'}),timeout=35) as response:temp.write_bytes(response.read())
    except Exception:
        temp.unlink(missing_ok=True);raise
    temp.replace(path); return path
def links(text):
    p=Links();p.feed(text);return [urljoin(HOST,u) for u in p.links]
def num(text):
    if not text or re.search(r'[A-Za-z]',text): return None
    try: return float(re.sub(r'[^\d,.-]','',text).replace(',','.'))
    except ValueError: return None
MONTHS={'janvier':1,'février':2,'mars':3,'avril':4,'mai':5,'juin':6,'juillet':7,'août':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12,'janv':1,'févr':2,'avr':4,'juil':7,'sept':9,'oct':10,'nov':11,'déc':12}
def french_date(s):
    m=re.search(r'(\d{1,2})[\s-]+([a-zéûô]+)\.?[\s-]+(\d{2,4})',s.lower())
    if not m or m[2] not in MONTHS:return None
    y=int(m[3]); y=y+2000 if y<70 else y+1900 if y<100 else y
    try:return date(y,MONTHS[m[2]],int(m[1])).isoformat()
    except ValueError:return None
def parse_boc(path,url,use_cache=True):
    cached=path.with_suffix('.json')
    if use_cache and cached.exists(): return json.loads(cached.read_text(encoding='utf-8'))
    if not path.read_bytes().startswith(b'%PDF'): raise ValueError('Contenu non PDF')
    records=[]
    with pdfplumber.open(path) as pdf:
        first=pdf.pages[0].extract_text() or ''
        session=french_date(first)
        if not session:raise ValueError('Date du bulletin absente')
        # Schema explicitement validé sur les bulletins 2026 : arrêt sûr en cas de changement.
        for page_index in (2,3):
            if page_index>=len(pdf.pages):continue
            pg=pdf.pages[page_index]; words=pg.extract_words()
            if not 590<pg.width<600:raise ValueError('Format de bulletin non reconnu')
            candidates=[w for w in words if 32<w['x0']<45 and re.fullmatch(r'[A-Z]{3,5}',w['text']) and w['text'] not in SECTORS and w['text']!='TOTAL']
            for w in candidates:
                line=sorted([z for z in words if abs(z['top']-w['top'])<2],key=lambda z:z['x0'])
                def cell(a,b):return ' '.join(z['text'] for z in line if a<=(z['x0']+z['x1'])/2<b)
                previous=num(cell(160,190)); opening=num(cell(190,218)); close=num(cell(218,246)); variation=num(cell(246,281)); volume=num(cell(281,318)); value=num(cell(318,360)); reference=num(cell(360,398))
                if previous is None or previous<=0 or reference is None or reference<=0:continue
                nearby=sorted((z for z in words if z['text'] in SECTORS and z['x0']<32 and abs(z['top']-w['top'])<15),key=lambda z:abs(z['top']-w['top']))
                sector=nearby[0]['text'] if nearby else None
                name=cell(60,160)
                # SP/NC n'est jamais transformé en cours exécuté.
                suspended=any(t in cell(190,246) for t in ('SP','NC'))
                calculated=((close/previous-1)*100) if close else None
                row=dict(symbol=w['text'],name=name,sector=sector,previous=previous,opening=opening,close=close,reference=reference,variation=variation,volume=volume or 0,value=value or 0,annual=num(cell(398,450)),dividend=num(cell(450,490)),dividendDate=french_date(cell(490,526)),yieldPublished=num(cell(526,558)),per=num(cell(558,588)),suspended=suspended,date=session,source=url,page=page_index+1)
                row['calculated']=calculated
                row['inconsistent']=calculated is not None and variation is not None and abs(calculated-variation)>0.16
                records.append(row)
    if not 40<=len(records)<=55:raise ValueError(f'Extraction incomplète : {len(records)} actions')
    result=dict(date=session,source=url,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),stocks=records)
    cached.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8'); return result
def download_day(d,known):
    stamp=d.strftime('%Y%m%d'); path=CACHE/f'BOC_{stamp}.pdf'
    urls=[known[stamp]] if stamp in known else [f'https://bfin.brvm.org/boc/BOC_JOUR/BOC_{stamp}.pdf',f'{HOST}/sites/default/files/boc_{stamp}_2.pdf',f'{HOST}/sites/default/files/boc_{stamp}.pdf']
    for url in urls:
        try:
            fetch(url,path); result=parse_boc(path,url)
            if result['date']!=d.isoformat(): raise ValueError('Date de séance différente')
            return result
        except Exception:
            # Un fichier déjà extrait mais portant une autre date n'est jamais accepté.
            if path.with_suffix('.json').exists():break
            path.unlink(missing_ok=True)
    return None
def catalogue():
    pages=[]
    for n in range(3):
        u=HOST+'/fr/rapports-societes-cotees'+(f'?page={n}' if n else '')
        try:pages.extend(links(fetch(u,CACHE/f'emetteurs-{n}.html',True).read_text(encoding='utf-8')))
        except Exception:pass
    urls=sorted(set(u for u in pages if '/rapports-societe-cotes/' in u))
    if len(urls)<40:raise RuntimeError('Catalogue officiel incomplet : dernier catalogue conservé.')
    previous={r['url']:r for r in json.loads((ROOT/'catalogue.json').read_text(encoding='utf-8'))} if (ROOT/'catalogue.json').exists() else {}
    def issuer(u):
        slug=u.rsplit('/',1)[-1]
        try:
            text=fetch(u,CACHE/f'emetteur-{slug}.html',True).read_text(encoding='utf-8')
            reports=[x for x in links(text) if urlparse(x).scheme=='https' and urlparse(x).hostname=='www.brvm.org' and '.pdf' in x.lower() and '/sites/default/files/' in x]
            reports=list(dict.fromkeys(reports))
            return dict(slug=slug,url=u,reports=[dict(url=r,title=unquote(r.rsplit('/',1)[-1]).replace('_',' ').replace('.pdf','')) for r in reports[:8]])
        except Exception:return previous.get(u,dict(slug=slug,url=u,reports=[],error=True))
    with ThreadPoolExecutor(max_workers=3) as pool:result=list(pool.map(issuer,urls))
    (ROOT/'catalogue.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Catalogue : {len(result)} émetteurs.',flush=True)
    return result
def publish_data(data):
    data['revision']=datetime.now(timezone.utc).isoformat()
    for name,payload in [('base-marche.json',json.dumps(data,ensure_ascii=False)),('donnees.js','window.BRVM_DATA = '+json.dumps(data,ensure_ascii=False)+';\n')]:
        temp=ROOT/(name+'.tmp');temp.write_text(payload,encoding='utf-8');temp.replace(ROOT/name)

def merge_sessions(existing,results):
    """Une panne ponctuelle ne supprime jamais une séance validée auparavant."""
    sessions={s['date']:s for s in existing.get('sessions',[])}
    for result in results:
        previous=sessions.get(result['date'])
        # Préserver les limites déjà extraites si le nouveau PDF est strictement identique.
        if previous and previous.get('sha256') and previous.get('sha256')==result.get('sha256') and previous.get('orderBookExtraction') and not result.get('orderBookExtraction'):
            result=previous
        sessions[result['date']]=result
    return sorted(sessions.values(),key=lambda s:s['date'])

def history_batch(existing,end,days,limit):
    """Petit lot borné, avec curseur avancé même pour un jour sans bulletin."""
    if not limit or not existing.get('sessions'):return [],None
    oldest=min(s['date'] for s in existing['sessions'])
    cursor=existing.get('historyBackfill',{}).get('nextBefore',oldest)
    start=date.fromisoformat(min(cursor,oldest))-timedelta(days=1)
    floor=end-timedelta(days=days)
    dates=[];at=start
    while at>=floor and len(dates)<limit:
        if at.weekday()<5:dates.append(at)
        at-=timedelta(days=1)
    return dates,{'nextBefore':(dates[-1] if dates else max(start,floor)).isoformat(),'floor':floor.isoformat(),'attempted':len(dates),'complete':at<floor}
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--jours',type=int,default=200);ap.add_argument('--sans-catalogue',action='store_true');ap.add_argument('--incremental',action='store_true');ap.add_argument('--refresh-catalogue',action='store_true');ap.add_argument('--historique-lot',type=int,default=0);ap.add_argument('--historique-jours',type=int,default=1095); args=ap.parse_args()
    existing=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8')) if (ROOT/'base-marche.json').exists() else {}
    text=fetch(HOST+'/fr/bulletins-officiels-de-la-cote',CACHE/'bulletins.html',True).read_text(encoding='utf-8')
    known={re.search(r'(20\d{6})',u)[1]:u for u in links(text) if re.search(r'boc_20\d{6}.*\.pdf',u,re.I)}
    if not known:raise RuntimeError('Aucun lien de bulletin reconnu ; dernière base conservée.')
    end=date.fromisoformat(max(known)[:4]+'-'+max(known)[4:6]+'-'+max(known)[6:])
    # Le dépôt BFIN peut publier le PDF avant que la liste Drupal soit mise à jour.
    # On vérifie le dépôt officiel pour le jour ouvré courant, sans inventer une séance.
    current=datetime.now(timezone.utc).date()
    if current.weekday()<5 and current>end:
        candidate=CACHE/f'BOC_{current:%Y%m%d}.pdf'
        direct=f'https://bfin.brvm.org/boc/BOC_JOUR/BOC_{current:%Y%m%d}.pdf'
        try:
            fetch(direct,candidate)
            parsed=parse_boc(candidate,direct)
            if parsed['date']==current.isoformat():known[f'{current:%Y%m%d}']=direct;end=current
        except Exception:pass
    older,backfill=history_batch(existing,end,args.historique_jours,args.historique_lot)
    if args.incremental and existing:
        if existing.get('session','')>=end.isoformat() and not older:
            catalog_path=ROOT/'catalogue.json'
            catalog_age=(datetime.now(timezone.utc).timestamp()-catalog_path.stat().st_mtime) if catalog_path.exists() else float('inf')
            if not args.sans_catalogue and (args.refresh_catalogue or catalog_age>86400):
                cat=catalogue()
                if cat!=existing.get('catalogue'):
                    existing['catalogue']=cat;publish_data(existing)
            print('Aucune nouvelle séance officielle : '+existing['session']+'. Base conservée.',flush=True)
            return
    known_dates={s['date'] for s in existing.get('sessions',[])}
    old_missing={s for s in existing.get('missingDates',[]) if s<(end-timedelta(days=7)).isoformat()}
    dates=[end-timedelta(days=i) for i in range(args.jours) if (end-timedelta(days=i)).weekday()<5 and (not args.incremental or ((end-timedelta(days=i)).isoformat() not in known_dates|old_missing))]
    dates=sorted(set(dates+older),reverse=True)
    results=[]; failures=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures={pool.submit(download_day,d,known):d for d in dates}
        for i,f in enumerate(as_completed(futures),1):
            r=f.result()
            if r:results.append(r)
            else:failures.append(futures[f].isoformat())
            if i%10==0:print(f'Bulletins : {i}/{len(dates)}, {len(results)} validés.',flush=True)
    if not results and not existing:raise RuntimeError('Aucun bulletin validé ; anciennes données conservées.')
    results=merge_sessions(existing,results)
    cat=json.loads((ROOT/'catalogue.json').read_text(encoding='utf-8')) if (ROOT/'catalogue.json').exists() else []
    catalog_path=ROOT/'catalogue.json'
    catalog_age=(datetime.now(timezone.utc).timestamp()-catalog_path.stat().st_mtime) if catalog_path.exists() else float('inf')
    if not args.sans_catalogue and (not args.incremental or args.refresh_catalogue or catalog_age>86400):cat=catalogue()
    missing=(set(existing.get('missingDates',[]))|set(failures))-{s['date'] for s in results}
    data=dict(existing,version=2,source=results[-1]['source'],fetched=datetime.now(timezone.utc).isoformat(),session=results[-1]['date'],stocks=results[-1]['stocks'],sessions=results,catalogue=cat,missingDates=sorted(missing))
    if backfill:data['historyBackfill']=backfill
    publish_data(data)
    print(f'Base prête : {len(results)} séances, {len(data["stocks"])} actions. Dates sans bulletin : {len(failures)}.',flush=True)
if __name__=='__main__':main()

