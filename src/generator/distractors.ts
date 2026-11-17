import { pick, randInt, sample, shuffle, type Rng } from './rng';
import { cellKey } from './signature';
import {
  ASYMMETRIC_SHAPES,
  ATTR_RANGE,
  MODE_ATTRS,
  ROTATION_STEPS,
  shapeDomain,
  type Attr,
  type AttrRule,
  type AttributeCell,
  type Layer,
  type Shape,
} from './types';

// 오답 보기 7개 만들기. 정답에서 출발해
//  - 속성 하나만 인접 값으로 바꾼 것 (규칙이 걸린 속성 우선)
//  - 속성 두 개를 바꾼 것
//  - 행렬에 이미 나온 칸을 그대로 복사한 것 (1~2개)
// 을 섞는다. 눈으로 봤을 때 서로 같은 보기는 만들지 않는다.

interface Slot {
  layer: number;
  attr: Attr;
}

type Value = number | Shape;

function mutate(cell: AttributeCell, slot: Slot, value: Value): AttributeCell {
  return {
    kind: 'attribute',
    layers: cell.layers.map((layer, i) => (i === slot.layer ? { ...layer, [slot.attr]: value } : layer)),
  };
}

/** 이 칸의 해당 속성을 바꿀 때 쓸 만한 값들 (현재 값 제외). */
function neighborValues(
  rng: Rng,
  cell: AttributeCell,
  slot: Slot,
  matrix: readonly AttributeCell[],
  rules: readonly AttrRule[],
): Value[] {
  const layer: Layer = cell.layers[slot.layer];
  const current = layer[slot.attr];
  // 행렬에 실제로 나온 값은 그럴듯한 오답이 된다.
  const seen = matrix.map((c) => c.layers[slot.layer][slot.attr]);
  const out = new Set<Value>();

  if (slot.attr === 'shape') {
    const rotationActive =
      layer.rotation !== 0 || rules.some((r) => r.layer === slot.layer && r.attr === 'rotation');
    const domain = shapeDomain(layer.mode, rotationActive);
    for (const s of seen) if (domain.includes(s as Shape)) out.add(s);
    for (const s of sample(rng, domain, 3)) out.add(s);
  } else if (slot.attr === 'rotation') {
    // 대칭 도형은 돌려도 차이가 잘 안 보이므로 회전 오답을 만들지 않는다.
    if (!ASYMMETRIC_SHAPES.includes(layer.shape)) return [];
    for (const s of seen) out.add(s);
    for (const d of [1, 2, ROTATION_STEPS - 1, ROTATION_STEPS - 2]) {
      out.add(((current as number) + d) % ROTATION_STEPS);
    }
  } else {
    const [lo, hi] = ATTR_RANGE[slot.attr];
    for (const s of seen) out.add(s);
    for (const d of [-1, 1]) {
      const v = (current as number) + d;
      if (v >= lo && v <= hi) out.add(v);
    }
  }

  out.delete(current);
  return [...out];
}

export function makeAttributeDistractors(
  rng: Rng,
  cells: readonly AttributeCell[],
  rules: readonly AttrRule[],
): AttributeCell[] | null {
  const answer = cells[8];
  const matrix = cells.slice(0, 8);

  const allSlots: Slot[] = answer.layers.flatMap((layer, i) =>
    MODE_ATTRS[layer.mode].map((attr) => ({ layer: i, attr })),
  );
  const isRuled = (s: Slot) =>
    rules.some((r) => r.layer === s.layer && r.attr === s.attr && r.kind !== 'constant');
  const ruledSlots = allSlots.filter(isRuled);
  const otherSlots = allSlots.filter((s) => !isRuled(s));

  const singles = (slots: Slot[]): AttributeCell[] =>
    shuffle(
      rng,
      slots.flatMap((slot) =>
        neighborValues(rng, answer, slot, matrix, rules).map((v) => mutate(answer, slot, v)),
      ),
    );

  const randomDouble = (): AttributeCell | null => {
    const [s1, s2] = sample(rng, allSlots, 2);
    if (!s1 || !s2) return null;
    const v1 = neighborValues(rng, answer, s1, matrix, rules);
    if (v1.length === 0) return null;
    const first = mutate(answer, s1, pick(rng, v1));
    const v2 = neighborValues(rng, first, s2, matrix, rules);
    if (v2.length === 0) return null;
    return mutate(first, s2, pick(rng, v2));
  };

  const chosen: AttributeCell[] = [];
  const keys = new Set<string>([cellKey(answer)]);
  const add = (cell: AttributeCell | null | undefined): boolean => {
    if (!cell || chosen.length >= 7) return false;
    const key = cellKey(cell);
    if (keys.has(key)) return false;
    keys.add(key);
    chosen.push(cell);
    return true;
  };
  const addUpTo = (pool: AttributeCell[], limit: number) => {
    let added = 0;
    for (const cell of pool) {
      if (added >= limit) break;
      if (add(cell)) added++;
    }
  };

  const ruledSingles = singles(ruledSlots);
  const otherSingles = singles(otherSlots);

  addUpTo(shuffle(rng, matrix), 1 + randInt(rng, 2)); // 행렬 칸 복사 1~2개
  addUpTo(ruledSingles, 3); // 규칙 속성 하나만 바꾼 것
  addUpTo(otherSingles, 1); // 규칙이 없는 속성 하나만 바꾼 것

  // 두 속성을 바꾼 것 (최대 3개)
  let doubles = 0;
  for (let i = 0; i < 40 && doubles < 3 && chosen.length < 7; i++) {
    if (add(randomDouble())) doubles++;
  }

  // 아직 모자라면 남은 후보로 채운다.
  addUpTo(ruledSingles, 7);
  addUpTo(otherSingles, 7);
  for (let i = 0; i < 80 && chosen.length < 7; i++) add(randomDouble());

  return chosen.length === 7 ? chosen : null;
}
