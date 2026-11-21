// 局外成长：星星、最好成绩与轻度跨局酒馆传承（VIP 初遇档案 / 菜谱见闻熟练 / 大件图纸折扣）。
import { DIFFICULTIES, LAST_DAY, MEAL_ORDER, type MealId, type TavernUpgradeId } from '../content/data';
import type { RunState } from '../sim/types';

export interface MetaState {
  stars: number;
  bestDay: number;
  runs: number;
  metVips: string[];
  recipeMastery: Partial<Record<MealId, number>>;
  unlockedDecor: TavernUpgradeId[];
}
const KEY = 'wz57.meta';

export function loadMeta(): MetaState {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (m && typeof m.stars === 'number') {
      return {
        stars: m.stars,
        bestDay: m.bestDay ?? 0,
        runs: m.runs ?? 0,
        metVips: Array.isArray(m.metVips) ? m.metVips : [],
        recipeMastery: m.recipeMastery && typeof m.recipeMastery === 'object' ? m.recipeMastery : {},
        unlockedDecor: Array.isArray(m.unlockedDecor) ? m.unlockedDecor : [],
      };
    }
  } catch { /* 读不到就当新玩家 */ }
  return { stars: 0, bestDay: 0, runs: 0, metVips: [], recipeMastery: {}, unlockedDecor: [] };
}
export function saveMeta(m: MetaState) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 存不了不影响玩 */ } }

/** 一局结束时得几颗星：撑过几天 × 难度倍率 */
export const starsEarned = (run: RunState) => {
  const base = run.phase === 'won' ? LAST_DAY : Math.max(0, run.day - 1);
  return Math.round(base * DIFFICULTIES[run.difficulty ?? 'normal'].starMul);
};

/** 合并本局解锁的熟客档案、菜谱见闻与大件装修图纸到局外持久化存档 */
export function recordRunToMeta(meta: MetaState, run: RunState, finishedRun = false): MetaState {
  const metSet = new Set<string>(meta.metVips ?? []);
  for (const vid of run.diner.metVips) metSet.add(vid);

  const mastery: Partial<Record<MealId, number>> = { ...(meta.recipeMastery ?? {}) };
  for (const id of MEAL_ORDER) {
    if (run.diner.researched.includes(id)) {
      const lv = Math.min(3, run.diner.dishLevels[id] ?? 1);
      mastery[id] = Math.max(mastery[id] ?? 0, lv);
    }
  }

  const decorSet = new Set<TavernUpgradeId>(meta.unlockedDecor ?? []);
  for (const up of run.diner.upgrades) decorSet.add(up);

  const gain = finishedRun ? starsEarned(run) : 0;
  return {
    stars: meta.stars + gain,
    bestDay: Math.max(meta.bestDay, finishedRun ? (run.phase === 'won' || run.endless ? Math.max(LAST_DAY, run.day) : run.day - 1) : run.day),
    runs: meta.runs + (finishedRun ? 1 : 0),
    metVips: Array.from(metSet),
    recipeMastery: mastery,
    unlockedDecor: Array.from(decorSet),
  };
}
