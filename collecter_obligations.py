"""Surveille automatiquement les adjudications UMOA-Titres, sans clé ni envoi de message."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request,urlopen
from urllib.parse import urljoin,urlparse
from datetime import datetime,timezone,date
import json,re

HOME="https://www.umoatitres.org/fr/"
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.rows=[];self.cells=None;self.cell=None;self.title="";self.in_title=False
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=="a" and attrs.get("href"):self.links.append(urljoin(HOME,attrs["href"]))
        if tag=="tr":self.cells=[]
        if tag in ("td","th") and self.cells is not None:self.cell=[]
        if tag=="h1" or tag=="h2":self.in_title=True
    def handle_data(self,text):
        if self.cell is not None:self.cell.append(text)
        if self.in_title:self.title+=text+" "
    def handle_endtag(self,tag):
        if tag in ("td","th") and self.cell is not None:
            self.cells.append(" ".join(" ".join(self.cell).split()));self.cell=None
        if tag=="tr" and self.cells is not None:
            if self.cells:self.rows.append(self.cells)
            self.cells=None
        if tag in ("h1","h2"):self.in_title=False
def read(url):
    if urlparse(url).hostname not in ("www.umoatitres.org","umoatitres.org"):raise ValueError("Hôte non officiel")
    with urlopen(Request(url,headers={"User-Agent":"BRVMConseil/4.0"}),timeout=30) as r:
        if r.geturl().split("/")[2] not in ("www.umoatitres.org","umoatitres.org"):raise ValueError("Redirection non officielle")
        html=r.read(3000000).decode("utf-8",errors="replace")
    p=Page();p.feed(html);return p
def operation_date(url):
    m=re.search(r"(\d{2})[-.](\d{2})[-.](20\d{2})",url)
    if not m:return None
    try:return date(int(m[3]),int(m[2]),int(m[1])).isoformat()
    except ValueError:return None
def event(url,p):
    day=operation_date(url)
    if not day:raise ValueError("Date non reconnue")
    details=[{"label":r[0],"value":" · ".join(r[1:])} for r in p.rows if len(r)>=2 and any(k in r[0].lower() for k in ("date","montant","durée","chéance","taux","nominale"))]
    if not details:raise ValueError("Caractéristiques non reconnues")
    docs=list(dict.fromkeys(u for u in p.links if urlparse(u).hostname in ("www.umoatitres.org","umoatitres.org") and ".pdf" in u.lower()))
    title=" ".join(p.title.split())[:220] or "Adjudication de titres publics"
    return dict(id=url,title=title,date=day,source=url,documents=docs,details=details,
                kind="Adjudication de titres publics",publicationDate=None)
def main():
    root=Path(__file__).resolve().parent;path=root/"obligations.json"
    old=json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"events":[]}
    now=datetime.now(timezone.utc);today=now.date().isoformat()
    known={e["id"]:e for e in old.get("events",[])}
    errors=[];checked=0
    try:
        home=read(HOME)
        urls=sorted(set(u for u in home.links if "/fr/emission/" in u and operation_date(u) and operation_date(u)>=today))
        for url in urls[:30]:
            try:
                item=event(url,read(url));item["publicationDate"]=known.get(url,{}).get("publicationDate");item["verifiedAt"]=now.isoformat();known[url]=item;checked+=1
            except Exception as exc:errors.append(type(exc).__name__+": "+url)
        if not urls:errors.append("Aucune émission future reconnue sur la page officielle ; dernières annonces conservées.")
    except Exception as exc:errors.append("Accès UMOA-Titres : "+type(exc).__name__)
    result=dict(checkedAt=now.isoformat(),lastSuccess=now.isoformat() if checked else old.get("lastSuccess"),
                events=sorted((e for e in known.values() if e["date"]>=today),key=lambda e:e["date"]),warnings=errors,
                scope="Adjudications annoncées sur UMOA-Titres. Couverture des emprunts d’entreprise et des appels publics à l’épargne non encore automatisée.")
    tmp=path.with_suffix(".json.tmp");tmp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8");tmp.replace(path)
    print("Obligations : "+str(checked)+" annonces vérifiées ; "+str(len(errors))+" avertissement(s).")
if __name__=="__main__":main()
