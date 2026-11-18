import { describe, expect, it } from 'vitest';
import {
  ASYMMETRIC_SHAPES,
  ATTR_RANGE,
  cellKey,
  difficultyScore,
  generateItem,
  itemSignature,
  levelOfScore,
  solveAttribute,
  type AttributeItemSpec,
  type Level,
} from '../../src/generator';
import { mulberry32 } from '../../src/generator/rng';

const LEVELS: Level[] = [1, 2, 3, 4, 5];
const SEED_COUNT = 10_000;

/** 무작위 시드 10,000개로 만든 문항 (레벨 1~5를 고르게). 한 번만 만들어 여러 테스트에서 쓴다. */
let cache: AttributeItemSpec[] | null = null;
function bulkItems(): AttributeItemSpec[] {
  if (!cache) {
    const seeds = mulberry32(20261117);
    cache = Array.from({ length: SEED_COUNT }, (_, i) => {
      const seed = Math.floor(seeds() * 4294967296);
      return generateItem(seed, LEVELS[i % 5]);
    });
  }
  return cache;
}

describe('속성 계열 생성기', () => {
  it('같은 시드와 레벨이면 항상 같은 문항이 나온다', () => {
    for (const level of LEVELS) {
      for (const seed of [0, 1, 42, 123456789, 4294967295]) {
        expect(generateItem(seed, level)).toEqual(generateItem(seed, level));
      }
    }
  });

  it('시드가 다르면 대부분 다른 문항이 나온다', () => {
    const signatures = new Set(Array.from({ length: 200 }, (_, i) => itemSignature(generateItem(i, 3))));
    expect(signatures.size).toBeGreaterThan(190);
  });

  it('무작위 시드 10,000개에서 정답이 항상 정확히 1개다', { timeout: 120_000 }, () => {
    const failures: string[] = [];
    for (const spec of bulkItems()) {
      const result = solveAttribute(spec);
      if (!result.ok || result.validOptions.length !== 1 || result.validOptions[0] !== spec.answerIndex) {
        failures.push(`seed=${spec.seed} level=${spec.level}: ${result.reason}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('보기 8개가 모두 서로 다르다 (10,000개)', { timeout: 120_000 }, () => {
    for (const spec of bulkItems()) {
      expect(spec.options).toHaveLength(8);
      expect(new Set(spec.options.map(cellKey)).size).toBe(8);
      expect(cellKey(spec.options[spec.answerIndex])).toBe(cellKey(spec.cells[8]));
    }
  });

  it('요청한 레벨과 난이도 점수가 일치한다 (10,000개)', { timeout: 120_000 }, () => {
    const perLevel = new Map<Level, number>();
    for (const spec of bulkItems()) {
      const layerCount = spec.cells[0].layers.length;
      expect(spec.score).toBe(difficultyScore(spec.rules, layerCount));
      expect(levelOfScore(spec.score)).toBe(spec.level);
      expect(spec.rules.some((r) => r.kind !== 'constant')).toBe(true);
      perLevel.set(spec.level, (perLevel.get(spec.level) ?? 0) + 1);
    }
    for (const level of LEVELS) expect(perLevel.get(level)).toBe(SEED_COUNT / 5);
  });

  it('rotation 규칙은 회전 대칭이 없는 도형에만 걸린다 (10,000개)', { timeout: 120_000 }, () => {
    for (const spec of bulkItems()) {
      for (const rule of spec.rules.filter((r) => r.attr === 'rotation')) {
        for (const cell of [...spec.cells, ...spec.options]) {
          expect(ASYMMETRIC_SHAPES).toContain(cell.layers[rule.layer].shape);
        }
      }
      // 규칙이 없는 레이어는 회전시키지 않는다.
      spec.cells[0].layers.forEach((_, layer) => {
        if (!spec.rules.some((r) => r.attr === 'rotation' && r.layer === layer)) {
          for (const cell of spec.cells) expect(cell.layers[layer].rotation).toBe(0);
        }
      });
    }
  });

  it('모든 속성값이 허용 범위 안에 있다 (10,000개)', { timeout: 120_000 }, () => {
    for (const spec of bulkItems()) {
      for (const cell of [...spec.cells, ...spec.options]) {
        for (const layer of cell.layers) {
          for (const attr of ['size', 'fill', 'rotation', 'count'] as const) {
            const [lo, hi] = ATTR_RANGE[attr];
            expect(layer[attr]).toBeGreaterThanOrEqual(lo);
            expect(layer[attr]).toBeLessThanOrEqual(hi);
          }
        }
      }
    }
  });

  it('2레이어 문항은 바깥 도형과 안쪽 도형으로 구성된다', () => {
    const doubles = bulkItems().filter((s) => s.cells[0].layers.length === 2);
    expect(doubles.length).toBeGreaterThan(1000);
    for (const spec of doubles) {
      for (const cell of [...spec.cells, ...spec.options]) {
        expect(cell.layers.map((l) => l.mode)).toEqual(['outer', 'inner']);
      }
    }
  });
});

describe('검증기(solver)', () => {
  it('정답과 똑같이 보이는 보기가 하나 더 있으면 실패로 판정한다', () => {
    const spec = generateItem(7, 2);
    const other = spec.answerIndex === 0 ? 1 : 0;
    const broken = { ...spec, options: spec.options.map((o, i) => (i === other ? spec.options[spec.answerIndex] : o)) };
    expect(solveAttribute(broken).ok).toBe(false);
  });

  it('정답 번호가 틀리면 실패로 판정한다', () => {
    const spec = generateItem(7, 2);
    expect(solveAttribute({ ...spec, answerIndex: (spec.answerIndex + 1) % 8 }).ok).toBe(false);
  });

  it('규칙을 알 수 없는 행렬은 실패로 판정한다', () => {
    const spec = generateItem(11, 1);
    // 둘째 행 가운데 칸을 엉뚱하게 바꿔 규칙을 깨뜨린다.
    const cells = spec.cells.map((c, i) =>
      i === 4 ? { ...c, layers: c.layers.map((l) => ({ ...l, fill: (l.fill + 2) % 4, size: (l.size % 3) + 1 })) } : c,
    );
    expect(solveAttribute({ ...spec, cells }).ok).toBe(false);
  });
});
