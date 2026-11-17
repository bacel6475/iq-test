import { generateItem } from './index';
import { mixSeed } from './rng';
import { comboKey, itemSignature } from './signature';
import type { ItemSpec, Level } from './types';

// 시험지 구성: 난이도가 뒤로 갈수록 점진적으로 오르도록 문항을 배치한다.

/** 논리 계열 비율. 논리 계열 생성기(M4)가 생기면 0.3으로 바꾼다. */
export const LOGIC_RATIO = 0;

/**
 * 문항 번호별 레벨. 레벨 1부터 시작하면 앞 20%는 레벨 1, 나머지는 남은 레벨에 고르게 나눈다.
 * 결과는 뒤로 갈수록 내려가지 않는다.
 */
export function levelPlan(count: number, [lo, hi]: readonly [Level, Level]): Level[] {
  const levels: Level[] = [];
  for (let lv = lo; lv <= hi; lv++) levels.push(lv as Level);

  const plan: Level[] = [];
  let rest = levels;
  if (lo === 1 && levels.length > 1) {
    const head = Math.round(count * 0.2);
    for (let i = 0; i < head; i++) plan.push(1);
    rest = levels.slice(1);
  }
  const remaining = count - plan.length;
  for (let i = 0; i < remaining; i++) {
    plan.push(rest[Math.floor((i * rest.length) / remaining)]);
  }
  return plan;
}

export interface AssembleOptions {
  seed: number;
  count: number;
  levelRange: readonly [Level, Level];
  /** 이미 출제된 문항인지 (M3에서 DB 기록과 대조). 없으면 이 시험지 안에서만 중복을 막는다. */
  isUsed?: (signature: string) => boolean;
}

/** 이 횟수까지는 "규칙 조합 + 도형 조합"이 겹치지 않는 문항을 찾고, 그 뒤로는 서명 중복만 막는다. */
const STRICT_ATTEMPTS = 40;
const MAX_ATTEMPTS = 400;

export function assembleTest({ seed, count, levelRange, isUsed }: AssembleOptions): ItemSpec[] {
  const plan = levelPlan(count, levelRange);
  const signatures = new Set<string>();
  const combos = new Set<string>();
  const items: ItemSpec[] = [];

  plan.forEach((level, position) => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const spec = generateItem(mixSeed(seed, position * 10_007 + attempt), level);
      const signature = itemSignature(spec);
      if (signatures.has(signature) || isUsed?.(signature)) continue;
      const combo = comboKey(spec);
      if (attempt < STRICT_ATTEMPTS && combos.has(combo)) continue;

      signatures.add(signature);
      combos.add(combo);
      items.push(spec);
      return;
    }
    throw new Error(`시험지 구성 실패: ${position + 1}번 문항 (레벨 ${level})`);
  });

  return items;
}
