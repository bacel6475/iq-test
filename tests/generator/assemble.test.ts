import { describe, expect, it } from 'vitest';
import { comboKey, itemSignature } from '../../src/generator';
import { assembleTest, levelPlan } from '../../src/generator/assemble';
import { PRESETS } from '../../src/presets';

describe('레벨 배치', () => {
  it('뒤로 갈수록 레벨이 내려가지 않고, 레벨 1에서 시작해 5에서 끝난다', () => {
    for (const count of [10, 15, 35, 36, 60]) {
      const plan = levelPlan(count, [1, 5]);
      expect(plan).toHaveLength(count);
      expect(plan[0]).toBe(1);
      expect(plan[count - 1]).toBe(5);
      for (let i = 1; i < count; i++) expect(plan[i]).toBeGreaterThanOrEqual(plan[i - 1]);
    }
  });

  it('앞 20%는 레벨 1, 나머지는 레벨 2~5에 고르게 나뉜다 (60문항)', () => {
    const plan = levelPlan(60, [1, 5]);
    const counts = [1, 2, 3, 4, 5].map((lv) => plan.filter((p) => p === lv).length);
    expect(counts).toEqual([12, 12, 12, 12, 12]);
  });

  it('고급형은 레벨 2~5로만 구성된다', () => {
    const plan = levelPlan(36, [2, 5]);
    expect(new Set(plan)).toEqual(new Set([2, 3, 4, 5]));
    expect([2, 3, 4, 5].map((lv) => plan.filter((p) => p === lv).length)).toEqual([9, 9, 9, 9]);
  });
});

describe('시험지 구성', () => {
  it('프리셋마다 정해진 문항 수로 구성되고, 같은 시드면 같은 시험지가 나온다', { timeout: 60_000 }, () => {
    for (const preset of PRESETS.filter((p) => p.id !== 'custom')) {
      const a = assembleTest({ seed: 99, count: preset.itemCount, levelRange: preset.levelRange });
      expect(a).toHaveLength(preset.itemCount);
      expect(a.map((s) => s.level)).toEqual(levelPlan(preset.itemCount, preset.levelRange));
      const b = assembleTest({ seed: 99, count: preset.itemCount, levelRange: preset.levelRange });
      expect(b.map(itemSignature)).toEqual(a.map(itemSignature));
    }
  });

  it('한 시험지 안에서 같은 문항과 같은 "규칙+도형 조합"이 반복되지 않는다', { timeout: 60_000 }, () => {
    for (let seed = 1; seed <= 10; seed++) {
      const items = assembleTest({ seed, count: 60, levelRange: [1, 5] });
      expect(new Set(items.map(itemSignature)).size).toBe(60);
      expect(new Set(items.map(comboKey)).size).toBe(60);
    }
  });

  it('이미 출제된 문항(isUsed)은 다시 넣지 않는다', () => {
    const first = assembleTest({ seed: 5, count: 20, levelRange: [1, 5] });
    const used = new Set(first.map(itemSignature));
    const second = assembleTest({ seed: 5, count: 20, levelRange: [1, 5], isUsed: (s) => used.has(s) });
    for (const item of second) expect(used.has(itemSignature(item))).toBe(false);
  });

  it('60문항 시험지를 빠르게 만든다 (폰에서 기다리지 않도록)', () => {
    const t = performance.now();
    assembleTest({ seed: 123, count: 60, levelRange: [1, 5] });
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
