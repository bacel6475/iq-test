import { describe, expect, it } from 'vitest';
import {
  applyOp,
  cellKey,
  describeRules,
  generateItem,
  itemSignature,
  levelOfScore,
  LOGIC_OPS,
  solveLogic,
  type LogicItemSpec,
} from '../../src/generator';
import { popcount } from '../../src/generator/logicOps';
import { mulberry32 } from '../../src/generator/rng';

const SEED_COUNT = 10_000;

let cache: LogicItemSpec[] | null = null;
/** 무작위 시드 10,000개 (레벨 2와 3 반반) */
function bulkItems(): LogicItemSpec[] {
  if (!cache) {
    const seeds = mulberry32(4242);
    cache = Array.from({ length: SEED_COUNT }, (_, i) =>
      generateItem(Math.floor(seeds() * 4294967296), i % 2 === 0 ? 2 : 3, 'logic'),
    );
  }
  return cache;
}

const row = (spec: LogicItemSpec, r: number) => [0, 1, 2].map((c) => spec.cells[r * 3 + c].mask);

describe('논리 연산 계산', () => {
  it('OR·AND·XOR·DIFF가 정의대로 동작한다', () => {
    const a = 0b0000_0000_1111;
    const b = 0b0000_0011_1100;
    expect(applyOp('or', a, b)).toBe(0b0000_0011_1111);
    expect(applyOp('and', a, b)).toBe(0b0000_0000_1100);
    expect(applyOp('xor', a, b)).toBe(0b0000_0011_0011);
    expect(applyOp('diff', a, b)).toBe(0b0000_0000_0011);
  });
});

describe('논리 계열 생성기', () => {
  it('같은 시드와 레벨이면 항상 같은 문항이 나온다', () => {
    for (const level of [2, 3] as const) {
      for (const seed of [0, 1, 99, 4294967295]) {
        expect(generateItem(seed, level, 'logic')).toEqual(generateItem(seed, level, 'logic'));
      }
    }
  });

  it('레벨 2는 OR·AND, 레벨 3은 XOR·DIFF이고 난이도 점수가 레벨과 맞는다', () => {
    for (const spec of bulkItems().slice(0, 2000)) {
      expect(spec.level === 2 ? ['or', 'and'] : ['xor', 'diff']).toContain(spec.operation);
      expect(levelOfScore(spec.score)).toBe(spec.level);
    }
  });

  it('레벨 1·4·5는 논리 계열로 만들 수 없다', () => {
    for (const level of [1, 4, 5] as const) expect(() => generateItem(1, level, 'logic')).toThrow();
  });

  it(
    '무작위 시드 10,000개에서 주어진 8칸으로 4개 연산 중 정확히 하나만 성립한다',
    { timeout: 120_000 },
    () => {
      const failures: string[] = [];
      for (const spec of bulkItems()) {
        const holding = LOGIC_OPS.filter((op) =>
          [0, 1].every((r) => {
            const [a, b, c] = row(spec, r);
            return applyOp(op, a, b) === c;
          }),
        );
        if (holding.length !== 1 || holding[0] !== spec.operation) {
          failures.push(`seed=${spec.seed}: ${holding.join(',')}`);
        }
      }
      expect(failures).toEqual([]);
    },
  );

  it('무작위 시드 10,000개에서 정답 보기가 정확히 1개다 (세로로 읽어도 다른 답 없음)', { timeout: 120_000 }, () => {
    const failures: string[] = [];
    for (const spec of bulkItems()) {
      const result = solveLogic(spec);
      if (!result.ok) failures.push(`seed=${spec.seed}: ${result.reason}`);
      if (spec.options[spec.answerIndex].mask !== spec.cells[8].mask) failures.push(`seed=${spec.seed}: 정답 위치`);
    }
    expect(failures).toEqual([]);
  });

  it('계획서 4.3의 제약을 지킨다 (10,000개)', { timeout: 120_000 }, () => {
    for (const spec of bulkItems()) {
      for (let r = 0; r < 3; r++) {
        const [a, b, c] = row(spec, r);
        expect(applyOp(spec.operation, a, b)).toBe(c); // 3열 = 연산(1열, 2열)
        expect(new Set([a, b, c]).size).toBe(3); // 한 행의 세 그림은 서로 다름
        for (const m of [a, b, c]) expect(popcount(m)).toBeGreaterThan(0); // 비어 있지 않음
        expect(a & b).not.toBe(0); // 1열과 2열은 최소 1개 선분이 겹침
      }
    }
  });

  it('보기 8개가 모두 서로 다르고 빈 그림이 없다 (10,000개)', { timeout: 120_000 }, () => {
    for (const spec of bulkItems()) {
      expect(spec.options).toHaveLength(8);
      expect(new Set(spec.options.map(cellKey)).size).toBe(8);
      for (const o of spec.options) expect(o.mask).toBeGreaterThan(0);
    }
  });

  it('시드가 다르면 대부분 다른 문항이 나오고, 해설이 연산을 설명한다', () => {
    const items = Array.from({ length: 300 }, (_, i) => generateItem(i, 3, 'logic'));
    expect(new Set(items.map(itemSignature)).size).toBe(300);
    expect(describeRules(generateItem(5, 2, 'logic'))[0]).toMatch(/^3열 = 1열/);
  });
});

describe('논리 검증기', () => {
  it('정답과 같은 보기가 둘이면 실패로 판정한다', () => {
    const spec = generateItem(8, 3, 'logic');
    const other = (spec.answerIndex + 1) % 8;
    const options = spec.options.map((o, i) => (i === other ? spec.options[spec.answerIndex] : o));
    expect(solveLogic({ ...spec, options }).ok).toBe(false);
  });

  it('두 연산이 모두 성립하는 행렬(겹침 없음 → OR와 XOR가 같음)은 실패로 판정한다', () => {
    const spec = generateItem(9, 2, 'logic');
    // 겹치지 않는 그림 두 개로 1·2행을 바꾸면 OR와 XOR 결과가 같아진다.
    const a = 0b000000_000011;
    const b = 0b000011_000000;
    const cells = spec.cells.map((c, i) => {
      if (i === 0 || i === 3) return { kind: 'logic' as const, mask: a };
      if (i === 1 || i === 4) return { kind: 'logic' as const, mask: b };
      if (i === 2 || i === 5) return { kind: 'logic' as const, mask: a | b };
      return c;
    });
    const result = solveLogic({ ...spec, cells });
    expect(result.ok).toBe(false);
    expect(result.rowOps).toEqual(expect.arrayContaining(['or', 'xor']));
  });
});
