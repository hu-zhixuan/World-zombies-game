// 剧情脚本、角色台词、战友羁绊与深夜食堂 15 位 VIP 档案：100% 契合「暮夜酒馆：守夜人 × 深夜食堂 × 15波尸潮」哥特暗黑风世界观。
import legacyRest from './legacy/restaurant.json';

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu;
const clean = (s: string) =>
  s
    .replace(EMOJI_RE, '')
    .replace(/Wastegram粉丝暴涨\+15/g, '当晚食客慕名暴涨 +15 粉')
    .replace(/废品改造狂/g, '机巧匠师')
    .replace(/疯批学者/g, '狂想炼金师')
    .replace(/破壁人·观测者/g, '夜幕先知·观测者')
    .replace(/废土电台主播/g, '江湖歌伶')
    .replace(/义体化狂人/g, '发条械身')
    .replace(/外面的废铁质量/g, '镇外铁铺锻的生铁质量')
    .replace(/卖的废铁/g, '贩的劣铁')
    .replace(/卖废铁的/g, '贩劣铁的')
    .replace(/坦克炮管/g, '重炮炮管')
    .replace(/开军工厂/g, '开军械工坊')
    .replace(/微波炉/g, '旧火炉')
    .replace(/酸液史莱姆/g, '腐爪腐尸')
    .replace(/变异鼠/g, '腐鼠')
    .replace(/酸烟/g, '黑雾毒气')
    .replace(/进口子弹/g, '稀罕银弹')
    .replace(/狙击枪/g, '圣铳')
    .replace(/枪都快提不动了/g, '火铳都快提不动了')
    .replace(/全酒馆客人都拔出了枪|满酒馆客人瞬间拔枪/g, '满堂夜客瞬间按住腰间火铳')
    .replace(/避难所的水管/g, '镇西水塔的送水闸')
    .replace(/你避难所的水/g, '镇西酒馆的水')
    .replace(/半个避难所/g, '半条街的口粮')
    .replace(/避难所里/g, '后厢地窖里')
    .replace(/避难所的小孩/g, '镇里的孩子们')
    .replace(/避难所米其林|废土米其林/g, '长夜名馆')
    .replace(/避难点/g, '栖身屋')
    .replace(/废土文化/g, '如今世道')
    .replace(/废土上的一切/g, '这长夜里的一切')
    .replace(/废土上/g, '长夜里')
    .replace(/废土/g, '长夜')
    .replace(/仿生胃/g, '发条铁胃')
    .replace(/电子合成音/g, '金属颤音')
    .replace(/伺服电机/g, '铜制齿轮')
    .replace(/发射洗脑电波/g, '暗藏迷魂阵法')
    .replace(/高维生物的阴谋！他们用病毒削弱人类意志，好方便殖民！/g, '黑雾教团的阴谋！他们散播尸疫动摇人心，好霸占暮色镇！')
    .replace(/摄像头/g, '窃听符')
    .replace(/那是灯泡。/g, '那是普通煤油灯。')
    .replace(/发表论文/g, '写进秘药手札')
    .replace(/全餐厅|满餐厅|整餐厅|这餐厅/g, '这酒馆')
    .replace(/你的餐厅/g, '你的小酒馆')
    .replace(/都市传说般的存在/g, '长夜传说般的存在')
    .replace(/有头有脸的人物打卡/g, '有头有脸的常客寻味')
    .replace(/第二波就出装甲尸/g, '第四波就撞见焦骨巨尸')
    .replace(/一台没有感情的机器/g, '一具毫无情绪波动的铁石躯壳')
    .replace(/精英变异体/g, '深渊巨尸')
    .replace(/变异体头颅/g, '巨尸头颅')
    .replace(/半变异巨汉/g, '铁臂巨汉')
    .replace(/三米高变异体格/g, '三米高天生神力体格')
    .replace(/异兽共生者/g, '驯兽狂徒')
    .replace(/变异地狱犬/g, '炼狱魔犬')
    .replace(/下波防御\+1塔/g, '下波守门协防')
    .replace(/大酒店/g, '大旅店')
    .replace(/交响乐团/g, '弦乐坊')
    .replace(/法式大餐/g, '宫廷大餐')
    .replace(/肉体早已在辐射中腐朽/g, '肉体早已在寒霜长夜中腐朽')
    .replace(/满是弹孔的旧防风衣|穿着弹孔旧防风衣/g, '满是战痕的旧斗篷')
    .replace(/风沙/g, '风雪')
    .replace(/传说级道具/g, '稀世护符')
    .replace(/黑桃子弹/g, '黑桃纹章弹丸')
    .replace(/特殊子弹/g, '秘银弹丸')
    .replace(/这子弹/g, '这枚弹丸')
    .replace(/72小时|七十二小时/g, '三天三夜')
    .trim();

export type NpcId = 'ming' | 'zhang' | 'lin' | 'qiang' | 'zhao' | 'watch' | 'boss1' | 'boss2' | 'boss3' | 'dawn';
export type AllyId = 'zhang' | 'lin' | 'qiang' | 'zhao';
export type VipTierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type StorySceneKey = 'siege' | 'rooftop' | 'beacon' | 'hearth' | 'dawn';

export interface SpeakerMeta {
  id: string;
  name: string;
  initial: string;
  desc: string;
  avatar: string;
}

export const SPEAKERS: Record<string, SpeakerMeta> = {
  ming:  { id: 'ming',  name: '小胡',     initial: '胡', desc: '暮夜酒馆守夜人', avatar: 'hero_idle' },
  zhang: { id: 'zhang', name: '老兵张',   initial: '张', desc: '银枪破阵 · 屋顶守卫', avatar: 'ally_zhang' },
  lin:   { id: 'lin',   name: '药师小林', initial: '林', desc: '绯火炼金 · 随行医者', avatar: 'ally_lin' },
  qiang: { id: 'qiang', name: '铁匠阿强', initial: '强', desc: '重铠斩卫 · 锻造技师', avatar: 'ally_qiang' },
  zhao:  { id: 'zhao',  name: '武僧小赵', initial: '赵', desc: '苍蓝气劲 · 对空斥候', avatar: 'ally_zhao' },
  boss1: { id: 'boss1', name: '地狱巨兽·暴君', initial: '暴', desc: '第5天首领 · 拆墙狂兽', avatar: 'boss_beast' },
  boss2: { id: 'boss2', name: '血月暴君·狂怒领主', initial: '怒', desc: '第10天首领 · 烈焰督军', avatar: 'boss_beast' },
  boss3: { id: 'boss3', name: '深渊魔王·尸皇', initial: '皇', desc: '第15天终极首领', avatar: 'boss_demon' },
  watch: { id: 'watch', name: '守夜号角', initial: '号', desc: '北方灯塔哨站 · 烽火传讯', avatar: 'watch' },
  dawn:  { id: 'dawn',  name: '破晓救援队', initial: '曙', desc: '北方黎明猎团与马车编队', avatar: 'dawn' },
};

export interface StoryLine {
  npc: string;
  name: string;
  initial: string;
  role: string;
  avatar: string;
  text: string;
  scene?: StorySceneKey;
}

const line = (npc: string, text: string, scene?: StorySceneKey): StoryLine => {
  const sp = SPEAKERS[npc] ?? { id: npc, name: '旅人', initial: '客', desc: '镇民', avatar: 'npc_hat' };
  return { npc: sp.id, name: sp.name, initial: sp.initial, role: sp.desc, avatar: sp.avatar, text: clean(text), scene };
};

function mapGuestLines(
  arr: readonly { npc?: string; speaker?: string; text: string }[],
  override: { vipId: string; vipName: string; vipAvatar: string },
): StoryLine[] {
  return arr.map((raw) => {
    const npcKey = raw.npc ?? (raw.speaker && SPEAKERS[raw.speaker] ? raw.speaker : '');
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

// ── 开场序幕：100% 暗黑悬疑叙事，主角「小胡」独守暮夜酒馆迎战十五夜黑潮 ──
export const CINEMATIC_INTRO: StoryLine[] = [
  line('ming', '黑雾沉沉压过石板街时，镇东最后一盏路灯也熄了。小胡钉死前院最后一块拒马木板，退回酒馆门檐下。', 'siege'),
  line('ming', '整条老街只剩这栋两层木石酒馆还立着——门廊木台连着屋顶高台，脚下砖墙厚实，身后是未熄的砖窑炭火。', 'rooftop'),
  line('watch', '呜——！北岭灯塔哨站吹响三长声号角！黎明猎团正顶风雪开拔，约定十五夜之后沿古驿道破雾驰援暮色镇！', 'beacon'),
  line('ming', '屋顶炮塔座还空着，手边只有一对猎手双铳和两枚爆炎弹。没人能替小胡守第一夜的门。', 'rooftop'),
  line('ming', '迎战时守住高台、清剿腐潮；夜幕歇息时推开堂门生火灶台——用热汤与烤肉留住过路旅人和战友，铸起整座要塞。', 'hearth'),
  line('ming', '只要这盏灯在，暮色镇的最后一道门就还开着。第一波雾影已经进街了——迎战！', 'dawn'),
];

export interface StorySceneCard { chapter: string; title: string; sceneKey: 'siege' | 'hearth' | 'dawn'; sub: string; text: string }
export const STORY_SCENES: StorySceneCard[] = [
  {
    chapter: '前情一',
    title: '黑雾淹城 · 孤馆残灯',
    sceneKey: 'siege',
    sub: '暮色镇西街 · 灾夜初临',
    text: '赤紫黑雾漫过暮色镇老街，寻常木门与哨卡一夜倾覆。小胡经营的两层木石酒馆因地基厚重、挑台连顶，成了唯一能退守迎敌的孤灯要塞。',
  },
  {
    chapter: '前情二',
    title: '灶火生温 · 群客寻香',
    sceneKey: 'hearth',
    sub: '酒馆堂内 · 深夜灶台',
    text: '白日斩杀魔物夺回的鲜肉与赏金，入夜便在红砖烤炉上滋滋作响。冻僵的拾荒客、夜巡老兵与炼金奇人循灯火登门，一顿热食换来金币、口碑与生死托付。',
  },
  {
    chapter: '前情三',
    title: '十五夜约 · 破晓号角',
    sceneKey: 'dawn',
    sub: '北岭烽火 · 终战誓约',
    text: '北塔守夜号角传下死信：十五夜黑潮之后黎明猎团将抵达东门。第 5、10、15 夜将有深渊首领亲自叩关——聚拢四位战友、筑起炮塔铁壁，活到破晓！',
  },
];

export interface ChapterCard { chapter: string; title: string; sub: string; text: string; minDay: number; maxDay: number }
export const CHAPTER_CARDS: ChapterCard[] = [
  {
    chapter: '第一章',
    title: '暮色初围',
    sub: '第 1～4 天',
    text: '游荡腐尸率先沿着暗紫长街涌来，第 2 夜噬魂黑猫突袭、第 3 夜地狱猎犬与掠空魔蝠齐至、第 4 夜重甲般的焦骨巨尸撞门——小胡必须迅速立起首座哨塔并守稳屋顶！',
    minDay: 1,
    maxDay: 4,
  },
  {
    chapter: '第二章',
    title: '暴君叩关',
    sub: '第 5～9 天',
    text: '第 5 夜首领「地狱巨兽·暴君」携烈焰与兽群撞向拒马壁垒；第 6 夜幽灵般的「提灯怨灵」浮空抛火。老兵张、药师小林、铁匠阿强与武僧小赵也会在夜色里陆续叩响馆门。',
    minDay: 5,
    maxDay: 9,
  },
  {
    chapter: '第三章',
    title: '血月死斗',
    sub: '第 10～14 天',
    text: '第 10 夜血月压檐，狂怒领主二度碾境。此时已是改建石堡要塞、连携寒霜与雷鸣炮阵的高潮，别忘了替满堂守夜人煮一桌长夜全宴提振士气。',
    minDay: 10,
    maxDay: 14,
  },
  {
    chapter: '终章',
    title: '深渊黎明',
    sub: '第 15 天',
    text: '终极首领「深渊魔王·尸皇」亲率黑潮压境。守住酒馆屋顶与最后一道铁壁，斩落魔王之时，古驿道的破晓号角与马蹄奔雷必将响彻全镇！',
    minDay: 15,
    maxDay: 15,
  },
];

// ── 第 1～15 波战前/战后叙事 ──
export const WAVE_STORY_LINES: Record<number, StoryLine[]> = {
  1: [
    line('ming', '第 1 夜。炮塔座空空如也，小胡把猎手双铳压实膛线，踩上屋檐石垛先压住街口这批腐尸。', 'rooftop'),
    line('ming', '先攒够第一笔赏金筑起防线，绝不能让雾里的东西踏破木门。', 'siege'),
  ],
  2: [
    line('ming', '巷尾黑雾里蹿起成片幽绿猫眼……第 2 夜会有贴地疾扑的噬魂黑猫！', 'siege'),
    line('ming', '站稳高台才能躲开撕咬，顺手攒钱添置新兵器和第一座炮塔。', 'rooftop'),
  ],
  3: [
    line('ming', '第 3 夜的嚎叫声不对劲——地面有地狱猎犬狂奔冲撞，屋檐上方还有夜翼魔蝠低空盘旋！', 'siege'),
    line('ming', '屋顶矮墙挡得住地面扑咬，却挡不住空中俯冲的爪牙。', 'rooftop'),
  ],
  4: [
    line('ming', '街砖在震颤……第 4 夜「焦骨巨尸」压境，单靠木拒马硬扛可讨不到便宜。', 'siege'),
    line('ming', '撑过今晚就是第 5 夜暴君关口，得进堂多备些热菜把金币与壁垒凑厚！', 'hearth'),
  ],
  5: [
    line('ming', '红雾滚过房檐——第 5 天首领「地狱巨兽·暴君」正在撞向防线！', 'siege'),
    line('ming', '高台矮墙能替小胡卸掉几成火球震荡，但壁垒一旦溃口，屋墙便再无遮拦。', 'rooftop'),
  ],
  6: [
    line('ming', '第 6 夜起雾色更深，「提灯怨灵」浮在半空隔墙抛掷幽火，直逼屋顶阵地！', 'siege'),
    line('ming', '盯紧火球抛线腾挪避锋，尽快先把半空那盏鬼灯打灭。', 'rooftop'),
  ],
  7: [
    line('ming', '第 7 夜，守夜历程过半。酒馆炉火与屋顶战旗已在长街立住名声。', 'hearth'),
    line('ming', '若能将木石酒馆加固为石堡要塞，屋顶便会多出一门日夜轰鸣的守卫重炮。', 'rooftop'),
  ],
  8: [
    line('ming', '第 8 夜前排巨尸配后排怨灵双线施压，防线每一丝耐久都金贵无比。', 'siege'),
    line('ming', '集中火力优先凿穿硬骨与后排，别叫尸潮把火线拖垮。', 'rooftop'),
  ],
  9: [
    line('ming', '第 9 夜远街传出比先前暴君更暴戾的咆哮……血月领主已经在半路上了。', 'siege'),
    line('ming', '今晚堂内灶火烧旺些，留一顿扎实热菜给大伙压压惊。', 'hearth'),
  ],
  10: [
    line('ming', '第 10 夜血月当头！第二头首领「血月暴君·狂怒领主」踏碎街灯逼近前院！', 'siege'),
    line('ming', '寒霜、雷弧与火炮全线齐鸣，这一仗退一步便是死局。', 'rooftop'),
  ],
  11: [
    line('ming', '跨过第十夜只余最后五关！黑潮自今晚起愈发急促凶狠，容错越来越低。', 'siege'),
    line('ming', '高星神兵与四座联动炮台缺一不可。', 'rooftop'),
  ],
  12: [
    line('ming', '第 12 夜，街尾冷风刺骨，老街半数废屋都在黑雾中摇摇欲坠。', 'siege'),
    line('ming', '只有这间还飘着肉香的哥特石堡亮着灯，绝不能在此夜熄火。', 'hearth'),
  ],
  13: [
    line('ming', '第 13 夜——小赵在屋顶捕捉到北岭哨塔连点三盏狼烟，黎明猎团离镇外只有两日脚程！', 'beacon'),
    line('ming', '备足爆炎弹与镶铁护甲，把最后两夜前线咬牙钉死。', 'rooftop'),
  ],
  14: [
    line('ming', '第 14 夜！明日便是终战之夜，今夜倾尽所有补给保住屋墙完好！', 'siege'),
    line('ming', '灶膛里的长夜全宴正冒着热气——明日决死一战！', 'hearth'),
  ],
  15: [
    line('ming', '第 15 夜——深渊魔王·尸皇撕裂暮色天空，踏碎青石板一步步走来了！', 'siege'),
    line('watch', '破晓救援队已抵镇东关卡！斩溃魔王、清扫黑潮，城门外即刻接应胡掌柜！', 'dawn'),
  ],
};

// ── 第 2 / 4 / 6 / 8 天清场加入的四位并肩战友（银枪 / 绯火炼金 / 重铠剑卫 / 苍蓝武僧）──
export const COMPANION_JOIN_STORIES: Record<number, { ally: AllyId; lines: StoryLine[] }> = {
  2: {
    ally: 'zhang',
    lines: [
      line('zhang', '（寒风里一道银芒破空而至，穿风斗篷的退伍老兵挽着长枪翻进院墙，稳稳跃上屋檐巡视街口）', 'rooftop'),
      line('ming', '银枪挑得干脆。阁下哪一营退下来的？'),
      line('zhang', '老兵张。见胡掌柜一人撑着这间酒馆没熄灯，便赶来搭把手——这屋顶视野通透，我的银枪替你破阵盯梢，全武器伤害再添一成！'),
    ],
  },
  4: {
    ally: 'lin',
    lines: [
      line('lin', '（绯红法袍边角还带着炼金火星，小林踩着木挑台迎面奔来，怀里护着药囊与赤铜火瓶）', 'hearth'),
      line('ming', '这雾夜里还敢点炼金火？快进门廊歇脚。'),
      line('lin', '胡掌柜收留过不少伤患，大伙都念着这口热汤呢。我就驻在门廊，战时掷绯火焚敌、顺手替你疗伤；入夜也能照看大伙伤势！'),
    ],
  },
  6: {
    ally: 'qiang',
    lines: [
      line('qiang', '（沉重的金铠战靴踩响院砖，铁匠阿强单手拎着丈长战剑与锻锤大步上前，反手拍了拍木障）', 'siege'),
      line('ming', '正愁前院缺个压阵的狠角色，右墙角落那台铁砧刚好给你开炉。'),
      line('qiang', '痛快！胡掌柜放心守楼，前院迎面撞来的腐尸全交由我重剑劈退——顺手把壁垒和房子各再铆厚 50 点，往后造塔全按九折！'),
    ],
  },
  8: {
    ally: 'zhao',
    lines: [
      line('zhao', '（院墙外飘来一串苍蓝气浪，披着念珠的青年武僧轻身落回屋顶，双掌一合向屋檐抱拳）', 'beacon'),
      line('ming', '北岭的音讯带回来了？'),
      line('zhao', '小赵幸不辱命！黎明猎团号角未断！今后我随老张同守屋顶，专运苍蓝气劲截杀半空翼魔，顺道也替小胡的酒馆再吆喝三成名气！'),
    ],
  },
};

// ── 第 5 / 10 / 15 天三大首领登场 & 击破剧情 ──
export const BOSS_INTROS: StoryLine[][] = [
  [
    line('boss1', '轰隆——！！！（青石长街在巨兽铁蹄下裂开细纹，暴君赤红独眼死死锁住酒馆大门）', 'siege'),
    line('ming', '第 5 夜的地狱巨兽·暴君到了！站稳高台架好火线，绝不能叫它掀翻前院壁垒！', 'rooftop'),
  ],
  [
    line('boss2', '吼——！！（血月狂怒领主顶碎街头铁灯柱，炽热火星顺着它脊背滚滚翻涌）', 'siege'),
    line('ming', '第 10 夜领主压境！寒霜减速、雷弧连锁、黑铁重炮全数齐发！', 'rooftop'),
  ],
  [
    line('boss3', '……区区凡人灶火，竟也敢与长夜争辉？（深渊魔王·尸皇拔地遮蔽半片赤紫天穹）', 'siege'),
    line('ming', '十五夜最后一关！为了这间救过无数人的酒馆——小胡与诸位今夜寸步不退！', 'dawn'),
  ],
];

export const BOSS_VICTORY: StoryLine[][] = [
  [
    line('ming', '呼……暴君倒下了。街口黑雾稀薄了半截，今夜回堂生火给大家添菜！', 'hearth'),
  ],
  [
    line('ming', '血月领主也啃不动咱们的铁壁和屋顶！只剩最后五夜，咬牙撑到破晓！', 'rooftop'),
  ],
  [
    line('boss3', '不可……思议……凡人微弱的灶火，竟烧穿了无尽长夜……', 'siege'),
    line('dawn', '这里是北方破晓救援队！镇东黑雾已经溃散——前方酒馆灯火长明，全队火炬马车正在入街接应！', 'dawn'),
    line('zhang', '哈哈哈哈！听见那阵破晓号角与马蹄声没！十五个漫漫长夜，咱们一砖一瓦都扛下来了！', 'dawn'),
    line('lin', '大伙的伤势全稳住了，炉膛里的铁锅还滚烫地冒着白气！', 'hearth'),
    line('qiang', '伙计们收剑入鞘！把今夜那锅「长夜全宴」端出堂门，分给赶来驰援的弟兄们暖暖身！', 'hearth'),
    line('ming', '黑雾散了，天光终于照进长街。小胡的这盏灯——和诸位一起，守到了天亮！', 'dawn'),
  ],
];

export type RestStoryKey = 'firstOpen' | 'rep10' | 'rep25' | 'rep40';
export const REST_STORY: Record<RestStoryKey, { title: string; lines: StoryLine[] }> = {
  firstOpen: {
    title: '深夜食堂 · 炉火初燃',
    lines: [
      line('ming', '墙外的嘶吼暂时退回黑雾深处。推开厚木门进堂，先把左壁砖窑烤炉里的炭火拨旺吧。', 'hearth'),
      line('ming', '外面攒回来的鲜肉与金币都有大用：铁板现炒能直接变现添置炮塔神兵，也可端上餐桌喂饱赶夜路的生还者。', 'hearth'),
      line('ming', '长桌上已有冻得发抖的旅人等着口热菜。顺着食客心思和今夜热门风味掌勺，名气攒起来，自会招来各方稀客。', 'hearth'),
      line('ming', '临走前别忘了替自己留一份「战前私房特餐」——带着热汤与烤肉的底气登顶迎战，十五夜才能走得更远。', 'rooftop'),
    ],
  },
  rep10: {
    title: '街头口碑 · 老兵传香',
    lines: [
      line('zhang', '胡掌柜，隔壁街区逃难过来的幸存者都在打听你这间「暮夜酒馆」呢！', 'hearth'),
      line('ming', '能让他们趁夜喝口热汤再接着活下去，这灶台就没白支起来。', 'hearth'),
    ],
  },
  rep25: {
    title: '名震暮夜 · 八方寻味',
    lines: [
      line('zhao', '北岭哨站与驿道行商全在传颂这盏灯！穿过鬼雾往西看见暖光拱窗，便能尝到王都大旅店般的炉火手艺。', 'hearth'),
      line('ming', '名声响了正好——往后熟客出手更阔绰，四方奇人异士也会循香前来投奔。', 'hearth'),
    ],
  },
  rep40: {
    title: '传奇名馆 · 长夜暖灯',
    lines: [
      line('lin', '整座暮色镇都流传着小胡与酒馆的故事了——墙外十五夜死斗，墙里却比和平岁月更暖人心。', 'hearth'),
      line('ming', '灶火越旺，守城越稳。无论今夜来的是谁，管饱！', 'dawn'),
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
  zhang: { id: 'zhang', joinDay: 2, name: '老兵张', role: '银枪破阵', initial: '张', sprite: 'ally_zhang', buffDesc: '屋顶银枪贯穿助战 · 全武器伤害 +10%' },
  lin:   { id: 'lin',   joinDay: 4, name: '药师小林', role: '绯火炼金', initial: '林', sprite: 'ally_lin', buffDesc: '门廊绯火爆燃/战中慢愈 · 每夜额外回血' },
  qiang: { id: 'qiang', joinDay: 6, name: '铁匠阿强', role: '重铠斩卫', initial: '强', sprite: 'ally_qiang', buffDesc: '前院冲锋重斩/修壁 · 墙屋+50 · 造塔-10%' },
  zhao:  { id: 'zhao',  joinDay: 8, name: '武僧小赵', role: '苍蓝气劲', initial: '赵', sprite: 'ally_zhao', buffDesc: '屋顶苍蓝气劲优先对空 · 食堂增粉 +30%' },
};
export const ALLY_ORDER: AllyId[] = ['zhang', 'lin', 'qiang', 'zhao'];

// ── 深夜食堂：VIP 阶级、15 位 VIP 档案、每日风向、点评与声望评级 ──
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
  gaolaotou: {
    name: '古怪术士·高老头',
    personality: '疑神疑鬼的老占卜客',
    personalityDesc: '怀疑长街每一缕雾气里都藏着邪教眼线，用膳前总要先念三遍清心咒、用铜罗盘测遍碗筷才肯下咽。',
    bg: '头上顶着折成尖顶的黄符斗笠，进门先掏出咔哒作响的破旧测瘴罗盘把桌椅扫了一遍。',
    firstMeet: [
      line('ming', '（一个戴着符纸斗笠的老头鬼鬼祟祟推门进来，手举铜制测瘴罗盘对着桌椅嘀嗒转了一圈）'),
      { npc: 'gaolaotou', name: '高老头', initial: '高', role: '古怪术士', avatar: 'npc_oldman', text: clean('嗯……瘴气还算正常，没沾窃听符印。（斜眼看你）掌柜，你墙角那只八音盒……是不是暗藏迷魂阵法？') },
      line('ming', '那是坏掉的旧八音盒。不吃别乱摸。'),
      { npc: 'gaolaotou', name: '高老头', initial: '高', role: '古怪术士', avatar: 'npc_oldman', text: clean('（落座，拿麻布擦了三遍木筷）哼……尸疫诅咒？那都是黑雾教团的阴谋！他们散播邪祟动摇人心，好霸占暮色镇！（压低声）你头顶这盏吊灯——该不会也藏了窥视邪眼吧？') },
      line('ming', '那是普通煤油灯。（端上一份清炖暖胃肉汤）吃吧，没毒。'),
      { npc: 'gaolaotou', name: '高老头', initial: '高', role: '古怪术士', avatar: 'npc_oldman', text: clean('（小心啜了一口，浑身突然松弛下来）……嗯，温热干净。（又连喝两大口）确实没下咒。掌柜，你算个可信人，这顶避邪符帽的做法我抄你一份！') },
      line('ming', '……不必了，谢谢。'),
    ],
    reactions: {
      legendary: clean('警惕地四下张望：「这滋味……太不对劲了，香得离奇！莫非加了灵草？」'),
      perfect: clean('满意颔首：「嗯，干净无毒。掌柜你暂时还算靠谱。」'),
      good: clean('小声嘀咕：「味道一般。不过至少没沾黑雾瘴气。」'),
      poor: clean('皱眉捂鼻：「这肉……确定不是腐雾里熏出来的？我得再用罗盘测测。」'),
    },
  },
  huanyin: {
    name: '江湖歌伶·幻音',
    personality: '戏感十足的夜街游吟伶',
    personalityDesc: '无论长夜多黑暗都要端起字正腔圆的说书腔，举手投足讲究排场，总爱挂着铜传声筒把酒馆灶火香气唱遍半条长街。',
    bg: '挎着旧风铃琴与铜制传声筒风风火火闯进酒馆，朝夜色吟唱：「诸位提灯夜行客，今夜带大伙走进暮色镇最香的小馆！」',
    firstMeet: [
      line('ming', '（一个斜挎风铃琴与铜制传声筒的年轻女子风风火火推门而入，袖口还沾着长街夜露）'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '江湖歌伶', avatar: 'npc_woman', text: clean('各位暮夜里的赶路人！幻音今夜唱到长街尽头最暖的一盏灯——听说这间暮夜酒馆什么奇珍硬肉都能上桌！') },
      line('ming', '……你那铜筒再喊下去，街口的腐尸都要听见了。吃点什么？'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '江湖歌伶', avatar: 'npc_woman', text: clean('（依然端着字正腔圆的说书腔）掌柜！给我上一道最摄人心魄的暗夜浓菜！我要让半条街外提灯巡夜的人都跟着咽口水！') },
      line('ming', '（端上一份泛着香料炭火光泽的深渊炙肉排）……就这一份，趁热吃。'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '江湖歌伶', avatar: 'npc_woman', text: clean('（对着风铃琴咏叹）诸位听看这焦糖色泽与烟熏香气！（咬了一口，腔调差点破功）嗯……真香！！——（压低真声凑近）掌柜，下回还是换正常烤排吧，差点没演住！') },
      line('ming', '……不是你自己非要点暗夜浓菜的么。'),
    ],
    reactions: {
      legendary: clean('扬起铜传声筒高歌：「诸位夜行客听好！！此等火候绝世难逢，今夜务必循灯而来！！」当晚慕名新客暴涨 +15 粉'),
      perfect: clean('满意收拢风铃琴：「火候精妙绝伦！明日走过各条长街，我定替小馆美言几曲。」'),
      good: clean('礼貌微笑：「滋味不赖……（压低声）掌柜下回摆盘若再齐整些便更体面了。」'),
      poor: clean('啪地合上曲本：「……唔，这段唱词先歇了，下回重开嗓门。」'),
    },
  },
  tongshu: {
    name: '发条械身·铜叔',
    personality: '崇尚齿轮与绝对理性的老巧匠',
    personalityDesc: '厌倦人类血肉的无常脆败，深信「血肉苦弱，齿轮永恒」。说话带有铜簧共振般的金属颤音，一丝不苟按刻度行事。',
    bg: '半边身躯改造自黄铜发条与齿轮巧构，「发条铁胃」咬合涩滞，急需滚烫烈酒与松脂厚肉润滑。',
    firstMeet: [
      line('ming', '（一个半边身躯镶满黄铜齿轮的男人迈进屋门，关节每动一下便发出清脆的发条咬合声）'),
      { npc: 'tongshu', name: '铜叔', initial: '铜', role: '发条巧匠', avatar: 'npc_bearded', text: clean('（金属颤音）凡人。我的发条铁胃出现涩滞。寻常清汤难以承压。需要高度烈酒与炽热松脂油脂调和。能做？') },
      line('ming', '……你是来用饭的，还是来给齿轮上油的？'),
      { npc: 'tongshu', name: '铜叔', initial: '铜', role: '发条巧匠', avatar: 'npc_bearded', text: clean('（冷静分析）血肉进食是低效的能量汲取。但发条铁胃必须润滑。据我推算，烈酒浸烤配七分焦油厚排可恢复九成运转效能。') },
      line('ming', '（端上一份烈酒炽烤厚肉排）……这种吃法我还是头一回做。'),
      { npc: 'tongshu', name: '铜叔', initial: '铜', role: '发条巧匠', avatar: 'npc_bearded', text: clean('（一口吞下烈酒厚排）……发条铁胃运转恢复至九成二。（颔首）你的火候合乎工艺刻度。往后我会定期前来维护。（起身离开，齿轮咔哒轻鸣）') },
      line('ming', '……成吧。记得结清酒钱。'),
    ],
    reactions: {
      legendary: clean('金属颤音微微泛响：「……检测到罕见芳醇共鸣。发条铁胃已刻录此配方。」额外支付 3 倍金币'),
      perfect: clean('颔首：「契合工艺刻度。发条运转顺滑如初。」'),
      good: clean('面无表情：「……尚可驱动。下次烈酒火候可再添一分。」'),
      poor: clean('齿轮咔哒卡响：「配比失衡。铁胃运转仅恢复四成。」'),
    },
  },
  baishi: {
    name: '狂想炼金师·怪医白石',
    personality: '沉迷药理异象的狂热怪医',
    personalityDesc: '眼里只有秘药配方与奇异体征，对深渊魔物的魔性变化有着近乎病态的好奇，常把常人避之唯恐不及的药材当成宝贝。',
    bg: '穿着被酸雾蚀出洞眼的褪色亚麻实验袍，兴冲冲掏出一小瓶冒着绿泡的炼金原液要混进热菜里。',
    firstMeet: [
      line('ming', '（一个亚麻实验袍满是灼痕的男人两眼放光冲进酒馆，手里晃着一小瓶冒绿泡的玻璃药瓶）'),
      { npc: 'baishi', name: '白石', initial: '白', role: '怪医炼金师', avatar: 'npc_oldman', text: clean('妙极了！妙极了！听说你这掌柜什么奇肉都敢掌勺？（把玻璃药瓶拍在木桌上）替我把这瓶魔药原液拌进菜里，看看会生出什么异象！') },
      line('ming', '……这里头装的是什么鬼东西？'),
      { npc: 'baishi', name: '白石', initial: '白', role: '怪医炼金师', avatar: 'npc_oldman', text: clean('（低笑）我也说不清！这正是迷人之处！或许是强心秘药，或许是蚀骨毒露——在药炉里熬一百次，都不如活体试药一遭来得痛快！') },
      line('ming', '（……这人简直是个疯子。）（端上一份深渊魔兽厚排，假装往上滴了一滴药水）行了，你的「试药菜」好了。'),
      { npc: 'baishi', name: '白石', initial: '白', role: '怪医炼金师', avatar: 'npc_oldman', text: clean('（迫不及待大嚼几口，眼里闪光）精彩！肺腑微暖，瞳仁清亮了几分！（飞快在羊皮手札记下一笔）掌柜，下回我带更猛的药草来！') },
      line('ming', '……其实那滴原液我全倒进炉灰里了。随他高兴吧，至少赏金给得痛快。'),
    ],
    reactions: {
      legendary: clean('狂喜拍桌：「太绝妙了！前所未见的炼金异象！我要写进秘药手札！」额外奉上五倍酬金与一瓶秘炼强效药水'),
      perfect: clean('兴奋地奋笔疾书：「药性相辅相成！极有深究的价值！」'),
      good: clean('点头：「成色尚可。待我再留心观察几夜。」'),
      poor: clean('皱眉摇头：「反应微弱。下回记得火头更猛些。」'),
    },
  },
  guancezhe: {
    name: '夜幕先知·观测者',
    personality: '洞悉长夜棋局的宿命旅人',
    personalityDesc: '仿佛早已看尽十五夜红雾起落与星辰轨迹，言辞幽深平静，常在寒风最盛时指点守夜人的迷津。',
    bg: '身披缀满星纹的黑绒长斗篷，手提青铜星灯静静推门而入，外头的寒霜与尸雾竟绕着他衣摆退散。',
    firstMeet: [
      line('ming', '（一个身披星纹斗篷、手提青铜古灯的旅人无声步入酒馆，门外风雪竟在他肩头绕开）'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（拂去斗篷霜花，环顾两层橡木梁柱与暖黄油灯）暮夜酒馆，最后一座不熄灯的堡垒。屋里炉火正旺……只是这菜单，刚重新开张不久吧？') },
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
  { grade: 'D', name: '暮夜风味摊', minFans: 60, unlock: '吸引白银级江湖客来访' },
  { grade: 'C', name: '酒馆名厨坊', minFans: 180, unlock: '解锁黄金级特邀常客' },
  { grade: 'B', name: '要塞星级厨', minFans: 400, unlock: '全镇守夜人闻香而来' },
  { grade: 'A', name: '暮夜名厨阁', minFans: 700, unlock: '解锁铂金势力人物' },
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
  { name: '初闻烟火', minRep: 0, bonusMul: 0, desc: '一锅热肉香飘出暮夜长街' },
  { name: '镇西名馆', minRep: 10, bonusMul: 0.1, desc: '口碑渐起，食客打赏 +10%' },
  { name: '要塞名馆', minRep: 25, bonusMul: 0.2, desc: '夜夜满座，食客打赏 +20%' },
  { name: '长夜传奇名馆', minRep: 40, bonusMul: 0.35, desc: '暮夜传奇酒馆，食客打赏 +35%' },
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
  { id: 'protein', tag: '厚肉', title: '守墙老兵最爱厚肉补给', desc: '【厚肉】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 3 },
  { id: 'smoky', tag: '烟熏', title: '铁板碳烤，烟熏焦香夜宵', desc: '【烟熏】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 3 },
  { id: 'exotic', tag: '奇味', title: '奇味秘菜挑战，满镇夜客都在问', desc: '【奇味】风味菜品 +35% 金币 · ×2 粉丝', unlockDay: 5 },
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
    '掌柜手艺宛如昔日王都御厨！暮夜酒馆之光实至名归！',
    '这口肉香让我想起了街灯还通宵亮着的和平夜晚。',
  ],
  perfect: [
    '手艺扎实、火候刚到点，明天上屋顶守城又有力气了！',
    '分量足味道稳，整条长街里最实在的良心小馆。',
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
    '今晚灶头有点偏旺，掌柜下一锅稳一下准更绝。',
    '味道清淡些，不过填饱肚子上阵完全顶用。',
  ],
};
