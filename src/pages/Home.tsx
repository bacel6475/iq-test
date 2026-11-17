import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getActiveSession, listSessions, type TestSession } from '../db/repo';
import { getPreset } from '../presets';
import { formatClock } from '../scoring';

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Home() {
  const [active, setActive] = useState<TestSession | undefined>();
  const [recent, setRecent] = useState<TestSession[]>([]);

  useEffect(() => {
    void getActiveSession().then(setActive);
    void listSessions().then((all) => setRecent(all.filter((s) => s.status !== 'active').slice(0, 3)));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-16 pb-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">추리력 테스트</h1>
        <p className="mt-3 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
          시험을 볼 때마다 새로 만들어지는 도형 행렬 문제로 추리력을 연습합니다.
        </p>
      </header>

      {active && (
        <section className="mt-8 rounded-2xl border border-amber-400 bg-amber-50 p-5 dark:border-amber-600 dark:bg-amber-950/40">
          <p className="font-semibold">진행 중인 시험이 있습니다</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            {getPreset(active.presetId).name} ·{' '}
            {active.endAt !== null ? `남은 시간 약 ${formatClock(active.endAt - Date.now())}` : '연습'}
          </p>
          <Link
            to={`/test/${active.id}`}
            className="mt-4 flex h-12 items-center justify-center rounded-xl bg-amber-500 font-semibold text-white"
          >
            이어서 풀기
          </Link>
        </section>
      )}

      <section className="mt-8">
        <Link
          to="/setup"
          className="flex h-14 w-full items-center justify-center rounded-xl bg-neutral-900 text-lg font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          시험 시작
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-500">최근 기록</h2>
        {recent.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            아직 본 시험이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/result/${s.id}`}
                  className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-900"
                >
                  <span>
                    <span className="block font-semibold">
                      {getPreset(s.presetId).name}
                      {s.mode === 'practice' && <span className="ml-1 text-sm font-normal text-neutral-500">(연습)</span>}
                    </span>
                    <span className="block text-sm text-neutral-500">{formatDate(s.startedAt)}</span>
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {s.rawScore} / {s.items.length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-auto pt-10 text-center text-xs leading-relaxed text-neutral-400 dark:text-neutral-600">
        <p>이 앱의 점수는 공인 IQ가 아니며 본인 기록 간 비교용입니다.</p>
        <Link to="/dev/gallery" className="mt-3 inline-block px-3 py-3 underline underline-offset-4">
          개발용 문항 갤러리
        </Link>
      </footer>
    </main>
  );
}
