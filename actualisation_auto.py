"""Actualisation partagée par le serveur, le lanceur et la tâche programmée.

Un seul collecteur à la fois, état persistant et dernier jeu valide conservé.
"""
from pathlib import Path
from datetime import datetime, timezone
import json, os, subprocess, sys, time, argparse, re

ROOT=Path(__file__).resolve().parent
STATE_PATH=ROOT/'collecte'/'etat-actualisation.json'
CONFIG_PATH=ROOT/'actualisation-config.json'
DEFAULT_CONFIG={'enabled':True,'intervalMinutes':60,'retryMinutes':15,'scheduledTime':'23:15','timezone':'Europe/Paris','scheduledTask':None}

def now():return datetime.now(timezone.utc).isoformat()
def read_json(path,default):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except (OSError,ValueError):return dict(default)
def configuration():return {**DEFAULT_CONFIG,**read_json(CONFIG_PATH,{})}
def read_state():return read_json(STATE_PATH,{'state':'idle','message':'En attente de la première vérification automatique.'})
def write_state(value):
    STATE_PATH.parent.mkdir(exist_ok=True)
    tmp=STATE_PATH.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(STATE_PATH)
def age_minutes(timestamp,at=None):
    if not timestamp:return float('inf')
    try:return ((at or datetime.now(timezone.utc))-datetime.fromisoformat(timestamp)).total_seconds()/60
    except (ValueError,TypeError):return float('inf')
def due(state=None,config=None,at=None):
    state=state or read_state();config=config or configuration()
    if not config.get('enabled'):return False
    if state.get('state')=='running':return not busy()
    interval=config['retryMinutes'] if state.get('state')=='error' else config['intervalMinutes']
    return age_minutes(state.get('lastAttempt'),at)>=interval
def revision():
    market=read_json(ROOT/'base-marche.json',{})
    finances=(ROOT/'finances.js').read_text(encoding='utf-8') if (ROOT/'finances.js').exists() else ''
    match=re.search(r'BRVM_FINANCIALS_REVISION\s*=\s*[\'"]([a-f0-9]+)',finances)
    extra=(ROOT/'fondamentaux.js').read_text(encoding='utf-8') if (ROOT/'fondamentaux.js').exists() else ''
    deep=re.search(r'BRVM_FUNDAMENTALS_REVISION\s*=\s*[\'"]([a-f0-9]+)',extra)
    forecast=read_json(ROOT/'previsions-calcul.json',{}).get('inputSha256','none')
    return str(market.get('revision') or market.get('fetched') or '')+'|'+(match[1] if match else 'legacy')+'|'+(deep[1] if deep else 'legacy')+'|'+forecast
class ProjectLock:
    def __enter__(self):
        path=ROOT/'collecte'/'actualisation.lock';path.parent.mkdir(exist_ok=True)
        self.handle=path.open('a+b');self.handle.seek(0)
        if path.stat().st_size==0:self.handle.write(b'0');self.handle.flush()
        self.handle.seek(0)
        try:
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(self.handle.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.handle.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:self.handle.close();raise BlockingIOError('Une actualisation est déjà en cours.')
        return self
    def __exit__(self,*args):
        self.handle.seek(0)
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(self.handle.fileno(),msvcrt.LK_UNLCK,1)
        else:
            import fcntl
            fcntl.flock(self.handle.fileno(),fcntl.LOCK_UN)
        self.handle.close()
def busy():
    try:
        with ProjectLock():return False
    except BlockingIOError:return True
def runtime():
    bundled=Path('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
    return str(bundled) if bundled.exists() else sys.executable
def execute(command,log):
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    p=subprocess.Popen(command,cwd=ROOT,stdout=log,stderr=log,creationflags=flags,env={**os.environ,'PYTHONIOENCODING':'utf-8'})
    try:code=p.wait(timeout=1800)
    except subprocess.TimeoutExpired:
        if os.name=='nt':subprocess.run(['taskkill','/PID',str(p.pid),'/T','/F'],stdout=log,stderr=log,creationflags=flags)
        else:p.kill()
        p.wait();raise RuntimeError('Délai de collecte dépassé ; la dernière base publiée reste disponible.')
    if code:raise RuntimeError('La collecte a échoué. Les détails sont dans collecte/actualisation.log.')
def perform(trigger='scheduled',force=False):
    if trigger!='manual' and not configuration().get('enabled'):
        return {'state':'idle','result':'disabled','message':'Actualisation automatique désactivée.'}
    try:
        with ProjectLock():
            previous=read_state()
            interrupted=previous.get('state')=='running'
            if not force and not interrupted and not due(previous):return {'result':'skipped',**previous}
            state={**previous,'state':'running','message':'Vérification automatique des publications BRVM…','startedAt':now(),'lastAttempt':now(),'trigger':trigger}
            write_state(state)
            old_revision=revision()
            old_session=read_json(ROOT/'base-marche.json',{}).get('session')
            try:
                with (ROOT/'collecte'/'actualisation.log').open('w',encoding='utf-8') as log:
                    command=[runtime(),'-u',str(ROOT/'collecter.py'),'--jours','200','--incremental','--historique-lot','5']
                    if trigger in ('scheduled','manual'):command.append('--refresh-catalogue')
                    execute(command,log)
                    execute([runtime(),str(ROOT/'collecter_ordres.py')],log)
                    execute([runtime(),str(ROOT/'publier_finances.py')],log)
                    execute([runtime(),str(ROOT/'actualiser_fondamentaux.py')],log)
                session=read_json(ROOT/'base-marche.json',{}).get('session')
                changed=revision()!=old_revision
                state.update(state='done',finishedAt=now(),lastSuccess=now(),session=session,changed=changed,newSession=session!=old_session,message='Nouvelle séance intégrée ; les avis seront recalculés.' if session!=old_session else 'Vérification terminée : aucune nouvelle séance publiée.')
                live=read_json(ROOT/'fondamentaux.json',{}).get('liveMarket',{})
                if live.get('session','')>(session or ''):
                    state['message']='Cours web du '+live['session']+' à '+live['time']+' (Abidjan) disponibles ; dernier bulletin PDF analysé : '+str(session)+'.'
            except Exception as e:
                state.update(state='error',finishedAt=now(),message=str(e),changed=False)
            write_state(state);return state
    except BlockingIOError:return {**read_state(),'result':'busy'}
def status():
    data=read_state();config=configuration()
    return {**data,'project':'BRVM Conseil','revision':revision(),'auto':config}
def worker(stop_event):
    while not stop_event.is_set():
        if due():perform(trigger='site-ouvert')
        stop_event.wait(60)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--force',action='store_true');ap.add_argument('--trigger',default='scheduled');args=ap.parse_args()
    result=perform(args.trigger,args.force);print(json.dumps(result,ensure_ascii=False))
    if result.get('state')=='error' and result.get('result') not in ('busy','skipped'):sys.exit(1)
if __name__=='__main__':main()

