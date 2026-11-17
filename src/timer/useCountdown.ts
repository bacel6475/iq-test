import { useEffect, useRef, useState } from 'react';

const TICK_MS = 250;

/**
 * 남은 시간(ms)을 돌려준다. endAt이 null이면 null (타이머 없음).
 *
 * 1초씩 빼는 방식은 화면이 꺼지거나 탭이 숨겨지면 어긋나므로,
 * 250ms마다 그리고 화면이 다시 보일 때마다 `endAt − 지금`을 새로 계산한다.
 * 0이 되면 onExpire를 한 번만 부른다.
 */
export function useCountdown(endAt: number | null, onExpire: () => void): number | null {
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  const firedRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    firedRef.current = false;
    if (endAt === null) return;

    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const timer = setInterval(tick, TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [endAt]);

  return endAt === null ? null : Math.max(0, endAt - now);
}
