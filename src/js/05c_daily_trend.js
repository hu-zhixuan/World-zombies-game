// ════════════════════════════════════════════════════════════════════════════
//  【每日任务系统】参考 Kairosoft 的每日目标机制
//  每夜开始时生成3个任务，完成给金币奖励，增加经营深度
// ════════════════════════════════════════════════════════════════════════════

const DAILY_TASK_TEMPLATES = [
  { id:'serve_n', desc:'服务{n}位顾客', check:(s)=>s.served>=s.n, reward:15, nOptions:[5,8,12] },
  { id:'perfect_dish', desc:'做出{n}道完美/传说菜品', check:(s)=>(s.perfectCount||0)>=s.n, reward:20, nOptions:[2,3,5] },
  { id:'earn_gold', desc:'赚取{n}金币', check:(s)=>s.earnings>=s.n, reward:10, nOptions:[30,50,80] },
  { id:'no_angry', desc:'不让任何顾客生气离开', check:(s)=>s.angry===0, reward:25, nOptions:[1] },
  { id:'vip_serve', desc:'接待{n}位VIP/特殊顾客', check:(s)=>(s.vipServed||0)>=s.n, reward:30, nOptions:[1,2] },
  { id:'drink_serve', desc:'送出{n}杯饮料', check:(s)=>(s.drinksServed||0)>=s.n, reward:12, nOptions:[3,5] },
];

let dailyTasks = [];  // 本夜任务列表

function generateDailyTasks(){
  dailyTasks = [];
  const shuffled = [...DAILY_TASK_TEMPLATES].sort(() => Math.random() - 0.5);
  for(let i = 0; i < 3 && i < shuffled.length; i++){
    const tpl = shuffled[i];
    const n = tpl.nOptions[Math.floor(Math.random() * tpl.nOptions.length)];
    dailyTasks.push({
      id: tpl.id + '_' + i,
      desc: tpl.desc.replace('{n}', n),
      n: n,
      reward: tpl.reward,
      check: tpl.check,
      completed: false,
    });
  }
}

function checkDailyTasks(){
  if(!restState) return;
  const stats = {
    served: restState.served || 0,
    perfectCount: restState.perfectCount || 0,
    earnings: restState.earnings || 0,
    angry: restState.angry || 0,
    vipServed: restState.vipServed || 0,
    drinksServed: restState.drinksServed || 0,
    n: 0,
  };
  dailyTasks.forEach(task => {
    if(!task.completed){
      stats.n = task.n;
      try {
        if(task.check(stats)){
          task.completed = true;
          coins += task.reward;
          updateCoinUI();
          addBanner('🎯 任务完成！' + task.desc + ' +' + task.reward + '金');
          pushSideNotification('🎯 任务完成！', task.desc, '+' + task.reward + '金币', '#88ff88', 'info');
          sndLevelUp();
        }
      } catch(e){}
    }
  });
}

function getDailyTasksHTML(){
  if(!dailyTasks || dailyTasks.length === 0) return '';
  return dailyTasks.map(t => {
    const stats = restState ? {
      served: restState.served || 0,
      perfectCount: restState.perfectCount || 0,
      earnings: restState.earnings || 0,
      angry: restState.angry || 0,
      vipServed: restState.vipServed || 0,
      drinksServed: restState.drinksServed || 0,
      n: t.n,
    } : {n:t.n};
    let progress = '';
    try { progress = t.check(stats) ? '✓' : (t.id.startsWith('serve_n') ? Math.min(stats.served,t.n)+'/'+t.n : t.id.startsWith('no_angry') ? (stats.angry===0?'✓':'✗') : ''); } catch(e){}
    return `<div class="daily-task ${t.completed?'done':''}" style="padding:4px 8px;background:rgba(40,24,14,.5);border-radius:4px;border-left:3px solid ${t.completed?'#88ff88':'#ffcc44'};margin-bottom:3px;font-size:.62rem;color:${t.completed?'#88ff88':'#c8b898'};">
      ${t.completed?'✓':'○'} ${t.desc} <span style="color:#f0c060;float:right;">+${t.reward}金 ${progress}</span>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════════════════
//  【三位一体联动系统：热搜 → 抓捕 → 爆款】
//  社交媒体作为"指挥棒"，引导玩家抓特定僵尸、消耗特定肉块
// ════════════════════════════════════════════════════════════════════════════

// ── 1. 僵尸肉属性标签系统 ──
// 每种肉块带属性标签，用于配方相性判定和热搜匹配
// 基础标签（每种肉都有）+ 风味标签（决定热搜/相性匹配）
const MEAT_TAGS = {
  normal: { name:'普通肉', tags:['普通','鲜嫩','家常'], flavor:'基础' },
  fast:   { name:'瘦肉',   tags:['瘦','劲道','低脂','酸','冰爽'], flavor:'清爽' },  // 瘦肉带酸+冰爽（运动后乳酸）
  tank:   { name:'厚肉',   tags:['厚','油腻','饱腹','高蛋白','咸','重口'], flavor:'浓郁' },  // 厚肉带咸+重口+高蛋白
  elite:  { name:'异变肉', tags:['异变','刺激','高危','辣','高温','甜','软烂','烟熏','焦香','爆裂','霸气'], flavor:'神秘' },  // 异变肉带多种特殊风味
};

// 僵尸原型 → 额外标签（让特定僵尸掉落的肉带特殊属性，用于图鉴展示）
const ZOMBIE_MEAT_EXTRA_TAGS = {
  roamer:     ['家常'],
  sprinter:   ['酸','冰爽'],
  flagbearer: ['咸','重口'],
  bruiser:    ['厚','高蛋白'],
  coneblock:  ['硬','韧'],
  buckethead: ['铁腥','金属'],
  screendoor: ['木香','烟熏'],
  jumper:     ['弹','脆'],
  exploder:   ['辣','高温','爆裂'],
  spawner:    ['甜','软烂'],
  ranged:     ['焦香','灼热'],
  gargantuar: ['浓烈','霸气'],
};

// 获取某种肉的完整标签（基础+额外）
function getMeatTags(zombieKey, meatKind){
  const base = MEAT_TAGS[meatKind] ? MEAT_TAGS[meatKind].tags : [];
  const extra = ZOMBIE_MEAT_EXTRA_TAGS[zombieKey] || [];
  return [...new Set([...base, ...extra])];
}

// ── 2. 配方相性系统（标签契合度） ──
// 当菜品含特定标签组合时，触发相性加成
const SYNERGY_RECIPES = [
  { name:'酸甜解腻', tags:['酸','甜'], mult:1.5, desc:'酸+甜的经典搭配' },
  { name:'冰火两重天', tags:['冰爽','高温'], mult:1.8, desc:'冰与火的极致反差' },
  { name:'重口炸弹', tags:['辣','咸','重口'], mult:1.6, desc:'重口味三重奏' },
  { name:'高能蛋白', tags:['高蛋白','厚'], mult:1.4, desc:'健身餐级别的蛋白质' },
  { name:'异变盛宴', tags:['异变','刺激'], mult:2.0, desc:'异变者的终极享受' },
  { name:'烟熏风味', tags:['烟熏','焦香'], mult:1.5, desc:'烟熏焦香双重奏' },
  { name:'软糯甜心', tags:['甜','软烂'], mult:1.4, desc:'甜软入口即化' },
  { name:'爆裂口感', tags:['爆裂','脆'], mult:1.5, desc:'爆裂脆爽' },
  { name:'霸气盛宴', tags:['浓烈','霸气'], mult:1.8, desc:'霸者的盛宴' },
];

// 检测配方触发的相性
function detectSynergy(usedTags){
  const tagSet = new Set(usedTags);
  const triggered = [];
  for(const syn of SYNERGY_RECIPES){
    if(syn.tags.every(t => tagSet.has(t))){
      triggered.push(syn);
    }
  }
  return triggered;
}

// ── 3. 每日热搜系统 ──
// 每天刷新一条热搜，匹配标签的菜品售价+30%，且顾客更爱点
const DAILY_TRENDS = [
  // 普通肉热搜：开局只解锁烤肉串（普通肉）时，热搜也必须有得匹配，白天的"今日目标"才不落空
  { id:'homestyle',  tag:'家常',  text:'🏠 #想念家的味道，来点家常的#', desc:'【家常】标签菜品售价+30%', mult:1.3 },
  { id:'tender',     tag:'鲜嫩',  text:'🥩 #嫩一点，再嫩一点#', desc:'【鲜嫩】标签菜品售价+30%', mult:1.3 },
  { id:'hot_day',    tag:'冰爽',  text:'🌡️ #高温天气，快来一杯冰爽饮料！#', desc:'【冰爽】标签菜品售价+30%', mult:1.3 },
  { id:'spicy_night',tag:'辣',    text:'🌙 #深夜就想吃重口味#', desc:'【辣】标签菜品售价+30%', mult:1.3 },
  { id:'sweet_tooth',tag:'甜',    text:'🍰 #今天心情不好，想吃甜的#', desc:'【甜】标签菜品售价+30%', mult:1.3 },
  { id:'protein',    tag:'高蛋白',text:'💪 #健身打卡，高蛋白餐#', desc:'【高蛋白】标签菜品售价+30%', mult:1.3 },
  { id:'exotic',     tag:'异变',  text:'🛸 #异变美食挑战，敢吃吗？#', desc:'【异变】标签菜品售价+40%', mult:1.4 },
  { id:'smoky',      tag:'烟熏',  text:'🔥 #烟熏风味，复古美食#', desc:'【烟熏】标签菜品售价+30%', mult:1.3 },
  { id:'sour',       tag:'酸',    text:'🍋 #酸爽开胃，夏日首选#', desc:'【酸】标签菜品售价+30%', mult:1.3 },
  { id:'heavy',      tag:'重口',  text:'🧄 #重口味爱好者集合#', desc:'【重口】标签菜品售价+30%', mult:1.3 },
  { id:'hearty',     tag:'饱腹',  text:'🍖 #大口吃肉，饱腹满足#', desc:'【饱腹】标签菜品售价+30%', mult:1.3 },
];

let currentTrend = null;  // 今日热搜
let trendMeatToday = 0;   // 今天白天已收集的"热搜目标肉"数量（战斗 HUD 显示进度）

// 这条热搜现在有没有菜能吃到加成（用已解锁菜谱的肉类标签判定）
function trendMatchableNow(tr){
  try{
    return getUnlockedRecipes().some(r => getDishTags(r, null).includes(tr.tag));
  }catch(e){ return true; }
}

let nextTrendPreview = null;  // 梦境「预知之梦」提前抽好的明日热搜

// 在"当前能做出匹配菜"的热搜里抽一条，尽量不和 exclude 重复
function pickTrend(exclude){
  let pool = DAILY_TRENDS.filter(trendMatchableNow);
  if(pool.length === 0) pool = DAILY_TRENDS.filter(t => Object.keys(MEAT_TAGS).some(k => MEAT_TAGS[k].tags.includes(t.tag)));
  if(exclude && pool.length > 1) pool = pool.filter(t => t.id !== exclude.id);
  return pool[Math.floor(Math.random() * pool.length)];
}

// 热搜每天在白天第一波开始时刷新（nextWave→startWaveContent），晚上开张直接沿用，
// 这样玩家打僵尸时就知道今晚什么菜好卖。若梦里已预知明日热搜，则直接兑现那一条。
function rollDailyTrend(){
  currentTrend = nextTrendPreview || pickTrend(currentTrend);
  nextTrendPreview = null;
  trendMeatToday = 0;
  return currentTrend;
}

// 梦境用：提前抽好明天的热搜并返回
function previewTomorrowTrend(){
  nextTrendPreview = pickTrend(currentTrend);
  return nextTrendPreview;
}

// 热搜标签 → 哪种肉带这个标签 → 哪些僵尸掉这种肉
function getTrendHuntInfo(){
  if(!currentTrend) return null;
  const tag = currentTrend.tag;
  const kinds = Object.keys(MEAT_TAGS).filter(k => MEAT_TAGS[k].tags.includes(tag));
  const zombieNames = ZOMBIE_DEX
    .filter(z => kinds.includes(z.meatKind) && z.firstWave <= wave)
    .map(z => z.name);
  return { tag, kinds, zombieNames };
}

// 战斗里每拾取一块肉调用一次：命中热搜目标肉就累计
function noteTrendMeat(kind, n){
  const info = getTrendHuntInfo();
  if(info && info.kinds.includes(kind)) trendMeatToday += (n || 1);
}

// 白天第一波开始：公布今日热搜 + 今晚怎么赚、白天该打什么
function announceDailyGoal(){
  const info = getTrendHuntInfo();
  if(!info) return;
  const kindTxt = info.kinds.map(k => MEAT_TYPES[k].name).join('/');
  const hunt = info.zombieNames.length > 0
    ? '白天多打：' + info.zombieNames.slice(0, 3).join('、') + '（掉' + kindTxt + '）'
    : '白天多打：精英僵尸（掉' + kindTxt + '）';
  pushSideNotification('📱 今日热搜', currentTrend.text, currentTrend.desc + '｜' + hunt, '#ff8844', 'info');
}

// 检查菜品是否匹配今日热搜
function matchesTrend(dishTags){
  if(!currentTrend || !dishTags) return false;
  return dishTags.includes(currentTrend.tag);
}

// 获取菜品的标签（从配方+肉类推断）
function getDishTags(recipe, meats){
  const tags = new Set();
  if(recipe && recipe.cost){
    for(const meatKey in recipe.cost){
      const mp = MEAT_TAGS[meatKey];
      if(mp) mp.tags.forEach(t => tags.add(t));
    }
  }
  // 如果有具体肉类信息（动态菜品），加入额外标签
  if(meats && meats.length){
    meats.forEach(m => {
      if(m.extraTags) m.extraTags.forEach(t => tags.add(t));
    });
  }
  return Array.from(tags);
}

// ── 4. 社媒等级解锁系统（类似 Cooksta 等级） ──
const SOCIAL_MEDIA_RANKS = [
  { name:'路人账号',    minFans:0,    unlock:'基础经营', icon:'📱' },
  { name:'街角红人',    minFans:100,  unlock:'解锁二级灶台（可放2种肉做相性合成）', icon:'⭐' },
  { name:'废土网红',    minFans:500,  unlock:'解锁VIP贵宾客群（高消费）', icon:'🌟' },
  { name:'末日名店',    minFans:2000, unlock:'解锁高级菜谱（异变盛宴）', icon:'🏆' },
  { name:'宇宙名店',    minFans:10000,unlock:'解锁外星富豪客群（钱包天花板更高）', icon:'🛸' },
];

function getSocialMediaRank(){
  let rank = SOCIAL_MEDIA_RANKS[0];
  for(const r of SOCIAL_MEDIA_RANKS){
    if(wastegramFans >= r.minFans) rank = r;
  }
  return rank;
}

function getNextSocialMediaRank(){
  const cur = getSocialMediaRank();
  const idx = SOCIAL_MEDIA_RANKS.indexOf(cur);
  if(idx < SOCIAL_MEDIA_RANKS.length - 1) return SOCIAL_MEDIA_RANKS[idx + 1];
  return null;
}

// 检查社媒等级是否提升
let lastSMRankIdx = 0;
function checkSocialMediaRankUp(){
  const curRank = getSocialMediaRank();
  const curIdx = SOCIAL_MEDIA_RANKS.indexOf(curRank);
  if(curIdx > lastSMRankIdx){
    const oldRank = SOCIAL_MEDIA_RANKS[lastSMRankIdx];
    lastSMRankIdx = curIdx;
    addBanner(`${curRank.icon} 社媒升级！${oldRank.name} → ${curRank.name}！${curRank.unlock}`);
    pushSideNotification(
      '📱 社媒等级提升！',
      `${curRank.icon} ${curRank.name}`,
      curRank.unlock,
      '#dd88ff',
      'fans'
    );
    sndLevelUp();
  }
}

// ── 5. 热搜匹配时的特殊顾客反应 ──
function getTrendMatchReaction(customer, dish, tags){
  if(!currentTrend) return null;
  if(matchesTrend(tags)){
    return {
      text: '🔥 正合热搜！',
      color: '#ff8844',
      bonus: currentTrend.mult,
    };
  }
  return null;
}

// 检查VIP是否已解锁
function isVIPUnlocked(vipId){
  const vip = VIP_CUSTOMERS.find(v => v.id === vipId);
  if(!vip) return false;
  return wastegramFans >= vip.unlockFans;
}

// 获取所有已解锁的VIP
function getUnlockedVIPs(){
  return VIP_CUSTOMERS.filter(v => wastegramFans >= v.unlockFans);
}

// 获取本夜可来访的VIP（已解锁 + 本次未来访 + 一定概率）
function maybeSpawnVIPCustomer(){
  // 一次只允许一个VIP在店
  if(vipActiveInRestaurant) return null;
  const unlocked = getUnlockedVIPs();
  if(unlocked.length === 0) return null;
  // 筛选本夜未来访的
  const available = unlocked.filter(v => !restState.vipVisitedThisNight || !restState.vipVisitedThisNight.includes(v.id));
  if(available.length === 0) return null;
  // VIP出现概率：基础60% + 每多一个未访问VIP +8%（确保玩家容易遇到VIP）
  // 如果本夜还没来过任何VIP，则100%出现（保证每夜至少一个VIP剧情）
  const noVIPTonight = !restState.vipVisitedThisNight || restState.vipVisitedThisNight.length === 0;
  const chance = noVIPTonight ? 1.0 : (0.60 + available.length * 0.08);
  if(Math.random() > chance) return null;
  // 按权重选择
  const totalWeight = available.reduce((s,v) => s + v.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = available[0];
  for(const v of available){
    roll -= v.weight;
    if(roll <= 0){ chosen = v; break; }
  }
  // 记录本夜已访问
  if(!restState.vipVisitedThisNight) restState.vipVisitedThisNight = [];
  restState.vipVisitedThisNight.push(chosen.id);
  // 判断是否首次相遇
  const isFirstMeet = !vipCompendium[chosen.id] || !vipCompendium[chosen.id].met;
  vipActiveInRestaurant = chosen.id;
  return { vip: chosen, isFirstMeet: isFirstMeet };
}

// ── 触发VIP初遇剧情 ──
function triggerVIPFirstMeet(vip, onComplete){
  const tierInfo = VIP_TIERS[vip.tier];
  // 构建cinematic格式的对话行
  const lines = [];
  // 开场：阶级介绍
  lines.push({ scene:'hub', label:`${tierInfo.icon} ${tierInfo.name} · ${vip.name}` });
  // 初遇剧情台词
  vip.firstMeet.forEach(line => {
    if(line.npc){
      lines.push({ npc: line.npc, text: line.text });
    } else {
      lines.push({ speaker: line.speaker, text: line.text });
    }
  });
  // 标记为已相遇
  if(!vipCompendium[vip.id]) vipCompendium[vip.id] = { met:false, meetCount:0, bestQuality:null, lastVisit:0 };
  vipCompendium[vip.id].met = true;
  vipCompendium[vip.id].meetCount = (vipCompendium[vip.id].meetCount || 0) + 1;
  vipCompendium[vip.id].lastVisit = wave;
  // 播放cinematic
  showCinematic(lines, () => {
    addBanner(`✨ 图鉴更新：${vip.name} 已加入顾客图鉴！`);
    sndLevelUp();
    if(onComplete) onComplete();
  });
}

// ── VIP性格驱动的上菜反应 ──
function getVIPReaction(vip, quality){
  if(!vip || !vip.reactions) return null;
  return vip.reactions[quality] || vip.reactions.good || '';
}

// ── 应用VIP特殊效果 ──
function applyVIPSpecialEffect(vip, quality, customer){
  if(!vip || !vip.specialEffect) return;
  const satisfied = quality !== 'burned' && quality !== 'poor';
  switch(vip.specialEffect){
    case 'humble':
      // 阿狗：满意时不扣声望反而+1
      if(satisfied){ restRep = Math.min(60, restRep + 1); }
      break;
    case 'stimulant':
      // 老包：吃到辣味菜额外回血
      if(satisfied && quality === 'perfect'){ health = Math.min(maxHp, health + 5); updateHpUI(); }
      break;
    case 'mechanic':
      // 七姐：满意时下次烹饪速度+10%（一次性）
      if(satisfied && quality === 'perfect'){
        restState.cookSpeedBuff = (restState.cookSpeedBuff || 1) * 1.1;
        addBanner('🔧 七姐帮你调了灶台！本夜烹饪速度+10%！');
      }
      break;
    case 'haggler':
      // 泥鳅：满意时给稀有道具（弹药）
      if(satisfied && quality === 'legendary'){
        wAmmo[curWpnIdx] = Math.min(weaponMagSize(WEAPONS[curWpnIdx]), wAmmo[curWpnIdx] + 20);
        addBanner('🐀 泥鳅塞给你一盒进口子弹！+20发弹药！');
      }
      break;
    case 'paranoid':
      // 高老头：满意时给下波情报
      if(satisfied){
        addBanner('🤔 高老头透露：下波僵尸似乎在' + (wave+1) + '波集结了特殊单位...');
      }
      break;
    case 'scout':
      // 孤影：满意时给战术情报
      if(satisfied && quality !== 'good'){
        addBanner('🎯 孤影留下情报：下波注意精英单位动向。');
      }
      break;
    case 'broadcaster':
      // 幻音：满意时粉丝+15，不满意声望-3
      if(quality === 'legendary' || quality === 'perfect'){
        wastegramFans += 15;
        updateWastegramRank();
        addRestFloatText('📱 粉丝+15!', customer.walkX, customer.seat.y - 60, '#ff66cc');
      } else if(quality === 'burned' || quality === 'poor'){
        restRep = Math.max(-50, restRep - 3);
        addRestFloatText('声望-3', customer.walkX, customer.seat.y - 60, '#ff4444');
      }
      break;
    case 'cyborg':
      // 铜叔：满意时帮升级装备（随机+1伤害）
      if(quality === 'legendary'){
        upgrades.damage = (upgrades.damage || 0) + 1;
        addBanner('🦾 铜叔帮你改造了武器！伤害永久+1！');
      }
      break;
    case 'guardian':
      // 大山：满意时下波帮忙守
      if(satisfied && quality === 'perfect'){
        restState.dashanWillHelp = true;
        addBanner('🧗 大山拍着胸脯说：下波坏人来了，大山帮你打！');
      }
      break;
    case 'alchemist':
      // 白石：满意时给强化药剂
      if(satisfied && quality !== 'good'){
        damageBuffActive = (damageBuffActive || 0) + 1;
        addBanner('🧪 白石留下一瓶强化药剂！下波战斗伤害+20%！');
      }
      break;
    case 'tycoon':
      // 金老板：满意时给资源，不满意声望大降
      if(quality === 'legendary' || quality === 'perfect'){
        woodPlanks = (woodPlanks||0) + 10;
        scrapMetal = (scrapMetal||0) + 10;
        addBanner('💰 金老板承诺下波优先供水！木材+10 废料+10');
      } else if(quality === 'burned'){
        restRep = Math.max(-50, restRep - 8);
        addBanner('😡 金老板扬言要断水！声望-8！');
      }
      break;
    case 'legend':
      // 无名客：无论品质都给特殊子弹
      if(quality === 'legendary'){
        addBanner('✉️ 无名客留下了一件传说级信物...');
        coins += 200;
        updateCoinUI();
      } else {
        addBanner('✉️ 无名客留下了一颗黑桃子弹...');
        coins += 50;
        updateCoinUI();
      }
      break;
    case 'ghost':
      // 阎老：满意时给旧金币
      if(quality === 'legendary'){
        coins += 500;
        updateCoinUI();
        addBanner('🎩 阎老留下一枚旧时代金币！+500金！');
      } else if(satisfied){
        coins += 100;
        updateCoinUI();
        addBanner('🎩 阎老留下一枚旧金币。+100金');
      }
      break;
    case 'beastlord':
      // 兽王狂牙：满意时地狱犬帮守
      if(satisfied && quality !== 'good'){
        restState.hellhoundWillGuard = true;
        addBanner('🐺 狂牙的地狱犬答应下波帮你看门！');
      }
      if(quality === 'legendary'){
        // 额外送一座免费塔
        if(!window._freeTowerPending){ window._freeTowerPending = 0; }
        window._freeTowerPending++;
        addBanner('🐺 狂牙还留下了一头幼犬当看门兽！（下波免费+1防御塔）');
      }
      break;
    case 'godmode':
      // 观测者：解锁全成就 + 当夜菜品全传说
      if(satisfied){
        for(const key in achievements){
          if(!achievements[key].unlocked){
            achievements[key].unlocked = true;
            if(achievements[key].reward) achievements[key].reward();
          }
        }
        restState.godModeActive = true;
        addBanner('👁️ 观测者打了个响指——全成就解锁！本夜所有菜品自动传说品质！');
      }
      break;
  }
}

// ── 推送Wastegram动态 ──
function pushWastegramPost(authorOrObj, text, color){
  if(!restState) return;
  if(!restState.wastegramFeed) restState.wastegramFeed = [];
  // 支持对象格式 {author, text, color, tag} 和旧式 (author, text, color)
  let post;
  if(typeof authorOrObj === 'object'){
    post = { author: authorOrObj.author, text: authorOrObj.text, color: authorOrObj.color||'#dd88ff', tag: authorOrObj.tag||'', time: Date.now() };
  } else {
    post = { author: authorOrObj, text: text, color: color||'#dd88ff', tag:'', time: Date.now() };
  }
  restState.wastegramFeed.unshift(post);
  if(restState.wastegramFeed.length > 30) restState.wastegramFeed.pop();
}

