// 剧情脚本、角色台词、战友羁绊与深夜食堂 15 位 VIP 档案：100% 契合「暮色酒馆要塞 × 深夜食堂 × 15波尸潮」世界观。
import legacyRest from './legacy/restaurant.json';

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
const clean = (s: string) =>
  s
    .replace(EMOJI_RE, '')
    .replace(/Wastegram粉丝暴涨\+15/g, '当晚食客慕名暴涨 +15 粉')
    .replace(/废品改造狂/g, '机巧匠师')
    .replace(/疯批学者/g, '狂想医者')
    .replace(/破壁人·观测者/g, '夜幕先知·观测者')
    .replace(/废土电台主播/g, '短波主播')
    .replace(/义体化狂人/g, '发条械身')
    .replace(/外面的废铁质量/g, '镇外铁铺锻的生铁质量')
    .replace(/卖的废铁/g, '贩的劣铁')
    .replace(/卖废铁的/g, '贩劣铁的')
    .replace(/坦克炮管/g, '重炮炮管')
    .replace(/开军工厂/g, '开军械工坊')
    .replace(/微波炉/g, '旧烤炉')
    .replace(/酸液史莱姆/g, '腐爪腐尸')
    .replace(/进口子弹/g, '稀罕银弹')
    .replace(/避难所的水管/g, '镇西水塔的送水闸')
    .replace(/你避难所的水/g, '镇西酒馆的水')
    .replace(/半个避难所/g, '半条街的口粮')
    .replace(/避难所里/g, '后厢地窖里')
    .replace(/避难所的小孩/g, '镇里的孩子们')
    .replace(/避难所米其林|废土米其林/g, '长夜名馆')
    .replace(/避难点/g, '栖身屋')
    .replace(/仿生胃/g, '发条铁胃')
    .replace(/电子合成音/g, '金属颤音')
    .replace(/伺服电机/g, '铜制齿轮')
    .replace(/发射洗脑电波/g, '暗藏迷魂阵法')
    .replace(/高维生物的阴谋！他们用病毒削弱人类意志，好方便殖民！/g, '黑雾教团的阴谋！他们散播尸疫动摇人心，好霸占暮色镇！')
    .replace(/摄像头/g, '窃听眼')
    .replace(/那是灯泡。/g, '那是普通煤油灯。')
    .replace(/发表论文/g, '写进秘药手札')
    .replace(/全餐厅/g, '全酒馆')
    .replace(/满餐厅/g, '满酒馆')
    .replace(/整餐厅/g, '整间酒馆')
    .replace(/这餐厅/g, '这酒馆')
    .replace(/你的餐厅/g, '你的小酒馆')
    .replace(/都市传说般的存在/g, '长夜传说般的存在')
    .replace(/有头有脸的人物打卡/g, '有头有脸的常客寻味')
    .replace(/第二波就出装甲尸/g, '第四波就撞见焦骨巨尸')
    .trim();

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

export const SPEAKERS: Record<string, SpeakerMeta> = {
  ming:  { id: 'ming',  name: '莫老板',   initial: '莫', desc: '暮色酒馆守夜人兼掌勺', avatar: 'hero_idle' },
  zhang: { id: 'zhang', name: '老兵张',   initial: '张', desc: '退伍神枪手 · 屋顶瞭望', avatar: 'npc_bearded' },
  lin:   { id: 'lin',   name: '护士小林', initial: '林', desc: '战地医护 · 伤员照料',   avatar: 'npc_woman' },
  qiang: { id: 'qiang', name: '铁匠阿强', initial: '强', desc: '锻造与炮塔技师',       avatar: 'npc_hat' },
  zhao:  { id: 'zhao',  name: '电台小赵', initial: '赵', desc: '短波通信兵 · 救援频道', avatar: 'npc_oldman' },
  boss1: { id: 'boss1', name: '地狱巨兽·暴君', initial: '暴', desc: '第5天首领 · 拆墙狂兽', avatar: 'boss_beast' },
  boss2: { id: 'boss2', name: '血月暴君·狂怒领主', initial: '怒', desc: '第10天首领 · 烈焰督军', avatar: 'boss_beast' },
  boss3: { id: 'boss3', name: '深渊魔王·尸皇', initial: '皇', desc: '第15天终极首领', avatar: 'boss_demon' },
  radio: { id: 'radio', name: '短波电台', initial: '电', desc: '联合救援频道 142.8MHz', avatar: 'radio' },
  heli:  { id: 'heli',  name: '黎明运输机', initial: '机', desc: '北部撤离编队', avatar: 'heli' },
};

export interface StoryLine {
  npc: string;
  name: string;
  initial: string;
  role: string;
  avatar: string;
  text: string;
}

const line = (npc: string, text: string): StoryLine => {
  const sp = SPEAKERS[npc] ?? { id: npc, name: '旅人', initial: '客', desc: '镇民', avatar: 'npc_hat' };
  return { npc: sp.id, name: sp.name, initial: sp.initial, role: sp.desc, avatar: sp.avatar, text: clean(text) };
};

function mapGuestLines(
  arr: readonly { npc?: string; speaker?: string; text: string }[],
  override: { vipId: string; vipName: string; vipAvatar: string },
): StoryLine[] {
  return arr.map((raw) => {
    const npcKey = raw.npc ?? '';
    if (npcKey && SPEAKERS[npcKey]) {
      const sp = SPEAKERS[npcKey];
      return { npc: npcKey, name: sp.name, initial: sp.initial, role: sp.desc, avatar: sp.avatar, text: clean(raw.text) };
    }
    const label = raw.speaker || override.vipName || '来客';
    return {
      npc: override.vipId,
      name: clean(label),
      initial: label[0] ?? '客',
      role: '深夜食客',
      avatar: override.vipAvatar,
      text: clean(raw.text),
    };
  });
}

// ── 开场序幕：完全贴合暮色酒馆要塞 × 屋顶猎手 × 深夜食堂 ──
export const CINEMATIC_INTRO: StoryLine[] = [
  line('ming', '暮色彻底沉下来了。镇口路灯只剩这几盏还亮着，门前的木石路障刚重新钉紧。'),
  line('ming', '踏着大门旁的木挑台就能跃上二楼屋顶——居高临下既能借矮墙躲开地面的扑咬，还能多打出几成狠劲。'),
  line('radio', '滋……这里是北部联合救援频道。撤离运输编队将在十五轮尸潮后掠过暮色镇上空，请沿路灯烟火坚持十五夜！'),
  line('ming', '十五夜……屋顶上已经架好第一座机枪哨塔，屋里砖窑炉火也一直温着。'),
  line('ming', '白天守在屋顶打退尸潮、捡回鲜肉与金币；入夜进堂开灶喂饱过路生还者、修墙买枪——这间小酒馆绝不熄灯！'),
];

export interface StorySceneCard { chapter: string; title: string; text: string }
export const STORY_SCENES: StorySceneCard[] = [
  {
    chapter: '前情一',
    title: '暮色酒馆防线',
    text: '灾变席卷老街后，镇西两层木石酒馆凭厚实砖墙和屋顶高台成了唯一能守的据点。前院立起木石路障与四座炮塔基座，踏上木挑台再跃屋顶，便能俯射整条长街。',
  },
  {
    chapter: '前情二',
    title: '不熄的砖窑灶火',
    text: '只要退回屋里，红砖烤炉的余温总能把战场带回的兽肉煎得滋滋冒香。拾荒者、夜巡老兵与江湖怪客循香而来，一碗热肉汤既换来金币与口碑，也为明天的守城注满底气。',
  },
  {
    chapter: '前情三',
    title: '十五夜之约',
    text: '屋顶天线的短波电台传来倒计时：十五波腐潮之后，黎明救援机群会降落镇东。第 5、10、15 夜更有深渊首领叩关——集结四位战友、升满堡垒火炮，活到天亮。',
  },
];

export interface ChapterCard { chapter: string; title: string; sub: string; text: string; minDay: number; maxDay: number }
export const CHAPTER_CARDS: ChapterCard[] = [
  {
    chapter: '第一章',
    title: '暮色初围',
    sub: '第 1～4 天',
    text: '游荡腐尸率先沿着暗紫长街涌来，第 2 天噬魂黑猫突袭、第 3 天地狱猎犬成群狂奔、第 4 天铁甲般的焦骨巨尸撞门——尽早升级兵器、修好壁垒并站稳屋顶！',
    minDay: 1,
    maxDay: 4,
  },
  {
    chapter: '第二章',
    title: '暴君叩关',
    sub: '第 5～9 天',
    text: '第 5 天首领「地狱巨兽·暴君」携火球与兽群碾压防线；第 6 天会飘在半空吐幽火的「提灯怨灵」登场。老兵张、护士小林、铁匠阿强与小赵也将在此期间陆续入伙！',
    minDay: 5,
    maxDay: 9,
  },
  {
    chapter: '第三章',
    title: '血月死斗',
    sub: '第 10～14 天',
    text: '第 10 天狂怒领主二度逼近酒馆。此时正是改建石堡、架设屋顶双联火炮与冰冻/电弧/重炮联动的高潮，别忘了在食堂给大伙留一顿终章硬菜。',
    minDay: 10,
    maxDay: 14,
  },
  {
    chapter: '终章',
    title: '深渊黎明',
    sub: '第 15 天',
    text: '终极首领「深渊魔王·尸皇」亲率黑潮压境。守住这最后一夜的屋顶与高墙，击溃魔王便能听见天边螺旋桨的轰鸣！',
    minDay: 15,
    maxDay: 15,
  },
];

// ── 第 1～15 波战前/战后节奏精准对齐（无任何冲突设定）──
export const WAVE_STORY_LINES: Record<number, StoryLine[]> = {
  1: [
    line('ming', '第 1 夜。先试试手中手枪的点射节奏，别浪费屋顶矮墙的高低差优势。'),
    line('ming', '路障撑不住时就花金币修一修，掉在院里的武器箱清完怪顺手下去捡回来。'),
  ],
  2: [
    line('ming', '雾里蹿出来不少黑影……第 2 夜会有速度飞快的噬魂黑猫贴地突进！'),
    line('ming', '站高一点能躲开它们的扑咬，要是攒够金币，可以考虑换把左轮或霰弹了。'),
  ],
  3: [
    line('ming', '第 3 夜！巷尾传出成群嚎叫——地狱猎犬顺着街灯冲过来了！'),
    line('ming', '高射速加特林或冰暴步枪最克制疯跑的狗群，路障别忘了盯紧血线。'),
  ],
  4: [
    line('ming', '地面在震……第 4 夜会出现浑身焦黑的重甲大块头「焦骨巨尸」，硬啃路障很疼。'),
    line('ming', '明天就是第 5 夜大关，今晚食堂多招待几位客人把钱和特餐备足！'),
  ],
  5: [
    line('ming', '红雾压过房檐了——第 5 天首领「地狱巨兽·暴君」就在这波尸潮里！'),
    line('ming', '站稳二楼屋顶能借墙垛挡掉不少火球伤害，大群扑壁垒时毫不犹豫甩颗手雷过去！'),
  ],
  6: [
    line('ming', '第 6 夜刚过第一道关口，半空又飘出青光——「提灯怨灵」会隔着墙抛幽火打屋顶！'),
    line('ming', '注意看它抬手时的火球弧线，按一下闪避就能潇洒滑步躲开。'),
  ],
  7: [
    line('ming', '第 7 夜，战程差不多过半。经过这几夜，酒馆已经不像孤堡了，炉火越烧越旺。'),
    line('ming', '把多余金币投进防线工坊——两层木石酒馆升级成石堡要塞后，屋顶会自动架起守卫火炮！'),
  ],
  8: [
    line('ming', '第 8 夜尸群更密了，前排巨尸配后排怨灵是最麻烦的组合。'),
    line('ming', '趁换弹间隙用磁场激光或特斯拉电弧清掉后排怨灵，别让它们把屋顶烤热了。'),
  ],
  9: [
    line('ming', '第 9 夜。远处的吼声比第 5 天那头还要狂暴，暴君的同伙明天多半要扑上来了。'),
    line('ming', '食堂今晚应该能解锁更扎实的盛宴，留一份硬菜当明天开战底气！'),
  ],
  10: [
    line('ming', '第 10 天血月当头！第二头首领「血月暴君·狂怒领主」带着漫街腐潮碾压过来了！'),
    line('ming', '电弧塔配冰霜塔能把狂奔护卫定死在壁垒外，剩下的交给屋顶火力和暴击瞄准！'),
  ],
  11: [
    line('ming', '撑过第十夜只剩最后五关！第 11 夜起，每夜冲墙的频率都比之前凶一截。'),
    line('ming', '手里的主力兵器尽量升到高星，星级带来的弹匣与爆发在残局里最救命。'),
  ],
  12: [
    line('ming', '第 12 夜，街尾路灯半明半灭，几座炮塔要是还没升满，今晚过后一定要补齐！'),
    line('ming', '真守到哥特铁堡三级，夜里还能自己修补三成路障，能省出大把修墙金币。'),
  ],
  13: [
    line('ming', '第 13 夜——倒数第三场死守。小赵刚刚捕捉到北部运输编队接近的加密微弱信号。'),
    line('ming', '手雷和护甲都塞满，只要壁垒和屋子都在，咱们就能耗死所有扑上来的怪物。'),
  ],
  14: [
    line('ming', '第 14 夜！明天就是最后一战，今天切忌省弹药、省手雷，能保住满血防线过夜就是大胜！'),
    line('ming', '今晚回堂把能喝的汤、能烤的排全都做了，明天见红！'),
  ],
  15: [
    line('ming', '第 15 夜——最后一夜！天空彻底裂成赤紫，深渊魔王·尸皇正踏碎街砖走来！'),
    line('radio', '救援机队距暮色镇仅剩一轮航程！击溃深渊魔王、肃清最后一波尸潮，我们立刻降落接应！'),
  ],
};

// ── 第 2 / 4 / 6 / 8 天清场加入的四位并肩战友（契合酒馆堡垒动线与纯金币体系）──
export const COMPANION_JOIN_STORIES: Record<number, { ally: AllyId; lines: StoryLine[] }> = {
  2: {
    ally: 'zhang',
    lines: [
      line('zhang', '（门外响起干净利落的两记点射，一个披风满霜的退伍老兵翻进院门，顺手搭上屋顶瞭望口）'),
      line('ming', '枪法很稳。哪来的？'),
      line('zhang', '老兵张。顺着你的灯火摸过来的——这间酒馆二楼视野真他娘的好，留我替你校准风向、盯住盲区，以后全武器伤害再添一成！'),
    ],
  },
  4: {
    ally: 'lin',
    lines: [
      line('lin', '掌柜的！刚才替街口几个伤员包扎时看见你的灯还亮着……我叫小林，以前在战地医疗站待过。'),
      line('ming', '屋里正好缺药箱。肯留下，晚上烤炉边永远有你的热汤位置。'),
      line('lin', '一言为定！每天迎战前我都会帮大家换好纱布与镇痛汤剂，每夜开战前额外多稳回 18 点生命！'),
    ],
  },
  6: {
    ally: 'qiang',
    lines: [
      line('qiang', '好家伙，这木石路障焊得真硬实！我是铁匠阿强——只要金币到位，我能把这屋前四座炮塔基座和铁壁全再锻厚一圈！'),
      line('ming', '右角落那台旧铁砧正缺主事的师傅。欢迎进屋！'),
      line('qiang', '妥妥的！路障与大屋上限立刻再加 50 点，往后造塔升塔全按九折收费，绝不坑自家掌柜！'),
    ],
  },
  8: {
    ally: 'zhao',
    lines: [
      line('zhao', '报告莫掌柜！我是通信兵小赵，刚顺着你们屋顶的天线频率爬上院墙！'),
      line('ming', '救援编队那边的频道还稳吗？'),
      line('zhao', '一直锁着呢！顺道我还帮你的「深夜小食堂」在短波里打了波免费吆喝——从今往后，食堂名气和涨粉速度再加三成！'),
    ],
  },
};

// ── 第 5 / 10 / 15 天三大首领登场 & 击破剧情 ──
export const BOSS_INTROS: StoryLine[][] = [
  [
    line('boss1', '轰隆——！！！（整条青石街都在巨爪下震颤，暴君的独眼死死锁住酒馆大门）'),
    line('ming', '这就是第 5 天的地狱巨兽·暴君？大家上屋顶、架稳枪线，绝不能让它掀翻路障！'),
  ],
  [
    line('boss2', '吼——！！（第 10 夜的狂怒领主顶碎街灯，烈焰顺着它脊背滚烫翻涌）'),
    line('ming', '暴君二号压境！冰霜塔与电弧塔全力拖住它，屋顶重炮对准胸口轰！'),
  ],
  [
    line('boss3', '……微弱的灶火，也敢在长夜尽头耀武扬威？（深渊魔王·尸皇拔高遮住半片暮色天空）'),
    line('ming', '最后十五步了！为了这间酒馆、为了屋里还在喝汤的所有人——把子弹和炮火全倾泻过去！'),
  ],
];

export const BOSS_VICTORY: StoryLine[][] = [
  [
    line('ming', '呼……暴君倒下了！街口那层压迫感散了一半，今晚回堂多烤两盘庆功！'),
  ],
  [
    line('ming', '连血月领主都啃不动我们的屋顶和炮台！还剩最后五夜，大伙撑住！'),
  ],
  [
    line('boss3', '不可……思议……凡人的灯火，竟烧穿了深渊长夜……'),
    line('heli', '这里是北部救援运输编队！暮色镇上空的红雾散了——下方酒馆屋顶灯火清晰可见，我们正在降落！'),
    line('zhang', '哈哈哈哈！听见桨声没！十五个夜晚，咱们一砖一瓦都守下来了！'),
    line('lin', '所有人的生命体征都稳定，连那只烤炉的余温都还烫着！'),
    line('qiang', '伙计们，收枪！这一锅全镇最传奇的「末日大餐」，咱带上去跟机组成员一起分！'),
    line('ming', '暮色散去，天终于亮了。感谢各位老伙计——这间十五波不灭的小酒馆，我们守住了！'),
  ],
];

export type RestStoryKey = 'firstOpen' | 'rep10' | 'rep25' | 'rep40';
export const REST_STORY: Record<RestStoryKey, { title: string; lines: StoryLine[] }> = {
  firstOpen: {
    title: '深夜食堂 · 炉火开张',
    lines: [
      line('ming', '墙外的嘶吼声总算暂时退潮。回到屋里，先把红砖烤炉的碳火拨旺吧。'),
      line('ming', '从尸群里捡回来的鲜肉别囤着发酸：既可以上铁板现炒直接换金币买枪、建炮塔，也能留着招待深夜来客。'),
      line('ming', '门外那几位夜行幸存者已经闻到香味了——照着今晚食客的点单和街头热门口味下锅，拿金币的同时还能攒口碑涨粉！'),
      line('ming', '下锅时盯紧铁板上的游标指针：落在中央金焰区就能打出完美乃至传说火候，名气越响，后续来的稀客赏金越高。'),
      line('ming', '最后别忘了给自己留一份「战前私房特餐」再上屋顶！明夜迎战时伤害、攻速和护甲都会明显涨一截。'),
    ],
  },
  rep10: {
    title: '街头口碑 · 老兵传香',
    lines: [
      line('zhang', '掌柜的，听说隔壁街区逃难过来的幸存者都在打听你这间「暮色小酒馆」呢！'),
      line('ming', '能让他们趁夜喝口热汤再接着活下去，这灶台就没白支起来。'),
    ],
  },
  rep25: {
    title: '名震废土 · 八方寻味',
    lines: [
      line('zhao', '短波频道里全是人在问路！都说穿过鬼雾往西看见两扇暖光拱窗，推门进去就能尝到战前大酒店级别的炉火手艺！'),
      line('ming', '名声响了更好——往后常客赏金再涨两成，连各地奇人怪客都会陆续找上门。'),
    ],
  },
  rep40: {
    title: '传奇名馆 · 长夜暖灯',
    lines: [
      line('lin', '整座暮色镇都流传着这里的故事了——墙外是十五夜死斗，墙里却是比和平年代还温暖的夜宵馆。'),
      line('ming', '来吧，灶火越旺、枪声越稳。不管来的是什么客人，今夜管够！'),
    ],
  },
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
  lin:   { id: 'lin',   joinDay: 4, name: '护士小林', role: '战地医护', initial: '林', sprite: 'npc_woman', buffDesc: '每夜额外恢复 +18 生命' },
  qiang: { id: 'qiang', joinDay: 6, name: '铁匠阿强', role: '结构锻工', initial: '强', sprite: 'npc_hat', buffDesc: '墙与大屋耐久 +50 · 造/升塔 -10% 金' },
  zhao:  { id: 'zhao',  joinDay: 8, name: '电台小赵', role: '通信兵', initial: '赵', sprite: 'npc_oldman', buffDesc: '食堂增粉 +30% · 锁定撤离频道' },
};
export const ALLY_ORDER: AllyId[] = ['zhang', 'lin', 'qiang', 'zhao'];

// ── 深夜食堂：VIP 阶级、15 位 VIP 档案、每日热搜、点评与声望评级 ──
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

const VIP_OVERRIDES: Partial<Record<string, Partial<Omit<VipDef, 'id' | 'tier' | 'unlockFans' | 'sprite'>>>> = {
  huanyin: {
    name: '短波主播·幻音',
    personality: '戏感十足的夜波红伶',
    personalityDesc: '无论长夜多黑暗都要端起端正播音腔，举手投足讲究排场，总爱把小酒馆的灶火香气传遍全镇短波频道。',
    bg: '拎着旧电瓶驱动的便携短波话筒闯进酒馆，对着空气广播：「各位夜行听众，今晚带大伙走近暮色镇尽头最香的酒馆！」',
    firstMeet: [
      line('ming', '（一个拎着老式短波话筒的年轻女人风风火火推门而入，肩头斜挎着嗡嗡作响的铜壳发报箱）'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '短波主播', avatar: 'npc_woman', text: clean('各位暮色电台的夜行听众！幻音今晚带大伙走近长夜里名声最响的暮色酒馆！听说这间灶台什么奇珍硬肉都能上桌！') },
      line('ming', '……你那发报箱电瓶快冒烟了。吃点什么？'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '短波主播', avatar: 'npc_woman', text: clean('（依然端着字正腔圆的播音腔）掌柜！给我上一道最摄人心魄的暗夜浓菜！我要让半条街外抱收音机的人都跟着咽口水！') },
      line('ming', '（端上一份泛着幽绿微光的深渊炙肉排）……就这一份，趁热吃。'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '短波主播', avatar: 'npc_woman', text: clean('（对着话筒赞叹）听众们，瞧这焦糖色泽与烟熏香气！（咬了一口，声音差点露馅）嗯……真香！！——（关掉开关凑近低声）掌柜，下回还是换正常烤排吧，差点没演住！') },
      line('ming', '……不是你自己非要点暗夜浓菜的么。'),
    ],
    reactions: {
      legendary: clean('对着话筒高呼：「各位夜行听众！！此等火候绝世难逢，今夜务必循灯而来！！」当晚慕名新客暴涨 +15 粉'),
      perfect: clean('满意收拢话筒：「火候精妙绝伦！今晚短波频道我定替小店美言几句。」'),
      good: clean('礼貌微笑：「滋味不赖……（压低声）掌柜下回摆盘若再齐整些便更体面了。」'),
      poor: clean('啪地关掉发报机：「……唔，这段不播了，下回重开嗓门。」'),
    },
  },
  guancezhe: {
    name: '夜幕先知·观测者',
    personality: '洞悉长夜棋局的宿命旅人',
    personalityDesc: '仿佛早已看尽十五夜红雾起落与星辰轨迹，言辞幽深平静，常在寒风最盛时指点守夜人的迷津。',
    bg: '身披缀满星纹的黑绒长斗篷，手提青铜星灯静静推门而入，外头的寒霜与尸雾竟绕着他衣摆退散。',
    firstMeet: [
      line('ming', '（一个身披星纹斗篷、手提青铜古灯的旅人无声步入酒馆，门外风雪竟在他肩头绕开）'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（拂去斗篷霜花，环顾两层橡木梁柱与暖黄油灯）暮色酒馆，最后一座不熄灯的堡垒。屋里炉火正旺……只是这菜单，刚重新开张不久吧？') },
      line('ming', '……夜路冷，客人想喝碗热汤还是吃块烤排？'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（轻声叹息）第 4 夜焦骨巨尸会撞响外墙，第 10 夜血月压境檐角，第 15 夜深渊魔王更将倾巢而出……别慌，掌柜的，屋顶高台与灶火会撑到天亮。') },
      line('ming', '（端上一碗冒着白气的滚烫肉汤）阁下倒像算命先生。喝口汤暖暖再说吧。'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（慢条斯理喝得碗底朝天，将一枚流转星光的铜币押在桌心）汤很好。十五夜漫长，只要屋里还有人为行路人留灯煮饭，这长夜便永远吞不掉人间。') },
      line('ming', '（收起温热的星纹铜币）……高人走好。'),
    ],
    reactions: {
      legendary: clean('微微颔首：「此等火候已能驱散红雾寒霜。」留下星纹护符并令全堂食客交口称誉'),
      perfect: clean('指尖轻叩桌面：「火候分毫不差，今夜防线必定固若金汤。」'),
      good: clean('「中规中矩，足够撑过今夜寒风。」'),
      poor: clean('「灶火微乱，明日登顶守城还需沉稳几分。」'),
    },
  },
};

export const VIP_CUSTOMERS: VipDef[] = legacyRest.VIP_CUSTOMERS.map((v) => {
  const sprite = VIP_SPRITE[v.id] ?? 'npc_hat';
  const ov = VIP_OVERRIDES[v.id];
  return {
    id: v.id,
    name: ov?.name ?? clean(v.name),
    tier: v.tier as VipTierId,
    unlockFans: SCALED_VIP_FANS[v.id] ?? 0,
    sprite,
    personality: ov?.personality ?? clean(v.personality),
    personalityDesc: ov?.personalityDesc ?? clean(v.personalityDesc),
    bg: ov?.bg ?? clean(v.bg),
    tipBonus: Math.min(2.2, 0.8 + (v.tipBonus ?? 1) * 0.25),
    weight: v.weight ?? 6,
    preferredDishPref: v.preferredDishPref ?? 'any',
    firstMeet: ov?.firstMeet ?? mapGuestLines(v.firstMeet, { vipId: v.id, vipName: clean((ov?.name ?? v.name).split('·').pop() ?? v.name), vipAvatar: sprite }),
    reactions: ov?.reactions ?? {
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
  { grade: 'D', name: '暮色风味摊', minFans: 60, unlock: '吸引白银级江湖客来访' },
  { grade: 'C', name: '酒馆名厨坊', minFans: 180, unlock: '解锁黄金级特邀常客' },
  { grade: 'B', name: '要塞星级厨', minFans: 400, unlock: '全镇守夜人闻香而来' },
  { grade: 'A', name: '暮色名厨阁', minFans: 700, unlock: '解锁铂金势力人物' },
  { grade: 'S', name: '长夜传奇食堂', minFans: 1000, unlock: '吸引传说人物与全图鉴朝圣' },
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
  { name: '初闻烟火', minRep: 0, bonusMul: 0, desc: '一锅热肉香飘出暮色长街' },
  { name: '废土名店', minRep: 10, bonusMul: 0.1, desc: '口碑渐起，食客打赏 +10%' },
  { name: '要塞名馆', minRep: 25, bonusMul: 0.2, desc: '夜夜满座，食客打赏 +20%' },
  { name: '长夜传奇名馆', minRep: 40, bonusMul: 0.35, desc: '暮色传奇酒馆，食客打赏 +35%' },
];

export function getRepTier(rep: number): RepTierDef {
  let cur = REP_TIERS[0];
  for (const t of REP_TIERS) if (rep >= t.minRep) cur = t;
  return cur;
}

export interface TrendDef { id: string; tag: string; title: string; desc: string; unlockDay: number }
export const DAILY_TRENDS: TrendDef[] = [
  { id: 'spicy_night', tag: '辣', title: '深夜就想吃重口味', desc: '【辣】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 1 },
  { id: 'homestyle', tag: '家常', title: '想念家的味道，来点家常的', desc: '【家常】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 1 },
  { id: 'tender', tag: '鲜嫩', title: '嫩一点，暖汤炖肉最治愈', desc: '【鲜嫩】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 2 },
  { id: 'hearty', tag: '饱腹', title: '大口吃肉，饱腹才守得住防线', desc: '【饱腹】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 2 },
  { id: 'protein', tag: '高蛋白', title: '守墙老兵最爱厚肉补给', desc: '【高蛋白】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 3 },
  { id: 'smoky', tag: '烟熏', title: '铁板碳烤，烟熏焦香夜宵', desc: '【烟熏】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 3 },
  { id: 'exotic', tag: '异变', title: '异变风味挑战，短波里都在问', desc: '【异变】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 5 },
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
    '救命！这是什么神仙手艺！吃完连明夜守墙的底气都满出来了。',
    '我愿意用半个月的口粮换掌柜这一口铁板火候！',
    '老板你战前是不是五星大酒店主厨？暮色酒馆之光实至名归！',
    '这口肉香让我想起了街灯还通宵亮着的和平夜晚。',
  ],
  perfect: [
    '手艺扎实、火候刚到点，明天上屋顶守城又有力气了！',
    '分量足味道稳，整片废墟里最实在的良心小馆。',
    '比昨晚还香！明天拉几个镇民一起赶夜路过来吃。',
    '掌柜用心了，这一口厚排能回味到天亮。',
  ],
  good: [
    '热乎的肉香下肚，浑身寒气散了一大半。',
    '实实在在一锅热汤，比冷干粮强太多了。',
    '踏实管饱的一顿夜宵，守完下一波再来光顾。',
    '火候不错，下回想试试掌柜的战前拿手特餐。',
  ],
  poor: [
    '火候稍急了一丁点，但这年头能吃上刚出炉的热菜已经知足。',
    '今晚灶头有点偏旺，老板下一锅稳一下准更绝。',
    '味道清淡些，不过填饱肚子上阵完全顶用。',
  ],
};
