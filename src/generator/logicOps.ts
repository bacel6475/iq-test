import { FULL_MASK, LOGIC_OPS, type LogicOp } from './types';

/** 두 그림(12비트 선분 마스크)에 연산을 적용한다. */
export function applyOp(op: LogicOp, a: number, b: number): number {
  switch (op) {
    case 'or':
      return (a | b) & FULL_MASK; // 두 그림을 겹침
    case 'and':
      return a & b; // 공통 선분만 남김
    case 'xor':
      return (a ^ b) & FULL_MASK; // 겹치는 선분은 지우고 나머지만
    case 'diff':
      return a & ~b & FULL_MASK; // 1열에서 2열의 선분을 뺌
  }
}

/** 켜진 선분 수 */
export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

/**
 * 완성된 두 줄 [a, b, c]를 모두 만족하는 연산들.
 * (주어진 8칸에서 규칙 후보를 찾을 때 쓴다.)
 */
export function consistentOps(lines: readonly (readonly [number, number, number])[]): LogicOp[] {
  return LOGIC_OPS.filter((op) => lines.every(([a, b, c]) => applyOp(op, a, b) === c));
}
