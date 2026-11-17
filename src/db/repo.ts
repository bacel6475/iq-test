import type { ItemSpec } from '../generator/types';
import { scoreResponses } from '../scoring';

// 시험 세션 저장소.
// M2: 메모리에만 저장한다 (새로고침하면 사라짐).
// M3: 같은 함수 이름을 유지한 채 내부를 Dexie(IndexedDB)로 바꾼다. 그래서 모든 함수가 Promise를 돌려준다.

export type SessionMode = 'timed' | 'practice';
export type SessionStatus = 'active' | 'submitted' | 'expired';

export interface ResponseState {
  itemIndex: number;
  selected: number | null;
  flagged: boolean;
  timeSpentMs: number;
  isCorrect: boolean | null;
}

export interface TestSession {
  id: string;
  presetId: string;
  mode: SessionMode;
  items: ItemSpec[];
  startedAt: number;
  /** timed 모드의 종료 시각 (epoch ms). practice는 null */
  endAt: number | null;
  submittedAt: number | null;
  status: SessionStatus;
  rawScore: number | null;
  responses: ResponseState[];
}

const sessions = new Map<string, TestSession>();

/** DB처럼 바깥에서 고쳐도 저장본이 바뀌지 않게 복사본을 돌려준다. */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function newId(): string {
  return crypto.randomUUID();
}

export interface CreateSessionInput {
  presetId: string;
  mode: SessionMode;
  items: ItemSpec[];
  minutes: number;
  now?: number;
}

export async function createSession({ presetId, mode, items, minutes, now = Date.now() }: CreateSessionInput) {
  const session: TestSession = {
    id: newId(),
    presetId,
    mode,
    items,
    startedAt: now,
    endAt: mode === 'timed' ? now + minutes * 60_000 : null,
    submittedAt: null,
    status: 'active',
    rawScore: null,
    responses: items.map((_, itemIndex) => ({
      itemIndex,
      selected: null,
      flagged: false,
      timeSpentMs: 0,
      isCorrect: null,
    })),
  };
  sessions.set(session.id, session);
  return clone(session);
}

export async function getSession(id: string): Promise<TestSession | undefined> {
  const session = sessions.get(id);
  return session && clone(session);
}

export async function updateResponse(
  id: string,
  itemIndex: number,
  patch: Partial<Pick<ResponseState, 'selected' | 'flagged'>>,
): Promise<void> {
  const session = sessions.get(id);
  if (!session || session.status !== 'active') return;
  Object.assign(session.responses[itemIndex], patch);
}

export async function addTimeSpent(id: string, itemIndex: number, ms: number): Promise<void> {
  const session = sessions.get(id);
  if (!session || session.status !== 'active') return;
  session.responses[itemIndex].timeSpentMs += ms;
}

/** 채점하고 세션을 끝낸다. 이미 끝난 세션이면 그대로 돌려준다. */
export async function finishSession(
  id: string,
  status: Exclude<SessionStatus, 'active'>,
  now = Date.now(),
): Promise<TestSession | undefined> {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (session.status === 'active') {
    const { correct, rawScore } = scoreResponses(session.items, session.responses);
    session.responses.forEach((r, i) => (r.isCorrect = correct[i]));
    session.rawScore = rawScore;
    session.status = status;
    // 시간이 다 되어 끝났으면 종료 시각을 제출 시각으로 본다.
    session.submittedAt = status === 'expired' && session.endAt !== null ? Math.min(now, session.endAt) : now;
  }
  return clone(session);
}

export async function getActiveSession(): Promise<TestSession | undefined> {
  const active = [...sessions.values()].filter((s) => s.status === 'active');
  active.sort((a, b) => b.startedAt - a.startedAt);
  return active[0] && clone(active[0]);
}

/** 최근 시작한 순서 */
export async function listSessions(): Promise<TestSession[]> {
  return [...sessions.values()].sort((a, b) => b.startedAt - a.startedAt).map(clone);
}

/** 테스트 전용: 저장소 비우기 */
export async function clearAll(): Promise<void> {
  sessions.clear();
}
