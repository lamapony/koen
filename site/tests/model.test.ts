import { describe, expect, it } from 'vitest';
import { pctRank, combine } from '../src/model';
import { num, withUnit } from '../src/format';
import { MODE_BY_ID } from '../src/modes/modes';
import type { AppData, Kommune } from '../src/data';

describe('index and display', () => {
  it('ranks ties monotonically, preserves missing values and stays bounded', () => {
    expect(pctRank([3, null, 1, 1, 2])).toEqual([1, null, 1/6, 1/6, 2/3]);
    expect(pctRank([12])).toEqual([0.5]);
    expect(pctRank([null])).toEqual([null]);
  });
  it('renormalises weights around missing indicators', () => {
    const k = [{z: {a: null, b: 4}}, {z: {a: 2, b: 4}}] as unknown as Kommune[];
    expect(combine(k, ['a', 'b'], {a: 1, b: 1})).toEqual([4, 3]);
  });
  it('does not display missing or non-finite numbers as zero or a bare unit', () => {
    for (const value of [null, undefined, NaN, Infinity]) {
      expect(num(value)).toBe('');
      expect(withUnit(value, 'kr.')).toBe('');
    }
    expect(withUnit(0, 'kr.')).toBe('0 kr.');
  });
  it('keeps the measured layer explicitly dated', () => {
    const data = {kommuner: [{maalt: [{maxList: 12}]}, {}]} as unknown as AppData;
    const result = MODE_BY_ID.get('maalt')!.compute(data, {koetryk: [], alt: false});
    expect(result.period).toBe('2017');
    expect(result.values).toEqual([12, null]);
  });
});
