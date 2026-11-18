import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { clearAll, exportAll, importAll, listSessions } from '../db/repo';

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

type Message = { kind: 'ok' | 'error'; text: string } | null;

interface OfflineStatus {
  supported: boolean;
  controlled: boolean;
  cachedFiles: number;
}

/** 인터넷 없이 열기 위해 이 기기에 저장된 앱 파일 수 (서비스 워커의 미리 저장 캐시) */
async function readOfflineStatus(): Promise<OfflineStatus> {
  if (!('serviceWorker' in navigator) || typeof caches === 'undefined') {
    return { supported: false, controlled: false, cachedFiles: 0 };
  }
  let cachedFiles = 0;
  for (const name of await caches.keys()) {
    if (name.includes('precache')) cachedFiles += (await (await caches.open(name)).keys()).length;
  }
  return { supported: true, controlled: !!navigator.serviceWorker.controller, cachedFiles };
}

export default function Settings() {
  const [count, setCount] = useState<number | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [offline, setOffline] = useState<OfflineStatus | null>(null);

  const refresh = () => void listSessions().then((s) => setCount(s.length));
  useEffect(refresh, []);
  useEffect(() => {
    void readOfflineStatus()
      .then(setOffline)
      .catch(() => setOffline({ supported: false, controlled: false, cachedFiles: 0 }));
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `추리력테스트-백업-${todayStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ kind: 'ok', text: `기록 ${data.sessions.length}회를 백업 파일로 저장했습니다. 폰의 "다운로드" 폴더를 확인하세요.` });
    } catch {
      setMessage({ kind: 'error', text: '백업 파일을 만들지 못했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const doImport = async (file: File) => {
    setBusy(true);
    try {
      const data: unknown = JSON.parse(await file.text());
      const summary = await importAll(data);
      setMessage({ kind: 'ok', text: `백업에서 기록 ${summary.sessions}회를 가져왔습니다.` });
      refresh();
    } catch (e) {
      const text = e instanceof SyntaxError ? '파일을 읽을 수 없습니다. 백업 파일(.json)이 맞는지 확인하세요.' : (e as Error).message;
      setMessage({ kind: 'error', text });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doReset = async () => {
    setConfirmReset(false);
    await clearAll();
    setMessage({ kind: 'ok', text: '모든 기록을 지웠습니다.' });
    refresh();
  };

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-10">
      <Link to="/" className="py-2 text-sm text-neutral-500 underline underline-offset-4">
        ← 홈
      </Link>
      <h1 className="mt-2 text-2xl font-bold">설정</h1>

      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900" data-testid="offline-status">
        <h2 className="text-base font-semibold">오프라인 사용</h2>
        {offline === null ? (
          <p className="mt-1 text-sm text-neutral-500">확인 중…</p>
        ) : offline.cachedFiles > 0 ? (
          <p className="mt-1 text-sm leading-relaxed text-emerald-700 dark:text-emerald-400">
            ✓ 준비됨 — 앱 파일 {offline.cachedFiles}개가 이 기기에 저장되어, 인터넷 없이도(비행기 모드) 열립니다.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
            {offline.supported
              ? '– 아직 준비 안 됨. 인터넷에 연결된 상태로 앱을 닫았다가 다시 한 번 열어 주세요.'
              : '– 이 브라우저는 오프라인 사용을 지원하지 않습니다.'}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900">
        <h2 className="text-base font-semibold">기록 백업</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          기록은 이 기기의 브라우저 안에만 있습니다. 크롬의 사이트 데이터를 지우거나 폰을 바꾸면 사라지므로, 가끔 백업
          파일로 저장해 두세요. {count !== null && `지금 저장된 기록: ${count}회`}
        </p>
        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={doExport}
            disabled={busy}
            className="h-12 rounded-xl bg-neutral-900 font-semibold text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            기록 내보내기 (백업 파일 저장)
          </button>
          <label
            className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 font-semibold dark:border-neutral-700 ${busy ? 'pointer-events-none opacity-50' : ''}`}
          >
            기록 가져오기 (백업 파일 열기)
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              data-testid="import-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void doImport(file);
              }}
            />
          </label>
          <p className="text-xs text-neutral-500">가져오기는 지금 기록을 지우지 않고 백업의 기록을 더합니다.</p>
        </div>
        {message && (
          <p
            role="status"
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              message.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
            }`}
          >
            {message.text}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-neutral-900">
        <h2 className="text-base font-semibold">전체 초기화</h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          모든 시험 기록과 출제 이력을 지웁니다. 지운 뒤에는 예전에 나온 문제가 다시 나올 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="mt-4 h-12 w-full rounded-xl border border-red-300 font-semibold text-red-600 dark:border-red-800"
        >
          모든 기록 지우기
        </button>
      </section>

      {confirmReset && (
        <ConfirmDialog
          title="모든 기록을 지울까요?"
          confirmLabel="지우기"
          cancelLabel="취소"
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        >
          되돌릴 수 없습니다. 필요하면 먼저 "기록 내보내기"로 백업하세요.
        </ConfirmDialog>
      )}
    </main>
  );
}
