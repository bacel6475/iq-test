import type { Level } from './generator/types';

// 시험 프리셋. 문항 수와 제한 시간은 널리 쓰이는 행렬 추리 검사 형식을 참고했지만,
// 화면에는 실제 검사의 이름을 쓰지 않는다 (CLAUDE.md 규칙 3).
//  - standard-60: 표준형 행렬 검사 형식 참고
//  - advanced-36: 고급형 행렬 검사 형식 참고 (난이도를 레벨 2~5로 올림)
//  - quick-35   : 온라인 단축형 형식 참고

export type PresetId = 'standard-60' | 'advanced-36' | 'quick-35' | 'custom';

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  itemCount: number;
  minutes: number;
  levelRange: readonly [Level, Level];
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'standard-60',
    name: '표준형',
    description: '쉬운 문제부터 어려운 문제까지 고르게',
    itemCount: 60,
    minutes: 40,
    levelRange: [1, 5],
  },
  {
    id: 'advanced-36',
    name: '고급형',
    description: '중간 난이도부터 시작하는 어려운 구성',
    itemCount: 36,
    minutes: 40,
    levelRange: [2, 5],
  },
  {
    id: 'quick-35',
    name: '단축형',
    description: '짧은 시간 안에 빠르게',
    itemCount: 35,
    minutes: 25,
    levelRange: [1, 5],
  },
  {
    id: 'custom',
    name: '사용자 지정',
    description: '문항 수와 시간을 직접 정하기',
    itemCount: 20,
    minutes: 15,
    levelRange: [1, 5],
  },
];

export const CUSTOM_LIMITS = {
  itemCount: { min: 10, max: 60, step: 5 },
  minutes: { min: 5, max: 60, step: 5 },
} as const;

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
