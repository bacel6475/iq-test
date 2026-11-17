import { generateAttributeItem } from './attributeFamily';
import type { Family, ItemSpec, Level } from './types';

/**
 * 문항 하나를 만든다. 같은 (seed, targetLevel, family)이면 항상 같은 문항이 나온다.
 * 논리 계열(logic)은 M4에서 추가한다.
 */
export function generateItem(seed: number, targetLevel: Level, family: Family = 'attribute'): ItemSpec {
  if (family === 'logic') throw new Error('논리 계열 생성기는 아직 없습니다 (M4).');
  return generateAttributeItem(seed, targetLevel);
}

export * from './types';
export { solveAttribute } from './solver';
export { itemSignature, cellKey, comboKey } from './signature';
export { difficultyScore, levelOfScore } from './difficulty';
export { describeRules } from './explain';
