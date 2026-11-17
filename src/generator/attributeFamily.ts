import { difficultyScore, levelOfScore } from './difficulty';
import { makeAttributeDistractors } from './distractors';
import { mixSeed, mulberry32, pick, randInt, sample, shuffle, weighted, type Rng } from './rng';
import { solveAttribute } from './solver';
import {
  ATTR_RANGE,
  GENERATOR_VERSION,
  MODE_ATTRS,
  ROTATION_STEPS,
  shapeDomain,
  type Attr,
  type AttrRule,
  type AttributeCell,
  type AttributeItemSpec,
  type Layer,
  type LayerMode,
  type Level,
  type RuleKind,
  type Shape,
} from './types';

// 문항 계열 A: 속성 규칙.
// 각 속성(모양·크기·채움·방향·개수)에 constant / progression / distribute3 규칙을
// 행 방향으로 걸어 3×3 행렬을 만든다.

type Layout = 'single' | 'multi' | 'double';

/** 레벨별 칸 구성 비율 */
const LAYOUT_WEIGHTS: Record<Level, readonly (readonly [Layout, number])[]> = {
  1: [
    ['single', 60],
    ['multi', 40],
  ],
  2: [
    ['single', 45],
    ['multi', 35],
    ['double', 20],
  ],
  3: [
    ['single', 35],
    ['multi', 30],
    ['double', 35],
  ],
  4: [
    ['single', 15],
    ['multi', 15],
    ['double', 70],
  ],
  5: [['double', 100]],
};

/** 레벨별 규칙 개수 [최소, 최대] */
const RULE_COUNT: Record<Level, readonly [number, number]> = {
  1: [1, 1],
  2: [1, 2],
  3: [2, 3],
  4: [3, 4],
  5: [3, 5],
};

/** 속성별로 걸 수 있는 규칙. 도형 종류에는 순서가 없어 progression을 쓰지 않는다. */
const RULE_KINDS: Record<Attr, readonly RuleKind[]> = {
  shape: ['distribute3'],
  size: ['progression', 'distribute3'],
  fill: ['progression', 'distribute3'],
  rotation: ['progression', 'distribute3'],
  count: ['progression', 'distribute3'],
};

interface Slot {
  layer: number;
  attr: Attr;
}

interface Plan {
  modes: LayerMode[];
  rules: AttrRule[];
}

function choosePlan(rng: Rng, level: Level): Plan | null {
  const layout = weighted(rng, LAYOUT_WEIGHTS[level]);
  const modes: LayerMode[] = layout === 'double' ? ['outer', 'inner'] : [layout];
  const slots: Slot[] = modes.flatMap((mode, layer) => MODE_ATTRS[mode].map((attr) => ({ layer, attr })));
  const [kMin, kMax] = RULE_COUNT[level];

  for (let i = 0; i < 100; i++) {
    const k = kMin + randInt(rng, kMax - kMin + 1);
    if (k > slots.length) continue;
    const rules: AttrRule[] = sample(rng, slots, k).map((slot) => ({
      ...slot,
      kind: pick(rng, RULE_KINDS[slot.attr]),
    }));
    if (levelOfScore(difficultyScore(rules, modes.length)) === level) return { modes, rules };
  }
  return null;
}

type Grid<T> = T[][];

const constGrid = <T>(v: T): Grid<T> => [0, 1, 2].map(() => [v, v, v]);
const rowConstGrid = <T>(vals: readonly T[]): Grid<T> => vals.map((v) => [v, v, v]);

/** 세 값을 라틴 방진으로 배치: 행에도 열에도 한 번씩 나온다. */
function latinGrid<T>(rng: Rng, vals: readonly T[]): Grid<T> {
  const shift = pick(rng, [1, 2]);
  return [0, 1, 2].map((r) => [0, 1, 2].map((c) => vals[(c + r * shift) % 3]));
}

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** progression 값 배치. 값 범위를 벗어나지 않는 시작값만 고른다. 반환값의 step은 부호 포함. */
function progressionGrid(rng: Rng, attr: Exclude<Attr, 'shape'>): { grid: Grid<number>; step: number } {
  if (attr === 'rotation') {
    const step = pick(rng, [1, 2, -1, -2]);
    const grid = [0, 1, 2].map(() => {
      const start = randInt(rng, ROTATION_STEPS);
      return [0, 1, 2].map((c) => (((start + c * step) % ROTATION_STEPS) + ROTATION_STEPS) % ROTATION_STEPS);
    });
    return { grid, step };
  }
  const [lo, hi] = ATTR_RANGE[attr];
  const step = pick(rng, [1, -1]);
  const starts = step > 0 ? range(lo, hi - 2) : range(lo + 2, hi);
  const grid = [0, 1, 2].map(() => {
    const start = pick(rng, starts);
    return [start, start + step, start + 2 * step];
  });
  return { grid, step };
}

function buildCells(rng: Rng, plan: Plan, level: Level): { cells: AttributeCell[]; rules: AttrRule[] } {
  const rules: AttrRule[] = plan.rules.map((r) => ({ ...r }));
  const findRule = (layer: number, attr: Attr) => rules.find((r) => r.layer === layer && r.attr === attr);

  // "행 안에서는 같지만 행마다 다른" constant 속성을 가끔 하나 넣는다 (레벨 2 이상).
  let perRowSlot: Slot | null = null;
  if (level >= 2 && rng() < 0.3) {
    const candidates: Slot[] = plan.modes.flatMap((mode, layer) =>
      MODE_ATTRS[mode]
        .filter((attr) => attr !== 'rotation' && !findRule(layer, attr))
        .map((attr) => ({ layer, attr })),
    );
    if (candidates.length > 0) perRowSlot = pick(rng, candidates);
  }
  const isPerRow = (layer: number, attr: Attr) => perRowSlot?.layer === layer && perRowSlot.attr === attr;

  const layerGrids: Grid<Layer>[] = plan.modes.map((mode, layer) => {
    const rotationRuled = !!findRule(layer, 'rotation');
    const shapes = shapeDomain(mode, rotationRuled);

    // 모양
    let shapeGrid: Grid<Shape>;
    if (findRule(layer, 'shape')) shapeGrid = latinGrid(rng, sample(rng, shapes, 3));
    else if (isPerRow(layer, 'shape')) shapeGrid = rowConstGrid(sample(rng, shapes, 3));
    else shapeGrid = constGrid(pick(rng, shapes));

    // 순서가 있는 속성
    const ordered = (attr: Exclude<Attr, 'shape'>, constantDomain?: number[]): Grid<number> => {
      const [lo, hi] = ATTR_RANGE[attr];
      const rule = findRule(layer, attr);
      if (rule?.kind === 'progression') {
        const { grid, step } = progressionGrid(rng, attr);
        rule.step = step;
        return grid;
      }
      if (rule?.kind === 'distribute3') return latinGrid(rng, sample(rng, range(lo, hi), 3));
      if (isPerRow(layer, attr)) return rowConstGrid(sample(rng, range(lo, hi), 3));
      return constGrid(pick(rng, constantDomain ?? range(lo, hi)));
    };

    const sizeGrid = mode === 'outer' ? constGrid(3) : mode === 'multi' ? constGrid(2) : ordered('size');
    const fillGrid = ordered('fill');
    // 규칙이 없으면 회전시키지 않는다.
    const rotationGrid = rotationRuled ? ordered('rotation') : constGrid(0);
    const countGrid = mode === 'multi' ? ordered('count', [2, 3, 4]) : constGrid(1);

    return [0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => ({
        mode,
        shape: shapeGrid[r][c],
        size: sizeGrid[r][c],
        fill: fillGrid[r][c],
        rotation: rotationGrid[r][c],
        count: countGrid[r][c],
      })),
    );
  });

  if (perRowSlot) rules.push({ ...perRowSlot, kind: 'constant', perRow: true });

  const cells: AttributeCell[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      cells.push({ kind: 'attribute', layers: layerGrids.map((g) => g[r][c]) });
    }
  }
  return { cells, rules };
}

const MAX_ATTEMPTS = 500;

/**
 * 속성 계열 문항 하나를 만든다. 같은 (seed, level)이면 항상 같은 문항이 나온다.
 * 정답이 유일하지 않거나 오답 7개를 못 만들면 버리고 다시 만든다.
 */
export function generateAttributeItem(seed: number, level: Level): AttributeItemSpec {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = mulberry32(mixSeed(seed, attempt));

    const plan = choosePlan(rng, level);
    if (!plan) continue;

    const { cells, rules } = buildCells(rng, plan, level);
    const distractors = makeAttributeDistractors(rng, cells, rules);
    if (!distractors) continue;

    // 정답(0번)과 오답을 섞고, 정답이 간 자리를 기억한다.
    const order = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
    const pool = [cells[8], ...distractors];
    const options = order.map((i) => pool[i]);
    const answerIndex = order.indexOf(0);

    const score = difficultyScore(rules, plan.modes.length);
    const spec: AttributeItemSpec = {
      generatorVersion: GENERATOR_VERSION,
      family: 'attribute',
      seed,
      level,
      score,
      rules,
      cells,
      options,
      answerIndex,
    };

    if (levelOfScore(score) !== level) continue;
    if (!solveAttribute(spec).ok) continue;
    return spec;
  }
  throw new Error(`문항 생성 실패: seed=${seed}, level=${level}`);
}
