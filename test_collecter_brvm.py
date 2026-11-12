import unittest
from collecter_brvm import parse_listing,safe,symbols_for,indices,calendar
from collecter_indices import parse

class OfficialTest(unittest.TestCase):
 def test_dates_and_source(self):
  html='<table><tr><th>Date</th><th>Société</th><th>Titre</th></tr><tr><td>12/11/2026</td><td>SONATEL</td><td>Résultats <a href="/sites/default/files/a.pdf">Télécharger</a><a href="https://evil.example/b.pdf">X</a></td></tr></table><a href="?page=4">dernier</a>'
  rows,last=parse_listing(html,'https://www.brvm.org/fr/communiques','communiques',[{'symbol':'SNTS','name':'SONATEL'}],'2026-11-12T20:00:00Z')
  self.assertEqual(len(rows),1);self.assertEqual(last,4);self.assertEqual(rows[0]['publishedAt'],'2026-11-12');self.assertEqual(rows[0]['symbols'],['SNTS'])
 def test_effect_date_is_not_publication(self):
  html='<table><tr><th>Emetteur</th><th>Date de fractionnement</th><th>Avis</th></tr><tr><td>SONATEL</td><td>26 octobre 2026</td><td><a href="/a.pdf">Télécharger</a></td></tr></table>'
  rows,_=parse_listing(html,'https://www.brvm.org/fr/esv/fractionnement','fractionnements',[{'symbol':'SNTS','name':'SONATEL'}],'2026-11-12T20:00:00Z')
  self.assertIsNone(rows[0]['publishedAt']);self.assertEqual(rows[0]['fields'][1]['date'],'2026-10-26');self.assertEqual(rows[0]['fields'][1]['label'],'Date de fractionnement')
 def test_company_not_securitisation(self):
  stocks=[{'symbol':'SNTS','name':'SONATEL'},{'symbol':'BOAC','name':"BANK OF AFRICA COTE D'IVOIRE"}]
  self.assertEqual(symbols_for('FCTC SONATEL',stocks),[]);self.assertEqual(symbols_for('BANK OF AFRICA CI',stocks),['BOAC']);self.assertFalse(safe('https://www.brvm.org.evil.com/a.pdf'))
 def test_indices_and_activity_not_concatenated(self):
  text='jeudi 12 novembre 2026\nBRVM COMPOSITE 518,96 BRVM 30 251,33 BRVM PRESTIGE 193,50\nCapitalisation boursière (FCFA)(Actions & Droits) 20 351 184 165 678 0,35 % Capitalisation 10\nVolume échangé (Actions & Droits) 1 124 578 30,98 % Volume 10\nValeur transigée (FCFA) (Actions & Droits) 2 214 370 213 83,96 % Valeur 10\nNombre de titres en hausse 28 86,67 % Nombre 3\nNombre de titres en baisse 11 -52,17 % Nombre 4\nINDICES SECTORIELS ANCIENS\nBRVM - SERVICES PUBLICS 5 703,56 -1,38 %\nINDICES SECTORIELS NOUVEAUX\nBRVM - SERVICES PUBLICS 2 225,46 1,44 %'
  r=parse(text,'https://www.brvm.org/a.pdf','hash');self.assertEqual(r['activity']['capitalisation'],20351184165678);self.assertEqual(r['activity']['volume'],1124578);self.assertEqual(r['activity']['value'],2214370213);self.assertEqual(r['activity']['advances'],28);self.assertEqual(r['activity']['declines'],11)
  self.assertNotEqual(r['rows'][-1]['series'],r['rows'][-2]['series'])
 def test_unknown_pdf_layout_rejected(self):
  with self.assertRaises(ValueError):parse('jeudi 12 novembre 2026\n123','https://www.brvm.org/a.pdf','hash')
 def test_calendar_mobile_dates_remain_provisional(self):
  r=calendar('<table><tr><td>25/12/2026</td><td>Noël</td></tr><tr><td>20/03/2026 (*)</td><td>Ramadan</td></tr></table>','https://www.brvm.org/fr/jours-feries','2026-11-12T20:00:00Z')
  self.assertEqual(r['closedDates'],['2026-12-25']);self.assertTrue(r['rows'][1]['provisional'])
 def test_archive_preserves_existing_sessions(self):
  from integrer_archives_brvm import merge_archives
  old={'date':'2026-11-12','stocks':[{'date':'2026-11-12','close':123}]*40}
  new={'date':'2026-11-11','stocks':[{'date':'2026-11-11','close':120}]*40}
  result,n=merge_archives({'sessions':[old]},{'sessions':[new,{**old,'stocks':[]} ]})
  self.assertEqual(n,1);self.assertEqual(result['sessions'][-1],old)
  with self.assertRaises(ValueError):merge_archives({'sessions':[old]},{'sessions':[{'date':'2026-11-10','stocks':[]} ]})
 def test_temporary_server_error_keeps_cached_source(self):
  import collecter,tempfile
  from pathlib import Path
  from urllib.error import HTTPError
  from unittest.mock import Mock,patch
  client=Mock();client.get.side_effect=HTTPError('https://www.brvm.org/test',500,'Server Error',{},None)
  with tempfile.TemporaryDirectory(dir=collecter.CACHE) as folder,patch.object(collecter,'_NETWORK_CLIENT',client),patch.object(collecter,'_FETCH_WARNINGS',[]):
   self.assertTrue(Path(folder).resolve().is_relative_to(collecter.CACHE.resolve()))
   path=Path(folder)/'source.html';path.write_text('ancienne copie valide',encoding='utf-8')
   self.assertEqual(collecter.fetch('https://www.brvm.org/test',path,True).read_text(encoding='utf-8'),'ancienne copie valide')
   self.assertEqual(len(collecter._FETCH_WARNINGS),1)
   with self.assertRaises(HTTPError):collecter.fetch('https://www.brvm.org/test',Path(folder)/'absent.html',True)
if __name__=='__main__':unittest.main()
