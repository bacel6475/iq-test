import type { Level, LogicOp, RuleKind } from './types';

/** 논리 연산 가중치. 논리 문항의 난이도 점수 = 연산 가중치 (레이어 1개) */
export const OP_WEIGHT: Record<LogicOp, number> = {
  or: 2.0,
  and: 2.0,
  xor: 2.5,
  diff: 2.5,
};

/** 각 연산이 들어갈 수 있는 레벨 (OR·AND → 2, XOR·DIFF → 3) */
export const LOGIC_LEVELS: readonly Level[] = [2, 3];

export const RULE_WEIGHT: Record<RuleKind, number> = {
  constant: 0,
  progression: 1.0,
  distribute3: 1.5,
};

/** 난이도 점수 = Σ(규칙 가중치) + 0.5 × (레이어 수 − 1) */
export function difficultyScore(rules: readonly { kind: RuleKind }[], layerCount: number): number {
  const sum = rules.reduce((acc, r) => acc + RULE_WEIGHT[r.kind], 0);
  return sum + 0.5 * (layerCount - 1);
}

/** 점수는 0.5 단위이므로 구간 사이에 빈틈이 없다. */
export function levelOfScore(score: number): Level {
  if (score <= 1.0) return 1;
  if (score <= 2.0) return 2;
  if (score <= 3.0) return 3;
  if (score <= 4.5) return 4;
  return 5;
}
