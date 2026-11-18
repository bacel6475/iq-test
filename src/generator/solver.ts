import { applyOp, consistentOps } from './logicOps';
import { cellKey } from './signature';
import {
  type ItemSpec,
  type LogicItemSpec,
  type LogicOp,
  ATTRS,
  ATTR_RANGE,
  ROTATION_STEPS,
  type Attr,
  type AttributeCell,
  type AttributeItemSpec,
  type Layer,
} from './types';

// 정답 유일성 검증.
// 생성기가 "어떤 규칙으로 만들었는지"는 보지 않고, 화면에 보이는 8칸만으로
// 성립할 수 있는 모든 규칙(가로·세로 양쪽)을 찾아 빈칸의 값을 추론한다.
// 추론이 하나로 모이지 않거나, 맞는 보기가 정확히 1개가 아니면 실패다.

type Value = number | string;

export interface SolveResult {
  ok: boolean;
  /** 규칙을 만족하는 보기의 번호들 */
  validOptions: number[];
  /** 8칸에서 추론한 빈칸의 내용 (추론 불가면 null) */
  predicted: AttributeCell | null;
  reason?: string;
}

function allEqual(values: Value[]): boolean {
  return values.every((v) => v === values[0]);
}

function isDistinct(values: Value[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * 완성된 두 줄(l0, l1)과 두 칸만 있는 줄(partial)을 보고,
 * 성립하는 규칙마다 빈칸에 올 값을 예측한다.
 */
function predictLine(l0: Value[], l1: Value[], partial: Value[], attr: Attr): Value[] {
  const out: Value[] = [];

  // constant: 한 줄 안에서 값이 같다.
  if (allEqual(l0) && allEqual(l1) && partial[0] === partial[1]) {
    out.push(partial[0]);
  }

  // distribute3: 같은 세 값이 줄마다 한 번씩 나온다.
  if (
    isDistinct(l0) &&
    isDistinct(l1) &&
    l1.every((v) => l0.includes(v)) &&
    partial[0] !== partial[1] &&
    partial.every((v) => l0.includes(v))
  ) {
    const rest = l0.filter((v) => !partial.includes(v));
    if (rest.length === 1) out.push(rest[0]);
  }

  // progression: 칸마다 일정하게 변한다 (도형 종류에는 순서가 없으므로 제외).
  if (attr !== 'shape') {
    const modular = attr === 'rotation';
    const diff = (a: Value, b: Value): number => {
      const d = (b as number) - (a as number);
      return modular ? ((d % ROTATION_STEPS) + ROTATION_STEPS) % ROTATION_STEPS : d;
    };
    const d = diff(l0[0], l0[1]);
    const consistent =
      d !== 0 &&
      diff(l0[1], l0[2]) === d &&
      diff(l1[0], l1[1]) === d &&
      diff(l1[1], l1[2]) === d &&
      diff(partial[0], partial[1]) === d;
    if (consistent) {
      const next = (partial[1] as number) + d;
      if (modular) {
        out.push(next % ROTATION_STEPS);
      } else {
        const [lo, hi] = ATTR_RANGE[attr];
        if (next >= lo && next <= hi) out.push(next);
      }
    }
  }

  return out;
}

/** 8칸의 값(행 우선, 길이 8)에서 빈칸에 올 수 있는 값을 모두 구한다. */
export function predictValues(values: Value[], attr: Attr): Value[] {
  const at = (r: number, c: number) => values[r * 3 + c];
  const byRows = predictLine(
    [at(0, 0), at(0, 1), at(0, 2)],
    [at(1, 0), at(1, 1), at(1, 2)],
    [at(2, 0), at(2, 1)],
    attr,
  );
  const byCols = predictLine(
    [at(0, 0), at(1, 0), at(2, 0)],
    [at(0, 1), at(1, 1), at(2, 1)],
    [at(0, 2), at(1, 2)],
    attr,
  );
  return [...new Set([...byRows, ...byCols])];
}

export function solveAttribute(
  spec: Pick<AttributeItemSpec, 'cells' | 'options' | 'answerIndex'>,
): SolveResult {
  const given = spec.cells.slice(0, 8);
  const layerCount = given[0].layers.length;
  if (given.some((c) => c.layers.length !== layerCount)) {
    return { ok: false, validOptions: [], predicted: null, reason: '레이어 수가 칸마다 다름' };
  }

  const layers: Layer[] = [];
  for (let i = 0; i < layerCount; i++) {
    const mode = given[0].layers[i].mode;
    if (given.some((c) => c.layers[i].mode !== mode)) {
      return { ok: false, validOptions: [], predicted: null, reason: '레이어 방식이 칸마다 다름' };
    }
    const predicted: Partial<Record<Attr, Value>> = {};
    for (const attr of ATTRS) {
      const candidates = predictValues(
        given.map((c) => c.layers[i][attr]),
        attr,
      );
      if (candidates.length !== 1) {
        return {
          ok: false,
          validOptions: [],
          predicted: null,
          reason: `레이어 ${i}의 ${attr} 값이 ${candidates.length}가지로 추론됨`,
        };
      }
      predicted[attr] = candidates[0];
    }
    layers.push({ mode, ...(predicted as Omit<Layer, 'mode'>) });
  }

  const predicted: AttributeCell = { kind: 'attribute', layers };
  const target = cellKey(predicted);
  const validOptions = spec.options
    .map((option, index) => (cellKey(option) === target ? index : -1))
    .filter((index) => index >= 0);

  const ok = validOptions.length === 1 && validOptions[0] === spec.answerIndex;
  return {
    ok,
    validOptions,
    predicted,
    reason: ok ? undefined : `규칙을 만족하는 보기가 ${validOptions.length}개`,
  };
}

export interface LogicSolveResult extends SolveResult {
  /** 가로 1·2행을 모두 만족하는 연산들 (정확히 1개여야 함) */
  rowOps: LogicOp[];
  /** 세로 1·2열을 모두 만족하는 연산들 (다른 답을 가리키면 모호한 문항) */
  colOps: LogicOp[];
}

/**
 * 논리 계열 검증. 보이는 8칸만으로
 *  - 가로 방향: 1·2행을 모두 만족하는 연산이 정확히 하나인지
 *  - 세로 방향으로 읽어도 다른 답이 나오지 않는지
 *  - 그 답과 같은 보기가 정확히 하나인지
 * 를 확인한다.
 */
export function solveLogic(
  spec: Pick<LogicItemSpec, 'cells' | 'options' | 'answerIndex'>,
): LogicSolveResult {
  const m = spec.cells.map((c) => c.mask);
  const at = (r: number, c: number) => m[r * 3 + c];

  const rowOps = consistentOps([
    [at(0, 0), at(0, 1), at(0, 2)],
    [at(1, 0), at(1, 1), at(1, 2)],
  ]);
  const colOps = consistentOps([
    [at(0, 0), at(1, 0), at(2, 0)],
    [at(0, 1), at(1, 1), at(2, 1)],
  ]);
  const fail = (reason: string): LogicSolveResult => ({
    ok: false,
    validOptions: [],
    predicted: null,
    rowOps,
    colOps,
    reason,
  });

  if (rowOps.length !== 1) return fail(`가로 규칙 후보가 ${rowOps.length}개`);
  const predictedMask = applyOp(rowOps[0], at(2, 0), at(2, 1));
  if (predictedMask === 0) return fail('빈칸의 답이 빈 그림');
  if (colOps.some((op) => applyOp(op, at(0, 2), at(1, 2)) !== predictedMask)) {
    return fail('세로로 읽으면 다른 답이 나옴');
  }

  const validOptions = spec.options
    .map((option, index) => (option.mask === predictedMask ? index : -1))
    .filter((index) => index >= 0);
  const ok = validOptions.length === 1 && validOptions[0] === spec.answerIndex;
  return {
    ok,
    validOptions,
    predicted: null,
    rowOps,
    colOps,
    reason: ok ? undefined : `규칙을 만족하는 보기가 ${validOptions.length}개`,
  };
}

/** 계열에 맞는 검증기로 확인한다. */
export function solveItem(spec: ItemSpec): { ok: boolean; validOptions: number[]; reason?: string } {
  return spec.family === 'logic' ? solveLogic(spec) : solveAttribute(spec);
}
