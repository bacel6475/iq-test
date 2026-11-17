// 문항 명세(ItemSpec)와 속성 값의 범위 정의. React·DOM·DB에 의존하지 않는다.

/** 생성기 로직이 바뀌어 같은 시드의 결과가 달라지면 1 올린다. */
export const GENERATOR_VERSION = 1;

export type Level = 1 | 2 | 3 | 4 | 5;
export type Family = 'attribute' | 'logic';

export const SHAPES = [
  'triangle',
  'square',
  'pentagon',
  'hexagon',
  'circle',
  'cross',
  'star',
  'arrow',
  'semicircle',
  'ell',
] as const;
export type Shape = (typeof SHAPES)[number];

/** 회전 대칭이 없는 도형. rotation 규칙은 이 도형에만 건다. */
export const ASYMMETRIC_SHAPES: readonly Shape[] = ['arrow', 'semicircle', 'ell'];

/** 2레이어 문항에서 바깥 도형으로 쓰는, 안이 넓은 도형. */
export const CONTAINER_SHAPES: readonly Shape[] = ['square', 'circle', 'pentagon', 'hexagon'];

/**
 * 45° 단위로 몇 번 돌리면 처음과 같은 모양이 되는가.
 * 예: 사각형은 90°(2단계)마다 같아지므로 2.
 */
export const ROTATION_PERIOD: Record<Shape, number> = {
  triangle: 8,
  square: 2,
  pentagon: 8,
  hexagon: 4,
  circle: 1,
  cross: 2,
  star: 8,
  arrow: 8,
  semicircle: 8,
  ell: 8,
};

export type Attr = 'shape' | 'size' | 'fill' | 'rotation' | 'count';
export const ATTRS: readonly Attr[] = ['shape', 'size', 'fill', 'rotation', 'count'];

/** 순서가 있는 속성의 값 범위 [최소, 최대]. rotation은 0~7(45° 단위)이며 한 바퀴 돌면 0으로 돌아온다. */
export const ATTR_RANGE: Record<Exclude<Attr, 'shape'>, readonly [number, number]> = {
  size: [1, 3],
  fill: [0, 3],
  rotation: [0, 7],
  count: [1, 4],
};
export const ROTATION_STEPS = 8;

/**
 * 레이어가 칸 안에서 그려지는 방식.
 * - single: 도형 1개. 크기가 바뀔 수 있다.
 * - multi : 같은 도형 1~4개를 고정 배치. 크기는 고정.
 * - outer : 2레이어 문항의 바깥 큰 도형.
 * - inner : 2레이어 문항의 안쪽 작은 도형.
 */
export type LayerMode = 'single' | 'multi' | 'outer' | 'inner';

/** 방식별로 값이 바뀔 수 있는 속성. 여기에 없는 속성은 문항 전체에서 고정이다. */
export const MODE_ATTRS: Record<LayerMode, readonly Attr[]> = {
  single: ['shape', 'size', 'fill', 'rotation'],
  multi: ['shape', 'fill', 'rotation', 'count'],
  outer: ['shape', 'fill'],
  inner: ['shape', 'size', 'fill', 'rotation'],
};

export interface Layer {
  mode: LayerMode;
  shape: Shape;
  /** 1(소) · 2(중) · 3(대) */
  size: number;
  /** 0 없음 · 1 옅은 회색 · 2 짙은 회색 · 3 검정 */
  fill: number;
  /** 0~7, 45° 단위(시계 방향) */
  rotation: number;
  /** 1~4개 */
  count: number;
}

export interface AttributeCell {
  kind: 'attribute';
  layers: Layer[];
}

export type CellSpec = AttributeCell;

export type RuleKind = 'constant' | 'progression' | 'distribute3';

export interface AttrRule {
  /** 몇 번째 레이어인가 (0부터) */
  layer: number;
  attr: Attr;
  kind: RuleKind;
  /** progression일 때 열마다 변하는 양 (부호 포함) */
  step?: number;
  /** constant인데 행마다 값이 다른 경우 */
  perRow?: boolean;
}

export interface AttributeItemSpec {
  generatorVersion: number;
  family: 'attribute';
  seed: number;
  level: Level;
  /** 난이도 점수 */
  score: number;
  /** constant가 아닌 규칙 전부 + 행마다 다른 constant */
  rules: AttrRule[];
  /** 9칸(행 우선). 마지막 칸(8번)이 정답이며 화면에는 빈칸으로 나온다. */
  cells: AttributeCell[];
  /** 보기 8개 */
  options: AttributeCell[];
  answerIndex: number;
}

export type ItemSpec = AttributeItemSpec;

/** 레이어의 도형 후보. rotation이 쓰이는 레이어는 비대칭 도형만 쓴다. */
export function shapeDomain(mode: LayerMode, rotationActive: boolean): readonly Shape[] {
  if (rotationActive) return ASYMMETRIC_SHAPES;
  if (mode === 'outer') return CONTAINER_SHAPES;
  return SHAPES;
}
