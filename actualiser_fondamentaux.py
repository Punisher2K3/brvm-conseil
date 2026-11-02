"""Actualise les données structurées ; les transcriptions annuelles restent vérifiées."""
import json,re
from datetime import datetime,timezone
from collecter_fondamentaux import ROOT,collect_dividends,collect_capitalisations,collect_live_market,fetch,publish
def main():
    data=json.loads((ROOT/'fondamentaux.json').read_text(encoding='utf-8'))
    market=json.loads((ROOT/'base-marche.json').read_text(encoding='utf-8'))
    stocks=market['sessions'][-1]['stocks']
    data['liveMarket']=collect_live_market(stocks,True)
    data['capitalisations']=collect_capitalisations(stocks,True)
    text=fetch('https://www.brvm.org/fr/capitalisations/0','capitalisations.html')
    m=re.search(r'Dernière mise à jour\s*:\s*[^,]+,\s*(\d+)\s+([a-zéû]+),?\s+(20\d{2})',text)
    months={'janvier':1,'février':2,'mars':3,'avril':4,'mai':5,'juin':6,'juillet':7,'août':8,'septembre':9,'octobre':10,'novembre':11,'décembre':12}
    data['capitalisationSession']=f'{m[3]}-{months[m[2]]:02d}-{int(m[1]):02d}' if m else None
    at=datetime.now(timezone.utc)
    previous=datetime.fromisoformat(data.get('dividendCollection','2000-01-01T00:00:00+00:00'))
    if (at-previous).total_seconds()>86400:
        data['dividends'],data['dividendUnmatched']=collect_dividends(stocks,True)
        data['dividendCollection']=at.isoformat()
    publish(data);print('Capitalisations et dividendes officiels actualisés ; bilans normalisés conservés.')
if __name__=='__main__':main()
