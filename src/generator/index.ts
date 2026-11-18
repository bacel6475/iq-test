import { generateAttributeItem } from './attributeFamily';
import { generateLogicItem } from './logicFamily';
import type { AttributeItemSpec, Family, ItemSpec, Level, LogicItemSpec } from './types';

/**
 * 문항 하나를 만든다. 같은 (seed, targetLevel, family)이면 항상 같은 문항이 나온다.
 * 논리 계열은 레벨 2·3만 있다.
 */
export function generateItem(seed: number, targetLevel: Level, family?: 'attribute'): AttributeItemSpec;
export function generateItem(seed: number, targetLevel: Level, family: 'logic'): LogicItemSpec;
export function generateItem(seed: number, targetLevel: Level, family: Family): ItemSpec;
export function generateItem(seed: number, targetLevel: Level, family: Family = 'attribute'): ItemSpec {
  return family === 'logic' ? generateLogicItem(seed, targetLevel) : generateAttributeItem(seed, targetLevel);
}

export * from './types';
export { solveAttribute, solveLogic, solveItem } from './solver';
export { itemSignature, cellKey, comboKey } from './signature';
export { difficultyScore, levelOfScore, LOGIC_LEVELS, OP_WEIGHT } from './difficulty';
export { applyOp } from './logicOps';
export { describeRules } from './explain';
