import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getSession, type TestSession } from '../db/repo';
import { getPreset } from '../presets';
import { formatDuration } from '../scoring';

// M2: 원점수와 기본 정보만 보여 준다. 레벨별 정답률·문항별 복기·추세 그래프는 M3에서 추가한다.

export default function Result() {
  const { sessionId = '' } = useParams();
  const [session, setSession] = useState<TestSession | null | undefined>(undefined);

  useEffect(() => {
    void getSession(sessionId).then((s) => setSession(s ?? null));
  }, [sessionId]);

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
  const preset = getPreset(session.presetId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-10 pb-8">
      <p className="text-sm text-neutral-500">
        {preset.name} · {session.mode === 'practice' ? '연습' : '시험'}
        {session.status === 'expired' && ' · 시간 종료로 자동 제출'}
      </p>
      <h1 className="mt-1 text-2xl font-bold">결과</h1>

      <section className="mt-6 rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-neutral-900">
        <p className="text-sm text-neutral-500">원점수</p>
        <p className="mt-1 text-5xl font-bold tabular-nums" data-testid="raw-score">
          {session.rawScore}
          <span className="text-2xl text-neutral-400"> / {total}</span>
        </p>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
          <dt className="text-sm text-neutral-500">미응답</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{unanswered}개</dd>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-neutral-900">
          <dt className="text-sm text-neutral-500">걸린 시간</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatDuration(used)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-center text-sm text-neutral-500">
        레벨별 정답률과 문항별 해설은 다음 단계에서 추가됩니다.
      </p>

      <Link
        to="/"
        className="mt-8 flex h-14 items-center justify-center rounded-xl bg-neutral-900 text-lg font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        홈으로
      </Link>

      <p className="mt-auto pt-10 text-center text-xs leading-relaxed text-neutral-500">
        이 점수는 공인 IQ가 아니며 본인 기록 간 비교용입니다.
      </p>
    </main>
  );
}
