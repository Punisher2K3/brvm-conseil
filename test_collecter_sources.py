import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from collecter_sources import parse_history,match_symbols,Client,iso_date

class PublicSourceTests(unittest.TestCase):
    def test_ohlc_dates_french_numbers_and_bad_rows(self):
        html='<table><tr>'+''.join('<td>'+x+'</td>' for x in ['12/11/2026','4&#160;195','4190','4195','4190','231 018','969120510','0,12%'])+'</tr><tr>'+''.join('<td>'+x+'</td>' for x in ['13/11/2026','100','110','105','100','10','1000','1%'])+'</tr></table>'
        rows=parse_history(html,'SNTS','https://www.sikafinance.com/test','2026-11-12T20:00:00Z')
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['close'],4195);self.assertEqual(rows[0]['date'],'2026-11-12');self.assertEqual(rows[0]['volume'],231018)

    def test_403_stops_the_host_without_a_second_attempt(self):
        client=Client()
        with patch('collecter_sources.urlopen',side_effect=HTTPError('https://www.richbourse.com/robots.txt',403,'Forbidden',{},None)) as request:
            with self.assertRaises(PermissionError):client.get('https://www.richbourse.com/test-public-page-403')
            with self.assertRaises(PermissionError):client.get('https://www.richbourse.com/other-public-page')
            self.assertEqual(request.call_count,1)

    def test_allowlisted_hosts_and_invalid_dates(self):
        with self.assertRaises(ValueError):Client().get('https://example.org/not-allowed')
        self.assertIsNone(iso_date('31/02/2026'))

    def test_issuer_mapping_avoids_short_substring(self):
        stocks=[{'symbol':'SNTS','name':'SONATEL SN'},{'symbol':'CIEC','name':'CIE CI'}]
        self.assertEqual(match_symbols('Sonatel annonce ses résultats',stocks),['SNTS'])
        self.assertEqual(match_symbols('Société générale et économie',stocks),[])

if __name__=='__main__':unittest.main()
