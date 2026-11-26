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
        self.assertTrue(measured['fileModifiedAt'].startswith('2017-'))
        self.assertNotIn('observedAt', measured)
        self.assertIn('2017', measured['label_da'])
        self.assertIn('2017', measured['label_en'])
        for source in sources:
            if source['id'].startswith('aarhusbolig-'):
                self.assertIn('2017', source['period'])

class RankingV2Tests(unittest.TestCase):
    """Køtryk v2 (docs/METHOD.md). Guards the method, not exact ranks, so a DST refresh does not break CI."""

    def setUp(self):
        self.meta = load('indicators.json')
        self.rows = {r['kode']: r for r in load('kommuner.json')}

    def rank(self, kode):
        return 1 + sum(1 for r in self.rows.values() if r['koetryk'] > self.rows[kode]['koetryk'])

    def test_index_members_and_weights(self):
        ix = self.meta['index']
        self.assertEqual(ix['version'], 2)
        self.assertEqual(ix['ids'], ['B1', 'D4', 'D5', 'D2', 'P1', 'P2', 'S2'])
        self.assertAlmostEqual(sum(ix['weights'].values()), 1.0)
        by_id = {m['id']: m for m in self.meta['indicators']}
        self.assertEqual(by_id['B1']['dir'], 1)  # more almen/andel stock per adult raises pressure
        self.assertEqual(by_id['S2']['dir'], -1)
        for lens in ('D1', 'D3', 'S1'):
            self.assertNotIn('w', by_id[lens])

    def test_b1_is_inverse_of_d1(self):
        r = self.rows['0101']['ind']
        self.assertAlmostEqual(r['B1'] * r['D1'], 100, delta=0.5)

    def test_big_cities_rank_high(self):
        self.assertLessEqual(self.rank('0101'), 5)   # København
        self.assertLessEqual(self.rank('0147'), 5)   # Frederiksberg
        self.assertLessEqual(self.rank('0751'), 15)  # Aarhus

    def test_validation_improves_on_v1(self):
        v = self.meta['index']['validation']
        self.assertGreater(v['after']['owner3']['auc'], v['before']['owner3']['auc'])
        self.assertGreaterEqual(v['after']['aarhusbolig']['rho'], v['before']['aarhusbolig']['rho'])
        self.assertLessEqual(v['after']['owner3']['rho'], v['maxOwner3Rho'] + 1e-9)
        self.assertEqual(len(v['leaveOneAnchorOut']), 3)

    def test_validate_ranks_share_ties(self):
        val = module('validate_pipeline', '55_validate.py')
        self.assertEqual(val.ranks([2.5, 2.5, 1.0], ['a', 'b', 'c']), {'a': 1.5, 'b': 1.5, 'c': 3})
        self.assertEqual(val.auc([3, 2, 1], ['a', 'b', 'c'], ['a']), 1.0)


if __name__ == '__main__':
    unittest.main()
