"""Ajoute les nouvelles archives sans remplacer une séance déjà présente sur main."""
import gzip,json
from pathlib import Path
from collecter import ROOT,publish_data

def merge_archives(data,archive):
 dates={s['date'] for s in data['sessions']}
 added=[s for s in archive.get('sessions',[]) if s['date'] not in dates]
 if not added:return data,0
 for session in added:
  if len(session['stocks'])<40 or any(r['date']!=session['date'] for r in session['stocks']):raise ValueError('Archive incomplète ou date différente')
 result={**data,'sessions':sorted(data['sessions']+added,key=lambda s:s['date'])}
 issues={r['date']:r for r in data.get('retrievalIssues',[])}
 for r in archive.get('retrievalIssues',[]):
  if r['date'] not in {s['date'] for s in result['sessions']}:issues[r['date']]=r
 result['retrievalIssues']=list(issues.values())
 return result,len(added)

def main():
 path=ROOT/'historique-brvm-initial.json.gz'
 if not path.exists():return
 archive=json.loads(gzip.decompress(path.read_bytes()))
 data=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8'))
 merged,n=merge_archives(data,archive)
 if n:publish_data(merged)
 print(str(n)+' séances officielles supplémentaires intégrées sans écraser les données existantes.')
if __name__=='__main__':main()
