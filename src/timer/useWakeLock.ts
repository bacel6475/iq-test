import { useEffect } from 'react';

/**
 * 시험 중 화면이 꺼지지 않게 한다 (Screen Wake Lock API).
 * 지원하지 않는 브라우저에서는 아무것도 하지 않는다.
 * 다른 앱에 갔다 오면 잠금이 풀리므로 화면이 다시 보일 때 다시 요청한다.
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // 배터리 절약 모드 등으로 거절될 수 있다. 시험 진행에는 지장이 없으므로 무시한다.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release();
    };
  }, [enabled]);
}
