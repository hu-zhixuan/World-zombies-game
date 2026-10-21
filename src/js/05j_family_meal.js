// ════════════════════════════════════════════════════════════════════════════
//  【昨晚的饭】食堂是唯一的"备战饭"来源
//  - 卖给客人：赚钱+声望，品质 good+ 的菜顺带给下一波一个数值增益（queuedBattleBuffs）
//  - 留一份：不卖，带上战场——该菜的「招牌特效」(DISH_SIGNATURES) + 更强的数值增益，队友同享
//  原先据点里单独的"战备特餐灶台"已并入这里，不再和食堂抢肉。
// ════════════════════════════════════════════════════════════════════════════

// 招牌特效：挂在食堂菜谱上（REST_RECIPES[].signatureId），战斗里的效果代码读 activeSignature.id
const DISH_SIGNATURES = [
  {
    id: 'spicy', name: '麻辣爆烤', icon: '🌶️🍖', badge: '翻滚烈焰', color: '#ff4422',
    desc: '吃下去全身血液沸腾。闪避翻滚时在身后留下一道灼热烈焰火海，踏入的僵尸每秒受到持续灼烧。',
    effectDesc: '空格翻滚留火海(4秒持续·每秒140点伤害) + 移速+15%',
  },
  {
    id: 'frost', name: '极光霜冻排', icon: '❄️🥩', badge: '极寒剑气', color: '#55ccff',
    desc: '深层极寒凝结的变异排骨。挥砍与射击发射穿透冰霜剑气，命中敌人强效减速并引发碎冰连环震荡爆破。',
    effectDesc: '挥砍/射击释放冰霜剑气 + 命中减速70% + 碎冰范围AoE爆破',
  },
  {
    id: 'stew', name: '十全大补汤', icon: '🍲✨', badge: '护体冲击波', color: '#ffd700',
    desc: '慢火熬制的秘汤。持续自动回复生命，受创时爆发环形冲击波震飞周围所有僵尸。',
    effectDesc: '每1.5秒自动回2血 + 受创爆发150px冲击波震飞眩晕2秒',
  },
  {
    id: 'thunder', name: '爆裂雷光拼盘', icon: '⚡🍢', badge: '天谴连锁雷', color: '#dd66ff',
    desc: '带电异变核心与瘦肉爆炒的激流料理。射击暴击或爆头时引动天降落雷，在多只僵尸间跳跃超导电离。',
    effectDesc: '暴击/爆头引动天降落雷(80点雷伤)并在周围4目标超导跳跃',
  },
  {
    id: 'dragon', name: '龙息炙烤盛宴', icon: '🐉🔥', badge: '地狱龙息', color: '#ff8800',
    desc: '汇聚所有肉类的终极战争大餐。开火时25%概率触发大范围扇形龙息焦土，伤害+35%并直接激活超武觉醒！',
    effectDesc: '开火25%概率喷射龙息焦土 + 全伤害+35% + 立即激活超武觉醒',
  },
];

// 昨晚吃了什么（战斗 HUD 显示用）：[{name, family}]
let lastMealLog = [];
// 食堂做好的"留饭"，下一波开战前吃：{recipeId, name, quality, signatureId}
let queuedFamilyMeal = null;

// 增益品质等级：good=0，perfect=1，legendary=2 stacks 视为 +1
function _buffRank(b){ return (b.boosted ? 1 : 0) + (b.stacks >= 2 ? 1 : 0); }

// 把一道菜的数值增益排进下一波。卖出的菜和留饭共用这一个入口。
// 返回 true 表示这份增益带"完美强化"(×1.5)。同名增益刷新，但低品质不会覆盖高品质。
function queueDishBuff(recipe, quality, opts){
  if(!recipe || !recipe.buffId) return false;
  if(quality !== 'good' && quality !== 'perfect' && quality !== 'legendary') return false;
  const entry = {
    id: recipe.buffId,
    stacks: quality === 'legendary' ? 2 : 1,
    boosted: quality === 'perfect' || quality === 'legendary',
    dishName: recipe.name,
    family: !!(opts && opts.family),
  };
  const old = queuedBattleBuffs.find(b => b.id === entry.id);
  if(old){
    if(_buffRank(entry) < _buffRank(old)) return false;
    queuedBattleBuffs = queuedBattleBuffs.filter(b => b !== old);
  }
  queuedBattleBuffs.push(entry);
  return entry.boosted;
}

// 这道菜有没有招牌特效可留
function recipeSignature(recipe){
  return recipe && recipe.signatureId ? DISH_SIGNATURES.find(s => s.id === recipe.signatureId) : null;
}

// 今晚还能不能留饭（每晚一份，且上一份还没吃掉）
function canPackFamilyMeal(){
  return !queuedFamilyMeal;
}

// 留饭做好了（灶台出菜时调用，取代"上出餐口"）
function packFamilyMeal(recipe, quality){
  const sig = recipeSignature(recipe);
  if(quality === 'burned'){
    addBanner('🔥 「' + recipe.name + '」烤焦了，留饭作废……');
    return false;
  }
  queuedFamilyMeal = { recipeId: recipe.id, name: recipe.name, quality, signatureId: sig ? sig.id : null };
  queueDishBuff(recipe, quality, { family: true });
  if(restState) restState.familyMeal = queuedFamilyMeal;
  const boosted = (quality === 'perfect' || quality === 'legendary');
  addBanner('🍱 留好了一份「' + recipe.name + '」' + (sig ? '——明天出击前和队友一起吃：' + sig.badge : '') + (boosted ? '（完美强化）' : ''));
  if(typeof addRestFloatText === 'function') addRestFloatText('🍱 留饭：' + recipe.name, REST_CANVAS_W * 0.5, REST_CANVAS_H * 0.2, '#ffd840');
  return true;
}

// 下一波开战前（nextWave 调用）：把夜里的饭变成战场上的效果
//  1) 排队的数值增益 → 本波生效（含完美强化）
//  2) 留饭 → 招牌特效 + 队友同享（满血、射速提升）
//  3) 记下"昨晚吃了什么"给 HUD
function applyOvernightMeals(){
  lastMealLog = [];
  if(queuedBattleBuffs.length > 0){
    // v52两界互锁：完美品质增益——效果×1.5（层数向上取整）、持续+50%
    activeBattleBuffs = queuedBattleBuffs.map(b => {
      const boostMul = b.boosted ? 1.5 : 1;
      const dur = Math.round(60*60 * (b.boosted ? 1.5 : 1));
      return {...b, stacks: Math.max(1, Math.ceil(b.stacks*boostMul)), timeLeft: dur};
    });
    activeBattleBuffs.forEach(b => {
      if(b.dishName && !lastMealLog.some(m => m.name === b.dishName)) lastMealLog.push({ name: b.dishName, family: !!b.family });
    });
    const names = activeBattleBuffs.map(b => {
      const def = BATTLE_BUFF_DEFS[b.id];
      const qTag = b.boosted ? '✨' : '';
      return def ? def.icon + def.name + qTag : b.id;
    }).join(' ');
    addBanner('🍲 美味增益生效：' + names + (activeBattleBuffs.some(b => b.boosted) ? '（含完美强化）' : ''));
    // v52肉鸽·餐厅线：余味悠长——增益本波结束后保留一半层数进队列（不再单波清零）
    if(playerPerks.buffextend){
      queuedBattleBuffs = queuedBattleBuffs.map(b => ({id:b.id, stacks:Math.max(1, Math.ceil(b.stacks/2)), dishName:b.dishName}));
      addBanner('⏳ 余味悠长：增益层数减半延续至下一波');
    }else{
      queuedBattleBuffs = [];  // 消耗队列（每夜菜品只强化下一波）
    }
  }else{
    activeBattleBuffs = [];  // 无新增益则清空（不无限续）
  }

  activeSignature = null;
  if(queuedFamilyMeal){
    const sig = DISH_SIGNATURES.find(s => s.id === queuedFamilyMeal.signatureId) || null;
    activeSignature = sig;
    if(!lastMealLog.some(m => m.name === queuedFamilyMeal.name)) lastMealLog.push({ name: queuedFamilyMeal.name, family: true });
    // 队友同享：满血站起来，射速/治疗频率+25%
    hiredCompanions.forEach(c => {
      if(!c) return;
      c.mealBoost = 1.25;
      c.downed = false;
      c.hp = c.maxHp;
    });
    if(sig) addBanner('🍱 留饭「' + queuedFamilyMeal.name + '」：' + sig.icon + sig.badge + '！队友同享（满血·射速+25%）');
    else addBanner('🍱 留饭「' + queuedFamilyMeal.name + '」：队友同享（满血·射速+25%）');
    queuedFamilyMeal = null;
  }
}

// 一波结束（onWaveCleared 调用）：饭吃完了
function endOvernightMeals(){
  if(activeSignature){
    addBanner('🍱 留饭的劲儿用完了。今晚再留一份吧！');
    activeSignature = null;
  }
  hiredCompanions.forEach(c => { if(c) c.mealBoost = 1; });
  lastMealLog = [];
}
