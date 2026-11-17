import type { ItemSpec } from './generator/types';

export interface ScorableResponse {
  selected: number | null;
}

/** 문항별 정답 여부(미응답은 오답)와 원점수(정답 수)를 계산한다. */
export function scoreResponses(
  items: readonly ItemSpec[],
  responses: readonly ScorableResponse[],
): { correct: boolean[]; rawScore: number } {
  const correct = items.map((item, i) => responses[i]?.selected === item.answerIndex);
  return { correct, rawScore: correct.filter(Boolean).length };
}

/** 남은 시간을 mm:ss로. 남은 초는 올림해서 0:00이 되는 순간이 실제 종료와 맞게 한다. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 소요 시간을 "12분 5초"처럼 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}
