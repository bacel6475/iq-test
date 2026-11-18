import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { TrendChart } from '../components/charts';
import { expireOverdueSessions, listSessions, type SessionMode, type SessionRow } from '../db/repo';
import { getPreset, PRESETS, type PresetId } from '../presets';
import { formatDate, trendPoints } from '../stats';

export default function History() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [presetId, setPresetId] = useState<PresetId>('standard-60');
  const [mode, setMode] = useState<SessionMode>('timed');

  useEffect(() => {
    let alive = true;
    void expireOverdueSessions()
      .then(listSessions)
      .then((all) => {
        if (!alive) return;
        const finished = all.filter((s) => s.status !== 'active');
        setSessions(finished);
        // 가장 최근에 본 시험 종류를 기본으로 보여 준다.
        if (finished[0]) {
          setPresetId(finished[0].presetId as PresetId);
          setMode(finished[0].mode);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (sessions === null) return <p className="p-8 text-center text-neutral-500">불러오는 중…</p>;

  const filtered = sessions.filter((s) => s.presetId === presetId && s.mode === mode);
  const points = trendPoints(sessions, presetId, mode);
  const best = filtered.reduce<number | null>(
    (m, s) => Math.max(m ?? 0, (s.rawScore ?? 0) / Math.max(1, s.itemIds.length)),
    null,
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <Link to="/" className="py-2 text-sm text-neutral-500 underline underline-offset-4">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">기록</h1>

      {/* 필터는 그래프 위 한 줄에 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="preset-filter">
          시험 종류
        </label>
        <select
          id="preset-filter"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value as PresetId)}
          className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex rounded-xl bg-neutral-200 p-1 dark:bg-neutral-800" role="group" aria-label="진행 방식">
          {(
            [
              ['timed', '시험'],
              ['practice', '연습'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`h-9 rounded-lg px-4 text-sm font-semibold ${
                mode === value ? 'bg-white shadow dark:bg-neutral-950' : 'text-neutral-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">정답률 추세</h2>
          {best !== null && (
            <span className="text-sm text-neutral-500">
              {filtered.length}회 · 최고 {Math.round(best * 100)}%
            </span>
          )}
        </div>
        <div className="mt-3">
          <TrendChart points={points} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500">전체 기록 {sessions.length}회</h2>
        {sessions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            아직 본 시험이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="history-list">
            {sessions.map((s) => {
              const total = s.itemIds.length;
              const pct = Math.round(((s.rawScore ?? 0) / Math.max(1, total)) * 100);
              return (
                <li key={s.id}>
                  <Link
                    to={`/result/${s.id}`}
                    className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm dark:bg-neutral-900"
                  >
                    <span>
                      <span className="block font-semibold">
                        {getPreset(s.presetId).name}
                        {s.mode === 'practice' && <span className="ml-1 text-sm font-normal text-neutral-500">(연습)</span>}
                        {s.status === 'expired' && <span className="ml-1 text-sm font-normal text-neutral-500">· 시간 종료</span>}
                      </span>
                      <span className="block text-sm text-neutral-500">{formatDate(s.startedAt)}</span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="block text-lg font-semibold">
                        {s.rawScore} / {total}
                      </span>
                      <span className="block text-sm text-neutral-500">{pct}%</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-neutral-500">
        이 점수는 공인 IQ가 아니며 본인 기록 간 비교용입니다.
      </p>
    </main>
  );
}
