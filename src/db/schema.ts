import Dexie, { type EntityTable, type Table } from 'dexie';
import type { Family, ItemSpec, Level } from '../generator/types';

// 브라우저 안의 데이터베이스(IndexedDB) 구조. Dexie는 IndexedDB를 쉽게 쓰게 해 주는 도구다.

/** 문항: 재현 가능한 전체 명세를 JSON으로 저장 (이미지는 저장하지 않음) */
export interface ItemRow {
  id: string;
  /** 중복 판별용 서명. 인덱스 */
  signature: string;
  family: Family;
  level: Level;
  spec: ItemSpec;
  /** 생성기 로직이 바뀌면 +1 */
  generatorVersion: number;
  createdAt: number;
}

export type SessionMode = 'timed' | 'practice';
export type SessionStatus = 'active' | 'submitted' | 'expired';

export interface SessionRow {
  id: string;
  presetId: string;
  mode: SessionMode;
  /** 출제 순서 */
  itemIds: string[];
  startedAt: number;
  /** timed 모드의 종료 시각 (epoch ms). practice는 null */
  endAt: number | null;
  submittedAt: number | null;
  status: SessionStatus;
  rawScore: number | null;
  /** 마지막으로 보던 문항 번호 (새로고침 후 그 문항에서 이어 가기 위함. PLAN.md에 추가한 필드) */
  currentIndex?: number;
}

export interface ResponseRow {
  /** [sessionId+itemIndex] 복합 키 */
  sessionId: string;
  itemIndex: number;
  itemId: string;
  /** 0~7, 미응답은 null */
  selected: number | null;
  /** "나중에 다시 보기" */
  flagged: boolean;
  /** 해당 문항 화면에 머문 누적 시간 */
  timeSpentMs: number;
  isCorrect: boolean | null;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  items!: EntityTable<ItemRow, 'id'>;
  sessions!: EntityTable<SessionRow, 'id'>;
  responses!: Table<ResponseRow, [string, number]>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'iq-test') {
    super(name);
    // 첫 칸은 기본 키, 나머지는 검색용 인덱스. 구조를 바꿀 때는 version(2)를 새로 추가한다.
    this.version(1).stores({
      items: 'id, signature, level, createdAt',
      sessions: 'id, presetId, status, startedAt',
      responses: '[sessionId+itemIndex], sessionId, itemId',
      settings: 'key',
    });
  }
}

export const db = new AppDB();
