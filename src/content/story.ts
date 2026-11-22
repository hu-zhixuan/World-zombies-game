// 剧情脚本、角色台词、战友羁绊与 15 位常客档案：男大学生小胡被困暮色镇、以西街孤灯酒馆为据点死守十五夜并突出重围的故事。
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
  ming:  { id: 'ming',  name: '小胡',     initial: '胡', desc: '被困古镇的男大学生 · 逆夜反骨突围者', avatar: 'hero_idle' },
  zhang: { id: 'zhang', name: '老兵张',   initial: '张', desc: '银枪破阵 · 拒不听命的叛逆老兵', avatar: 'ally_zhang' },
  lin:   { id: 'lin',   name: '药师小林', initial: '林', desc: '绯火炼金 · 敢跟死神掀桌的医者', avatar: 'ally_lin' },
  qiang: { id: 'qiang', name: '铁匠阿强', initial: '强', desc: '重铠斩卫 · 劈碎宿命的狂骨铁匠', avatar: 'ally_qiang' },
  zhao:  { id: 'zhao',  name: '武僧小赵', initial: '赵', desc: '苍蓝气劲 · 破戒踏雾的反骨武僧', avatar: 'ally_zhao' },
  boss1: { id: 'boss1', name: '地狱巨兽·暴君', initial: '暴', desc: '第5夜首领 · 拆墙狂兽', avatar: 'boss_beast' },
  boss2: { id: 'boss2', name: '血月暴君·狂怒领主', initial: '怒', desc: '第10夜首领 · 烈焰督军', avatar: 'boss_beast' },
  boss3: { id: 'boss3', name: '深渊魔王·尸皇', initial: '皇', desc: '第15夜终极首领', avatar: 'boss_demon' },
  watch: { id: 'watch', name: '北岭烽火', initial: '烽', desc: '城外接应号角 · 第15夜破雾窗口', avatar: 'watch' },
  dawn:  { id: 'dawn',  name: '破晓突围队', initial: '曙', desc: '城东撕开雾障接应的黎明猎团', avatar: 'dawn' },
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
      role: '暮夜来客',
      avatar: override.vipAvatar,
      text: clean(raw.text),
    };
  });
}

// ── 开场序幕：男大学生「小胡」来古镇写生遭黑雾封城，拒不认命、反手点灯开灶，携满城反骨杀穿十五夜重围 ──
export const CINEMATIC_INTRO: StoryLine[] = [
  line('ming', '紫红暮色砸塌古镇钟楼时，黑雾像一道死刑诏书封死了出城青石道。来暮色镇做建筑写生的男大学生小胡与同伴失散，攥着帆布包，反手把西街老酒馆的木门重重插牢。', 'siege'),
  line('ming', '街坊都在喊「快躲进地窖别出声」，仿佛乖乖发抖就能讨来一条活命。小胡看着昏黄街灯下这座两层石木老酒馆，冷笑一声——黑雾叫整座城跪下熄灯？老子偏要挑最显眼的路口，把两盏大灯全点亮！', 'rooftop'),
  line('watch', '呜——！北岭烽火撕裂浓雾吹响三长声号角！第十五夜黑雾裂口将在城东开启，破晓猎团会在外接应——但想活命，得先自己从死城里杀出来！', 'beacon'),
  line('ming', '长这么大没碰过真枪，旧猎手双铳的后坐力震得虎口发麻。小胡把没画完的写生本往胸口一拍：命运替我写好了死局？那我就把这破剧本撕个稀巴烂！', 'rooftop'),
  line('ming', '入夜翻上屋顶架枪硬刚，黑潮刚退就进堂把红砖灶煽到通红——怪物想把活人当口粮，小胡偏把它们的鲜肉架上烤炉，招待整条街同样不肯低头的叛逆之徒！', 'hearth'),
  line('ming', '「谁规定误入死城的大学生就该窝囊交代在这儿？」火点起来了，门立起来了，第一夜黑潮已经撞向街口——上屋顶，跟这鬼夜掀桌子！', 'dawn'),
];

export interface StorySceneCard { chapter: string; title: string; sceneKey: 'siege' | 'hearth' | 'dawn'; sub: string; text: string }
export const STORY_SCENES: StorySceneCard[] = [
  {
    chapter: '前情一',
    title: '黑雾宵禁 · 逆命点灯',
    sceneKey: 'siege',
    sub: '暮色镇西街 · 拒绝跪下',
    text: '男大学生小胡原本只身来古镇暮色镇做毕业写生，却撞上赤紫黑雾骤然封城。满街都在劝人躲进地窖听天由命，他偏偏反骨犯了——钉牢西街两层石木酒馆前院拒马，亲手点亮满城最刺眼的一盏反叛孤灯。',
  },
  {
    chapter: '前情二',
    title: '烤怪下酒 · 反骨成群',
    sceneKey: 'hearth',
    sub: '酒馆堂内 · 掀翻绝望',
    text: '黑雾越想用饥饿和恐惧驯服活人，小胡越要把红砖灶烧得噼啪作响。把扑上门的魔物反手烤成滚烫厚排与辣肉串，一间不守宵禁的深夜酒馆，引来了拒不退役的老兵、跟死神抢命的药师、砸碎宿命的铁匠和破戒踏雾的武僧。',
  },
  {
    chapter: '前情三',
    title: '十五夜围 · 杀穿东门',
    sceneKey: 'dawn',
    sub: '北岭烽火 · 撕碎死局',
    text: '北岭烽火只亮出第十五夜城东破雾的窗口，不会替弱者清路。踩碎第 5、10、15 夜三大深渊首领的霸权，不是为了苟延残喘，而是这群凡人要亲手踹开焦黑城门，踩着长夜尸骨杀出重围！',
  },
];

export interface ChapterCard { chapter: string; title: string; sub: string; text: string; minDay: number; maxDay: number }
export const CHAPTER_CARDS: ChapterCard[] = [
  {
    chapter: '第一章',
    title: '孤灯逆命',
    sub: '第 1～4 夜',
    text: '黑雾下达死城宵禁，从未上过战场的男大学生小胡偏偏翻上屋顶亮灯迎敌。腐尸、噬魂黑猫、地狱猎犬与焦骨巨尸轮番压境——越是不许活，越要开火反杀！',
    minDay: 1,
    maxDay: 4,
  },
  {
    chapter: '第二章',
    title: '反骨集结',
    sub: '第 5～9 夜',
    text: '第 5 夜「地狱巨兽·暴君」企图碾碎这盏不肯熄灭的叛逆灯火，第 6 夜「提灯怨灵」凌空抛火。老兵张、药师小林、铁匠阿强与武僧小赵各自砸碎旧规矩，踏雾而来与小胡并肩掀桌。',
    minDay: 5,
    maxDay: 9,
  },
  {
    chapter: '第三章',
    title: '血月掀桌',
    sub: '第 10～14 夜',
    text: '第 10 夜血月压檐，狂怒领主企图以烈焰彻底抹平西街。砖木老馆已淬火成石堡炮垒，炉膛肉香冲天，前院枪炮齐鸣——这群被判了死刑的凡人，偏要跟长夜反着来！',
    minDay: 10,
    maxDay: 14,
  },
  {
    chapter: '终章',
    title: '杀穿重围',
    sub: '第 15 夜',
    text: '深渊魔王·尸皇降临宣判死局。小胡与满堂反叛同袍拒绝再守——今晚斩落魔王、撕碎黑雾法则，亲手踹开焦黑大门，踏着破晓烈风杀出暮色镇！',
    minDay: 15,
    maxDay: 15,
  },
];

// ── 第 1～15 夜反叛突围手记：刻画男大学生小胡与众人不服宿命、反客为主的 rebel 意志 ──
export const WAVE_STORY_LINES: Record<number, StoryLine[]> = {
  1: [
    line('ming', '第 1 夜。整条街死寂得像坟场，只有我这屋顶还亮着灯。握枪的虎口确实在抖，可躲进地窖求饶？做梦！', 'rooftop'),
    line('ming', '怪物们，看清楚了——西街这盏灯我偏不关！想拿我当夜宵，先吃我一梭子再说！', 'siege'),
  ],
  2: [
    line('ming', '第 2 夜。黑雾里蹿出一串专咬脚踝的噬魂黑猫，速度刁钻得像是冲着立威来的。', 'siege'),
    line('ming', '肩膀被昨晚后坐力撞得发青，小胡反手把外套一甩照样跨上屋顶：越想吓退我，我偏越要站在最高处打你的脸！', 'rooftop'),
  ],
  3: [
    line('ming', '第 3 夜。地狱猎犬贴地狂扑，夜翼魔蝠遮住紫红天幕，天上地下一起合围。', 'siege'),
    line('ming', '想用合围逼我低头认栽？那就抬头把这片天挨个点穿——老子宁可站着打光子弹，也绝不低一次头！', 'rooftop'),
  ],
  4: [
    line('ming', '第 4 夜。青石街震得砖灰扑簌簌往下掉，焦骨巨尸顶着木垒猛砸，企图把酒馆连根推平。', 'siege'),
    line('ming', '明晚就是第一道死关。趁歇战把灶火烧得更旺、请匠师把壁垒铆成铁骨——谁的骨头硬，碰一碰就知道！', 'hearth'),
  ],
  5: [
    line('ming', '第 5 夜！赤红雾浪翻过屋檐，「地狱巨兽·暴君」撞碎街头铁灯扑向院门！', 'siege'),
    line('ming', '小胡踩上石垛冲它竖起枪口大笑：大块头，专程来给不听话的人立规矩的？今晚我就把你的规矩连骨头一起轰碎！', 'rooftop'),
  ],
  6: [
    line('ming', '第 6 夜。暴君趴下了，黑雾恼羞成怒派出「提灯怨灵」，飘在半空隔墙泼洒幽火。', 'siege'),
    line('ming', '烧焦衣角也不下高台！你提你的鬼灯，我亮我的灶火——先一枪打碎你那盏装神弄鬼的破灯笼！', 'rooftop'),
  ],
  7: [
    line('ming', '第 7 夜，重围过半。小胡在写生本背面划下第七道粗黑碳痕——不是求救记号，是欠这片黑夜的账单。', 'hearth'),
    line('ming', '砖木老馆已经垒成石堡要塞，它不再是躲灾的壳，是我们钉进黑雾心脏的一枚反骨长钉！', 'rooftop'),
  ],
  8: [
    line('ming', '第 8 夜。前排巨尸硬顶、后排怨灵放火，怪潮像铁钳一样往死里绞杀。', 'siege'),
    line('ming', '绞得越紧，反弹越狠！炮塔锁死前排，高台点爆后排——今晚就让这群怪物见识什么叫越压越疯！', 'rooftop'),
  ],
  9: [
    line('ming', '第 9 夜。钟楼方向传来震耳欲聋的狂嚎，整片天幕被染成发烫的血红。', 'siege'),
    line('ming', '大伙先回堂吃肉喝酒，把明晚的火气攒满！血月想压垮西街？明晚咱们一起把它从天上掀下来！', 'hearth'),
  ],
  10: [
    line('ming', '第 10 夜血月当头！「血月暴君·狂怒领主」裹着烈焰踏碎长街，要让反叛者彻底闭嘴！', 'siege'),
    line('ming', '小胡一脚踹开屋顶木箱怒吼：十夜都拿我们没办法，换只冒火的就想吓住人？全线开火，把它的嚣张气焰打回地底！', 'rooftop'),
  ],
  11: [
    line('ming', '第 11 夜。血月裂开一道猩红缺口，距离撕开东门只剩五夜，黑潮开始歇斯底里地反扑。', 'siege'),
    line('ming', '它急了，说明它怕了！炮管滚烫就换枪，护甲崩口就现补——反攻的节拍，现在握在我们手里！', 'rooftop'),
  ],
  12: [
    line('ming', '第 12 夜。整座暮色镇大半陷进死寂，唯有西街石堡的拱窗照旧灯火通明、肉香四溢。', 'siege'),
    line('ming', '黑雾最怕的从来不是高墙，是一群明知必死却偏要笑着点灯吃肉的疯子！灯不灭，我们就还没输！', 'hearth'),
  ],
  13: [
    line('ming', '第 13 夜！小赵在屋顶望见北岭三道烽烟直刺苍穹——东门黑雾裂口还有两夜彻底松动！', 'beacon'),
    line('ming', '不是等谁来施舍活路，是我们自己打出了破口！爆炎弹压满、灶火拉爆，准备掀翻最后两夜！', 'rooftop'),
  ],
  14: [
    line('ming', '第 14 夜，决战前夜。黑雾压得屋檐咯吱作响，屋里炭炉却烧得比哪一夜都狂。', 'siege'),
    line('ming', '小胡给每人斟满最后一扎黑啤、端上最厚肉排：干了这杯，明晚咱们不守城——咱们把城门踹开，杀出去！', 'hearth'),
  ],
  15: [
    line('ming', '第 15 夜！深渊魔王·尸皇撕裂暮色苍穹，携全城死意降临西街！', 'siege'),
    line('watch', '东门雾障已现裂隙，破晓猎团就在门外接应！小胡，把你们十五夜的反骨燃到最旺——劈开魔王，杀出重围！', 'dawn'),
  ],
};

// ── 第 2 / 4 / 6 / 8 夜清场加入的四位反叛战友：每一位都亲手砸碎了压在头顶的规矩与宿命 ──
export const COMPANION_JOIN_STORIES: Record<number, { ally: AllyId; lines: StoryLine[] }> = {
  2: {
    ally: 'zhang',
    lines: [
      line('zhang', '（寒风里一道银芒挑穿街角腐尸，旧斗篷翻飞，退伍老兵拄着银枪翻墙跃上屋顶，左腿旧伤微微一顿却笑得肆意）', 'rooftop'),
      line('ming', '前辈，你腿上还有伤！外头这么乱怎么直接冲上来了？'),
      line('zhang', '老兵张。镇长老早下令让残腿老兵躲进地窖别添乱——去他的狗屁命令！老子瞧见你个外地大学生敢在西街逆着黑雾点灯开火，骨头缝里的火一下就烧起来了！'),
      line('zhang', '活了一辈子最恨别人替我定死活！你小子不跪，老子更不跪！屋顶高台分我一半，全武器伤害再涨一成——咱们爷俩把这鬼夜掀个底朝天！'),
    ],
  },
  4: {
    ally: 'lin',
    lines: [
      line('lin', '（绯红衣摆焦了半截，年轻药师小林踩着木挑台飒然落进门廊，十指缠满药渍纱布，怀里却死死抱紧几只滚烫赤铜药罐）', 'hearth'),
      line('ming', '你的手烫成这样了！快进屋包扎，外头我来顶！'),
      line('lin', '药师公会那些老顽固连夜锁门装死，还说黑雾是天罚、救人就是逆天。我呸！天要收人，我小林偏要拿这黑雾里的毒火炼成绯炎药罐，把人从阎王手里硬拽回来！'),
      line('lin', '小胡，你敢拿怪物肉开灶给死城续命，我就敢把门廊守成续命阵！绯火轰敌、战中替你吊命——谁的剧本写着咱们该死，我亲手替他撕了！'),
    ],
  },
  6: {
    ally: 'qiang',
    lines: [
      line('qiang', '（铁靴踏裂青石砖，满脸烟灰的铁匠阿强单手拖着崩口重剑、肩扛铁砧闯进前院，反手一锤把松动的木垒砸进地底三寸）', 'siege'),
      line('ming', '阿强哥，你铁铺那边……没事吧？'),
      line('qiang', '铺子让暴君踩成渣了，那帮怪物以为砸烂我的炉子我就会哭着跪地求饶？做它的春秋大梦！炉碎了还有铁砧，甲裂了老子拿怪物焦骨再锻一副！'),
      line('qiang', '小胡，你只管在屋顶放肆开火、把酒馆灯挂得再高些！前院撞过来的东西全归我重剑劈碎！壁垒大屋各铆厚 50 点，往后造塔全算九折——谁敢给咱们画死线，老子连线带墙一起砍断！'),
    ],
  },
  8: {
    ally: 'zhao',
    lines: [
      line('zhao', '（苍蓝气劲凌空炸碎两只夜翼魔蝠，衣衫破烂的青年武僧轻落屋顶，磨穿的草鞋渗着血，眼底却烧着桀骜不驯的野火）', 'beacon'),
      line('ming', '你真孤身闯穿北岭三十里黑雾禁区回来了？！'),
      line('zhao', '寺里清规叫我闭门敲钟等超度，我把木鱼砸了翻墙出来的！小赵踩烂三双草鞋闯透北岭，带回确信——第十五夜东门雾障必裂，破晓猎团就在外头等咱们杀出去！'),
      line('zhao', '什么禁区、什么死城，都是吓唬顺民的假话！小胡，从今夜起我随老张守顶斩飞魔，再把你西街反叛孤灯的名号传遍全镇——十五夜一到，咱们破戒、破雾、破重围！'),
    ],
  },
};

// ── 第 5 / 10 / 15 夜三大首领登场 & 击破剧情（终战爆发「反叛死局、掀桌突围」高潮）──
export const BOSS_INTROS: StoryLine[][] = [
  [
    line('boss1', '轰隆——！！！（青石长街在暴君铁蹄下龟裂，赤红独眼死死锁定这间不肯熄灯的西街酒馆）', 'siege'),
    line('ming', '第 5 夜的地狱巨兽·暴君！黑雾派你来给不听话的人立规矩？可惜了，我小胡从小最讨厌的就是立规矩——开火，拆了它！', 'rooftop'),
  ],
  [
    line('boss2', '吼——！！（血月狂怒领主顶断街头铁灯柱，烈焰沿着脊背翻涌，企图将整条西街连根焚毁）', 'siege'),
    line('ming', '十夜都按不住我们，急眼了？老张、小林、阿强、小赵——别给它留面子，全线齐鸣，把这片血月给我打穿！', 'rooftop'),
  ],
  [
    line('boss3', '……区区一个误入死城的毛头大学生，不乖乖躲进暗窖等死，竟敢点灯开灶、鼓动满城蝼蚁逆天抗命？（深渊魔王·尸皇遮蔽半片紫红苍穹）', 'siege'),
    line('ming', '乖乖等死？谁他妈签字同意过你的规矩！我确实只是个来画建筑写生的大学生，没神力，也不信天命——可你偏要我跪，我偏要站着把你掀翻！', 'dawn'),
    line('ming', '你听好了，尸皇！今晚我们不是来守城的——我们要踏碎你的黑雾、掀翻你的死局，带着这一屋子反骨活着杀出重围！全员开火！！', 'dawn'),
  ],
];

export const BOSS_VICTORY: StoryLine[][] = [
  [
    line('ming', '呼……哈哈哈哈！（小胡抹掉脸颊烟灰，对着焦黑街面畅快大笑）暴君趴下了！看见没——所谓天谴死局，照样能一枪一炮轰出窟窿！回堂生火烤肉，庆祝反杀！', 'hearth'),
  ],
  [
    line('ming', '血月领主也不过如此！还剩最后五夜，谁也别再提「守」字——把弹药填满、肉排烤焦，咱们准备一鼓作气杀穿东门！', 'rooftop'),
  ],
  [
    line('boss3', '荒谬……不可理喻……明明写定了必死的终局，你们这群叛逆凡人凭什么……死也不肯顺从……', 'siege'),
    line('dawn', '这里是破晓突围队！东门黑雾被你们硬生生轰穿了！西街石堡的反叛守夜人们——火炬战车已冲破封锁线，正与你们会师！', 'dawn'),
    line('zhang', '哈哈哈哈！听见东门的烈风没！那些躲地窖念天命的老顽固全看傻了吧？老子拖着这条伤腿照样把魔王挑下马了！小胡，真他妈痛快！', 'dawn'),
    line('lin', '所有人一个不少，伤全都兜住了！阎王爷今天这笔账，算是彻底输给我们这间不听话的小酒馆了！', 'hearth'),
    line('qiang', '（重剑哐当劈碎门前焦木，仰天狂笑）黑雾想困死咱们十五夜，反倒替咱们炼出一身铜骨头！把炉里最后那锅肉汤端干，咱们自己踹开大门走出去！', 'hearth'),
    line('zhao', '清规破了，雾障破了，死局也破了。小胡，拿出你的写生本吧——今天这缕破晓晨光，配得上你最后一页画！', 'dawn'),
    line('ming', '（小胡擦净脸上的炭灰，背起磨破边的帆布包，回望了一眼身后亮了十五夜的暖黄拱窗，一脚踹开前院焦黑木门迎向晨风）', 'dawn'),
    line('ming', '从来没有什么救世主，只有一群拒不认命、偏要掀桌的反叛者。暮色镇留不住我们，黑夜更留不住我们——走吧大伙，我们突出重围，回家！', 'dawn'),
  ],
];

export type RestStoryKey = 'firstOpen' | 'rep10' | 'rep25' | 'rep40';
export const REST_STORY: Record<RestStoryKey, { title: string; lines: StoryLine[] }> = {
  firstOpen: {
    title: '逆夜开灶 · 烤怪下酒',
    lines: [
      line('ming', '第一夜的怪潮灰溜溜退回黑雾。小胡插上门闩，虎口还震得发麻，却直接抄起火钳把红砖灶煽到火星四溅——想让我躲在暗处啃冷饼发抖？没门！', 'hearth'),
      line('ming', '在学校顶多煮泡面，今夜倒逼出个狠活：怪物拿人当猎物，老子反手把它们的鲜肉抹上辣酱架上铁板！滋滋冒油的那一刻，整条死街的压抑都被顶穿了一道口子。', 'hearth'),
      line('ming', '闻着香味摸黑敲门的，都是憋了一肚子火、不肯缩在地窖等死的硬骨头。给他们端上滚烫肉汤和黑啤，他们就会扛着锤子、护甲和爆炎弹一起陪你掀翻明晚的围城。', 'hearth'),
      line('ming', '记住，出门开火前先给自己留一盘最狠的战备硬菜——吃饱喝足，才有劲儿把剩下的十四夜挨个砸穿！', 'rooftop'),
    ],
  },
  rep10: {
    title: '不守宵禁 · 反骨相传',
    lines: [
      line('zhang', '小胡，隔壁几条街炸开锅了！都在传西街来了个浑身反骨的男大学生，公然违抗黑雾宵禁，白天打怪晚上支锅烤肉！', 'hearth'),
      line('ming', '传得越响越好。黑雾想让全城安静等死，我偏要把这口锅敲得叮当响，把不甘心的人全喊醒！', 'hearth'),
    ],
  },
  rep25: {
    title: '反叛灯塔 · 揭竿而起',
    lines: [
      line('zhao', '如今连最老实的街坊都把地窖门踹开了，提着柴火和铁料直奔西街——大家都说，既然规矩拦不住怪物，那就跟着小胡一起掀了这鬼世道的桌子！', 'hearth'),
      line('ming', '一个人的反骨顶多算倔强，满街人的反骨凑在一起，就能撕开这座死城的封锁线！', 'hearth'),
    ],
  },
  rep40: {
    title: '掀翻长夜 · 破晓之旗',
    lines: [
      line('lin', '整座暮色镇都把你的名字刻心上了，小胡——一个来写生的大学生，靠一双猎铳和一口红砖灶，硬把死城带成了一座反叛要塞。', 'hearth'),
      line('ming', '我哪是什么英雄，不过是天生反骨、最烦别人替我安排结局罢了。灶火别停，肉管够——天亮前咱们一起杀穿东门！', 'dawn'),
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
  zhang: { id: 'zhang', joinDay: 2, name: '老兵张', role: '银枪破阵', initial: '张', sprite: 'ally_zhang', buffDesc: '拒听撤退令的伤腿老兵 · 屋顶银枪贯穿 · 全武器伤害 +10%' },
  lin:   { id: 'lin',   joinDay: 4, name: '药师小林', role: '绯火炼金', initial: '林', sprite: 'ally_lin', buffDesc: '敢跟死神掀桌的医者 · 门廊绯火爆燃/战中慢愈 · 每夜额外回血' },
  qiang: { id: 'qiang', joinDay: 6, name: '铁匠阿强', role: '重铠斩卫', initial: '强', sprite: 'ally_qiang', buffDesc: '铺碎骨硬的狂骨铁匠 · 前院重斩/修壁 · 墙屋+50 · 造塔-10%' },
  zhao:  { id: 'zhao',  joinDay: 8, name: '武僧小赵', role: '苍蓝气劲', initial: '赵', sprite: 'ally_zhao', buffDesc: '砸碎清规踏雾探路的武僧 · 屋顶气劲斩飞魔 · 堂食口碑 +30%' },
};
export const ALLY_ORDER: AllyId[] = ['zhang', 'lin', 'qiang', 'zhao'];

// ── 深夜酒馆：VIP 阶级、15 位反叛常客档案、每日风向、点评与声望评级 ──
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
  agou: {
    name: '夜街闯客·阿狗',
    personality: '腿软却天生反骨的街头小子',
    personalityDesc: '原本在老街货栈跑腿，封城后明明怕得小腿打颤，却偏不肯缩地窖听天由命，揣着锈匕首专挑黑雾薄弱处反踩点。',
    bg: '压低破毡帽撞开木门，裤脚沾满黑泥、气喘吁吁，眼里烧着不服管的野火。',
    firstMeet: [
      line('ming', '（戴着旧毡帽的瘦小伙猛地撞开馆门，反手顶死门栓，大口喘着粗气却咧嘴一笑）'),
      { npc: 'agou', name: '阿狗', initial: '狗', role: '夜街闯客', avatar: 'npc_hat', text: clean('呼……听说西街有个外地大学生不守黑雾宵禁，非但没躲地窖，还在屋顶跟怪物对轰？我阿狗偏要来拜拜码头！') },
      line('ming', '外头满街黑雾，你一个人乱窜不要命了？先坐下喘口气。'),
      { npc: 'agou', name: '阿狗', initial: '狗', role: '夜街闯客', avatar: 'npc_hat', text: clean('（抹掉冷汗硬挺起胸膛）腿肚子是直打颤！可让我像耗子一样缩阴沟里等怪物上门？门都没有！你一个背书包的都敢掀桌子，我阿狗凭什么认怂！') },
      line('ming', '（递上一串滋滋冒油的炭烤香辣肉串）说得痛快。先吃口辣的壮胆，往后咱俩一起拆了这鬼宵禁。'),
      { npc: 'agou', name: '阿狗', initial: '狗', role: '夜街闯客', avatar: 'npc_hat', text: clean('（烫得直哈气还是狠咬一大口）爽！！小胡哥，从今晚起我替你跑街喊人、拉满前线火气——早晚把暮色镇的死局踹翻！') },
    ],
    reactions: {
      legendary: clean('眼睛冒火地连嚼两口：「小胡哥绝了！吃完这串，明晚我带头冲上去抽肿那帮怪物的脸！」'),
      perfect: clean('拍胸脯大笑：「够辣够野！腿不抖了，明晚照样跟黑雾反着干！」'),
      good: clean('啃得精光：「热乎解气！总比窝在冷地窖当顺民强一万倍！」'),
      poor: clean('咂吧嘴：「火候糙了点，不过没关系，吃饱照样掀翻街口！」'),
    },
  },
  laobao: {
    name: '反骨老匠·老包',
    personality: '不信天塌的老木匠',
    personalityDesc: '修了半辈子古镇房梁与城门的老匠人，黑雾封城后所有人都弃街逃命，唯有他死活不肯扔下铁锤，发誓不让怪物砸烂他亲手修过的街。',
    bg: '胡须挂着夜霜、虎口缠着血布条，扛着半截包铁木桩沉步闯进堂内。',
    firstMeet: [
      line('ming', '（满脸胡茬的老匠人扛着大铁锤推门进屋，先蹲在门槛边敲了敲你钉上的木板）'),
      { npc: 'laobao', name: '老包', initial: '包', role: '筑城匠师', avatar: 'npc_bearded', text: clean('啧……钉子歪得没眼看，标准学生娃手笔。（抬头瞅你一眼，忽然大笑）手都磨烂了还死顶着不跑，有点老子年轻时的臭脾气！') },
      line('ming', '（把破皮的手往袖口藏了藏）不会也得钉。谁说外地学生就得乖乖等死？'),
      { npc: 'laobao', name: '老包', initial: '包', role: '筑城匠师', avatar: 'npc_bearded', text: clean('（重重把铁锤墩在地上）说得好！半城老爷们都吓破胆缩卵了，偏你个大学生敢逆着黑雾立门面！我老包修了一辈子暮色镇，绝不把老街让给这群烂骨头！') },
      line('ming', '（端上一盘滚烫厚实的铁板肉排）那这顿厚排算我敬大叔，前院的防线咱们一起给它钉成铁板。'),
      { npc: 'laobao', name: '老包', initial: '包', role: '筑城匠师', avatar: 'npc_bearded', text: clean('（大口吞肉，抡起锤子指向门外）吃你一口热肉，前院壁垒老子替你铆死！往后修塔造防一律八五折——看是黑雾先压塌墙，还是咱们先敲碎它的牙！') },
    ],
    reactions: {
      legendary: clean('猛拍桌板大笑：「够劲！吃完这块厚排，今晚我连夜能把前院铁壁再铆厚三寸！」'),
      perfect: clean('满意抹嘴：「扎实带火气！明晚怪物敢撞墙，撞掉它满嘴烂牙！」'),
      good: clean('点头笑道：「不赖！你小子掌勺比钉木板可野多了！」'),
      poor: clean('哼了一声：「火头偏急，不过够烫！吃饱就有劲儿砸怪物！」'),
    },
  },
  qijie: {
    name: '缝甲烈姐·七姐',
    personality: '嘴毒心热、敢骂老天的女药师',
    personalityDesc: '原本在老街开裁缝兼草药铺，封城后把碎铁片和止血草全缝进围裙，嘴上骂小胡不知死活，心里却最欣赏他那股不服管教的疯劲。',
    bg: '披着深红旧披肩利落掀帘，怀里揣着用麻布卷紧的秘药瓶与打磨发亮的铁甲片。',
    firstMeet: [
      line('ming', '（神色干练的女子掀帘进屋，一眼瞄见你肩头被后坐力震出的青紫，眉毛瞬间竖起）'),
      { npc: 'qijie', name: '七姐', initial: '七', role: '战地药师', avatar: 'npc_woman', text: clean('你就是那个不听劝、偏要在屋顶跟黑雾对着干的大学生小胡？肩都肿成馒头了还端锅，真打算把命押在这破夜里？') },
      line('ming', '不押上去，明天太阳也不会自己出来啊，七姐。'),
      { npc: 'qijie', name: '七姐', initial: '七', role: '战地药师', avatar: 'npc_woman', text: clean('（嗤笑一声，把铁甲片和药瓶啪地拍上桌面）行，嘴够硬，合姐脾气！这鬼夜最缺的就是你这种不服管的愣头青！给我盛碗最烫的肉汤，喝完我替你敷药披甲！') },
      line('ming', '（端上一碗热气翻涌的守夜暖胃肉汤）谢了七姐，趁热喝。'),
      { npc: 'qijie', name: '七姐', initial: '七', role: '战地药师', avatar: 'npc_woman', text: clean('（一口喝干，抹抹嘴挑眉道）听好了臭小子，少给姐死在半路！十五夜一到，你得把这破雾撕个口子，大摇大摆杀回你的大学去！') },
    ],
    reactions: {
      legendary: clean('七姐爽朗大笑：「这锅汤熬出魂了！把铁甲扣死，姐保你明晚放开手脚杀个痛快！」'),
      perfect: clean('点头收好药囊：「汤烈肉滚，比镇上那些酸腐大夫管用多了！明晚接着干！」'),
      good: clean('「嗯，手脚全暖活了。记住，敢死撑不敷药我就拿针扎你！」'),
      poor: clean('无奈摇头：「火太冲了小子，打仗要狂，熬汤得稳！」'),
    },
  },
  niqiu: {
    name: '军火狂商·泥鳅',
    personality: '偏爱逆盘豪赌的军火游商',
    personalityDesc: '平时精明滑头的走街商贩，全城都在唱衰暮色镇必亡，他偏要反着市场下注，把压箱底的爆炎弹与神兵全押在叛逆大学生小胡身上。',
    bg: '瘦高身形灵巧钻进酒馆，怀里叮当作响藏着几枚沉甸甸的铁壳爆炎弹与弹药匣。',
    firstMeet: [
      line('ming', '（眼神滴溜转的瘦高游商闪身进屋，啪啪几声把铁壳爆炎弹排在木桌上）'),
      { npc: 'niqiu', name: '泥鳅', initial: '泥', role: '军火游商', avatar: 'npc_oldman', text: clean('嘿，小胡同学！满镇都在打赌你撑不过三天，说你一个学生娃敢跟黑雾叫板纯属找死！') },
      line('ming', '那大叔你是来收尸的，还是来押注的？'),
      { npc: 'niqiu', name: '泥鳅', initial: '泥', role: '军火游商', avatar: 'npc_oldman', text: clean('（猛地一拍大腿大笑）老子当然是押你赢！所有人都说必死的盘口，翻盘了才最痛快！给我来盘招牌蒜香熏肉，压箱底的爆炎弹和神兵空投我全押给你——带大伙掀了这鬼局！') },
      line('ming', '（端上香气扑鼻的蒜香疾风熏肉）成交。这注我保证让你赢个盆满钵满。'),
    ],
    reactions: {
      legendary: clean('拍案叫绝：「绝活！冲你这手艺和反骨，明晚战场神兵箱老夫给你塞最猛的家伙事！」'),
      perfect: clean('咧嘴大笑：「够冲！爆炎弹揣好，明晚照着怪物脸门狠狠炸！」'),
      good: clean('点头道：「吃爽了才好翻盘，明晚补给准时抛进院子！」'),
      poor: clean('咂咂嘴：「火候略差，但冲你敢掀桌的胆气，货照送不误！」'),
    },
  },
  gaolaotou: {
    name: '破邪术士·高老头',
    personality: '宁信自己罗盘也不信天命的怪老头',
    personalityDesc: '怀疑黑雾背后藏着操控人心的邪法，所有人都怕得闭门不出，他偏每天戴着黄符斗笠提罗盘满街找茬，誓要拆穿长夜的把戏。',
    bg: '头顶折成尖顶的黄符斗笠，进门先举着咔哒作响的铜制测瘴罗盘扫遍四角。',
    firstMeet: [
      line('ming', '（戴着符纸斗笠的老头鬼祟推门，举着铜罗盘绕着木桌滴溜转了两圈）'),
      { npc: 'gaolaotou', name: '高老头', initial: '高', role: '破邪术士', avatar: 'npc_oldman', text: clean('嗯……阳气够冲，没沾黑雾窃听符！（斜眼盯你）外地小大学生，你墙角那只破八音盒，是不是邪教暗藏的迷魂阵？') },
      line('ming', '那是坏掉的旧八音盒。外头怪叫那么吵，坐下喝口热汤压压火吧。'),
      { npc: 'gaolaotou', name: '高老头', initial: '高', role: '破邪术士', avatar: 'npc_oldman', text: clean('（落座，拿粗布擦了三遍木筷）哼！黑雾教团就指望大家吓破胆乖乖投降！老头子偏不吃这套——你头顶这盏吊灯，该不会也藏着窥视邪眼吧？') },
      line('ming', '那是普通煤油灯。（端上一份滚烫肉汤）喝吧大爷，黑雾越想吓人，咱们越得吃香喝辣。'),
      { npc: 'gaolaotou', name: '高老头', initial: '高', role: '破邪术士', avatar: 'npc_oldman', text: clean('（猛喝一口，眼睛瞪得滚圆）……好霸道的阳火！一股宁折不弯的叛逆热气！小子，老头子盯雾气动向盯定了，黑雾休想糊弄咱们！') },
      line('ming', '一言为定，高大爷。'),
    ],
    reactions: {
      legendary: clean('举起罗盘狂笑：「阳火冲天！连邪雾的狗眼都能熏瞎！」'),
      perfect: clean('满意点头：「干净霸道！小胡，你比城里那帮软骨头顺眼一万倍！」'),
      good: clean('小声嘀咕：「朴实热乎，足够把邪祟寒气顶出门外。」'),
      poor: clean('皱眉摆手：「火气偏乱，下回稳住阵脚，别叫外头鬼哭狼嚎扰了灶！」'),
    },
  },
  guying: {
    name: '断誓猎手·孤影',
    personality: '撕毁撤退悬赏令的冷面独行客',
    personalityDesc: '猎手公会下达全员弃城撤离令时，他当众把公会徽章掰成两半——宁可孤身斩尽长街巨尸，也不当夹尾巴逃命的懦夫。',
    bg: '裹着带血风衣推开木门，随手把一颗深渊巨尸头颅咚地砸在吧台上。',
    firstMeet: [
      line('ming', '（浑身血气的冷面猎手推门而入，随手把半截焦黑怪角扔上吧台，眼神冷得像刀）'),
      { npc: 'guying', name: '孤影', initial: '影', role: '断誓猎手', avatar: 'npc_bearded', text: clean('猎手公会下令弃守暮色镇，把敢留下来的人都划成了叛徒。可我刚路过西街，听见有个大学生在屋顶把尸潮打得人仰马翻。') },
      line('ming', '他们画他们的叛徒名单，我走我的突围路。要喝点什么？'),
      { npc: 'guying', name: '孤影', initial: '影', role: '断誓猎手', avatar: 'npc_bearded', text: clean('（冷峻嘴角难得扬起一丝锋利弧度）好一句「走我的路」。给我来块最滚烫的厚肉排——既然公会说留守的是叛徒，那我今晚就陪你当一回头号反贼！') },
      line('ming', '（端上滋滋冒烟的铁板重甲厚排）欢迎入伙，头号反贼。'),
    ],
    reactions: {
      legendary: clean('孤影握紧刀柄低笑：「够烈。明晚前排的精英巨尸，我替你斩断它们的脖子。」'),
      perfect: clean('点头放下一枚银徽：「利落。吃饱了，正好去撕碎那群怪物的包围圈。」'),
      good: clean('言简意赅：「扎实。足够撑过下一轮血战。」'),
      poor: clean('微蹙眉头：「火候欠稳，但比公会发的那堆冷干粮强。」'),
    },
  },
  huanyin: {
    name: '逆夜歌伶·幻音',
    personality: '黑夜越嚣张唱腔越狂的反叛歌伶',
    personalityDesc: '怪物嚎叫着要整座古镇鸦雀无声，她偏拎着铜传声筒站在街角放声高歌——只要歌声没断，长夜就别想赢。',
    bg: '挎着旧风铃琴与黄铜传声筒风风火火闯进堂内，衣角沾霜却笑得张扬。',
    firstMeet: [
      line('ming', '（挎着风铃琴与黄铜传声筒的姑娘推门闯入，外头的夜风都拦不住她那股张扬劲儿）'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '逆夜歌伶', avatar: 'npc_woman', text: clean('全城不肯闭嘴的反叛者听好啦！幻音唱到西街最嚣张的孤灯下——听说有位男大学生公然在怪物眼皮底下点灯烤肉？太对我胃口了！') },
      line('ming', '……你那铜筒嗓门再大点，东街的尸群都要组团来听戏了。快坐下暖嗓子吧。'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '逆夜歌伶', avatar: 'npc_woman', text: clean('（一甩折扇，眼眸亮得逼人）它们越要人抖着闭嘴，我偏要唱得比它们嘶吼还响！活人的声音绝不能被黑雾压死！小胡，来道最提气的硬菜！') },
      line('ming', '（端上一份滋滋作响的炙烤厚肉排）唱得漂亮。吃饱了再把这鬼夜的安静彻底砸碎。'),
      { npc: 'huanyin', name: '幻音', initial: '幻', role: '逆夜歌伶', avatar: 'npc_woman', text: clean('（咬下一大口笑得眉眼飞扬）绝了！明晚我把西街反叛酒馆的曲子唱穿半座暮色镇——让所有躲着的人全站起来造反！') },
    ],
    reactions: {
      legendary: clean('举起铜传声筒高歌：「诸位不服命的夜行客听好！！西街灯火不灭、烤怪管饱，一起杀穿重围！！」当晚慕名新客暴涨 +15 粉'),
      perfect: clean('收拢风铃琴笑道：「火候绝佳！明晚我定把咱们的反叛名号唱响整条长街！」'),
      good: clean('点头畅笑：「热乎够劲！吃完又能对着黑雾连唱三宿！」'),
      poor: clean('轻咳一笑：「火候急了点，不过在这死夜里敢开灶，本就是最响的一首歌。」'),
    },
  },
  tongshu: {
    name: '发条械身·铜叔',
    personality: '用冰冷齿轮向死局竖中指的老巧匠',
    personalityDesc: '半身换作黄铜发条的老机关师，亲手算出突围生还率不足一成，却毫不犹豫把所有齿轮调到超载——越是概率逼近零，越要亲手打破算法。',
    bg: '半边身躯镶嵌精密黄铜齿轮与发条巧构，「发条铁胃」咬合涩滞，急需炽热厚肉与烈酒润滑。',
    firstMeet: [
      line('ming', '（半身镶满黄铜齿轮的男人迈进屋门，关节转动间发出沉稳的发条咔哒声）'),
      { npc: 'tongshu', name: '铜叔', initial: '铜', role: '发条巧匠', avatar: 'npc_bearded', text: clean('（金属颤音）异乡男大学生。我的黄铜算盘推演过三百次：暮色镇强行突围的生还率不足一成。你为何拒绝认输？') },
      line('ming', '算盘算的是顺民的死活，算不出反骨的分量。只要不是零，我偏要亲手把剩下九成砸穿！'),
      { npc: 'tongshu', name: '铜叔', initial: '铜', role: '发条巧匠', avatar: 'npc_bearded', text: clean('（胸口齿轮骤然停顿，随即轰鸣大笑）……绝妙的误差！我最恨注定的概率！把发条铁胃灌满烈酒与滚烫厚排——这具铁身今夜超载运转，陪你砸碎算法！') },
      line('ming', '（端上一份烈酒炙烤厚肉排）超载愉快，铜叔。'),
      { npc: 'tongshu', name: '铜叔', initial: '铜', role: '发条巧匠', avatar: 'npc_bearded', text: clean('（吞下厚排，齿轮转出耀眼金光）动力恢复至九成五。你的火候与反叛意志皆远超刻度——第十五夜，我们一起推翻概率！') },
    ],
    reactions: {
      legendary: clean('金属颤音激荡：「……检测到超频意志共鸣！此等反骨足以碾碎必死算法！」额外支付 3 倍金币'),
      perfect: clean('颔首：「完美契合工艺刻度。明晚前院防线由我铁躯死顶。」'),
      good: clean('沉声道：「尚可驱动。保持这份对抗宿命的冷静。」'),
      poor: clean('齿轮咔哒作响：「火候略偏，但我欣赏你不停摆的劲头。」'),
    },
  },
  dashan: {
    name: '铁臂巨汉·大山',
    personality: '拒绝被当成怪物的温柔叛逆巨人',
    personalityDesc: '天生三米高的神力巨汉，平日被镇民当成异类排挤，封城后所有人都以为他会趁乱伤人，他却偏偏用宽阔脊背挡在巷口护住落单孩童。',
    bg: '庞大的身躯猫着腰挤进木门，满堂食客瞬间按住武器，他却局促地举起两只大手示意自己不打架。',
    firstMeet: [
      line('ming', '（三米高的铁臂巨汉弯腰挤进酒馆，门框咯吱作响，几桌客人吓得同时按住腰间火铳）'),
      { npc: 'dashan', name: '大山', initial: '山', role: '铁臂巨汉', avatar: 'npc_bearded', text: clean('俺、俺不是黑雾里的怪尸！镇上都骂俺是怪物，可俺偏不想像怪物那样欺负人……小胡兄弟，俺刚把巷口两只猎犬摔飞了，能给俺盛碗大肉汤不？') },
      line('ming', '（摆手让大伙收起武器，笑着指了指最结实的木凳）坐！谁长什么样不重要，敢跟黑雾对着干的，进了这扇门都是自己人！'),
      { npc: 'dashan', name: '大山', initial: '山', role: '铁臂巨汉', avatar: 'npc_bearded', text: clean('（眼眶发亮，小心翼翼捧住大碗肉汤）俺头一回听见有人叫俺「自己人」！小胡兄弟，往后谁敢碰你酒馆大门，俺大山连它带墙外石头一起掀飞！') },
    ],
    reactions: {
      legendary: clean('大山高兴得差点拍碎木桌：「太香了！吃完俺力气翻倍，明晚替小胡兄弟把巨尸当沙袋抡！」'),
      perfect: clean('憨厚大笑：「肉厚汤浓！俺绝不叫镇上人看扁，明晚守门俺顶最前头！」'),
      good: clean('一口喝干抹嘴：「热乎管饱，真好喝！」'),
      poor: clean('挠挠头：「有点焦，不过俺不挑，吃饱就能打怪物！」'),
    },
  },
  baishi: {
    name: '狂想炼金师·怪医白石',
    personality: '把魔物当食材反噬黑雾的疯骨怪医',
    personalityDesc: '正统炼金学会骂他离经叛道、严禁触碰黑雾样本，他偏要反着来——把魔物拆骨入药、以毒攻毒，让怪物变成人类反杀的燃料。',
    bg: '穿着被毒雾蚀出洞眼的亚麻长袍，手里晃着冒绿泡的草药瓶兴冲冲撞开木门。',
    firstMeet: [
      line('ming', '（亚麻长袍满是灼痕的怪医两眼放光冲进酒馆，举着冒绿泡的玻璃药瓶直奔灶台）'),
      { npc: 'baishi', name: '白石', initial: '白', role: '狂想炼金师', avatar: 'npc_oldman', text: clean('天才！简直是离经叛道的天才！学会那群老学究说魔物碰不得、只能等死，偏你这个男大学生敢把魔物烤熟吃进肚里——这是对黑雾最辛辣的羞辱！') },
      line('ming', '它想吃我，我就先吃了它。白大夫，坐下等菜吧，药瓶离我锅远点。'),
      { npc: 'baishi', name: '白石', initial: '白', role: '狂想炼金师', avatar: 'npc_oldman', text: clean('（仰天狂笑）说得好！「它想吃我，我就先吃了它！」这才是活人该有的反叛逻辑！快给我上最猛的深渊厚排，今晚我把魔物弱点全写进突围药札！') },
      line('ming', '（端上一份滚烫的深渊魔兽厚排）吃吧，把它们的底细全拆干净。'),
      { npc: 'baishi', name: '白石', initial: '白', role: '狂想炼金师', avatar: 'npc_oldman', text: clean('（大嚼几口，奋笔疾书）痛快！魔性全化作了暴涨气力！小胡，你这口红砖灶就是整座死城最嚣张的炼金炉！') },
    ],
    reactions: {
      legendary: clean('狂喜拍桌：「反噬黑雾的杰作！魔物若知道自己这么香，怕是要气活过来！」额外奉上五倍酬金'),
      perfect: clean('飞快记札：「火候把全部药力逼出来了！明晚守夜必定反杀全场！」'),
      good: clean('点头笑道：「成色够猛，学会那帮老古董见了准吓掉下巴。」'),
      poor: clean('皱眉摇头：「反应偏温吞，下回把炭火拉得更狂些！」'),
    },
  },
  jinlaoban: {
    name: '破产豪商·金老板',
    personality: '踹翻体面、砸钱资助反叛者的前贵妇',
    personalityDesc: '原本是暮色镇最讲究洁癖与体面的水栈女财阀，眼见旧秩序崩塌，她索性把昂贵丝绸袍一撕、把压箱底金币全押给小胡造炮突围。',
    bg: '穿着沾了泥点却依旧挺拔的锦缎披风走入酒馆，把一袋沉甸甸的金币啪地甩上木桌。',
    firstMeet: [
      line('ming', '（锦缎披风沾满灰尘却气场迫人的女商贾步入堂内，把一袋金币直接拍在吧台上）'),
      { npc: 'jinlaoban', name: '金老板', initial: '金', role: '豪气女商贾', avatar: 'npc_woman', text: clean('从前我嫌这老街尘土重、嫌粗陶碗脏。可如今才看明白——黑雾压境时，满城体面人跪得最快，反倒你这间油烟熏天的酒馆站得最直！') },
      line('ming', '粗茶淡饭管饱，不讲究排场。金老板今天想点哪道？'),
      { npc: 'jinlaoban', name: '金老板', initial: '金', role: '豪气女商贾', avatar: 'npc_woman', text: clean('（洒脱大笑，拂去袖口灰尘）去它的体面规矩！把你最辣最烫的招牌硬菜端上来！老娘存了一辈子的金币，绝不便宜给死城——全砸给你造炮修塔，给我杀穿东门！') },
      line('ming', '（端上热气腾腾的招牌硬菜）够豪气！保证每一枚金币都化成轰碎黑雾的炮火。'),
    ],
    reactions: {
      legendary: clean('金老板畅快拍案：「这味道比宫廷宴痛快百倍！加倍打赏，明晚炮火给我拉到最满！」'),
      perfect: clean('满意颔首：「滚烫扎实！这笔突围投资，老娘押得值！」'),
      good: clean('微微一笑：「粗碗盛热肉，竟比银盘还提气。」'),
      poor: clean('轻哼一声：「卖相略糙，不过看在你敢掀桌的份上，赏钱照给！」'),
    },
  },
  wumingke: {
    name: '孤行信使·无名客',
    personality: '无视死城禁令、只替活人送信的独行者',
    personalityDesc: '从来没人知道他的真名。黑雾封城后驿站全线瘫痪，唯有他披着满是战痕的旧斗篷一次次撕破雾障，把北岭的破晓讯息送进城内。',
    bg: '满是战痕的旧斗篷滴落寒露，沉默坐在最偏的木桌边，眼神却像出鞘长剑。',
    firstMeet: [
      line('ming', '（披着战痕斗篷的沉默男子推门落座角落，将一枚沾血的北岭驿牌轻轻压在桌角）'),
      { npc: 'wumingke', name: '无名客', initial: '无', role: '孤行信使', avatar: 'npc_hat', text: clean('驿站总管说暮色镇已是死地，谁敢再往里送信便算叛逃。……但我接了北岭的信，路再黑也得送到。') },
      line('ming', '（默默盛来一碗滚烫的守夜暖胃肉汤）外头风寒，先喝碗热的。只要城里还有人没死，这路就不算断。'),
      { npc: 'wumingke', name: '无名客', initial: '无', role: '孤行信使', avatar: 'npc_hat', text: clean('（一口喝干，眼中闪过锐利微光）……好烫。这城里的叛逆灯火还没熄，我就会一直跑下去——第十五夜，东门见。') },
    ],
    reactions: {
      legendary: clean('无名客罕见点头致意：「滚烫如火。足够我再穿十里黑雾，把突围的信送到每一个不屈者手里。」'),
      perfect: clean('压低帽檐：「火候极稳。黑雾拦不住我们。」'),
      good: clean('平静收碗：「够暖。明晚我还会再来。」'),
      poor: clean('沉默颔首：「热的就是好汤，足以抵御夜寒。」'),
    },
  },
  yanlao: {
    name: '百年掌柜·阎老',
    personality: '宁烧老楼也不低头的倔强遗老',
    personalityDesc: '这栋西街两层木石酒馆百年前原是他家祖产。旁人劝他弃楼保命，他偏穿着笔挺旧燕尾服走进火线，亲眼看着小胡把老楼守成反叛孤堡。',
    bg: '穿着拂净灰尘的笔挺旧燕尾服，手拄黑檀手杖挺直脊背推开木门，浑然不惧门外怪吼。',
    firstMeet: [
      line('ming', '（身着笔挺旧燕尾服、手拄黑檀手杖的白发老者迈进木门，抬头打量着烟火熏黑的橡木大梁）'),
      { npc: 'yanlao', name: '阎老', initial: '阎', role: '百年遗老', avatar: 'npc_oldman', text: clean('一百年前，这栋两层石木老楼原是老夫名下的老店。街坊都说它老朽了、该在黑雾里塌掉——可你这个外地男大学生，偏把它守成了全城最硬的骨头。') },
      line('ming', '抱歉借了您的老屋架炮生火，弄得满墙烟灰。等杀出重围，我拿写生本替它画幅新的。'),
      { npc: 'yanlao', name: '阎老', initial: '阎', role: '百年遗老', avatar: 'npc_oldman', text: clean('（手杖重重一顿地板，笑声洪亮）哈哈哈哈！老房子最怕冷清等死，能陪一群反叛年轻人跟长夜干到底，是它的造化！小胡，给老夫上一道最滚烫的硬菜！') },
    ],
    reactions: {
      legendary: clean('阎老抚须长叹：「百年老楼竟在你手里重燃烈火！此等风骨，胜过当年十倍！」'),
      perfect: clean('优雅举杯：「火候恰到好处。敬这栋永不低头的老酒馆，敬突围！」'),
      good: clean('欣慰颔首：「热气腾腾，老屋听见这声音想必也欢喜。」'),
      poor: clean('微微摇头：「火候稍急，不过年轻人血气方刚，倒也合老夫胃口。」'),
    },
  },
  kuangya: {
    name: '驯兽狂徒·兽王狂牙',
    personality: '反客为主、把魔犬驯成坐骑的野性反贼',
    personalityDesc: '别人听见炼狱魔犬的嚎叫就两股战战，他偏徒手摁服头犬当成座驾——深渊派来的凶兽？老子偏要骑在它脖子上反咬黑雾一口。',
    bg: '扛着沉重铁链大步踏进木门，门外拴着的炼狱魔犬竟被他一声冷哼吓得乖乖趴地。',
    firstMeet: [
      line('ming', '（肩扛粗铁链的魁梧狂徒一脚踹开酒馆木门，门外那头暴躁的炼狱魔犬竟被他一眼瞪得趴伏在地）'),
      { npc: 'kuangya', name: '狂牙', initial: '狂', role: '驯兽狂徒', avatar: 'npc_bearded', text: clean('哈哈哈哈！深渊那帮东西以为放几条恶犬就能咬死活人？老子偏把最凶的头犬摁趴下当狗遛！听说西街有个大学生更野，直接把魔物架火上烤？') },
      line('ming', '彼此彼此。狗拴门外别咬坏老包刚修的拒马，进屋吃肉吧。'),
      { npc: 'kuangya', name: '狂牙', initial: '狂', role: '驯兽狂徒', avatar: 'npc_bearded', text: clean('（拍腿狂笑，眼里满是野性赞赏）够狂！我就喜欢不把死神当回事的狠角色！切块最生猛的炙烤厚排——明晚老子放魔犬替你咬穿怪潮侧翼！') },
    ],
    reactions: {
      legendary: clean('狂牙扯着嗓子狂笑：「带劲！！吃完这块肉，老子和魔犬明晚能把半条街的腐尸全撕碎！」'),
      perfect: clean('大口吞肉：「血性十足！小胡，你这大学生比荒原猎王还野！」'),
      good: clean('抹抹嘴：「够大块！吃饱了正好出去跟黑雾撒野！」'),
      poor: clean('嗤笑一声：「火候偏软，下回烤焦烤烈点才配得上咱们！」'),
    },
  },
  guancezhe: {
    name: '夜幕先知·观测者',
    personality: '见证凡人撕碎宿命剧本的冷眼旅人',
    personalityDesc: '亲眼看过七座古镇乖乖按照宿命熄灯覆灭，原本只来记录暮色镇的终章，却被男大学生小胡亲手撕碎剧本的反叛意志彻底惊艳。',
    bg: '身披星纹黑绒斗篷、手提青铜古灯静静推门而入，门外风雪与尸雾竟在他衣摆前自动退散。',
    firstMeet: [
      line('ming', '（身披星纹斗篷、手提青铜古灯的旅人无声步入酒馆，门外风雪竟在他肩头绕道退散）'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（拂去斗篷霜花，凝视暖黄拱窗与滚烫砖灶）我观测过七座陷落古镇，每一座都顺从了黑雾写好的死局。唯有这里……一个背着写生本的年轻人，竟亲手把命运的剧本撕了个粉碎。') },
      line('ming', '谁让它写的结局太难看了？我不服，屋里这群人也全都不服。'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（轻声失笑，眼中星光骤燃）第 5 夜暴君立威，第 10 夜血月清场，第 15 夜魔王合围——本该是毫无悬念的屠杀。可凡人最令深渊战栗的，正是明知必死却偏要掀桌反杀的叛逆意志。') },
      line('ming', '（端上一碗热气翻涌的肉汤）那就请你坐稳了，先生。这回的终章，由我们自己来写。'),
      { npc: 'guancezhe', name: '观测者', initial: '观', role: '夜幕先知', avatar: 'npc_hat', text: clean('（喝干肉汤，将一枚流转星芒的铜币压上桌心）好汤。去吧，小胡——让我亲眼看看，你们如何把这无尽长夜撕出天亮。') },
    ],
    reactions: {
      legendary: clean('微微颔首：「此等反叛心火，已足以焚穿既定宿命。」留下星纹护符并令全堂沸腾'),
      perfect: clean('指尖轻叩桌面：「火候桀骜却沉稳，明晚的死局必被你们改写。」'),
      good: clean('「炽热、真实，足以刺破无尽长夜的寒意。」'),
      poor: clean('「反骨已成，心火略急——稳住呼吸，才能把宿命掀得更彻底。」'),
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

export interface FansRankDef {
  grade: string;
  name: string;
  minFans: number;
  minTaste: number;
  minResearched: number;
  maxStaff: number;
  unlock: string;
}
export const FANS_RANKS: FansRankDef[] = [
  { grade: 'E', name: '西街孤灯',     minFans: 0,    minTaste: 0,   minResearched: 2,  maxStaff: 1, unlock: '逆着黑雾宵禁开灶，聚拢首批反骨街坊' },
  { grade: 'D', name: '逆夜热灶',     minFans: 60,   minTaste: 115, minResearched: 3,  maxStaff: 2, unlock: '烤怪肉香飘穿半条街，白银狂客循灯而来' },
  { grade: 'C', name: '反骨名馆',     minFans: 180,  minTaste: 175, minResearched: 5,  maxStaff: 3, unlock: '黄金叛逆奇人齐聚助阵，战备口碑飙升' },
  { grade: 'B', name: '叛夜火种',     minFans: 400,  minTaste: 245, minResearched: 6,  maxStaff: 4, unlock: '满城不服命者望灯揭竿，军械匠师齐援' },
  { grade: 'A', name: '不屈铁堡',     minFans: 700,  minTaste: 330, minResearched: 6,  maxStaff: 5, unlock: '铂金狂人倾囊相助，反叛灯火名震全镇' },
  { grade: 'S', name: '破晓反叛营',   minFans: 1000, minTaste: 420, minResearched: 6,  maxStaff: 6, unlock: '撕碎死局的十五夜传奇，全图鉴宿命旅人齐聚' },
];

export function getFansRank(fans: number, bestTaste = 999, researched = 99) {
  let cur = FANS_RANKS[0];
  let next: FansRankDef | null = FANS_RANKS[1];
  for (let i = 0; i < FANS_RANKS.length; i++) {
    const r = FANS_RANKS[i];
    if (fans >= r.minFans && bestTaste >= r.minTaste && researched >= r.minResearched) {
      cur = r;
      next = FANS_RANKS[i + 1] ?? null;
    } else {
      break;
    }
  }
  return { cur, next };
}

export interface RepTierDef { name: string; minRep: number; bonusMul: number; desc: string }
export const REP_TIERS: RepTierDef[] = [
  { name: '逆夜初燃', minRep: -999, bonusMul: 0, desc: '违抗黑雾宵禁支起砖灶，附近硬骨头率先敲门' },
  { name: '孤灯呛夜', minRep: 0, bonusMul: 0, desc: '烤肉香气呛进漆黑长街，反叛声名渐起' },
  { name: '西街火种', minRep: 10, bonusMul: 0.1, desc: '不甘等死的人们聚拢，食客支援赏金 +10%' },
  { name: '反骨要塞', minRep: 25, bonusMul: 0.2, desc: '夜夜满座喧腾，食客支援赏金 +20%' },
  { name: '掀桌灯塔', minRep: 40, bonusMul: 0.35, desc: '满城反叛同袍齐聚，食客支援赏金 +35%' },
];

export function getRepTier(rep: number): RepTierDef {
  let cur = REP_TIERS[0];
  for (const t of REP_TIERS) if (rep >= t.minRep) cur = t;
  return cur;
}

export interface TrendDef { id: string; tag: string; title: string; desc: string; unlockDay: number }
export const DAILY_TRENDS: TrendDef[] = [
  { id: 'spicy_night', tag: '辣', title: '黑雾越冷，越要吃口暴辣肉串呛回去', desc: '【辣】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 1 },
  { id: 'homestyle', tag: '家常', title: '死城不许过好日子？偏要吃口热乎家常菜', desc: '【家常】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 1 },
  { id: 'tender', tag: '鲜嫩', title: '滚烫嫩肉汤，把满身寒气全逼出去', desc: '【鲜嫩】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 2 },
  { id: 'hearty', tag: '饱腹', title: '吃得越饱、反击越狠，绝不饿着肚子打仗', desc: '【饱腹】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 2 },
  { id: 'protein', tag: '厚肉', title: '拆怪烤厚排，把明晚掀桌的力气拉满', desc: '【厚肉】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 3 },
  { id: 'smoky', tag: '烟熏', title: '红砖炉炭香冲天，越到绝境越要吃香喝辣', desc: '【烟熏】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 3 },
  { id: 'exotic', tag: '奇味', title: '怪物想吞活人？反手把它们拆骨入锅吃干抹净', desc: '【奇味】风味菜品 +35% 金币 · ×2 口碑', unlockDay: 5 },
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
    '黑雾要全城等死，偏你一个大学生把怪物烤成绝味下酒菜！明晚一起把东门掀了！',
    '吃进嘴里全是反骨的滚烫火气——谁也别想让咱们这群人跪下！',
    '全城都在发抖，只有小胡这屋子笑声震天！带咱们杀穿重围！',
    '手起火落，够野够烈！吃完这一顿，明晚怪物敢撞门就砸碎它的骨头！',
  ],
  perfect: [
    '热乎够冲！看见你一个大学生敢跟黑夜叫板，老子今晚也不缩地窖了！',
    '分量足、火候狠，整座暮色镇最嚣张的反叛灯塔就在西街！',
    '比昨晚更带劲！明晚喊隔壁街憋着火的弟兄全出来搭把手！',
    '一口厚排下肚，反攻的底气全回来了，明晚接着掀桌！',
  ],
  good: [
    '滚烫肉香一落胃，哪还有工夫怕黑雾，干就完了！',
    '实打实一锅热汤，比缩地窖当顺民痛快一万倍。',
    '吃饱喝足才好反杀突围，明晚照样来捧场！',
    '小胡这灶越烧越狂了，咱们早晚把这鬼夜撕开天亮！',
  ],
  poor: [
    '火候急了点，不过黑夜里敢逆命开灶，这股疯劲我就认！',
    '今晚灶火太冲，下回稳一稳，咱们接着跟怪物反着干。',
    '味道略糙，但热汤垫肚上墙一样能干翻它们！',
  ],
};
