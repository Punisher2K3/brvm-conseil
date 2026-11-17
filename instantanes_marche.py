"""Archive compacte d'instantanés publics ; aucune prévision intrajournalière inventée."""
import json,hashlib,re,math
from datetime import date

MAX_SNAPSHOTS=400
MAX_SESSIONS=10
SOURCE='https://www.brvm.org/fr/cours-actions/0'

def compact(quote):
    if not isinstance(quote,dict) or quote.get('source')!=SOURCE:return None
    session=quote.get('session','');clock=quote.get('time','')
    try:date.fromisoformat(session)
    except (ValueError,TypeError):return None
    if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',clock):return None
    rows=[]
    for row in quote.get('stocks',[]):
        price,volume=row.get('price'),row.get('volume')
        if not isinstance(row.get('symbol'),str) or not isinstance(price,(int,float)) or not math.isfinite(price) or price<=0:return None
        if not isinstance(volume,(int,float)) or not math.isfinite(volume) or volume<0:return None
        rows.append([row['symbol'],price,volume])
    if len(rows)<40 or len({r[0] for r in rows})!=len(rows):return None
    return dict(session=session,time=clock,collected=quote.get('collected'),rows=sorted(rows,key=lambda r:r[0]))

def merge_history(payload,previous=None):
    previous=previous or {}
    items=[]
    for data in (previous,payload):
        history=data.get('intraday',{})
        if history.get('version')==1:
            for point in history.get('snapshots',[]):
                if isinstance(point,dict) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',point.get('session','')) and isinstance(point.get('rows'),list):
                    items.append(point)
        point=compact(data.get('liveMarket'))
        if point:items.append(point)
    unique={}
    for point in items:
        normalised=[[row[0],float(row[1]),float(row[2])] for row in point.get('rows',[])]
        key=point.get('session','')+'T'+point.get('time','')+'|'+hashlib.sha256(json.dumps(normalised,sort_keys=True).encode()).hexdigest()
        if key not in unique:unique[key]=point
    points=sorted(unique.values(),key=lambda p:(p.get('session',''),p.get('time',''),p.get('collected') or ''))
    current=compact(payload.get('liveMarket'))
    if current:points=[p for p in points if (p.get('session',''),p.get('time',''))<=(current['session'],current['time'])]
    dates=sorted({p['session'] for p in points})[-MAX_SESSIONS:]
    points=[p for p in points if p['session'] in dates][-MAX_SNAPSHOTS:]
    return dict(version=1,source=SOURCE,maxSnapshots=MAX_SNAPSHOTS,maxSessions=MAX_SESSIONS,snapshots=points,
                scope='Observations publiques différées. Deux contenus différents au même horodatage sont conservés ; ce ne sont pas toutes les transactions.')

def archive_into(payload,previous=None):
    payload['intraday']=merge_history(payload,previous)
    return payload
