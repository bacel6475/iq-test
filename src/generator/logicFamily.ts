import { OP_WEIGHT } from './difficulty';
import { makeLogicDistractors } from './distractors';
import { applyOp, popcount } from './logicOps';
import { mixSeed, mulberry32, pick, shuffle, type Rng } from './rng';
import { solveLogic } from './solver';
import {
  GENERATOR_VERSION,
  SEGMENT_COUNT,
  type Level,
  type LogicCell,
  type LogicItemSpec,
  type LogicOp,
} from './types';

// 문항 계열 B: 논리 연산.
// 각 칸은 3×3 점 격자 위 선분 12개 중 일부가 켜진 그림이고, 각 행에서 3열 = 연산(1열, 2열)이다.

/** 레벨별로 쓰는 연산: 레벨 2는 OR·AND, 레벨 3은 XOR·DIFF (난이도 점수 2.0 / 2.5) */
const OPS_BY_LEVEL: Partial<Record<Level, readonly LogicOp[]>> = {
  2: ['or', 'and'],
  3: ['xor', 'diff'],
};

/** 한 칸에 켜지는 선분 수 범위. 너무 비거나 꽉 차면 눈으로 비교하기 어렵다. */
const MIN_SEGMENTS = 2;
const MAX_SEGMENTS = 9;

function randomMask(rng: Rng): number {
  // 선분이 켜질 확률을 칸마다 조금씩 다르게 해 그림의 밀도에 변화를 준다.
  const density = 0.3 + rng() * 0.25;
  let mask = 0;
  for (let i = 0; i < SEGMENT_COUNT; i++) if (rng() < density) mask |= 1 << i;
  return mask;
}

const inRange = (mask: number) => {
  const n = popcount(mask);
  return n >= MIN_SEGMENTS && n <= MAX_SEGMENTS;
};

/** 한 행 (1열, 2열, 3열). 계획서 4.3의 제약을 지키는 것만 돌려준다. */
function makeRow(rng: Rng, op: LogicOp): [number, number, number] | null {
  for (let i = 0; i < 200; i++) {
    const a = randomMask(rng);
    const b = randomMask(rng);
    const c = applyOp(op, a, b);
    if (!inRange(a) || !inRange(b) || !inRange(c)) continue; // 어느 것도 비어 있지 않음
    if ((a & b) === 0) continue; // 1열과 2열은 최소 1개 선분이 겹침 (OR와 XOR 구분)
    if (a === b || a === c || b === c) continue; // 한 행의 세 그림은 서로 다름
    return [a, b, c];
  }
  return null;
}

const MAX_ATTEMPTS = 500;

/**
 * 논리 계열 문항 하나를 만든다. 같은 (seed, level)이면 항상 같은 문항이 나온다.
 * 주어진 8칸으로 볼 때 4개 연산 중 정확히 하나만 성립하지 않으면 버리고 다시 만든다.
 */
export function generateLogicItem(seed: number, level: Level): LogicItemSpec {
  const ops = OPS_BY_LEVEL[level];
  if (!ops) throw new Error(`논리 계열은 레벨 2·3만 있습니다 (요청: 레벨 ${level})`);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(mixSeed(seed ^ 0x6c6f6769, attempt));
    const operation = pick(rng, ops);

    const rows: [number, number, number][] = [];
    for (let r = 0; r < 3; r++) {
      const row = makeRow(rng, operation);
      if (!row) break;
      // 다른 행과 같은 그림이 나오지 않게 한다.
      if (rows.some((prev) => prev.some((m) => row.includes(m)))) break;
      rows.push(row);
    }
    if (rows.length !== 3) continue;

    const cells: LogicCell[] = rows.flat().map((mask) => ({ kind: 'logic', mask }));
    const distractors = makeLogicDistractors(rng, cells, operation);
    if (!distractors) continue;

    const order = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
    const pool = [cells[8], ...distractors];
    const spec: LogicItemSpec = {
      generatorVersion: GENERATOR_VERSION,
      family: 'logic',
      seed,
      level,
      score: OP_WEIGHT[operation],
      operation,
      cells,
      options: order.map((i) => pool[i]),
      answerIndex: order.indexOf(0),
    };
    if (!solveLogic(spec).ok) continue;
    return spec;
  }
  throw new Error(`논리 문항 생성 실패: seed=${seed}, level=${level}`);
}
