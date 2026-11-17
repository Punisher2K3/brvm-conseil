import unittest,copy
from instantanes_marche import compact,merge_history,archive_into,SOURCE
class Snapshots(unittest.TestCase):
 def quote(self,clock='13:00',price=100,volume=1000):
  return {'session':'2026-11-17','time':clock,'collected':'2026-11-17T13:20:00+00:00','source':SOURCE,'stocks':[{'symbol':'T'+str(i),'price':price,'volume':volume} for i in range(48)]}
 def test_history_preserves_initial_point(self):
  before={'liveMarket':self.quote()};after={'liveMarket':self.quote('14:00',99,1100)}
  history=merge_history(after,before)
  self.assertEqual([p['time'] for p in history['snapshots']],['13:00','14:00'])
  self.assertEqual(before['liveMarket']['stocks'][0]['price'],100)
  after['intraday']=history
  self.assertEqual(len(merge_history(after,after)['snapshots']),2)
 def test_same_time_revisions_not_overwritten(self):
  before={'liveMarket':self.quote()};after={'liveMarket':self.quote(price=99)}
  self.assertEqual(len(merge_history(after,before)['snapshots']),2)
 def test_bad_or_partial_snapshot_not_archived(self):
  for change in [{'source':'https://example.org'}, {'time':'25:00'}, {'session':'2026-02-31'}, {'stocks':[]}]:
   self.assertIsNone(compact({**self.quote(),**change}))
  q=self.quote();q['stocks'][0]['price']=float('nan');self.assertIsNone(compact(q))
 def test_retention_is_bounded(self):
  old={'version':1,'snapshots':[{'session':'2026-11-'+str(i).zfill(2),'time':'13:00','rows':[['A',i,1]]} for i in range(1,18)]}
  h=merge_history({'intraday':old})
  self.assertEqual(len({p['session'] for p in h['snapshots']}),10)
 def test_future_snapshot_not_shown_as_current(self):
  prior={'liveMarket':self.quote('14:00',99)}
  current={'liveMarket':self.quote('13:00',100)}
  self.assertEqual([p['time'] for p in merge_history(current,prior)['snapshots']],['13:00'])
 def test_empty_and_mutation_are_explicit(self):
  p={};archive_into(p);self.assertEqual(p['intraday']['snapshots'],[])
if __name__=='__main__':unittest.main()
