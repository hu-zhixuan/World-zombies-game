// 把旧版里的剧情和内容表原样抽成 JSON（src/content/legacy/）。文本一个字不改，只换载体。
// 做法：在 node 里把旧版整包跑起来（沿用旧测试的假 DOM），再把常量序列化出来。
// 用法：node tools/extract_content.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const LEGACY = path.join(__dirname, '..', 'legacy');
const OUT = path.join(__dirname, '..', 'src', 'content', 'legacy');

const boot = fs.readFileSync(path.join(LEGACY, 'test_suite.js'), 'utf8').split('let testsPassed')[0];
const context = new Function('require', '__dirname', 'console', boot + '\nreturn context;')(
  (m) => require(m.startsWith('.') ? path.join(LEGACY, m) : m), LEGACY, { log() {}, error: console.error });

const TABLES = {
  story: ['NPC_CHARACTERS', 'CINEMATIC_INTRO', 'STORY_SCENES', 'WAVE_DIALOGUES', 'WAVE_DIALOGUES_LATE', 'NPC_JOIN_DIALOGUES',
    'BOSS_INTROS', 'BOSS_VICTORY_DIALOGUES', 'CHAPTER_CARDS', 'ENV_NARRATIONS', 'REST_STORY_EVENTS'],
  zombies: ['ZOMBIE_DEX', 'BOSS_TYPES'],
  weapons: ['WEAPONS', 'WEAPON_RARITY'],
  perks: ['PERKS'],
  restaurant: ['RECIPES', 'CUSTOMER_TYPES', 'VIP_TIERS', 'VIP_CUSTOMERS'],
  classes: ['START_CLASSES'],
};
fs.mkdirSync(OUT, { recursive: true });
for (const [file, names] of Object.entries(TABLES)) {
  const data = {};
  for (const n of names) data[n] = JSON.parse(vm.runInContext(`JSON.stringify(${n})`, context));
  fs.writeFileSync(path.join(OUT, file + '.json'), JSON.stringify(data, null, 1) + '\n');
  console.log(file + '.json', names.map((n) => n + ':' + (Array.isArray(data[n]) ? data[n].length : Object.keys(data[n]).length)).join(' '));
}
