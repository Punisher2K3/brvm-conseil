"""Collecte autonome : étapes isolées, contrôles, reprise et état public."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,json,os,subprocess,sys,hashlib,zipfile

ROOT=Path(__file__).resolve().parent
STATE=ROOT/'actualisation-publique.json'
DATA=['base-marche.json','donnees.js','fondamentaux.json','fondamentaux.js','finances.js','catalogue.json','obligations.json','sources-complementaires.json.gz','brvm-officiel.json','indices-brvm.json']
def now():return datetime.now(timezone.utc).isoformat()
def read(path,default):
 try:return json.loads(path.read_text(encoding='utf-8'))
 except (OSError,ValueError):return default
def atomic(path,value):
 temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(path)
def validate_market(data,previous=None):
 sessions=data.get('sessions',[])
 dates=[s.get('date','') for s in sessions]
 if not dates or dates!=sorted(set(dates)) or data.get('session')!=dates[-1]:raise ValueError('Séances absentes, dupliquées ou mal ordonnées')
 if dates[-1]>datetime.now(timezone.utc).date().isoformat():raise ValueError('Séance future refusée')
 rows=sessions[-1].get('stocks',[])
 if len(rows)<40 or len({r['symbol'] for r in rows})!=len(rows):raise ValueError('Dernier bulletin incomplet')
 if any(r.get('date')!=dates[-1] for r in rows):raise ValueError('Date de ligne différente du bulletin')
 if previous and data['session']<previous['session']:raise ValueError('Régression de la date de séance refusée')
 if previous and not set(s['date'] for s in previous['sessions']).issubset(dates):raise ValueError('Suppression d’archives refusée')
 return True
def archive_due(previous,at):
 return at.hour>=15 and previous.get('lastArchiveDate')!=at.date().isoformat()
def stage(name,command,files,timeout,runner=None,validator=None):
 before={name:(ROOT/name).read_bytes() if (ROOT/name).exists() else None for name in files}
 prior=read(ROOT/'base-marche.json',{})
 record={'name':name,'startedAt':now(),'status':'ok'}
 try:
  if runner:runner(command,timeout)
  else:
   subprocess.run(command,cwd=ROOT,check=True,timeout=timeout,env={**os.environ,'BRVM_BACKFILL_BATCH':os.environ.get('BRVM_BACKFILL_BATCH','0'),'PYTHONIOENCODING':'utf-8'})
  if validator:validator(read(ROOT/'base-marche.json',{}),prior)
 except Exception as exc:
  for filename,raw in before.items():
   path=ROOT/filename
   if raw is not None:
    temp=path.with_suffix(path.suffix+'.restore');temp.write_bytes(raw);temp.replace(path)
   elif path.exists():path.unlink()
  record.update(status='degraded',message=type(exc).__name__+' : dernière copie valide conservée.')
 record['finishedAt']=now();return record
def backup():
 out=ROOT/'collecte'/'sauvegarde-donnees.zip';out.parent.mkdir(exist_ok=True)
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  for name in DATA+['previsions-journal.json','actualisation-publique.json']:
   if (ROOT/name).exists():z.write(ROOT/name,name)
 return out
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--mode',choices=['quick','full'],default='full');ap.add_argument('--sauvegarder',action='store_true');args=ap.parse_args()
 if args.sauvegarder:print(backup());return
 old=read(STATE,{});at=datetime.now(timezone.utc);deep=args.mode=='full' and archive_due(old,at)
 validate_market(read(ROOT/'base-marche.json',{}))
 stages=[];py=sys.executable
 os.environ['BRVM_BACKFILL_BATCH']='5' if deep else '0'
 stages.append(stage('Cours et fondamentaux',[py,'actualisation_auto.py','--force','--trigger','github'],DATA[:6],1200,validator=validate_market))
 stages.append(stage('Annonces obligataires',[py,'collecter_obligations.py'],['obligations.json'],180))
 stages.append(stage('Sources complémentaires',[py,'collecter_sources.py','--lot','12','--archives-lot','2' if deep else '0'],['sources-complementaires.json.gz'],480))
 if deep:
  archived=stage('Archives publiques BRVM',[py,'collecter_brvm.py','--requetes','35','--documents','8','--pages-par-rubrique','2'],['brvm-officiel.json'],900)
  report=read(ROOT/'brvm-officiel.json',{})
  if any(c.get('state')=='partial' for c in report.get('collections',[])):archived.update(status='degraded',message='Certaines rubriques sont inaccessibles ; reprise au prochain passage.')
  stages.append(archived)
 stages.append(stage('Indices officiels',[py,'collecter_indices.py'],['indices-brvm.json'],180))
 market=read(ROOT/'base-marche.json',{});validate_market(market)
 degraded=any(s['status']!='ok' for s in stages) or bool(market.get('collectionWarnings'))
 state={**old,'version':1,'lastAttemptAt':at.isoformat(),'finishedAt':now(),'state':'degraded' if degraded else 'ok','session':market['session'],'stages':stages,'intervalMinutes':60,'archiveAfterUtcHour':15,'runUrl':os.environ.get('GITHUB_SERVER_URL','https://github.com')+'/'+os.environ.get('GITHUB_REPOSITORY','Punisher2K3/brvm-conseil')+'/actions/runs/'+os.environ.get('GITHUB_RUN_ID','local')}
 if stages[0]['status']=='ok' and not market.get('collectionWarnings'):state['lastSuccessfulCollection']=stages[0]['finishedAt']
 if deep and next(s for s in stages if s['name']=='Archives publiques BRVM')['status']=='ok':state['lastArchiveDate']=at.date().isoformat()
 atomic(STATE,state)
 print(json.dumps({'state':state['state'],'session':state['session'],'archives':deep,'stages':stages},ensure_ascii=False))
 if state['state']=='degraded':print('::warning::Une source est indisponible ; données valides conservées. Consulter actualisation-publique.json.')
if __name__=='__main__':main()
