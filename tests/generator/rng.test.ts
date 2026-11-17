import { describe, expect, it } from 'vitest';
import { mixSeed, mulberry32, randInt, sample, shuffle } from '../../src/generator/rng';

describe('시드 난수', () => {
  it('같은 시드는 같은 수열을 만든다', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('다른 시드는 다른 수열을 만든다', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 5 }, a)).not.toEqual(Array.from({ length: 5 }, b));
  });

  it('0 이상 1 미만의 값만 나오고 고르게 퍼진다', () => {
    const rng = mulberry32(99);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) {
      const x = rng();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      buckets[randInt(() => x, 4)]++;
    }
    for (const n of buckets) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it('shuffle과 sample은 원본을 바꾸지 않는다', () => {
    const original = [1, 2, 3, 4, 5];
    const rng = mulberry32(7);
    expect(shuffle(rng, original).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(sample(rng, original, 3)).size).toBe(3);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });

  it('mixSeed는 32비트 부호 없는 정수를 돌려준다', () => {
    for (let i = 0; i < 100; i++) {
      const s = mixSeed(i, i * 31);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(4294967296);
    }
    expect(mixSeed(1, 0)).not.toBe(mixSeed(1, 1));
  });
});
