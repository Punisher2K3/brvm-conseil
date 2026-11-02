from pathlib import Path
from urllib.parse import urlparse
import json, math, hashlib
ROOT=Path(__file__).resolve().parent
def publish():
    rows=json.loads((ROOT/'finances.json').read_text(encoding='utf-8'))
    seen=set()
    for r in rows:
        if r['symbol'] in seen:raise ValueError('Une seule période courante par symbole')
        seen.add(r['symbol'])
        if urlparse(r['source']).hostname not in ('www.brvm.org','bfin.brvm.org'):raise ValueError('Source officielle requise')
        for k in ('revenue','previousRevenue','profit','previousProfit'):
            if r[k] is None and k in ('revenue','previousRevenue') and r.get('revenueComparable') is False and r.get('missingReason'):continue
            if r[k] is None and k=='profit' and r.get('profitReliable') is False and r.get('dataIssues'):continue
            if r[k] is None and k in ('previousRevenue','previousProfit'):
                growth=r.get('revenueGrowthReported' if k=='previousRevenue' else 'profitGrowthReported')
                if isinstance(growth,(int,float)) and math.isfinite(growth):continue
            if not isinstance(r[k],(float,int)) or not math.isfinite(r[k]):raise ValueError('Montant invalide')
        if (r['revenue'] is not None and r['revenue']<=0) or (r['previousRevenue'] is not None and r['previousRevenue']<=0):raise ValueError('Revenus positifs requis')
        if not r.get('evidence') or not r.get('scope'):raise ValueError('Preuve et périmètre requis')
    content=json.dumps(rows,ensure_ascii=False)
    target=ROOT/'finances.js';payload='window.BRVM_FINANCIALS = '+content+';\nwindow.BRVM_FINANCIALS_REVISION = "'+hashlib.sha256(content.encode('utf-8')).hexdigest()+'";\n'
    if not target.exists() or target.read_text(encoding='utf-8')!=payload:
        temp=ROOT/'finances.js.tmp';temp.write_text(payload,encoding='utf-8');temp.replace(target)
    print(f'{len(rows)} comptes normalisés publiés.')
if __name__=='__main__':publish()
