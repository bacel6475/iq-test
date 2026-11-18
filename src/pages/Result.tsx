import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ItemTimeChart, LevelAccuracyChart, TrendChart, type TrendPoint } from '../components/charts';
import { getSession, listSessions, type TestSession } from '../db/repo';
import { describeRules } from '../generator';
import { CellView } from '../render/Cell';
import { Matrix } from '../render/Matrix';
import { getPreset } from '../presets';
import { formatDuration } from '../scoring';
import { formatDate, itemResult, levelStats, trendPoints } from '../stats';

type Filter = 'all' | 'wrong' | 'blank';

const RESULT_BADGE = {
  correct: { text: '✓ 정답', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  wrong: { text: '✗ 오답', cls: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  blank: { text: '– 미응답', cls: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300' },
} as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** 문항 복기: 번호 격자 + 선택한 문항의 행렬·보기·해설 */
function Review({ session, index, setIndex }: { session: TestSession; index: number; setIndex: (i: number) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = session.responses
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => filter === 'all' || itemResult(r) === filter)
    .map(({ i }) => i);

  const item = session.items[index];
  const response = session.responses[index];
  const result = itemResult(response);
  const pos = visible.indexOf(index);

  return (
    <div>
      <div className="flex gap-2" role="group" aria-label="복기 문항 거르기">
        {(
          [
            ['all', `전체 ${session.items.length}`],
            ['wrong', `오답 ${session.responses.filter((r) => itemResult(r) === 'wrong').length}`],
            ['blank', `미응답 ${session.responses.filter((r) => r.selected === null).length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              const first = session.responses.findIndex((r) => value === 'all' || itemResult(r) === value);
              if (first >= 0) setIndex(first);
            }}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${
              filter === value
                ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                : 'border border-neutral-300 dark:border-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ol className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-12">
        {visible.map((i) => {
          const res = itemResult(session.responses[i]);
          return (
            <li key={i}>
              <button
                type="button"
                aria-label={`${i + 1}번 ${RESULT_BADGE[res].text.slice(2)}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className={`h-10 w-full rounded-md text-sm font-semibold tabular-nums ${RESULT_BADGE[res].cls} ${
                  i === index ? 'outline-3 outline-offset-1 outline-blue-600' : ''
                }`}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
      </ol>

      {visible.length === 0 ? (
        <p className="mt-4 text-center text-sm text-neutral-500">해당하는 문항이 없습니다.</p>
      ) : (
        <article className="mt-5" data-testid="review-item">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-lg font-bold">{index + 1}번</span>
            <span className={`rounded-full px-2.5 py-0.5 font-semibold ${RESULT_BADGE[result].cls}`}>
              {RESULT_BADGE[result].text}
            </span>
            <span className="text-neutral-500">레벨 {item.level}</span>
            <span className="text-neutral-500">· {formatDuration(response.timeSpentMs)}</span>
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Matrix cells={item.cells} revealAnswer className="w-full max-w-[360px] justify-self-center" />
            <div>
              <div className="grid grid-cols-4 gap-2">
                {item.options.map((option, oi) => {
                  const isAnswer = oi === item.answerIndex;
                  const isMine = oi === response.selected;
                  return (
                    <div key={oi} className="text-center">
                      <div
                        className={`relative aspect-square bg-white ${
                          isAnswer
                            ? 'outline-4 outline-emerald-600'
                            : isMine
                              ? 'outline-4 outline-red-600'
                              : 'outline-1 outline-neutral-400'
                        }`}
                      >
                        <CellView cell={option} className="h-full w-full" />
                        <span className="absolute top-0.5 left-1 text-[10px] text-neutral-400">{oi + 1}</span>
                      </div>
                      <span className="mt-1 block h-4 text-[11px] font-semibold">
                        {isAnswer && isMine ? '✓ 정답·내 답' : isAnswer ? '✓ 정답' : isMine ? '✗ 내 답' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <h3 className="mt-3 text-sm font-semibold">적용된 규칙 (가로 방향)</h3>
              <ul className="mt-1 space-y-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300" data-testid="rules">
                {describeRules(item).map((rule) => (
                  <li key={rule}>· {rule}</li>
                ))}
                {item.family === 'attribute' && <li className="text-neutral-500">· 나머지 속성은 모든 칸에서 같음</li>}
              </ul>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={pos <= 0}
              onClick={() => setIndex(visible[pos - 1])}
              className="h-12 rounded-xl border border-neutral-300 font-semibold disabled:opacity-30 dark:border-neutral-700"
            >
              ← 이전 문항
            </button>
            <button
              type="button"
              disabled={pos < 0 || pos >= visible.length - 1}
              onClick={() => setIndex(visible[pos + 1])}
              className="h-12 rounded-xl border border-neutral-300 font-semibold disabled:opacity-30 dark:border-neutral-700"
            >
              다음 문항 →
            </button>
          </div>
        </article>
      )}
    </div>
  );
}

export default function Result() {
  const { sessionId = '' } = useParams();
  const [session, setSession] = useState<TestSession | null | undefined>(undefined);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([getSession(sessionId), listSessions()]).then(([s, all]) => {
      if (!alive) return;
      setSession(s ?? null);
      if (s) setTrend(trendPoints(all, s.presetId, s.mode));
    });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const levels = useMemo(() => (session ? levelStats(session) : []), [session]);

  if (session === undefined) return <p className="p-8 text-center text-neutral-500">불러오는 중…</p>;
  if (session === null || session.status === 'active') {
    return (
      <div className="p-8 text-center">
        <p>결과를 찾을 수 없습니다.</p>
        <Link to="/" className="mt-4 inline-block py-3 underline">
          홈으로
        </Link>
      </div>
    );
  }

  const total = session.items.length;
  const unanswered = session.responses.filter((r) => r.selected === null).length;
  const used = (session.submittedAt ?? session.startedAt) - session.startedAt;
  const answeredTimes = session.responses.filter((r) => r.timeSpentMs > 0).map((r) => r.timeSpentMs);
  const avgMs = answeredTimes.length ? answeredTimes.reduce((a, b) => a + b, 0) / answeredTimes.length : 0;
  const preset = getPreset(session.presetId);
  const pct = Math.round(((session.rawScore ?? 0) / Math.max(1, total)) * 100);

  const jumpToReview = (i: number) => {
    setReviewIndex(i);
    reviewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <div className="flex items-center justify-between">
        <Link to="/" className="py-2 text-sm text-neutral-500 underline underline-offset-4">
          ← 홈
        </Link>
        <Link to="/history" className="py-2 text-sm text-neutral-500 underline underline-offset-4">
          전체 기록
        </Link>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        {preset.name} · {session.mode === 'practice' ? '연습' : '시험'} · {formatDate(session.startedAt)}
        {session.status === 'expired' && ' · 시간 종료로 자동 제출'}
      </p>
      <h1 className="mt-1 text-2xl font-bold">결과</h1>

      <section className="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-neutral-900">
        <p className="text-sm text-neutral-500">원점수</p>
        <p className="mt-1 text-5xl font-bold tabular-nums" data-testid="raw-score">
          {session.rawScore}
          <span className="text-2xl text-neutral-400"> / {total}</span>
        </p>
        <p className="mt-1 text-sm text-neutral-500">정답률 {pct}%</p>
      </section>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
        {[
          ['미응답', `${unanswered}개`],
          ['평균 소요', formatDuration(avgMs)],
          ['걸린 시간', formatDuration(used)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-3 shadow-sm dark:bg-neutral-900">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <Card title="레벨별 정답률">
        <LevelAccuracyChart stats={levels} />
      </Card>

      <Card title="문항별 소요 시간">
        <ItemTimeChart
          items={session.responses.map((r, i) => ({ index: i, ms: r.timeSpentMs, result: itemResult(r) }))}
          selected={reviewIndex}
          onSelect={jumpToReview}
        />
      </Card>

      <Card title={`정답률 추세 (${preset.name} · ${session.mode === 'practice' ? '연습' : '시험'})`}>
        <TrendChart points={trend} currentId={session.id} />
      </Card>

      <div ref={reviewRef} className="scroll-mt-4">
        <Card title="문항별 복기">
          <Review session={session} index={reviewIndex} setIndex={setReviewIndex} />
        </Card>
      </div>

      <section className="mt-4 rounded-2xl bg-neutral-100 p-4 text-sm leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        <p className="font-semibold text-neutral-800 dark:text-neutral-200">
          이 점수는 공인 IQ가 아니며 본인 기록 간 비교용입니다.
        </p>
        <p className="mt-1">
          같은 유형을 반복해서 풀면 점수가 오르는 것은 정상적인 연습 효과입니다. 추세는 실력 변화와 익숙해짐이 함께
          반영된 것으로 봐 주세요.
        </p>
      </section>

      <Link
        to="/setup"
        className="mt-6 flex h-14 items-center justify-center rounded-xl bg-neutral-900 text-lg font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        새 시험 보기
      </Link>
    </main>
  );
}
