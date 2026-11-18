import { useEffect, useRef, useState, type ReactElement, type RefObject } from 'react';
import { formatDuration } from '../scoring';

// 결과·기록 화면의 그래프. 라이브러리 없이 SVG로 그린다.
// 막대·점에 손가락을 대거나 마우스를 올리면 값이 나온다(<title>).
// 화면 폭을 재서 SVG 1단위 = 1px로 그린다. 그래야 폰에서도 PC에서도 글자가 같은 크기(11px)로 보인다.

const FONT = 11;

function useMeasuredWidth<T extends HTMLElement>(fallback = 600): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/* ---------------- 레벨별 정답률 (가로 막대, 값 직접 표시) ---------------- */

export interface LevelStat {
  level: number;
  correct: number;
  total: number;
}

export function LevelAccuracyChart({ stats }: { stats: LevelStat[] }): ReactElement {
  return (
    <ul className="space-y-2" aria-label="레벨별 정답률">
      {stats.map(({ level, correct, total }) => {
        const pct = total === 0 ? 0 : Math.round((correct / total) * 100);
        return (
          <li key={level} className="grid grid-cols-[3.5rem_1fr_6.5rem] items-center gap-3 text-sm">
            <span className="text-neutral-500">레벨 {level}</span>
            <span className="relative h-3 rounded-full bg-[var(--chart-grid)]" title={`레벨 ${level}: ${correct}/${total}`}>
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--chart-series)]"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-right tabular-nums">
              {total === 0 ? '—' : `${correct}/${total} (${pct}%)`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- 문항별 소요 시간 (세로 막대, 정답 여부를 색+기호로) ---------------- */

export interface ItemTime {
  index: number;
  ms: number;
  result: 'correct' | 'wrong' | 'blank';
}

const RESULT_STYLE = {
  correct: { color: 'var(--chart-good)', label: '정답', icon: '✓' },
  wrong: { color: 'var(--chart-critical)', label: '오답', icon: '✗' },
  blank: { color: 'var(--chart-muted)', label: '미응답', icon: '–' },
} as const;

export function ItemTimeChart({
  items,
  selected,
  onSelect,
}: {
  items: ItemTime[];
  selected?: number;
  onSelect?: (index: number) => void;
}): ReactElement {
  const [ref, width] = useMeasuredWidth<HTMLElement>();
  const height = 160;
  const top = 8;
  const bottom = 22;
  const left = 40;
  const plotH = height - top - bottom;
  const maxMs = Math.max(30_000, ...items.map((i) => i.ms));
  // 눈금: 30초 단위로 깔끔하게
  const stepMs = maxMs > 180_000 ? 60_000 : 30_000;
  const yMax = Math.ceil(maxMs / stepMs) * stepMs;
  const ticks = Array.from({ length: yMax / stepMs + 1 }, (_, i) => i * stepMs);
  const slot = (width - left) / Math.max(1, items.length);
  const barW = Math.max(2, slot - 2); // 막대 사이 2px 간격
  const y = (ms: number) => top + plotH - (ms / yMax) * plotH;

  return (
    <figure ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block max-w-full"
        role="img"
        aria-label="문항별 소요 시간 막대 그래프"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={width} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={FONT} className="fill-neutral-500">
              {t / 1000 >= 60 ? `${t / 60_000}분` : `${t / 1000}초`}
            </text>
          </g>
        ))}
        {items.map((item, i) => {
          const x = left + i * slot + 1;
          const h = Math.max(2, (item.ms / yMax) * plotH);
          const style = RESULT_STYLE[item.result];
          const isSelected = selected === item.index;
          return (
            <g
              key={item.index}
              onClick={() => onSelect?.(item.index)}
              className={onSelect ? 'cursor-pointer' : undefined}
            >
              <title>{`${item.index + 1}번 · ${style.label} · ${formatDuration(item.ms)}`}</title>
              {/* 막대보다 넓은 투명 영역: 누르기 쉽게 */}
              <rect x={left + i * slot} y={top} width={slot} height={plotH} fill="transparent" />
              <rect
                x={x}
                y={top + plotH - h}
                width={barW}
                height={h}
                rx={Math.min(2, barW / 2)}
                fill={style.color}
                opacity={selected === undefined || isSelected ? 1 : 0.55}
              />
            </g>
          );
        })}
        {[0, items.length - 1].map((i) =>
          items[i] ? (
            <text
              key={i}
              x={i === 0 ? left : left + (i + 1) * slot}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : 'end'}
              fontSize={FONT}
              className="fill-neutral-500"
            >
              {i + 1}번
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        {(Object.keys(RESULT_STYLE) as (keyof typeof RESULT_STYLE)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: RESULT_STYLE[k].color }} />
            {RESULT_STYLE[k].icon} {RESULT_STYLE[k].label}
          </span>
        ))}
        {onSelect && <span className="text-neutral-400">막대를 누르면 그 문항을 복기합니다</span>}
      </figcaption>
    </figure>
  );
}

/* ---------------- 점수 추세 (선 그래프) ---------------- */

export interface TrendPoint {
  id: string;
  /** 0~1 정답률 */
  ratio: number;
  label: string;
}

export function TrendChart({ points, currentId }: { points: TrendPoint[]; currentId?: string }): ReactElement {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  if (points.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        같은 종류의 시험 기록이 2회 이상 쌓이면 추세 그래프가 나옵니다.
      </p>
    );
  }
  const height = 190;
  const top = 18;
  const bottom = 22;
  const left = 40;
  const right = 14;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (i: number) => left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (ratio: number) => top + plotH - ratio * plotH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.ratio).toFixed(1)}`).join('');

  return (
    <div ref={ref}>
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="block max-w-full"
      role="img"
      aria-label="회차별 정답률 추세 선 그래프"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
          <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={FONT} className="fill-neutral-500">
            {t * 100}%
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--chart-series)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => {
        const current = p.id === currentId;
        return (
          <g key={p.id}>
            <title>{`${i + 1}회차 · ${p.label} · ${Math.round(p.ratio * 100)}%`}</title>
            <circle cx={x(i)} cy={y(p.ratio)} r={14} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.ratio)}
              r={current ? 6 : 4}
              fill={current ? 'var(--chart-series)' : 'var(--chart-surface)'}
              stroke={current ? 'var(--chart-surface)' : 'var(--chart-series)'}
              strokeWidth={2}
            />
          </g>
        );
      })}
      {/* 마지막 점에만 값 표시 */}
      <text
        x={x(points.length - 1)}
        y={y(points[points.length - 1].ratio) - 10}
        textAnchor="end"
        fontSize={12}
        fontWeight={600}
        className="fill-neutral-700 dark:fill-neutral-300"
      >
        {Math.round(points[points.length - 1].ratio * 100)}%
      </text>
      <text x={left} y={height - 6} fontSize={FONT} className="fill-neutral-500">
        1회차
      </text>
      <text x={width - right} y={height - 6} textAnchor="end" fontSize={FONT} className="fill-neutral-500">
        {points.length}회차
      </text>
    </svg>
    </div>
  );
}
