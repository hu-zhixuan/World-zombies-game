// ═══════════════════════════════════════════════════════════════════
//  01.5 战备工事升级与秘密深夜菜品配方 (CABIN_UPGRADE_ITEMS & RECIPES)
// ═══════════════════════════════════════════════════════════════════
const CABIN_UPGRADE_ITEMS = [
  {
    id: 'turret',
    icon: '🗼',
    name: '城垛自动速射炮',
    maxLevel: 3,
    getCost: (lvl) => {
      if (lvl === 0) return { wood: 3, scrap: 2, coins: 40 };
      if (lvl === 1) return { wood: 5, scrap: 4, coins: 60 };
      if (lvl === 2) return { wood: 8, scrap: 6, coins: 80 };
      return null;
    },
    getDesc: (lvl) => {
      if (lvl === 0) return "在城垛高台搭建自动速射炮塔，居高临下自动索敌俯射逼近的僵尸";
      if (lvl === 1) return "升级双管加特林机匣，射速+40%并附带穿甲撕裂伤害";
      if (lvl === 2) return "加装红外火控雷达，全场索敌射程扩大至700px，发射高爆穿甲弹";
      return "已达最大等级！";
    }
  },
  {
    id: 'barricade',
    icon: '🏰',
    name: '花岗岩城垛要塞加固',
    maxLevel: 5,
    getCost: (lvl) => {
      if (lvl >= 5) return null;
      return { wood: 2 + lvl, scrap: 1 + lvl, coins: 30 + lvl * 10 };
    },
    getDesc: (lvl) => {
      if (lvl >= 5) return "已达最大等级！";
      return `加固主城墙与高台城垛防御，增加城墙HP上限并使防线获得永久减伤 (当前: -${lvl * 5}%, 下级: -${(lvl + 1) * 5}%)`;
    }
  },
  {
    id: 'supplier',
    icon: '📦',
    name: '高台战术军备架',
    maxLevel: 2,
    getCost: (lvl) => {
      if (lvl === 0) return { wood: 4, scrap: 3, coins: 50 };
      if (lvl === 1) return { wood: 6, scrap: 5, coins: 70 };
      return null;
    },
    getDesc: (lvl) => {
      if (lvl === 0) return "在城垛平台放置物资架，每波战斗开始时自动空投弹药补给箱";
      if (lvl === 1) return "物资架升级，每波战斗开始时额外空投急救包医疗补给箱";
      return "已达最大等级！";
    }
  },
  {
    id: 'fortify',
    icon: '🏛️',
    name: '主城避难要塞扩建',
    maxLevel: 3,
    getCost: (lvl) => {
      if (lvl === 0) return { wood: 5, scrap: 4, coins: 60 };
      if (lvl === 1) return { wood: 8, scrap: 6, coins: 90 };
      if (lvl === 2) return { wood: 12, scrap: 10, coins: 150 };
      return null;
    },
    getDesc: (lvl) => {
      if (lvl === 0) return "扩建核心主堡，据点最大生命+50（当前100→150）";
      if (lvl === 1) return "加固内部安全舱，据点最大生命+50（150→200）";
      if (lvl === 2) return "避难要塞完工，据点最大生命+100（200→300）+ 城墙自动修复";
      return "已达最大等级！";
    }
  },
  {
    id: 'farm',
    icon: '⚙️',
    name: '战备物资后勤处',
    maxLevel: 3,
    getCost: (lvl) => {
      if (lvl === 0) return { wood: 4, scrap: 2, coins: 30 };
      if (lvl === 1) return { wood: 6, scrap: 4, coins: 50 };
      if (lvl === 2) return { wood: 10, scrap: 8, coins: 80 };
      return null;
    },
    getDesc: (lvl) => {
      if (lvl === 0) return "设立后勤工坊，每波开始自动收集 2 木材 + 1 废铁";
      if (lvl === 1) return "扩建回收流水线，每波产出 4 木材 + 2 废铁";
      if (lvl === 2) return "自动化后勤完备，每波产出 6 木材 + 3 废铁 + 20 金币";
      return "已达最大等级！";
    }
  },
  {
    id: 'watchtower',
    icon: '🔭',
    name: '高台鹰眼瞭望塔',
    maxLevel: 2,
    getCost: (lvl) => {
      if (lvl === 0) return { wood: 6, scrap: 3, coins: 40 };
      if (lvl === 1) return { wood: 10, scrap: 6, coins: 70 };
      return null;
    },
    getDesc: (lvl) => {
      if (lvl === 0) return "在城堡最高点设立瞭望哨，扩大侦察视野并显示僵尸血量";
      if (lvl === 1) return "高台弹道测算，居高临下使全员枪械与防御塔伤害永久+12%";
      return "已达最大等级！";
    }
  }
];

// 菜谱定义：消耗肉块 → 产出金币
// unlockWave: 解锁波次（让玩家有渐进感）
const RECIPES = [
  { id:'grilled_meat',  name:'烤肉串',     unlockWave:1, cost:{normal:2}, price:18,
    desc:'最简单的烤肉，填肚子用' },
  { id:'meat_soup',     name:'僵尸浓汤',   unlockWave:2, cost:{normal:3, fast:1}, price:35,
    desc:'加瘦肉熬的浓汤，鲜美暖身' },
  { id:'steak',         name:'铁板厚肉',   unlockWave:3, cost:{tank:2}, price:55,
    desc:'巨型僵尸的厚肉铁板烧，分量十足' },
  { id:'mixed_grill',   name:'混合烤拼盘', unlockWave:4, cost:{normal:2, fast:2, tank:1}, price:80,
    desc:'三种肉混烤，搭配均衡' },
  { id:'elite_hotpot',  name:'异变火锅',   unlockWave:5, cost:{elite:1, normal:3}, price:120,
    desc:'加入异变肉的火锅，味道刺激' },
  { id:'feast',         name:'末日大餐',   unlockWave:7, cost:{normal:4, fast:3, tank:2, elite:1}, price:250,
    desc:'集齐所有肉料的终极盛宴，富豪专属' },
  { id:'king_feast',    name:'霸王末日能量煲', unlockWave:1, cost:{normal:3, fast:2, tank:2, elite:1}, price:360,
    desc:'【绝密秘方】融合废土野山椒与变异全肉宴，食客赞不绝口，食用后全武器伤害+20%！', secret:true },
];


