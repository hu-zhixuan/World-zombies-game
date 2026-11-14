// 剧情脚本、角色台词、战友羁绊与深夜食堂 15 位 VIP 档案：文案承接旧版（src/content/legacy/）。
import legacyRest from './legacy/restaurant.json';
import legacyStory from './legacy/story.json';

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
const clean = (s: string) => s.replace(EMOJI_RE, '').trim();

export type NpcId = 'ming' | 'zhang' | 'lin' | 'qiang' | 'zhao' | 'radio' | 'boss1' | 'boss2' | 'boss3' | 'heli';
export type AllyId = 'zhang' | 'lin' | 'qiang' | 'zhao';
export type VipTierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface SpeakerMeta {
  id: string;
  name: string;
  initial: string;
  desc: string;
  avatar: string;
}

const AVATARS: Record<string, string> = {
  ming: 'hero_idle',
  zhang: 'npc_bearded',
  lin: 'npc_woman',
  qiang: 'npc_hat',
  zhao: 'npc_oldman',
  boss1: 'boss_beast',
  boss2: 'boss_beast',
  boss3: 'boss_demon',
  radio: 'radio',
  heli: 'heli',
};

export const SPEAKERS: Record<string, SpeakerMeta> = Object.fromEntries(
  Object.entries(legacyStory.NPC_CHARACTERS).map(([id, c]) => [
    id,
    { id, name: c.name, initial: c.initial, desc: c.desc, avatar: AVATARS[id] ?? 'npc_hat' },
  ]),
);

export interface StoryLine {
  npc: string;
  name: string;
  initial: string;
  role: string;
  avatar: string;
  text: string;
}

function mapLines(
  arr: readonly { npc?: string; speaker?: string; text: string }[],
  override?: { vipId?: string; vipName?: string; vipAvatar?: string; adapt?: boolean },
): StoryLine[] {
  return arr.map((raw) => {
    const npcKey = raw.npc ?? '';
    if (npcKey && SPEAKERS[npcKey]) {
      const sp = SPEAKERS[npcKey];
      const text = override?.adapt ? raw.text.replace('给我废铁和金币，', '只要金币到位，') : raw.text;
      return { npc: npcKey, name: sp.name, initial: sp.initial, role: sp.desc, avatar: sp.avatar, text: clean(text) };
    }
    const label = raw.speaker || override?.vipName || '旅人';
    return {
      npc: override?.vipId ?? 'vip',
      name: label,
      initial: label[0] ?? '客',
      role: '酒馆来客',
      avatar: override?.vipAvatar ?? 'npc_hat',
      text: clean(raw.text),
    };
  });
}

// ── 主线剧情：序幕、序章前情、四章总览、15 波对白、战友加入、Boss 出场与退场 ──
export const CINEMATIC_INTRO: StoryLine[] = mapLines(legacyStory.CINEMATIC_INTRO);

export interface StorySceneCard { chapter: string; title: string; text: string }
export const STORY_SCENES: StorySceneCard[] = legacyStory.STORY_SCENES.map((s) => ({
  chapter: clean(s.chapter),
  title: clean(s.title),
  text: clean(s.text),
}));

export interface ChapterCard { chapter: string; title: string; sub: string; text: string; minDay: number; maxDay: number }
const CHAPTER_RANGES: [number, number][] = [[1, 4], [5, 9], [10, 14], [15, 15]];
export const CHAPTER_CARDS: ChapterCard[] = legacyStory.CHAPTER_CARDS.map((c, idx) => ({
  chapter: clean(c.chapter),
  title: clean(c.title),
  sub: clean(c.sub),
  text: clean(c.text),
  minDay: CHAPTER_RANGES[idx]?.[0] ?? 1,
  maxDay: CHAPTER_RANGES[idx]?.[1] ?? 15,
}));

export const WAVE_STORY_LINES: Record<number, StoryLine[]> = {
  ...Object.fromEntries(Object.entries(legacyStory.WAVE_DIALOGUES).map(([d, ls]) => [Number(d), mapLines(ls)])),
  ...Object.fromEntries(Object.entries(legacyStory.WAVE_DIALOGUES_LATE).map(([d, ls]) => [Number(d), mapLines(ls)])),
};

export const COMPANION_JOIN_STORIES: Record<number, { ally: AllyId; lines: StoryLine[] }> = {
  2: { ally: 'zhang', lines: mapLines(legacyStory.NPC_JOIN_DIALOGUES['2']) },
  4: { ally: 'lin', lines: mapLines(legacyStory.NPC_JOIN_DIALOGUES['4']) },
  6: { ally: 'qiang', lines: mapLines(legacyStory.NPC_JOIN_DIALOGUES['6'], { adapt: true }) },
  8: { ally: 'zhao', lines: mapLines(legacyStory.NPC_JOIN_DIALOGUES['8']) },
};

export const BOSS_INTROS: StoryLine[][] = legacyStory.BOSS_INTROS.map((b) => mapLines(b.lines));
export const BOSS_VICTORY: StoryLine[][] = legacyStory.BOSS_VICTORY_DIALOGUES.map((b) => mapLines(b.lines));

export type RestStoryKey = 'firstOpen' | 'rep10' | 'rep25' | 'rep40';
export const REST_STORY: Record<RestStoryKey, { title: string; lines: StoryLine[] }> = {
  firstOpen: { title: '深夜食堂 · 初开张', lines: mapLines(legacyStory.REST_STORY_EVENTS.firstOpen) },
  rep10: { title: '街头口碑 · 老兵赞许', lines: mapLines(legacyStory.REST_STORY_EVENTS.rep10) },
  rep25: { title: '废土密探 · 美食评论家', lines: mapLines(legacyStory.REST_STORY_EVENTS.rep25) },
  rep40: { title: '全网热议 · 打卡新地标', lines: mapLines(legacyStory.REST_STORY_EVENTS.rep40) },
};

export interface AllyDef {
  id: AllyId;
  joinDay: 2 | 4 | 6 | 8;
  name: string;
  role: string;
  initial: string;
  sprite: string;
  buffDesc: string;
}

export const ALLIES: Record<AllyId, AllyDef> = {
  zhang: { id: 'zhang', joinDay: 2, name: '老兵张', role: '前特战老兵', initial: '张', sprite: 'npc_bearded', buffDesc: '全武器伤害 +10%' },
  lin: { id: 'lin', joinDay: 4, name: '护士小林', role: '战地医护', initial: '林', sprite: 'npc_woman', buffDesc: '每夜额外恢复 +18 生命' },
  qiang: { id: 'qiang', joinDay: 6, name: '工程师阿强', role: '结构焊工', initial: '强', sprite: 'npc_hat', buffDesc: '墙与大屋耐久 +50 · 造/升塔 -10% 金' },
  zhao: { id: 'zhao', joinDay: 8, name: '通信兵小赵', role: '军方电台手', initial: '赵', sprite: 'npc_oldman', buffDesc: '食堂增粉 +30% · 锁定撤离频道' },
};
export const ALLY_ORDER: AllyId[] = ['zhang', 'lin', 'qiang', 'zhao'];

// ── 深夜食堂：VIP 阶级、15 位 VIP 档案、每日热搜、社媒与声望评级 ──
const SCALED_VIP_FANS: Record<string, number> = {
  agou: 0,
  laobao: 0,
  qijie: 0,
  niqiu: 45,
  gaolaotou: 90,
  guying: 140,
  huanyin: 200,
  tongshu: 280,
  dashan: 360,
  baishi: 450,
  jinlaoban: 560,
  wumingke: 680,
  yanlao: 820,
  kuangya: 980,
  guancezhe: 1150,
};

const VIP_SPRITE: Record<string, string> = {
  agou: 'npc_hat',
  laobao: 'npc_bearded',
  qijie: 'npc_woman',
  niqiu: 'npc_oldman',
  gaolaotou: 'npc_oldman',
  guying: 'npc_bearded',
  huanyin: 'npc_woman',
  tongshu: 'npc_bearded',
  dashan: 'npc_bearded',
  baishi: 'npc_oldman',
  jinlaoban: 'npc_woman',
  wumingke: 'npc_hat',
  yanlao: 'npc_oldman',
  kuangya: 'npc_bearded',
  guancezhe: 'npc_hat',
};

const TIER_FANS: Record<VipTierId, number> = {
  bronze: 0,
  silver: 45,
  gold: 200,
  platinum: 450,
  diamond: 820,
};

export interface VipTierMeta { id: VipTierId; name: string; label: string; minFans: number }
export const VIP_TIERS: Record<VipTierId, VipTierMeta> = Object.fromEntries(
  Object.entries(legacyRest.VIP_TIERS).map(([id, t]) => [
    id,
    { id: id as VipTierId, name: clean(t.name), label: clean(t.label), minFans: TIER_FANS[id as VipTierId] ?? 0 },
  ]),
) as Record<VipTierId, VipTierMeta>;

export interface VipDef {
  id: string;
  name: string;
  tier: VipTierId;
  unlockFans: number;
  sprite: string;
  personality: string;
  personalityDesc: string;
  bg: string;
  tipBonus: number;
  weight: number;
  preferredDishPref: string;
  firstMeet: StoryLine[];
  reactions: Record<'legendary' | 'perfect' | 'good' | 'poor', string>;
}

export const VIP_CUSTOMERS: VipDef[] = legacyRest.VIP_CUSTOMERS.map((v) => {
  const sprite = VIP_SPRITE[v.id] ?? 'npc_hat';
  return {
    id: v.id,
    name: clean(v.name),
    tier: v.tier as VipTierId,
    unlockFans: SCALED_VIP_FANS[v.id] ?? 0,
    sprite,
    personality: clean(v.personality),
    personalityDesc: clean(v.personalityDesc),
    bg: clean(v.bg),
    tipBonus: Math.min(2.2, 0.8 + (v.tipBonus ?? 1) * 0.25),
    weight: v.weight ?? 6,
    preferredDishPref: v.preferredDishPref ?? 'any',
    firstMeet: mapLines(v.firstMeet, { vipId: v.id, vipName: clean(v.name.split('·').pop() ?? v.name), vipAvatar: sprite }),
    reactions: {
      legendary: clean(v.reactions.legendary),
      perfect: clean(v.reactions.perfect),
      good: clean(v.reactions.good),
      poor: clean(v.reactions.poor),
    },
  };
});

export interface FansRankDef { grade: string; name: string; minFans: number; unlock: string }
export const FANS_RANKS: FansRankDef[] = [
  { grade: 'E', name: '据点小灶', minFans: 0, unlock: '开启深夜食堂堂食与青铜熟客' },
  { grade: 'D', name: '废土网红摊', minFans: 60, unlock: '吸引白银级江湖客来访' },
  { grade: 'C', name: '据点名厨馆', minFans: 180, unlock: '解锁黄金级特邀常客' },
  { grade: 'B', name: '避难所星厨', minFans: 400, unlock: '全城名人闻香打卡' },
  { grade: 'A', name: '废土米其林', minFans: 700, unlock: '解锁铂金势力人物' },
  { grade: 'S', name: '末世传奇食堂', minFans: 1000, unlock: '吸引传说人物与全图鉴朝圣' },
];

export function getFansRank(fans: number) {
  let cur = FANS_RANKS[0];
  let next: FansRankDef | null = FANS_RANKS[1];
  for (let i = 0; i < FANS_RANKS.length; i++) {
    if (fans >= FANS_RANKS[i].minFans) {
      cur = FANS_RANKS[i];
      next = FANS_RANKS[i + 1] ?? null;
    }
  }
  return { cur, next };
}

export interface RepTierDef { name: string; minRep: number; bonusMul: number; desc: string }
export const REP_TIERS: RepTierDef[] = [
  { name: '门可罗雀', minRep: -999, bonusMul: 0, desc: '刚挂上招牌，只有熟面孔上门' },
  { name: '初闻烟火', minRep: 0, bonusMul: 0, desc: '一锅热肉香飘出半条街' },
  { name: '废土名店', minRep: 10, bonusMul: 0.1, desc: '口碑渐起，食客打赏 +10%' },
  { name: '据点食堂', minRep: 25, bonusMul: 0.2, desc: '夜夜满座，食客打赏 +20%' },
  { name: '末日米其林', minRep: 40, bonusMul: 0.35, desc: '废土传奇名馆，食客打赏 +35%' },
];

export function getRepTier(rep: number): RepTierDef {
  let cur = REP_TIERS[0];
  for (const t of REP_TIERS) if (rep >= t.minRep) cur = t;
  return cur;
}

export interface TrendDef { id: string; tag: string; title: string; desc: string; unlockDay: number }
export const DAILY_TRENDS: TrendDef[] = [
  { id: 'spicy_night', tag: '辣', title: '#深夜就想吃重口味#', desc: '【辣】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 1 },
  { id: 'homestyle', tag: '家常', title: '#想念家的味道，来点家常的#', desc: '【家常】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 1 },
  { id: 'tender', tag: '鲜嫩', title: '#嫩一点，暖汤炖肉最治愈#', desc: '【鲜嫩】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 2 },
  { id: 'hearty', tag: '饱腹', title: '#大口吃肉，饱腹才守得住防线#', desc: '【饱腹】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 2 },
  { id: 'protein', tag: '高蛋白', title: '#战前高蛋白特餐打卡#', desc: '【高蛋白】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 3 },
  { id: 'smoky', tag: '烟熏', title: '#铁板碳烤，烟熏焦香夜宵#', desc: '【烟熏】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 3 },
  { id: 'exotic', tag: '异变', title: '#异变美食挑战，据点网红都在问#', desc: '【异变】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 5 },
];

export const QUALITY_META = {
  poor: { label: '一般', payMul: 0.9, buffMul: 0.9, fans: 6, rep: 1 },
  good: { label: '不错', payMul: 1.1, buffMul: 1.0, fans: 10, rep: 2 },
  perfect: { label: '完美', payMul: 1.38, buffMul: 1.15, fans: 15, rep: 3 },
  legendary: { label: '传说', payMul: 1.7, buffMul: 1.3, fans: 22, rep: 5 },
} as const;
export type DishQuality = keyof typeof QUALITY_META;

export const DINER_REVIEW_POOL: Record<DishQuality, readonly string[]> = {
  legendary: [
    '救命！这是什么神仙料理！吃完直接想流泪。',
    '我愿意用三个月的罐头换老板这一口火候。',
    '老板你是不是战前米其林主厨？据点之光实至名归！',
    '这味道让我想起了和平年代的街角夜宵摊。',
  ],
  perfect: [
    '手艺扎实、火候刚到点，明天守城又有力气了！',
    '分量足味道稳，据点里数一数二的良心食堂。',
    '比昨晚还香！朋友们明天一起翻墙过来吃。',
    '老板用心了，这一口肉排能回味到天亮。',
  ],
  good: [
    '热乎的肉香下肚，浑身寒气散了一大半。',
    '中规中矩又实在，比外面啃冷压缩饼干强太多。',
    '踏踏实实一顿热饭，守完下一波再来光顾。',
    '火候还行，下次试试老板拿手特餐。',
  ],
  poor: [
    '肉火候略急了点，但末世能吃上热的已经知足。',
    '今天手抖偏生了些，老板多练两锅肯定更绝。',
    '味道稍淡，但填饱肚子完全顶用。',
  ],
};
