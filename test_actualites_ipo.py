import unittest
from actualites_ipo import parse_page,render
class TestIPO(unittest.TestCase):
 def test_dates_and_price(self):
  html="<h1>Banque Test</h1>Offre Publique de Vente suivie d’une introduction à la BRVM Prix de l’action · grand public 4 700 FCFA du 7 décembre 2026 au 11 décembre 2026 Visa AMF-UMOA n° OA/26-06 Possibilité de clôture anticipée"
  r=parse_page(html,'https://coris-bourse.com/test','2026-11-25')
  self.assertEqual(r['openDate'],'2026-12-07');self.assertEqual(r['price'],4700)
  self.assertFalse(r['earlyClosed']);self.assertIsNone(r['listingDate'])
  d={'checkedAt':'2026-11-25','events':[r]}
  self.assertIn('À venir',render(d,'2026-11-25'))
  self.assertIn('Période annoncée en cours',render(d,'2026-12-07'))
  self.assertNotIn('Banque Test',render(d,'2026-12-12'))
 def test_missing_dates_stale_and_escape(self):
  r=parse_page('<h1>&lt;script&gt;</h1> introduction à la BRVM','https://coris-bourse.com/test','yesterday')
  text=render({'checkedAt':'today','events':[r]},'2026-11-25')
  self.assertIn('Calendrier à confirmer',text);self.assertIn('information conservée',text)
  self.assertNotIn('<script>',text)
 def test_bond_not_ipo(self):
  self.assertIsNone(parse_page('<h1>Emprunt</h1>Obligation 7 %','https://coris-bourse.com/test','now'))
if __name__=='__main__':unittest.main()
