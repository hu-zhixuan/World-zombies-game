// ═══════════════════════════════════════════════════════════════════
//  01.2 塔防与工事配置注册表 (TOWER_TYPES & DEFENSE REGISTRY)
// ═══════════════════════════════════════════════════════════════════
// 塔类型配置：每类型含按等级的 stats 数组（index 0=L1,1=L2,2=L3）
// ── 王国保卫战式双轴克制体系（重做）──
// 伤害类型 dmgType: 'physical'(物理·吃armor减伤) / 'explosive'(爆炸·无视50%护甲) / 'energy'(能量·吃resist减伤) / 'support'(支援·不攻击)
// 定位：机枪=便宜速射单体 | 炮击=慢速AoE破甲 | 电弧=能量链电打高甲 | 冰霜=控制 | 维修=修墙守家
const TOWER_TYPES = {
  turret:  {icon:'🗼', name:'机枪塔',  cost:60, maxLevel:3, range:230, color:'#cccccc', dmgType:'physical', hp:140,
            desc:'高速物理弹·便宜速射单体。克无甲脆皮，被高护甲完克',
            stats:[{dmg:10,cooldown:18,projSpeed:26},{dmg:19,cooldown:12,projSpeed:30},{dmg:36,cooldown:7,projSpeed:36}]},
  freeze:  {icon:'🧊', name:'冰霜塔',  cost:70, maxLevel:3, range:200, color:'#5be4ff', dmgType:'energy', hp:120,
            desc:'能量冰弹·强减速控场。让敌人暴露在其他塔火力下',
            stats:[{dmg:8,cooldown:40,projSpeed:24,slowFactor:0.5,slowDur:180},{dmg:15,cooldown:28,projSpeed:28,slowFactor:0.35,slowDur:240},{dmg:26,cooldown:18,projSpeed:32,slowFactor:0.25,slowDur:320}]},
  cannon:  {icon:'💥', name:'炮击塔',  cost:110, maxLevel:3, range:240, color:'#ff8833', dmgType:'explosive', hp:220,
            desc:'爆炸弹AoE·无视50%护甲。克扎堆+铁桶，被分散快怪风筝',
            stats:[{dmg:45,cooldown:70,projSpeed:20,aoeRadius:110},{dmg:85,cooldown:48,projSpeed:24,aoeRadius:140},{dmg:150,cooldown:30,projSpeed:28,aoeRadius:175}]},
  tesla:   {icon:'⚡', name:'电弧塔',  cost:100, maxLevel:3, range:190, color:'#ffe066', dmgType:'energy', hp:130,
            desc:'能量链电·跳跃4敌每跳-30%。克高护甲肉盾，被高魔抗完克',
            stats:[{dmg:22,cooldown:50,chain:4,chainDecay:0.7},{dmg:40,cooldown:34,chain:5,chainDecay:0.75},{dmg:70,cooldown:20,chain:6,chainDecay:0.8}]},
  repair:  {icon:'🔧', name:'维修塔',  cost:80, maxLevel:3, range:9999, color:'#44ff66', dmgType:'support', hp:180,
            desc:'支援塔·持续修复围墙+微治疗玩家。守家生命线',
            stats:[{heal:8,cooldown:90},{heal:16,cooldown:60},{heal:30,cooldown:36}]},
};
// 塔伤害类型→中文名（图鉴/弹窗显示用）
const TOWER_DMG_TYPES = {
  physical: {name:'物理', icon:'🗡️', color:'#cccccc'},
  explosive: {name:'爆炸', icon:'💥', color:'#ff8833'},
  energy:   {name:'能量', icon:'⚡', color:'#5be4ff'},
  support:  {name:'支援', icon:'🔧', color:'#44ff66'},
};
// 获取塔当前等级的 stats
function towerStat(t){const tt=TOWER_TYPES[t.type];return tt.stats[t.level-1]||tt.stats[0];}
// 陷阱类型配置
const TRAP_TYPES = {
  spikes: {icon:'🌵', name:'地刺',  cost:30, charges:5, dmg:8},
  mine:   {icon:'💣', name:'地雷',  cost:45, charges:1, dmg:25, aoe:80},
};
// ── 城堡塔防制（v47回退）：塔自由放置在城堡平台上 ──
const FORTRESS_BASE_SLOTS = [170, 310, 450, 590];
const TOWER_SLOTS = [];  // 保留空数组兼容旧代码
const CASTLE_TOWER_SLOTS = [];
const TOWER_MAX_COUNT = 8;  // 基础软上限：8座塔
function getTowerMaxCount(){
  return TOWER_MAX_COUNT + ((typeof getBackpackTowerCapBonus === 'function') ? getBackpackTowerCapBonus() : 0);
}
const TOWER_PLACE_MIN_X = 30;    // 平台最左放置点（紧贴左墙内侧）
const TOWER_PLACE_MAX_X = 705;   // 平台最右放置点（紧贴右墙内侧）
const TOWER_PLACE_MIN_GAP = 50;  // 塔之间最小间距，避免重叠

