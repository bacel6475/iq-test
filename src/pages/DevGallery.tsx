import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { describeRules, generateItem, itemSignature, solveAttribute, type ItemSpec, type Level } from '../generator';
import { mixSeed } from '../generator/rng';
import { CellView } from '../render/Cell';
import { Matrix } from '../render/Matrix';

// 개발용 갤러리: 생성기가 만든 문항을 정답 표시와 함께 나열해 눈으로 점검한다.

const LEVELS: Level[] = [1, 2, 3, 4, 5];
const ITEM_COUNT = 50;

interface GalleryItem {
  seed: number;
  spec: ItemSpec;
  solverOk: boolean;
  rules: string[];
  signature: string;
}

function buildItems(level: Level, baseSeed: number): GalleryItem[] {
  return Array.from({ length: ITEM_COUNT }, (_, i) => {
    const seed = mixSeed(baseSeed, i);
    const spec = generateItem(seed, level);
    return {
      seed,
      spec,
      solverOk: solveAttribute(spec).ok,
      rules: describeRules(spec),
      signature: itemSignature(spec),
    };
  });
}

export default function DevGallery() {
  const [level, setLevel] = useState<Level>(1);
  const [baseSeed, setBaseSeed] = useState(1);
  const items = useMemo(() => buildItems(level, baseSeed), [level, baseSeed]);

  return (
    <main className="mx-auto max-w-7xl px-4 pt-6 pb-16">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link to="/" className="text-sm text-neutral-500 underline underline-offset-4">
          ← 홈
        </Link>
        <h1 className="text-xl font-bold">개발용 갤러리</h1>
        <span className="text-sm text-neutral-500">생성된 문항 {ITEM_COUNT}개 · 초록 테두리가 정답</span>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2" role="group" aria-label="레벨 선택">
          <span className="text-sm text-neutral-500">레벨</span>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              type="button"
              aria-pressed={lv === level}
              onClick={() => setLevel(lv)}
              className={`h-12 w-12 rounded-lg border text-base font-semibold ${
                lv === level
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {lv}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">계열</span>
          <span className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
            속성 규칙
          </span>
          <span className="text-xs text-neutral-400">(논리 연산은 M4에서 추가)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">묶음 번호</span>
          <button
            type="button"
            onClick={() => setBaseSeed((s) => Math.max(1, s - 1))}
            className="h-12 w-12 rounded-lg border border-neutral-300 text-lg dark:border-neutral-700"
            aria-label="이전 묶음"
          >
            −
          </button>
          <span className="w-10 text-center font-mono text-base" data-testid="base-seed">
            {baseSeed}
          </span>
          <button
            type="button"
            onClick={() => setBaseSeed((s) => s + 1)}
            className="h-12 w-12 rounded-lg border border-neutral-300 text-lg dark:border-neutral-700"
            aria-label="다음 묶음"
          >
            +
          </button>
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, i) => (
          <li
            key={item.signature + i}
            data-testid="gallery-item"
            className="rounded-xl border border-neutral-200 bg-white p-3 text-neutral-900 dark:border-neutral-800"
          >
            <div className="flex items-baseline justify-between text-xs text-neutral-500">
              <span>
                #{i + 1} · 레벨 {item.spec.level} · 점수 {item.spec.score.toFixed(1)}
              </span>
              <span className={item.solverOk ? 'text-emerald-700' : 'font-bold text-red-600'}>
                {item.solverOk ? '검증 통과' : '검증 실패'}
              </span>
            </div>

            <Matrix cells={item.spec.cells} className="mx-auto mt-2 w-full max-w-[260px]" />

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {item.spec.options.map((option, oi) => {
                const isAnswer = oi === item.spec.answerIndex;
                return (
                  <div
                    key={oi}
                    data-answer={isAnswer || undefined}
                    className={`relative aspect-square border ${
                      isAnswer ? 'border-emerald-600 ring-2 ring-emerald-600' : 'border-neutral-400'
                    }`}
                  >
                    <CellView cell={option} className="h-full w-full" />
                    <span className="absolute top-0 left-0.5 text-[10px] leading-tight text-neutral-500">{oi + 1}</span>
                  </div>
                );
              })}
            </div>

            <ul className="mt-3 space-y-0.5 text-xs leading-relaxed text-neutral-700">
              {item.rules.map((rule) => (
                <li key={rule}>· {rule}</li>
              ))}
            </ul>
            <p className="mt-1 font-mono text-[10px] text-neutral-400">seed {item.seed}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
