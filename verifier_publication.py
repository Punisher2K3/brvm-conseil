"""Contrôles du paquet réellement publié, après génération et avant déploiement."""
from pathlib import Path
from html.parser import HTMLParser
import json,re,hashlib
from preparer_publication import ROOT,PUBLIC,GENERATED

class Audit(HTMLParser):
 def __init__(self):super().__init__();self.csp=False;self.refs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta' and a.get('http-equiv','').lower()=='content-security-policy':self.csp="script-src 'self'" in a.get('content','') and "'unsafe-eval'" not in a.get('content','')
  if tag=='script':
   if not a.get('src') or re.match(r'^(?:https?:|//|data:)',a['src']):raise ValueError('Script distant ou incorporé refusé')
   self.refs.append(a['src'].split('?')[0])
  if tag=='a' and a.get('target')=='_blank' and not {'noopener','noreferrer'}.issubset(set(a.get('rel','').split())):raise ValueError('Lien externe non protégé')
  if tag=='form':raise ValueError('Collecte par formulaire non prévue dans la politique')
def verify(out):
 allowed=set(PUBLIC)|GENERATED
 for path in out.iterdir():
  if not path.is_file() or path.name not in allowed:raise ValueError('Fichier non prévu dans la publication : '+path.name)
  raw=path.read_bytes()
  if re.search(rb'(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)',raw):raise ValueError('Secret potentiel dans '+path.name)
  if path.suffix=='.html':
   audit=Audit();audit.feed(raw.decode('utf-8'))
   if not audit.csp:raise ValueError('Politique de sécurité absente : '+path.name)
   if any(not (out/name).is_file() for name in audit.refs):raise ValueError('Script manquant')
 hashes=json.loads((out/'integrite-publication.json').read_text(encoding='utf-8'))['files']
 for name,expected in hashes.items():
  if hashlib.sha256((out/name).read_bytes()).hexdigest()!=expected:raise ValueError('Empreinte incohérente : '+name)
 print('Publication vérifiée : pages, scripts, liens, fichiers autorisés et empreintes.')
if __name__=='__main__':verify(ROOT/'site-public')
