import unittest,tempfile,json
from pathlib import Path
from datetime import datetime,timezone
from unittest.mock import patch
import pipeline_actualisation as p

class PipelineTest(unittest.TestCase):
 def market(self,date='2026-11-12'):
  return {'session':date,'sessions':[{'date':date,'stocks':[{'symbol':'T'+str(i),'date':date} for i in range(48)]}]}
 def test_no_regression_or_deleted_history(self):
  old=self.market('2026-11-11');p.validate_market(self.market())
  with self.assertRaises(ValueError):p.validate_market(self.market('2026-11-10'),old)
  with self.assertRaises(ValueError):p.validate_market(self.market(),old)
 def test_one_archive_cycle_per_day_after_close(self):
  at=datetime(2026,11,12,18,tzinfo=timezone.utc)
  self.assertTrue(p.archive_due({},at));self.assertFalse(p.archive_due({'lastArchiveDate':'2026-11-12'},at));self.assertFalse(p.archive_due({},at.replace(hour=10)))
 def test_failed_stage_restores_valid_file(self):
  with tempfile.TemporaryDirectory(dir=p.ROOT/'collecte') as folder:
   root=Path(folder).resolve();self.assertTrue(root.is_relative_to(p.ROOT.resolve()))
   path=root/'base-marche.json';initial=json.dumps(self.market());path.write_text(initial,encoding='utf-8')
   def fail(command,timeout):path.write_text('{}',encoding='utf-8');raise TimeoutError('test')
   with patch.object(p,'ROOT',root):result=p.stage('test',[],['base-marche.json'],1,runner=fail,validator=p.validate_market)
   self.assertEqual(result['status'],'degraded');self.assertEqual(path.read_text(encoding='utf-8'),initial)
if __name__=='__main__':unittest.main()
