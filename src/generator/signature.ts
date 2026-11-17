import { ROTATION_PERIOD, type AttributeCell, type ItemSpec, type Layer } from './types';

/**
 * 눈으로 봤을 때 같은 그림이면 같은 문자열이 되도록 정규화한다.
 * (예: 원은 돌려도 같으므로 rotation을 0으로 본다.)
 */
export function layerKey(layer: Layer): string {
  const rotation = layer.rotation % ROTATION_PERIOD[layer.shape];
  return [layer.mode, layer.shape, layer.size, layer.fill, rotation, layer.count].join(',');
}

export function cellKey(cell: AttributeCell): string {
  return cell.layers.map(layerKey).join('|');
}

/** cyrb53: 문자열을 53비트 해시로 바꾼다 (동기식, 순수 함수). */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, '0');
}

/**
 * 중복 판별용 서명: 규칙 배정과 9칸의 내용만으로 만든다.
 * 보기 순서나 시드가 달라도 같은 행렬이면 같은 서명이 된다.
 */
export function itemSignature(spec: ItemSpec): string {
  const rules = spec.rules
    .map((r) => [r.layer, r.attr, r.kind, r.step ?? 0, r.perRow ? 1 : 0].join(':'))
    .sort();
  const normalized = JSON.stringify({
    family: spec.family,
    rules,
    cells: spec.cells.map(cellKey),
  });
  return hashString(normalized);
}

/**
 * 한 시험지 안에서 비슷한 문항이 반복되지 않게 하는 데 쓰는 "규칙 조합 + 도형 조합" 키.
 */
export function comboKey(spec: ItemSpec): string {
  const rules = spec.rules.map((r) => [r.layer, r.attr, r.kind].join(':')).sort();
  const shapes = [...new Set(spec.cells.flatMap((c) => c.layers.map((l) => `${l.mode}:${l.shape}`)))].sort();
  return `${rules.join(',')}#${shapes.join(',')}`;
}
