import { expect, test } from 'vitest';
import story from '../src/content/legacy/story.json';
import zombies from '../src/content/legacy/zombies.json';
import weapons from '../src/content/legacy/weapons.json';
import rest from '../src/content/legacy/restaurant.json';

// 剧情和内容表是从旧版原样抽出来的，数量不能少
test('旧版的剧情和内容表都搬过来了', () => {
  expect(JSON.stringify(story).match(/"text"/g)!.length).toBeGreaterThanOrEqual(103);
  expect(Object.keys(story.NPC_CHARACTERS).length).toBe(10);
  expect(story.BOSS_INTROS.length).toBe(3);
  expect(zombies.ZOMBIE_DEX.length).toBe(12);
  expect(weapons.WEAPONS.length).toBe(16);
  expect(rest.RECIPES.length).toBe(7);
  expect(rest.VIP_CUSTOMERS.length).toBe(15);
});
