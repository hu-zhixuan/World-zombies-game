// 局外成长：星星和最好成绩。独立于单局，存在另一个键下，重开一局不动它。
import { LAST_DAY } from '../content/data';
import type { RunState } from '../sim/types';

export interface MetaState { stars: number; bestDay: number; runs: number }
const KEY = 'wz57.meta';

export function loadMeta(): MetaState {
  try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); if (m && typeof m.stars === 'number') return { stars: m.stars, bestDay: m.bestDay ?? 0, runs: m.runs ?? 0 }; } catch { /* 读不到就当新玩家 */ }
  return { stars: 0, bestDay: 0, runs: 0 };
}
export function saveMeta(m: MetaState) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* 存不了不影响玩 */ } }

/** 一局结束时得几颗星：撑过几天就几颗 */
export const starsEarned = (run: RunState) => (run.phase === 'won' ? LAST_DAY : Math.max(0, run.day - 1));
