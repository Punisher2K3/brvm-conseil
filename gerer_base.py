"""Archive compacte dans Git ; JSON et script navigateur reconstruits sur le serveur."""
from pathlib import Path
import argparse,gzip,json
ROOT=Path(__file__).resolve().parent
def main():
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['restaurer','sauvegarder']);mode=ap.parse_args().mode
    source=ROOT/'base-marche.json';archive=ROOT/'base-marche.json.gz'
    if mode=='restaurer':
        payload=gzip.decompress(archive.read_bytes());data=json.loads(payload)
        if not data.get('sessions') or len(data['sessions'][-1]['stocks'])<40:raise ValueError('Archive de marché incomplète')
        source.write_bytes(payload)
        (ROOT/'donnees.js').write_text('window.BRVM_DATA = '+json.dumps(data,ensure_ascii=False)+';\n',encoding='utf-8')
    else:
        payload=source.read_bytes();json.loads(payload)
        archive.write_bytes(gzip.compress(payload,mtime=0))
    print('Base de marché '+('restaurée' if mode=='restaurer' else 'archivée')+'.')
if __name__=='__main__':main()
