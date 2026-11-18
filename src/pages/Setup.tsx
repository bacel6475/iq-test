import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  createSession,
  expireOverdueSessions,
  finishSession,
  getActiveSession,
  getUsedSignatures,
  type SessionMode,
  type SessionRow,
} from '../db/repo';
import { assembleTest } from '../generator/assemble';
import { CUSTOM_LIMITS, PRESETS, type Preset, type PresetId } from '../presets';

/** 시험지마다 다른 시드. (생성기 안이 아니므로 브라우저의 난수를 써도 된다.) */
function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function Stepper({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-base">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} 줄이기`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}
          className="h-12 w-12 rounded-xl border border-neutral-300 text-xl disabled:opacity-30 dark:border-neutral-700"
        >
          −
        </button>
        <span className="w-16 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value}
          {unit}
        </span>
        <button
          type="button"
          aria-label={`${label} 늘리기`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}
          className="h-12 w-12 rounded-xl border border-neutral-300 text-xl disabled:opacity-30 dark:border-neutral-700"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const [presetId, setPresetId] = useState<PresetId>('standard-60');
  const [mode, setMode] = useState<SessionMode>('timed');
  const [customCount, setCustomCount] = useState(20);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [active, setActive] = useState<SessionRow | undefined>();
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void expireOverdueSessions()
      .then(getActiveSession)
      .then(setActive);
  }, []);

  const preset = PRESETS.find((p) => p.id === presetId) as Preset;
  const itemCount = presetId === 'custom' ? customCount : preset.itemCount;
  const minutes = presetId === 'custom' ? customMinutes : preset.minutes;

  const start = async () => {
    setStarting(true);
    setError(null);
    // 버튼이 "준비 중"으로 바뀌는 것을 먼저 보여 준 뒤 문항을 만든다.
    await new Promise((resolve) => setTimeout(resolve, 0));
    try {
      // 예전에 한 번이라도 출제된 문항은 다시 내지 않는다.
      const used = await getUsedSignatures();
      const items = assembleTest({
        seed: freshSeed(),
        count: itemCount,
        levelRange: preset.levelRange,
        isUsed: (signature) => used.has(signature),
      });
      const session = await createSession({ presetId, mode, items, minutes });
      navigate(`/test/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '문항을 만들지 못했습니다.');
      setStarting(false);
    }
  };

  const abandon = async () => {
    if (active) await finishSession(active.id, 'submitted');
    setActive(undefined);
    setConfirmAbandon(false);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-6 pb-8">
      <Link to="/" className="self-start py-2 text-sm text-neutral-500 underline underline-offset-4">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">시험 설정</h1>

      {active ? (
        <section className="mt-6 rounded-2xl border border-amber-400 bg-amber-50 p-5 dark:border-amber-600 dark:bg-amber-950/40">
          <p className="font-semibold">진행 중인 시험이 있습니다.</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
            새 시험을 보려면 먼저 그 시험을 이어서 풀거나 끝내야 합니다.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setConfirmAbandon(true)}
              className="h-12 rounded-xl border border-neutral-300 font-semibold dark:border-neutral-700"
            >
              그 시험 끝내기
            </button>
            <Link
              to={`/test/${active.id}`}
              className="flex h-12 items-center justify-center rounded-xl bg-neutral-900 font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              이어서 풀기
            </Link>
          </div>
        </section>
      ) : (
        <>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-neutral-500">시험 종류</legend>
            <div className="mt-2 space-y-2">
              {PRESETS.map((p) => {
                const selected = p.id === presetId;
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${
                      selected
                        ? 'border-neutral-900 bg-white ring-2 ring-neutral-900 dark:border-neutral-100 dark:bg-neutral-900 dark:ring-neutral-100'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="preset"
                      value={p.id}
                      checked={selected}
                      onChange={() => setPresetId(p.id)}
                      className="h-5 w-5 accent-neutral-900"
                    />
                    <span className="flex-1">
                      <span className="block text-base font-semibold">{p.name}</span>
                      <span className="block text-sm text-neutral-500">{p.description}</span>
                    </span>
                    {p.id !== 'custom' && (
                      <span className="text-right text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                        {p.itemCount}문항
                        <br />
                        {p.minutes}분
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {presetId === 'custom' && (
            <section className="mt-4 space-y-3 rounded-2xl border border-neutral-300 p-4 dark:border-neutral-700">
              <Stepper label="문항 수" unit="개" value={customCount} {...CUSTOM_LIMITS.itemCount} onChange={setCustomCount} />
              <Stepper label="제한 시간" unit="분" value={customMinutes} {...CUSTOM_LIMITS.minutes} onChange={setCustomMinutes} />
            </section>
          )}

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-neutral-500">진행 방식</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-neutral-200 p-1 dark:bg-neutral-800">
              {(
                [
                  ['timed', '시험 (시간 제한)'],
                  ['practice', '연습 (시간 무제한)'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex h-12 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ${
                    mode === value ? 'bg-white shadow dark:bg-neutral-950' : 'text-neutral-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <section className="mt-6 rounded-2xl bg-neutral-100 p-4 text-sm leading-relaxed text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">안내</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>3×3 그림의 규칙을 찾아, 오른쪽 아래 빈칸에 들어갈 그림을 보기 8개 중에서 고르세요.</li>
              <li>문제는 쉬운 것부터 점점 어려워집니다. 다른 문항으로 오가며 답을 고칠 수 있습니다.</li>
              {mode === 'timed' ? (
                <>
                  <li>
                    제한 시간은 <strong>{minutes}분</strong>, 문항은 <strong>{itemCount}개</strong>입니다.
                  </li>
                  <li>
                    <strong>일시정지가 없습니다.</strong> 앱을 닫아도 시간은 흐르고, 시간이 다 되면 자동으로 제출됩니다.
                  </li>
                </>
              ) : (
                <li>연습은 시간 제한이 없으며, 기록에는 연습으로 표시됩니다.</li>
              )}
              <li>정답 여부는 제출한 뒤에 보여 드립니다.</li>
            </ul>
          </section>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="mt-6 h-14 w-full rounded-xl bg-neutral-900 text-lg font-semibold text-white disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {starting ? '문항 준비 중…' : mode === 'timed' ? '시험 시작' : '연습 시작'}
          </button>
        </>
      )}

      {confirmAbandon && (
        <ConfirmDialog
          title="진행 중인 시험을 끝낼까요?"
          confirmLabel="끝내기"
          cancelLabel="취소"
          danger
          onConfirm={abandon}
          onCancel={() => setConfirmAbandon(false)}
        >
          지금까지 고른 답으로 채점하고 기록에 남깁니다.
        </ConfirmDialog>
      )}
    </main>
  );
}
