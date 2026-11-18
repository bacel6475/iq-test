import type { Attr, AttrRule, ItemSpec, LogicOp } from './types';

// 문항에 적용된 규칙의 한국어 해설 (복기 화면·갤러리용).

const ATTR_NAME: Record<Attr, string> = {
  shape: '모양',
  size: '크기',
  fill: '채움',
  rotation: '방향',
  count: '개수',
};

function describeRule(rule: AttrRule): string {
  if (rule.kind === 'distribute3') return '세 가지가 행마다 한 번씩';
  if (rule.kind === 'constant') return rule.perRow ? '행 안에서는 같고 행마다 다름' : '모두 같음';

  const step = rule.step ?? 1;
  if (rule.attr === 'rotation') {
    const degrees = Math.abs(step) * 45;
    return `열마다 ${step > 0 ? '시계' : '반시계'} 방향으로 ${degrees}°씩 회전`;
  }
  if (rule.attr === 'fill') return `열마다 한 단계씩 ${step > 0 ? '진해짐' : '옅어짐'}`;
  if (rule.attr === 'count') return `열마다 하나씩 ${step > 0 ? '늘어남' : '줄어듦'}`;
  return `열마다 한 단계씩 ${step > 0 ? '증가' : '감소'}`;
}

const OP_TEXT: Record<LogicOp, string> = {
  or: '3열 = 1열과 2열을 겹친 그림 (두 그림의 선을 모두 합침)',
  and: '3열 = 1열과 2열에 공통으로 있는 선만 남긴 그림',
  xor: '3열 = 1열과 2열을 겹치되, 둘 다 있는 선은 지운 그림',
  diff: '3열 = 1열에서 2열에 있는 선을 뺀 그림',
};

/** 예: ["크기: 열마다 한 단계씩 증가", "안쪽 도형 채움: 세 가지가 행마다 한 번씩"] */
export function describeRules(spec: ItemSpec): string[] {
  if (spec.family === 'logic') return [OP_TEXT[spec.operation]];
  const layerCount = spec.cells[0].layers.length;
  const layerName = (layer: number) => (layerCount < 2 ? '' : layer === 0 ? '바깥 도형 ' : '안쪽 도형 ');
  // 실제 규칙을 먼저, 행마다 다른 constant는 뒤에 보여 준다.
  const sorted = [...spec.rules].sort(
    (a, b) => Number(a.kind === 'constant') - Number(b.kind === 'constant') || a.layer - b.layer,
  );
  return sorted.map((rule) => `${layerName(rule.layer)}${ATTR_NAME[rule.attr]}: ${describeRule(rule)}`);
}
