import { LOGIC_LEVELS } from './difficulty';
import { generateItem } from './index';
import { mixSeed, mulberry32, shuffle } from './rng';
import { comboKey, itemSignature } from './signature';
import type { Family, ItemSpec, Level } from './types';

// 시험지 구성: 난이도가 뒤로 갈수록 점진적으로 오르도록 문항을 배치한다.

/** 논리 계열 비율 (전체 문항 대비). 논리 문항은 레벨 2·3 자리에만 들어간다. */
export const LOGIC_RATIO = 0.3;

/**
 * 문항 번호별 계열. 전체의 30%를 논리 계열로 하되, 논리 문항이 있는 레벨(2·3) 자리 중에서
 * 시드로 고른다. 그 자리가 모자라면 있는 만큼만 논리 계열로 한다.
 */
export function familyPlan(seed: number, levels: readonly Level[]): Family[] {
  const slots = levels.map((lv, i) => (LOGIC_LEVELS.includes(lv) ? i : -1)).filter((i) => i >= 0);
  const want = Math.min(slots.length, Math.round(levels.length * LOGIC_RATIO));
  const chosen = new Set(shuffle(mulberry32(mixSeed(seed, 0x10a1c)), slots).slice(0, want));
  return levels.map((_, i) => (chosen.has(i) ? 'logic' : 'attribute'));
}

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
  const families = familyPlan(seed, plan);
  const signatures = new Set<string>();
  const combos = new Set<string>();
  const items: ItemSpec[] = [];

  plan.forEach((level, position) => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const spec = generateItem(mixSeed(seed, position * 10_007 + attempt), level, families[position]);
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
