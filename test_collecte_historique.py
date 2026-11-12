import unittest
from datetime import date
from collecter import merge_sessions,history_batch

class HistoricalCollectionTests(unittest.TestCase):
    def test_preserve_old_sessions_and_orders(self):
        old={'sessions':[{'date':'2020-01-01','sha256':'a','orderBookExtraction':1,'stocks':[{'orderBook':{'usable':True}}]},{'date':'2026-01-01','stocks':[]}]}
        merged=merge_sessions(old,[{'date':'2020-01-01','sha256':'a','stocks':[]},{'date':'2026-01-02','stocks':[]}])
        self.assertEqual(len(merged),3)
        self.assertEqual(merged[0],old['sessions'][0])

    def test_backfill_advances_after_missing_days(self):
        old={'sessions':[{'date':'2026-04-27'}]}
        dates,state=history_batch(old,date(2026,11,12),1095,5)
        self.assertEqual(len(dates),5)
        old['historyBackfill']=state
        next_dates,_=history_batch(old,date(2026,11,12),1095,5)
        self.assertLess(max(next_dates),min(dates))
        self.assertTrue(all(d.weekday()<5 for d in dates+next_dates))

    def test_history_floor_and_empty_base(self):
        self.assertEqual(history_batch({},date(2026,11,12),1095,5),([],None))
        dates,state=history_batch({'sessions':[{'date':'2023-01-01'}]},date(2026,11,12),1095,5)
        self.assertEqual(dates,[])
        self.assertTrue(state['complete'])

if __name__=='__main__':unittest.main()
