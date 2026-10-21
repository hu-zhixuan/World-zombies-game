// ═══════════════════════════════════════════════════════════════════
//  01.3 僵尸图鉴注册表 (ZOMBIE_DEX & ENEMY REGISTRY)
// ═══════════════════════════════════════════════════════════════════
//  ZOMBIE DEX（僵尸图鉴）—— 12种僵尸的统一注册表
//  参考 PvZ 的僵尸分类与特性，重命名为末日题材
//  每种僵尸：外观、机制、首次出现波次、肉块种类
// ═══════════════════════════════════════════
const ZOMBIE_DEX = [
  // ── Tier 1: 普通（W1+）── armorPct=物理减伤% / resistPct=能量减伤%（双轴克制）
  { key:'roamer', name:'游荡感染者', tier:'普通', meatKind:'normal', meatType:0,
    baseHp:80, baseSpeed:1.4, coins:3, pts:5, firstWave:1, armorPct:0, resistPct:0,
    color1:'#e0b888', color2:'#4a8acc', hair:'#3a2818',
    mechanic:'none', mechanicDesc:'无护甲无抗性，什么塔都好打。数量取胜',
    desc:'最常见的感染者。曾是附近的居民，病毒爆发后失去理智。肉质普通，是餐厅基础食材。',
    drawType:'roamer' },
  { key:'sprinter', name:'冲刺啃食者', tier:'普通', meatKind:'fast', meatType:1,
    baseHp:55, baseSpeed:2.5, coins:4, pts:10, firstWave:2, armorPct:0, resistPct:0,
    color1:'#d4a878', color2:'#cc5544', hair:'#5a4030',
    mechanic:'dash', mechanicDesc:'低血量时频繁冲刺，移动极快。',
    desc:'身穿运动服的感染者，肌肉尚未完全僵化。速度极快，常成群突袭围墙缺口。',
    drawType:'sprinter' },
  { key:'flagbearer', name:'号旗呼号者', tier:'普通', meatKind:'normal', meatType:3,
    baseHp:160, baseSpeed:1.6, coins:5, pts:18, firstWave:3, armorPct:0.1, resistPct:0,
    color1:'#e8c098', color2:'#cc8844', hair:'#6a5030',
    mechanic:'rally', mechanicDesc:'出现时身边同类移速+15%。',
    desc:'手里举着破烂旗帜的感染者，似乎是某种"指挥官"。它的出现总会带来更多僵尸。',
    drawType:'flagbearer' },
  { key:'bruiser', name:'壮汉感染者', tier:'普通', meatKind:'tank', meatType:2,
    baseHp:320, baseSpeed:0.95, coins:7, pts:25, firstWave:4, armorPct:0.35, resistPct:0,
    color1:'#c89868', color2:'#55aa55', hair:'#2a1810',
    mechanic:'none', mechanicDesc:'皮糙肉厚（物理减伤35%），能量武器好打。',
    desc:'生前是健身房常客，感染后肌肉更加膨胀。血量极高，是厚实肉块的主要来源。',
    drawType:'bruiser' },
  // ── Tier 2: 装甲（W5+）── 高物理减伤，电弧塔/能量武器的猎物
  { key:'coneblock', name:'路障囚徒', tier:'装甲', meatKind:'normal', meatType:0,
    baseHp:140, baseSpeed:1.3, coins:7, pts:20, firstWave:5, armorPct:0.7, resistPct:0,
    color1:'#d8a878', color2:'#777777', hair:'#3a2818',
    mechanic:'armor_cone', mechanicDesc:'头顶路障：物理减伤70%·机枪塔打不动，用电弧塔/燃烧武器',
    desc:'头上扣着交通路障的感染者。路障挡住了物理弹，但能量武器可以穿透。',
    drawType:'coneblock' },
  { key:'buckethead', name:'铁桶禁闭者', tier:'装甲', meatKind:'tank', meatType:2,
    baseHp:280, baseSpeed:1.0, coins:9, pts:35, firstWave:6, armorPct:0.8, resistPct:0.1,
    color1:'#c89868', color2:'#888888', hair:'#2a1810',
    mechanic:'armor_bucket', mechanicDesc:'铁桶护甲：物理减伤80%·炮击塔或电弧塔克制',
    desc:'整个头套进生锈铁桶的感染者。物理攻击几乎无效，需要爆炸或能量开罐。',
    drawType:'buckethead' },
  { key:'screendoor', name:'铁门盾卫', tier:'装甲', meatKind:'tank', meatType:2,
    baseHp:220, baseSpeed:1.1, coins:8, pts:30, firstWave:7, armorPct:0.6, resistPct:0,
    color1:'#b89878', color2:'#aa9988', hair:'#3a2818',
    mechanic:'shield_front', mechanicDesc:'正面免疫【物理/爆炸】伤害，能量武器可穿透盾牌',
    desc:'手里举着一扇铁门当盾牌。正面刀枪不入，只有能量武器能穿透铁门。',
    drawType:'screendoor' },
  // ── Tier 3: 特殊机制（W7+）── 各有偏科抗性，需要针对性出塔
  { key:'jumper', name:'弹跳狂尸', tier:'特殊', meatKind:'fast', meatType:1,
    baseHp:90, baseSpeed:1.8, coins:7, pts:28, firstWave:7, armorPct:0, resistPct:0.4,
    color1:'#d4a878', color2:'#aa44cc', hair:'#4a2818',
    mechanic:'jump_wall', mechanicDesc:'到达围墙时跳跃越过围墙一次。',
    desc:'腿脚异变的感染者，能像撑杆跳一样越过围墙。第一次接触围墙时会跳过去，需要拦截。',
    drawType:'jumper' },
  { key:'exploder', name:'自爆殉道者', tier:'特殊', meatKind:'elite', meatType:2,
    baseHp:130, baseSpeed:1.5, coins:9, pts:40, firstWave:8, armorPct:0, resistPct:0.5,
    color1:'#e0a088', color2:'#cc4422', hair:'#3a1818',
    mechanic:'explode', mechanicDesc:'死亡或接触玩家时爆炸，范围伤害+击退。能量抗性50%',
    desc:'腹部高高鼓起的感染者，体内充满可燃气体。死亡时剧烈爆炸，波及周围一切。',
    drawType:'exploder' },
  { key:'spawner', name:'舞池感染源', tier:'特殊', meatKind:'elite', meatType:3,
    baseHp:260, baseSpeed:0.9, coins:10, pts:45, firstWave:9, armorPct:0.2, resistPct:0.3,
    color1:'#d4a8c8', color2:'#cc4488', hair:'#5a2840',
    mechanic:'spawn_imp', mechanicDesc:'每8秒召唤2只小型感染者。',
    desc:'身体不断抽搐的感染者，会从口中吐出小型尸婴。不快速击杀会被小尸潮淹没。',
    drawType:'spawner' },
  { key:'ranged', name:'火焰投手', tier:'特殊', meatKind:'elite', meatType:2,
    baseHp:180, baseSpeed:1.0, coins:10, pts:42, firstWave:10, armorPct:0.1, resistPct:0.7,
    color1:'#c8a878', color2:'#cc6622', hair:'#3a1818',
    mechanic:'ranged_fire', mechanicDesc:'远距离抛射火球，砸中围墙/玩家爆炸。能量抗性70%·用物理/爆炸塔打',
    desc:'喉咙变异的感染者，能喷出灼热火球。会在远处持续骚扰，必须优先解决。',
    drawType:'ranged' },
  // ── Tier 4: 精英/小Boss（W12+）── 双抗中庸但血量惊人
  { key:'gargantuar', name:'巨型行刑者', tier:'精英', meatKind:'elite', meatType:2,
    baseHp:900, baseSpeed:0.7, coins:20, pts:120, firstWave:12, armorPct:0.45, resistPct:0.45,
    color1:'#b88868', color2:'#552222', hair:'#1a0a0a',
    mechanic:'shockwave', mechanicDesc:'血量极高+双抗45%，每3秒砸地范围眩晕。需要多塔集火',
    desc:'三米高的巨型感染者，每一步都让地面颤抖。血量惊人，需要全火力倾泻才能击倒。',
    drawType:'gargantuar' },
];
// 按key建立快速索引
const ZOMBIE_DEX_MAP = {};
ZOMBIE_DEX.forEach(d => ZOMBIE_DEX_MAP[d.key] = d);

// 原ZTYPES保留作为肉块类型→基础属性的映射（向后兼容）
const ZTYPES=[{hp:100, speed:1.55, pts:5,  coins:6,  type:0},{hp:75, speed:2.7, pts:10, coins:8,  type:1},{hp:450,speed:1.1,pts:25, coins:15, type:2},{hp:220,speed:1.75, pts:18, coins:12, type:3}];

