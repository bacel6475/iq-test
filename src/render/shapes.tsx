import type { ReactElement } from 'react';
import type { Shape } from '../generator/types';

// 도형 10종을 "반지름 1짜리 원 안"에 맞춘 좌표로 정의한다. (0,0)이 중심, y는 아래로 증가.

function regularPolygon(n: number, radius = 1, startDeg = -90): string {
  const points = Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return `${(radius * Math.cos(a)).toFixed(4)},${(radius * Math.sin(a)).toFixed(4)}`;
  });
  return `M${points.join('L')}Z`;
}

function starPath(outer = 1, inner = 0.45): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((-90 + 36 * i) * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(4)},${(r * Math.sin(a)).toFixed(4)}`;
  });
  return `M${points.join('L')}Z`;
}

const SHAPE_PATHS: Record<Shape, string> = {
  triangle: regularPolygon(3),
  square: 'M-0.8,-0.8H0.8V0.8H-0.8Z',
  pentagon: regularPolygon(5),
  hexagon: regularPolygon(6),
  // 원은 path의 호 두 개로 그린다 (반지름 0.88).
  circle: 'M-0.88,0A0.88,0.88 0 1 0 0.88,0A0.88,0.88 0 1 0 -0.88,0Z',
  cross: 'M-0.32,-0.95H0.32V-0.32H0.95V0.32H0.32V0.95H-0.32V0.32H-0.95V-0.32H-0.32Z',
  star: starPath(),
  // 위를 가리키는 화살표
  arrow: 'M0,-1L0.75,-0.1H0.3V1H-0.3V-0.1H-0.75Z',
  // 둥근 쪽이 위인 반원
  semicircle: 'M-1,0.5A1,1 0 0 1 1,0.5Z',
  ell: 'M-0.7,-0.9H-0.1V0.3H0.7V0.9H-0.7Z',
};

/** 채움 단계별 색: 없음(흰색) · 옅은 회색 · 짙은 회색 · 검정 */
export const FILL_COLORS = ['#ffffff', '#cfcfcf', '#7a7a7a', '#111111'] as const;
export const STROKE_COLOR = '#111111';
const STROKE_WIDTH = 2.6;

interface ShapeGlyphProps {
  shape: Shape;
  cx: number;
  cy: number;
  /** 바깥 반지름 (100×100 칸 기준) */
  r: number;
  /** 0~7, 45° 단위 시계 방향 */
  rotation: number;
  /** 0~3 */
  fill: number;
  /** 다른 도형 위에 겹쳐 그릴 때, 경계가 보이도록 흰 테두리를 먼저 깐다. */
  halo?: boolean;
}

export function ShapeGlyph({ shape, cx, cy, r, rotation, fill, halo = false }: ShapeGlyphProps): ReactElement {
  const d = SHAPE_PATHS[shape];
  // 좌표를 r배로 키우므로 선 굵기는 r로 나눠 화면에서 일정하게 유지한다.
  const strokeWidth = STROKE_WIDTH / r;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotation * 45}) scale(${r})`}>
      {halo && (
        <path d={d} fill="#ffffff" stroke="#ffffff" strokeWidth={(STROKE_WIDTH + 5) / r} strokeLinejoin="round" />
      )}
      <path
        d={d}
        fill={FILL_COLORS[fill] ?? FILL_COLORS[0]}
        stroke={STROKE_COLOR}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </g>
  );
}
