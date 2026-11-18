import { itemSignature } from '../generator/signature';
import type { ItemSpec } from '../generator/types';
import { scoreResponses } from '../scoring';
import {
  db,
  type ItemRow,
  type ResponseRow,
  type SessionMode,
  type SessionRow,
  type SessionStatus,
  type SettingRow,
} from './schema';

// 시험 세션 저장소. 화면은 이 파일의 함수만 부르고, DB(Dexie)를 직접 만지지 않는다.

export type { SessionMode, SessionStatus, SessionRow };

export type ResponseState = Omit<ResponseRow, 'sessionId' | 'itemId'>;

/** 화면에서 쓰는 세션: 세션 정보 + 문항 명세 + 응답을 합친 것 */
export interface TestSession extends SessionRow {
  items: ItemSpec[];
  responses: ResponseState[];
}

function newId(): string {
  return crypto.randomUUID();
}

/** 한 번이라도 시험지에 들어간 문항의 서명 전체. 새 시험지를 만들 때 대조한다. */
export async function getUsedSignatures(): Promise<Set<string>> {
  const keys = await db.items.orderBy('signature').uniqueKeys();
  return new Set(keys as string[]);
}

export interface CreateSessionInput {
  presetId: string;
  mode: SessionMode;
  items: ItemSpec[];
  minutes: number;
  now?: number;
}

/** 시험지를 저장하고 세션을 시작한다. 문항은 이 순간 영구 기록되어 다시 출제되지 않는다. */
export async function createSession({
  presetId,
  mode,
  items,
  minutes,
  now = Date.now(),
}: CreateSessionInput): Promise<TestSession> {
  const itemRows: ItemRow[] = items.map((spec) => ({
    id: newId(),
    signature: itemSignature(spec),
    family: spec.family,
    level: spec.level,
    spec,
    generatorVersion: spec.generatorVersion,
    createdAt: now,
  }));
  const session: SessionRow = {
    id: newId(),
    presetId,
    mode,
    itemIds: itemRows.map((r) => r.id),
    startedAt: now,
    endAt: mode === 'timed' ? now + minutes * 60_000 : null,
    submittedAt: null,
    status: 'active',
    rawScore: null,
    currentIndex: 0,
  };
  const responses: ResponseRow[] = itemRows.map((row, itemIndex) => ({
    sessionId: session.id,
    itemIndex,
    itemId: row.id,
    selected: null,
    flagged: false,
    timeSpentMs: 0,
    isCorrect: null,
  }));

  await db.transaction('rw', db.items, db.sessions, db.responses, async () => {
    await db.items.bulkAdd(itemRows);
    await db.sessions.add(session);
    await db.responses.bulkAdd(responses);
  });
  return { ...session, items, responses: responses.map(stripResponse) };
}

function stripResponse({ sessionId: _s, itemId: _i, ...rest }: ResponseRow): ResponseState {
  return rest;
}

export async function getSession(id: string): Promise<TestSession | undefined> {
  return db.transaction('r', db.items, db.sessions, db.responses, async () => {
    const session = await db.sessions.get(id);
    if (!session) return undefined;
    const itemRows = await db.items.bulkGet(session.itemIds);
    const responses = await db.responses.where('sessionId').equals(id).sortBy('itemIndex');
    const items = itemRows.map((row, i) => {
      if (!row) throw new Error(`문항 기록이 없습니다: ${session.itemIds[i]}`);
      return row.spec;
    });
    return { ...session, items, responses: responses.map(stripResponse) };
  });
}

/** 답·다시 보기 표시를 바로 저장한다. 끝난 시험은 바꾸지 않는다. */
export async function updateResponse(
  id: string,
  itemIndex: number,
  patch: Partial<Pick<ResponseState, 'selected' | 'flagged'>>,
): Promise<void> {
  await db.transaction('rw', db.sessions, db.responses, async () => {
    const session = await db.sessions.get(id);
    if (session?.status !== 'active') return;
    await db.responses.update([id, itemIndex], patch);
  });
}

export async function addTimeSpent(id: string, itemIndex: number, ms: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.responses, async () => {
    const session = await db.sessions.get(id);
    if (session?.status !== 'active') return;
    await db.responses
      .where('[sessionId+itemIndex]')
      .equals([id, itemIndex])
      .modify((r) => {
        r.timeSpentMs += ms;
      });
  });
}

export async function setCurrentIndex(id: string, index: number): Promise<void> {
  await db.sessions.update(id, { currentIndex: index });
}

/** 채점하고 세션을 끝낸다. 이미 끝난 세션이면 그대로 돌려준다. */
export async function finishSession(
  id: string,
  status: Exclude<SessionStatus, 'active'>,
  now = Date.now(),
): Promise<TestSession | undefined> {
  await db.transaction('rw', db.items, db.sessions, db.responses, async () => {
    const session = await db.sessions.get(id);
    if (!session || session.status !== 'active') return;
    const itemRows = await db.items.bulkGet(session.itemIds);
    const responses = await db.responses.where('sessionId').equals(id).sortBy('itemIndex');
    const items = itemRows.map((row) => row!.spec);
    const { correct, rawScore } = scoreResponses(items, responses);

    await db.responses.bulkPut(responses.map((r, i) => ({ ...r, isCorrect: correct[i] })));
    await db.sessions.update(id, {
      status,
      rawScore,
      // 시간이 다 되어 끝났으면 종료 시각을 제출 시각으로 본다.
      submittedAt: status === 'expired' && session.endAt !== null ? Math.min(now, session.endAt) : now,
    });
  });
  return getSession(id);
}

/**
 * 앱을 열 때 부른다. 진행 중이던 시험 중 시간이 이미 지난 것은
 * 그때까지 저장된 답으로 채점하고 'expired'로 기록한다.
 */
export async function expireOverdueSessions(now = Date.now()): Promise<void> {
  const active = await db.sessions.where('status').equals('active').toArray();
  for (const s of active) {
    if (s.endAt !== null && s.endAt <= now) await finishSession(s.id, 'expired', now);
  }
}

/** 진행 중인 시험 (가장 최근 것) */
export async function getActiveSession(): Promise<SessionRow | undefined> {
  const active = await db.sessions.where('status').equals('active').sortBy('startedAt');
  return active[active.length - 1];
}

/** 끝난 시험을 포함한 전체 세션, 최근 시작한 순서 (문항 내용은 불러오지 않음) */
export async function listSessions(): Promise<SessionRow[]> {
  const all = await db.sessions.orderBy('startedAt').toArray();
  return all.reverse();
}

/** 테스트 전용: 모든 기록 지우기 */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.items, db.sessions, db.responses, db.settings, async () => {
    await Promise.all([db.items.clear(), db.sessions.clear(), db.responses.clear(), db.settings.clear()]);
  });
}

/* ---------------- 백업: 내보내기·가져오기 ---------------- */

export const BACKUP_FORMAT = 'iq-test-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  items: ItemRow[];
  sessions: SessionRow[];
  responses: ResponseRow[];
  settings: SettingRow[];
}

/** 모든 기록을 한 파일(JSON)에 담을 수 있는 형태로 꺼낸다. */
export async function exportAll(now = Date.now()): Promise<BackupFile> {
  return db.transaction('r', db.items, db.sessions, db.responses, db.settings, async () => ({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    items: await db.items.toArray(),
    sessions: await db.sessions.toArray(),
    responses: await db.responses.toArray(),
    settings: await db.settings.toArray(),
  }));
}

export interface ImportSummary {
  sessions: number;
  items: number;
}

/**
 * 백업 파일을 읽어 기존 기록에 합친다. 같은 기록(같은 id)은 백업 내용으로 덮어쓴다.
 * 형식이 맞지 않으면 아무것도 바꾸지 않고 오류를 낸다.
 */
export async function importAll(data: unknown): Promise<ImportSummary> {
  const backup = data as Partial<BackupFile> | null;
  if (!backup || backup.format !== BACKUP_FORMAT) {
    throw new Error('이 앱에서 내보낸 백업 파일이 아닙니다.');
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new Error('더 새로운 버전의 앱에서 만든 백업입니다. 앱을 업데이트한 뒤 다시 시도하세요.');
  }
  const { items, sessions, responses, settings = [] } = backup;
  if (!Array.isArray(items) || !Array.isArray(sessions) || !Array.isArray(responses) || !Array.isArray(settings)) {
    throw new Error('백업 파일의 내용이 손상되었습니다.');
  }
  const itemIds = new Set(items.map((i) => i.id));
  const broken = sessions.some(
    (s) => typeof s?.id !== 'string' || !Array.isArray(s.itemIds) || s.itemIds.some((id) => !itemIds.has(id)),
  );
  if (broken || items.some((i) => typeof i?.signature !== 'string' || !i.spec)) {
    throw new Error('백업 파일의 내용이 손상되었습니다.');
  }

  await db.transaction('rw', db.items, db.sessions, db.responses, db.settings, async () => {
    await db.items.bulkPut(items);
    await db.sessions.bulkPut(sessions);
    await db.responses.bulkPut(responses);
    await db.settings.bulkPut(settings);
  });
  return { sessions: sessions.length, items: items.length };
}
