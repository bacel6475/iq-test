import type { Level, RuleKind } from './types';

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
