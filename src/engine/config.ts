import type { EngineConfig } from './types';

/** 暫定値は rules_spec.md どおり。回答が来たらここだけ変える。 */
export const DEFAULT_CONFIG: EngineConfig = {
  wrongEndsQuestion: true,
  maxQuestions: null,
  sdMaxOffset: 1,
  autoAdvance: true,
  r2InitialHolder: false,
  r2BonusKeepsHolder: false,
  r2WrongByHolderClears: true,
  r2WrongByOthersClears: false,
  r2ThroughClears: false,
  sevenBySevenWin: 'product',
  sevenBySevenTarget: 49,
  sfAllowNegative: true,
  sfLateAnswer: true,
  exrCapacity: 12,
  exrDirectAdvanceMax: 2,
  courseCapacity: 10,
};

export function mergeConfig(c?: Partial<EngineConfig>): EngineConfig {
  return { ...DEFAULT_CONFIG, ...(c ?? {}) };
}
