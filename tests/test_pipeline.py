import importlib.util
import json
import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'pipeline'))

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'pipeline' / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

index = module('index_pipeline', '30_index.py')
clean = module('clean_pipeline', '10_clean.py')
DATA = ROOT / 'site/public/data'

def load(name):
    return json.loads((DATA / name).read_text(encoding='utf-8'))

class PipelineTests(unittest.TestCase):
    def test_missing_and_real_zero(self):
        self.assertIsNone(clean.num('..'))
        self.assertIsNone(clean.num(''))
        self.assertEqual(clean.num('0'), 0)
        self.assertEqual(index.robust_z([None, None], 1), [None, None])
        self.assertIsNone(index.robust_z([1, None, 3], 1)[1])

    def test_index_rank_ties_bounds_and_direction(self):
        self.assertEqual(index.pct_rank([]), [])
        self.assertEqual(index.pct_rank([42]), [0.5])
        self.assertEqual(index.pct_rank([3, 1, 1, 2]), [1, 0.16666666666666666, 0.16666666666666666, 2/3])
        z = index.robust_z([1, 2, 3, 100], -1)
        self.assertTrue(all(-2.5 <= x <= 2.5 for x in z))
        self.assertEqual(z, sorted(z, reverse=True))
        self.assertEqual(index.combine({'a': [None, 2], 'b': [4, 4]}, {'a': 1, 'b': 1}, 2), [4, 3])

    def test_export_has_98_unique_kommuner_and_valid_bands(self):
        rows = load('kommuner.json')
        self.assertEqual(len(rows), 98)
        self.assertEqual(len({r['kode'] for r in rows}), 98)
        for row in rows:
            self.assertTrue(0 <= row['koetrykBand'][0] <= row['koetryk'] <= row['koetrykBand'][1] <= 1, row['navn'])
            self.assertTrue(all(v is None or math.isfinite(v) for v in row['ind'].values()))
        self.assertTrue(any(v is None for row in rows for v in row['ind'].values()))

    def test_source_metadata_and_measured_year(self):
        sources = load('sources.json')['sources']
        self.assertEqual(len({s['id'] for s in sources}), len(sources))
        for source in sources:
            self.assertTrue(source.get('period'), source['id'])
            self.assertTrue(source.get('licence', {}).get('name'), source['id'])
            if source['status'] in ('ok', 'runtime'):
                self.assertTrue(source['licence'].get('url'), source['id'])
        measured = load('measured.json')['aarhusbolig']
        self.assertTrue(measured['observedAt'].startswith('2017-'))
        self.assertIn('2017', measured['label_da'])
        self.assertIn('2017', measured['label_en'])
        for source in sources:
            if source['id'].startswith('aarhusbolig-'):
                self.assertIn('2017', source['period'])

if __name__ == '__main__':
    unittest.main()
