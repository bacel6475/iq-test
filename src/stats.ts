import type { LevelStat, TrendPoint } from './components/charts';
import type { ResponseState, SessionRow, TestSession } from './db/repo';

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 레벨별 정답 수 (그 시험에 나온 레벨만) */
export function levelStats(session: TestSession): LevelStat[] {
  const map = new Map<number, LevelStat>();
  session.items.forEach((item, i) => {
    const stat = map.get(item.level) ?? { level: item.level, correct: 0, total: 0 };
    stat.total++;
    if (session.responses[i]?.isCorrect) stat.correct++;
    map.set(item.level, stat);
  });
  return [...map.values()].sort((a, b) => a.level - b.level);
}

export function itemResult(r: ResponseState): 'correct' | 'wrong' | 'blank' {
  if (r.selected === null) return 'blank';
  return r.isCorrect ? 'correct' : 'wrong';
}

/** 같은 시험 종류·같은 진행 방식(시험/연습)으로 끝낸 기록의 정답률, 오래된 순 */
export function trendPoints(sessions: SessionRow[], presetId: string, mode: SessionRow['mode']): TrendPoint[] {
  return sessions
    .filter((s) => s.presetId === presetId && s.mode === mode && s.status !== 'active' && s.rawScore !== null)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({
      id: s.id,
      ratio: (s.rawScore ?? 0) / Math.max(1, s.itemIds.length),
      label: `${formatDate(s.startedAt)} · ${s.rawScore}/${s.itemIds.length}`,
    }));
}
