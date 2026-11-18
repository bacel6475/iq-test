import type { ReactElement } from 'react';
import type { CellSpec } from '../generator/types';
import { CellView } from './Cell';

interface MatrixProps {
  /** 9칸(행 우선). 앞의 8칸만 그리고 마지막 칸은 빈칸(?)으로 둔다. */
  cells: readonly CellSpec[];
  className?: string;
  /** 복기 화면: 빈칸 대신 정답(9번째 칸)을 초록 테두리로 보여 준다. */
  revealAnswer?: boolean;
}

/** 3×3 행렬. 다크 모드에서도 항상 흰 배경에 검정 선으로 그린다. */
export function Matrix({ cells, className = '', revealAnswer = false }: MatrixProps): ReactElement {
  return (
    <div
      role="group"
      aria-label="3×3 행렬 문제"
      className={`grid aspect-square grid-cols-3 gap-[2px] border-2 border-neutral-900 bg-neutral-900 ${className}`}
    >
      {cells.slice(0, 8).map((cell, i) => (
        <div key={i} data-testid="matrix-cell" className="bg-white">
          <CellView cell={cell} className="h-full w-full" />
        </div>
      ))}
      {revealAnswer ? (
        <div data-testid="matrix-answer" className="bg-white outline-4 -outline-offset-4 outline-emerald-600">
          <CellView cell={cells[8]} className="h-full w-full" />
        </div>
      ) : (
      <div
        data-testid="matrix-blank"
        aria-label="빈칸"
        className="flex items-center justify-center bg-neutral-100 text-4xl font-bold text-neutral-400"
      >
        ?
      </div>
      )}
    </div>
  );
}
