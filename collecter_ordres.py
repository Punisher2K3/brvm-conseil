"""Enrichit automatiquement la base avec les limites résiduelles officielles BRVM."""
from pathlib import Path
from datetime import datetime, timezone
import json, re
import pdfplumber

VERSION = 1

def numeric(text, price=False):
    text=re.sub(r"\s+", "", text)
    if price: text=text.replace(",", "")
    if not re.fullmatch(r"\d+(?:\.\d+)?", text): return None
    value=float(text)
    return value if price else int(value) if value.is_integer() else None

def extract_orders(pdf, symbols, session, source):
    for index in range(9, min(len(pdf.pages), 14)):
        page=pdf.pages[index]
        text=page.extract_text() or ""
        if "MARCHE DES ACTIONS" not in text or "résiduelle" not in text: continue
        if not 590 < page.width < 600: raise ValueError("Format de carnet non reconnu")
        words=page.extract_words()
        result={}
        for anchor in words:
            if anchor["text"] not in symbols or anchor["x0"] >= 45: continue
            line=sorted((w for w in words if abs(w["top"]-anchor["top"])<2), key=lambda w:w["x0"])
            def cell(lo,hi):
                return " ".join(w["text"] for w in line if lo <= (w["x0"]+w["x1"])/2 < hi)
            bid=numeric(cell(312,350),True); ask=numeric(cell(365,410),True)
            buy=numeric(cell(275,312)); sell=numeric(cell(430,510))
            valid=all(x is not None and x>0 for x in (bid,ask,buy,sell)) and bid<=ask
            result[anchor["text"]]=dict(date=session,source=source,page=index+1,
                bid=bid,ask=ask,bidQuantity=buy,askQuantity=sell,
                usable=valid,imbalance=(buy-sell)/(buy+sell) if valid else None,
                spreadPct=(ask-bid)/((ask+bid)/2)*100 if valid else None,
                kind="residual_limits",extractionVersion=VERSION)
        if len(result)<40: raise ValueError("Extraction résiduelle incomplète")
        return result
    return {}

def main():
    import collecter
    root=Path(__file__).resolve().parent
    path=root/"base-marche.json"
    data=json.loads(path.read_text(encoding="utf-8"))
    changed=False; done=0; count=0
    for session in reversed(data["sessions"]):
        if session.get("orderBookExtraction")==VERSION: continue
        if count>=24: break
        count+=1
        pdfpath=root/"collecte"/("BOC_"+session["date"].replace("-","")+".pdf")
        try:
            collecter.fetch(session["source"],pdfpath)
            with pdfplumber.open(pdfpath) as pdf:
                orders=extract_orders(pdf,{r["symbol"] for r in session["stocks"]},session["date"],session["source"])
            if not orders:
                print("Limites résiduelles non retrouvées : "+session["date"],flush=True)
                continue
            for row in session["stocks"]:
                if row["symbol"] in orders: row["orderBook"]=orders[row["symbol"]]
            session["orderBookExtraction"]=VERSION
            cache=pdfpath.with_suffix(".json")
            temp=cache.with_suffix(".json.tmp")
            temp.write_text(json.dumps(session,ensure_ascii=False),encoding="utf-8")
            temp.replace(cache)
            changed=True; done+=1
        except Exception as exc:
            print("Carnet conservé sans enrichissement : "+session["date"]+" ("+type(exc).__name__+")",flush=True)
    if changed:
        data["stocks"]=data["sessions"][-1]["stocks"]
        data["orderBookUpdated"]=datetime.now(timezone.utc).isoformat()
        collecter.publish_data(data)
    print(str(done)+" séances enrichies ; reprise automatique des autres archives au prochain passage.",flush=True)
if __name__=="__main__": main()
