"""Bounded API/archival integrity smoke tests; no external requests."""
import importlib.util
import itertools
import json
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cv_server', ROOT / 'server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class ReplayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle = json.loads((ROOT / 'data/replays.json').read_text(encoding='utf-8'))
        server.Handler.bundle = cls.bundle
        cls.http = server.LocalServer(('127.0.0.1', 0), server.Handler)
        cls.base = 'http://127.0.0.1:' + str(cls.http.server_port)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def get(self, path):
        with urlopen(self.base + path, timeout=5) as response:
            return response.status, response.read(), response.headers

    def test_every_selection_matches_archived_cells(self):
        b = self.bundle
        selections = itertools.product(b['cv']['records'], b['models'], server.FRAMES, b['cv']['notes'])
        count = 0
        for rid, model, frame, note in selections:
            q = urlencode(dict(record=rid, model=model, frame=frame, condition=note))
            status, body, _ = self.get('/api/cv/replay?' + q)
            d = json.loads(body)
            self.assertEqual(status, 200)
            expected = [x for x in b['cv']['cells'] if (x['record_id'], x['model'], x['frame']) == (rid, model, frame) and x['condition'] in {note, 'clean', 'neutral'}]
            self.assertEqual(d['rows'], expected)
            for row in d['rows']:
                self.assertEqual(json.loads(row['response']['message']['content'])['score'], row['score'])
            count += 1
        self.assertEqual(count, 80)

    def test_cv_only_health_catalog_and_ui(self):
        self.assertEqual(json.loads(self.get('/api/health')[1])['mode'], 'cv-offline-replay')
        catalog = json.loads(self.get('/api/catalog')[1])
        self.assertEqual({x['id'] for x in catalog['cv_records']}, {'H01', 'H09'})
        self.assertNotIn('agent_records', catalog)
        self.assertNotIn('agent', json.loads(self.get('/api/studies')[1]))
        for path in ['/', '/app.js', '/styles.css']:
            status, body, headers = self.get(path)
            self.assertEqual(status, 200)
            self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
            self.assertTrue(body)
        html = self.get('/')[1].decode('utf-8')
        self.assertNotIn('agent-authorized', html)

    def test_no_other_study_write_or_source_routes(self):
        for path, expected in [('/api/agent/replay', 404), ('/studio/', 404), ('/%2e%2e/server.py', 403), ('/api/cv/replay?record=unknown', 400)]:
            with self.assertRaises(HTTPError) as caught:
                self.get(path)
            self.assertEqual(caught.exception.code, expected)
        for path in ['/api/gate', '/api/studio-export', '/api/cv/replay']:
            with self.assertRaises(HTTPError) as caught:
                urlopen(Request(self.base + path, data=b'{}', method='POST'), timeout=5)
            self.assertEqual(caught.exception.code, 405)
        with self.assertRaises(HTTPError) as caught:
            urlopen(Request(self.base + '/', headers={'Host': 'example.org'}), timeout=5)
        self.assertEqual(caught.exception.code, 403)

    def test_teaching_transcripts_are_exact_subset(self):
        evidence = json.loads((ROOT / 'evidence/Recorded AI Requests and Responses.json').read_text(encoding='utf-8'))
        source = {(x['model'], x['request_id']): x for x in self.bundle['cv']['cells']}
        self.assertEqual(len(evidence['cells']), 12)
        for x in evidence['cells']:
            original = source[(x['model'], x['request_id'])]
            for key in ['request', 'response', 'request_sha256', 'score']:
                self.assertEqual(x[key], original[key])


if __name__ == '__main__':
    unittest.main()
