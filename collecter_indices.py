"""Indices et activité officiels extraits des premières pages des BOC archivés."""
from pathlib import Path
import json,re,hashlib
import pdfplumber
from collecter import ROOT,french_date,num
from collecter_brvm import atomic,now

def parse(text,source,sha):
 session=french_date(text)
 if not session:raise ValueError('Séance absente')
 header=re.search(r'BRVM COMPOSITE\s+([\d ,]+)\s+BRVM 30\s+([\d ,]+)\s+BRVM PRESTIGE\s+([\d ,]+)',text)
 if not header:raise ValueError('En-tête des indices non reconnu')
 rows=[{'name':name,'series':name,'value':num(value)} for name,value in zip(['BRVM COMPOSITE','BRVM 30','BRVM PRESTIGE'],header.groups())]
 section='compartiment'
 for line in text.splitlines():
  if 'INDICES SECTORIELS ANCIENS' in line:section='anciens'
  elif 'INDICES SECTORIELS NOUVEAUX' in line or line=='INDICES SECTORIELS':section='base2025'
  elif 'INDICE TOTAL RETURN' in line:section='total_return'
  m=re.match(r'^(BRVM\s*[-–]\s*[A-ZÉÈÊÇÀ \-]+?)\s*(?:\(\*\*\))?\s+(\d+)\s+([\d,]+)\s+(-?[\d,]+)\s*%',line)
  if m:
   name=m[1].strip().replace('�','-');rows.append({'name':name,'series':section+'|'+name,'companies':int(m[2]),'value':num(m[3]),'variationPct':num(m[4])})
 if any(not r['value'] or r['value']<=0 for r in rows):raise ValueError('Indice invalide')
 activity={}
 for label,key in [('Capitalisation boursière','capitalisation'),('Volume échangé','volume'),('Valeur transigée','value'),('Nombre de titres en hausse','advances'),('Nombre de titres en baisse','declines'),('Nombre de titres inchangés','unchanged')]:
  m=re.search(re.escape(label)+r'[^\n\d]*([\d ]+?)\s+-?\d+,\d+\s*%',text)
  if m:activity[key]=num(m[1])
 return {'session':session,'source':source,'sha256':sha,'parserVersion':2,'kind':'official_bulletin','final':True,'rows':rows,'activity':activity}

def main():
 path=ROOT/'indices-brvm.json';old=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
 snapshots={s['session']:s for s in old.get('sessions',[])};errors=[]
 market=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8'))
 for session in market['sessions']:
  if snapshots.get(session['date'],{}).get('sha256')==session.get('sha256') and snapshots[session['date']].get('parserVersion')==2:continue
  pdf=ROOT/'collecte'/('BOC_'+session['date'].replace('-','')+'.pdf')
  if not pdf.exists():continue
  try:
   with pdfplumber.open(pdf) as doc:text=doc.pages[0].extract_text() or ''
   result=parse(text,session['source'],hashlib.sha256(pdf.read_bytes()).hexdigest())
   if result['session']!=session['date']:raise ValueError('Date différente')
   snapshots[result['session']]=result
  except Exception as e:errors.append({'date':session['date'],'message':str(e)})
 data={'version':1,'checkedAt':now(),'sessions':sorted(snapshots.values(),key=lambda s:s['session']),'errors':errors,'scope':'Indices et activité des seuls bulletins archivés et reconnus. Séries sectorielles anciennes séparées des nouvelles ; aucune interpolation des dates manquantes.'}
 atomic(path,data);print(str(len(snapshots))+' séances avec indices officiels ; '+str(len(errors))+' erreurs',flush=True)
if __name__=='__main__':main()
