import unittest,tempfile,json,copy,threading
from pathlib import Path
from datetime import datetime,timezone
from urllib.error import HTTPError
from urllib.request import urlopen,Request
from unittest.mock import patch
import collecter_cours_rapides as m

class FastTests(unittest.TestCase):
 def quote(self):return {'session':'2026-11-13','time':'15:00','stocks':[{'symbol':'T'+str(i),'price':100,'volume':10} for i in range(48)],'collected':'première'}
 def test_no_republication_when_only_timestamp_changes(self):
  q=self.quote();later={**q,'collected':'nouvelle','time':'15:15'}
  self.assertEqual(m.fingerprint(q),m.fingerprint(later))
 def test_bad_and_regressing_quotes_rejected(self):
  at=datetime(2026,11,13,16,tzinfo=timezone.utc);q=self.quote();m.validate(q,at=at)
  for change in [{'session':'2099-01-01'},{'session':'2026-11-12'},{'stocks':q['stocks'][:2]}]:
   with self.assertRaises(ValueError):m.validate({**q,**change},q,at)
  bad=copy.deepcopy(q);bad['stocks'][0]['volume']=float('nan')
  with self.assertRaises(ValueError):m.validate(bad,at=at)
 def test_failed_source_preserves_published_data_and_backs_off(self):
  with tempfile.TemporaryDirectory(dir=m.ROOT/'collecte') as folder:
   root=Path(folder);state=root/'state.json';snapshot=root/'quote.json';fund=root/'fondamentaux.json';fund.write_text(json.dumps({'liveMarket':self.quote()}));before=fund.read_bytes()
   calls=[]
   def fail(*args):calls.append(1);raise HTTPError(m.URL,429,'limited',{'Retry-After':'600'},None)
   with patch.object(m,'ROOT',root),patch.object(m,'STATE',state),patch.object(m,'SNAPSHOT',snapshot):
    at=datetime(2026,11,13,16,tzinfo=timezone.utc);self.assertEqual(m.collect(at,fail)['state'],'degraded');self.assertEqual(m.collect(at,fail)['state'],'backoff')
   self.assertEqual(calls,[1]);self.assertEqual(fund.read_bytes(),before)
   self.assertEqual(json.loads(state.read_text())['nextAttemptAt'],'2026-11-13T16:10:00+00:00')
 def test_once_publishes_only_a_changed_valid_quote(self):
  with tempfile.TemporaryDirectory(dir=m.ROOT/'collecte') as folder:
   root=Path(folder);q=self.quote();(root/'fondamentaux.json').write_text(json.dumps({'liveMarket':q}));at=datetime(2026,11,13,16,tzinfo=timezone.utc)
   with patch.object(m,'ROOT',root),patch.object(m,'STATE',root/'state.json'),patch.object(m,'SNAPSHOT',root/'quote.json'),patch.object(m,'publish') as publisher:
    self.assertFalse(m.collect(at,lambda *a:q)['changed']);publisher.assert_not_called()
    q=copy.deepcopy(q);q['stocks'][0]['price']=101
    self.assertTrue(m.collect(at.replace(minute=2),lambda *a:q)['changed']);publisher.assert_called_once()
 def test_retry_after_and_no_one_second_loop(self):
  at=datetime(2026,11,13,16,tzinfo=timezone.utc)
  self.assertEqual(m.retry_delay('Fri, 13 Nov 2026 16:05:00 GMT',at),300);self.assertEqual(m.retry_delay('1',at),60)
 def test_service_exposes_only_the_two_read_only_routes(self):
  with tempfile.TemporaryDirectory(dir=m.ROOT/'collecte') as folder:
   root=Path(folder);quote=root/'quote.json';state=root/'state.json';m.write(quote,self.quote());m.write(state,{'state':'ok'})
   with patch.object(m,'SNAPSHOT',quote),patch.object(m,'STATE',state):
    httpd=m.server(0);thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(httpd.server_port)
    try:
     with urlopen(base+'/cours.json') as r:self.assertEqual(len(json.load(r)['stocks']),48)
     for req in [Request(base+'/fondamentaux.json'),Request(base+'/cours.json',headers={'Origin':'https://example.org'})]:
      with self.assertRaises(HTTPError):urlopen(req)
    finally:httpd.shutdown();httpd.server_close();thread.join()
if __name__=='__main__':unittest.main()
