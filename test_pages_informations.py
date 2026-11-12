import unittest,tempfile,json,hashlib
from pathlib import Path
import pages_informations as p
from preparer_publication import clean_public_dir
from verifier_publication import Audit

class PagesTest(unittest.TestCase):
 def test_truthful_publisher_privacy_and_security(self):
  with tempfile.TemporaryDirectory(dir=p.ROOT/'collecte') as folder:
   out=Path(folder).resolve();self.assertTrue(out.is_relative_to(p.ROOT.resolve()));p.generate(out)
   for path in out.glob('*.html'):
    html=path.read_text(encoding='utf-8');audit=Audit();audit.feed(html);self.assertTrue(audit.csp);self.assertIn('Le Financier',html)
   privacy=(out/'confidentialite.html').read_text(encoding='utf-8');self.assertIn('mémoire de l’onglet',privacy);self.assertIn('adresse IP',privacy)
   legal=(out/'mentions-legales.html').read_text(encoding='utf-8');self.assertIn('restent à compléter',legal);self.assertNotIn('mailto:contact@',legal)
 def test_unexpected_public_file_is_removed(self):
  with tempfile.TemporaryDirectory(dir=p.ROOT/'collecte') as folder:
   out=Path(folder).resolve();self.assertTrue(out.is_relative_to(p.ROOT.resolve()));(out/'.env').write_text('secret de test');(out/'index.html').write_text('page')
   clean_public_dir(out);self.assertFalse((out/'.env').exists());self.assertTrue((out/'index.html').exists())
 def test_external_or_inline_script_rejected(self):
  for html in ['<script>alert(1)</script>','<script src="https://evil.example/a.js"></script>']:
   with self.assertRaises(ValueError):Audit().feed(html)
if __name__=='__main__':unittest.main()
