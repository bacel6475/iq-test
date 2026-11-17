import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  addTimeSpent,
  finishSession,
  getSession,
  updateResponse,
  type ResponseState,
  type SessionStatus,
  type TestSession,
} from '../db/repo';
import { CellView } from '../render/Cell';
import { Matrix } from '../render/Matrix';
import { formatClock } from '../scoring';
import { useCountdown } from '../timer/useCountdown';
import { useWakeLock } from '../timer/useWakeLock';

const FIVE_MINUTES = 5 * 60_000;
const ONE_MINUTE = 60_000;

function timerColor(ms: number): string {
  if (ms <= ONE_MINUTE) return 'text-red-600 dark:text-red-500';
  if (ms <= FIVE_MINUTES) return 'text-orange-500';
  return '';
}

/** 문항 목록 패널의 번호 칸 모양: 응답함(채움) / 미응답(점선) / 다시 보기(주황 테두리 + 깃발) */
function navCellClass(r: ResponseState, current: boolean): string {
  const base = 'relative flex h-12 items-center justify-center rounded-lg text-base font-semibold tabular-nums';
  const state =
    r.selected !== null
      ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900'
      : 'border-2 border-dashed border-neutral-400 text-neutral-500 dark:border-neutral-600';
  const flag = r.flagged ? ' ring-3 ring-orange-500 ring-offset-1 dark:ring-offset-neutral-900' : '';
  const here = current ? ' outline-3 outline-offset-2 outline-blue-600' : '';
  return `${base} ${state}${flag}${here}`;
}

export default function Test() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<TestSession | null | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const finishingRef = useRef(false);
  /** 현재 문항에 머문 시간을 저장소에 반영하는 함수 (문항을 옮길 때마다 바뀜) */
  const flushTimeRef = useRef<() => Promise<void>>(async () => {});

  // 세션 불러오기. 이미 끝난 시험이면 결과 화면으로 보낸다.
  useEffect(() => {
    let alive = true;
    void getSession(sessionId).then((s) => {
      if (!alive) return;
      if (s && s.status !== 'active') navigate(`/result/${s.id}`, { replace: true });
      else setSession(s ?? null);
    });
    return () => {
      alive = false;
    };
  }, [sessionId, navigate]);

  const loaded = !!session;

  // 문항별 소요 시간 기록. 화면이 꺼지거나 다른 앱으로 간 동안은 세지 않는다.
  useEffect(() => {
    if (!loaded) return;
    const itemIndex = index;
    let enteredAt: number | null = document.visibilityState === 'visible' ? Date.now() : null;

    const flush = async () => {
      if (enteredAt === null) return;
      const spent = Date.now() - enteredAt;
      enteredAt = null;
      if (spent > 0) await addTimeSpent(sessionId, itemIndex, spent);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
      else enteredAt = Date.now();
    };
    flushTimeRef.current = async () => {
      await flush();
      if (document.visibilityState === 'visible') enteredAt = Date.now();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void flush();
    };
  }, [loaded, sessionId, index]);

  const finish = useCallback(
    async (status: Exclude<SessionStatus, 'active'>) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      await flushTimeRef.current();
      await finishSession(sessionId, status);
      navigate(`/result/${sessionId}`, { replace: true });
    },
    [sessionId, navigate],
  );

  const timed = session?.mode === 'timed';
  const remaining = useCountdown(timed ? session.endAt : null, () => void finish('expired'));
  useWakeLock(loaded);

  // 시험 중 뒤로 가기 등으로 화면을 떠나려 하면 확인 창을 띄운다.
  const blocker = useBlocker(
    ({ nextLocation }) => loaded && !finishingRef.current && !nextLocation.pathname.startsWith('/result/'),
  );

  const total = session?.items.length ?? 0;
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  const patchResponse = useCallback(
    (itemIndex: number, patch: Partial<Pick<ResponseState, 'selected' | 'flagged'>>) => {
      setSession((s) =>
        s ? { ...s, responses: s.responses.map((r, i) => (i === itemIndex ? { ...r, ...patch } : r)) } : s,
      );
      // 답을 고를 때마다 바로 저장한다.
      void updateResponse(sessionId, itemIndex, patch);
    },
    [sessionId],
  );

  const dialogOpen = listOpen || confirmSubmit || blocker.state === 'blocked';

  // PC 키보드: ←/→ 이동, 1~8 보기 선택, F 다시 보기
  useEffect(() => {
    if (!loaded || dialogOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (/^[1-8]$/.test(e.key)) patchResponse(index, { selected: Number(e.key) - 1 });
      else if (e.key === 'f' || e.key === 'F') {
        patchResponse(index, { flagged: !session?.responses[index].flagged });
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loaded, dialogOpen, index, goTo, patchResponse, session]);

  if (session === undefined) {
    return <p className="p-8 text-center text-neutral-500">불러오는 중…</p>;
  }
  if (session === null) {
    return (
      <div className="p-8 text-center">
        <p>시험을 찾을 수 없습니다.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 h-12 px-4 underline">
          홈으로
        </button>
      </div>
    );
  }

  const item = session.items[index];
  const response = session.responses[index];
  const unanswered = session.responses.filter((r) => r.selected === null).length;
  const flaggedCount = session.responses.filter((r) => r.flagged).length;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* 상단 고정 바 */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <div className="min-w-0 flex-1">
          {timed && remaining !== null ? (
            <span
              role="timer"
              aria-label="남은 시간"
              className={`font-mono text-3xl font-bold tabular-nums ${timerColor(remaining)}`}
            >
              {formatClock(remaining)}
            </span>
          ) : (
            <span className="text-lg font-semibold text-neutral-500">연습</span>
          )}
        </div>
        <span className="text-lg font-semibold tabular-nums" aria-label="현재 문항">
          {index + 1}
          <span className="text-neutral-400"> / {total}</span>
        </span>
        <div className="flex flex-1 justify-end">
          <button
            type="button"
            onClick={() => setConfirmSubmit(true)}
            className="h-11 rounded-xl bg-neutral-900 px-5 font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            제출
          </button>
        </div>
      </header>

      {/* 문제 영역 */}
      <main className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="test-stage">
          <Matrix key={index} cells={item.cells} className="test-matrix" />
          <div className="test-options" role="radiogroup" aria-label="보기">
            {item.options.map((option, i) => {
              const selected = response.selected === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`보기 ${i + 1}`}
                  onClick={() => patchResponse(index, { selected: i })}
                  className={`relative aspect-square bg-white ${
                    selected ? 'outline-[5px] outline-blue-600' : 'outline-1 outline-neutral-400'
                  }`}
                >
                  <CellView cell={option} className="h-full w-full" />
                  <span
                    className={`absolute top-0.5 left-1 text-xs font-semibold ${selected ? 'text-blue-700' : 'text-neutral-400'}`}
                  >
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* 하단 바 */}
      <footer className="grid h-16 shrink-0 grid-cols-4 gap-2 border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-xl border border-neutral-300 font-semibold disabled:opacity-30 dark:border-neutral-700"
        >
          ← 이전
        </button>
        <button
          type="button"
          aria-pressed={response.flagged}
          onClick={() => patchResponse(index, { flagged: !response.flagged })}
          className={`rounded-xl border text-sm font-semibold ${
            response.flagged
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
        >
          {response.flagged ? '⚑ 다시 보기' : '⚐ 다시 보기'}
        </button>
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="rounded-xl border border-neutral-300 text-sm font-semibold dark:border-neutral-700"
        >
          목록
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className="rounded-xl bg-neutral-900 font-semibold text-white disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900"
        >
          다음 →
        </button>
      </footer>

      {/* 문항 목록 패널 */}
      {listOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setListOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="문항 목록"
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 text-neutral-900 sm:rounded-2xl dark:bg-neutral-900 dark:text-neutral-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">문항 목록</h2>
              <button type="button" onClick={() => setListOpen(false)} className="h-11 px-3 text-sm underline">
                닫기
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span>■ 응답함 {total - unanswered}</span>
              <span>⬚ 미응답 {unanswered}</span>
              <span className="text-orange-600">⚑ 다시 보기 {flaggedCount}</span>
            </div>
            <ol className="mt-4 grid grid-cols-6 gap-2">
              {session.responses.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    aria-label={`${i + 1}번 문항${r.selected === null ? ' 미응답' : ' 응답함'}${r.flagged ? ' 다시 보기' : ''}`}
                    aria-current={i === index ? 'step' : undefined}
                    onClick={() => {
                      setIndex(i);
                      setListOpen(false);
                    }}
                    className={`w-full ${navCellClass(r, i === index)}`}
                  >
                    {i + 1}
                    {r.flagged && <span className="absolute -top-1.5 -right-1 text-sm text-orange-500">⚑</span>}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <ConfirmDialog
          title="제출할까요?"
          confirmLabel="제출"
          cancelLabel="계속 풀기"
          onConfirm={() => {
            setConfirmSubmit(false);
            void finish('submitted');
          }}
          onCancel={() => setConfirmSubmit(false)}
        >
          {unanswered > 0 ? (
            <>
              아직 답하지 않은 문항이 <strong className="text-red-600">{unanswered}개</strong> 있습니다. 제출하면 답을 고칠
              수 없습니다.
            </>
          ) : (
            '모든 문항에 답했습니다. 제출하면 답을 고칠 수 없습니다.'
          )}
        </ConfirmDialog>
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="시험 화면을 떠날까요?"
          confirmLabel="떠나기"
          cancelLabel="계속 풀기"
          danger
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        >
          {timed ? '시험을 떠나도 시간은 계속 흐릅니다. 홈 화면에서 이어서 풀 수 있습니다.' : '홈 화면에서 이어서 풀 수 있습니다.'}
        </ConfirmDialog>
      )}
    </div>
  );
}
