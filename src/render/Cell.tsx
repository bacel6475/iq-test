import type { ReactElement } from 'react';
import type { CellSpec, Layer } from '../generator/types';
import { ShapeGlyph } from './shapes';

// 칸 하나를 100×100 좌표의 SVG로 그린다. 문제 영역은 항상 흰 배경에 검정 선이다.

/** 크기 1·2·3에 해당하는 반지름 */
const SINGLE_RADIUS = [16, 27, 38];
const INNER_RADIUS = [11, 17, 23];
const MULTI_RADIUS = 17;
const OUTER_RADIUS = 46;

/** 개수별 고정 배치 */
const COUNT_POSITIONS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[50, 50]],
  2: [
    [29, 50],
    [71, 50],
  ],
  3: [
    [50, 29],
    [28, 71],
    [72, 71],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
};

function LayerView({ layer }: { layer: Layer }): ReactElement {
  const common = { shape: layer.shape, rotation: layer.rotation, fill: layer.fill };
  switch (layer.mode) {
    case 'outer':
      return <ShapeGlyph {...common} cx={50} cy={50} r={OUTER_RADIUS} />;
    case 'inner':
      return <ShapeGlyph {...common} cx={50} cy={50} r={INNER_RADIUS[layer.size - 1] ?? 17} halo />;
    case 'multi': {
      const positions = COUNT_POSITIONS[layer.count] ?? COUNT_POSITIONS[1];
      return (
        <>
          {positions.map(([cx, cy]) => (
            <ShapeGlyph key={`${cx}-${cy}`} {...common} cx={cx} cy={cy} r={MULTI_RADIUS} />
          ))}
        </>
      );
    }
    case 'single':
      return <ShapeGlyph {...common} cx={50} cy={50} r={SINGLE_RADIUS[layer.size - 1] ?? 27} />;
  }
}

interface CellViewProps {
  cell: CellSpec;
  className?: string;
}

export function CellView({ cell, className }: CellViewProps): ReactElement {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
      {cell.layers.map((layer, i) => (
        <LayerView key={i} layer={layer} />
      ))}
    </svg>
  );
}
