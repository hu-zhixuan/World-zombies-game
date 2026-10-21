// ═══════════════════════════════════════════════════════════
//  【新烹饪系统】玩家选肉放入锅中 → QTE决定品质 → 任何菜可给任何顾客
// ═══════════════════════════════════════════════════════════

// 品质等级：burned(烤焦) / poor(一般) / good(不错) / perfect(完美) / legendary(传说)
const DISH_QUALITY = {
  burned:  { name:'烤焦的', mult:0.3, color:'#444', desc:'黑乎乎的一坨...'},
  poor:    { name:'一般的', mult:0.7, color:'#aaa', desc:'勉强能吃'},
  good:    { name:'不错的', mult:1.0, color:'#88ff88', desc:'味道还行'},
  perfect: { name:'完美的', mult:1.5, color:'#FFD45E', desc:'绝佳美味！'},
  legendary: { name:'传说的', mult:3.0, color:'#ff44dd', desc:'废土传说！'},
};

// 肉类属性表
const MEAT_PROPS = {
  normal: { name:'普通肉', icon:'🥩', color:'#c87862', basePrice:10, cookTime:2 },
  fast:   { name:'瘦肉',   icon:'🍗', color:'#d89878', basePrice:15, cookTime:2 },
  tank:   { name:'厚肉',   icon:'🥩', color:'#a85838', basePrice:20, cookTime:3 },
  elite:  { name:'异变肉', icon:'💜', color:'#aa44cc', basePrice:30, cookTime:4 },
};

// 根据放入的肉组合，自动生成菜品
function generateDishFromMeats(meats){
  const counts = {};
  meats.forEach(m => { counts[m.type] = (counts[m.type]||0)+1; });
  const total = meats.length;
  const types = Object.keys(counts);
  if(total === 0) return null;
  let baseValue = 0;
  let cookTime = 2;
  for(const t of types){
    const mp = MEAT_PROPS[t];
    baseValue += mp.basePrice * counts[t];
    cookTime += mp.cookTime * counts[t] * 0.25;
  }
  const quantityBonus = 1 + (total - 1) * 0.25;
  let diversityBonus = 1;
  if(types.length >= 2) diversityBonus = 1.5;
  if(types.length >= 3) diversityBonus = 2.0;
  if(types.length >= 4) diversityBonus = 3.0;
  let price = Math.floor(baseValue * quantityBonus * diversityBonus);
  let name, icon, color, tier;
  const hasElite = counts.elite > 0;
  const hasTank = counts.tank > 0;
  const hasFast = counts.fast > 0;
  if(total >= 8 && hasElite && types.length >= 3){
    name = '末日帝王盛宴'; icon = '👑'; color = '#ff44dd'; tier = 'legendary';
  } else if(total >= 6 && hasElite){
    name = '异变满汉全席'; icon = '宴'; color = '#cc44ff'; tier = 'epic';
  } else if(total >= 5 && types.length >= 3){
    name = '废土豪华大餐'; icon = '奢'; color = '#ffaa44'; tier = 'epic';
  } else if(total >= 4 && hasElite){
    name = '异变盛宴'; icon = '宴'; color = '#aa44cc'; tier = 'rare';
  } else if(hasElite && total >= 2){
    name = '异变烤肉'; icon = '异'; color = '#aa44cc'; tier = 'rare';
  } else if(hasTank && hasFast && counts.normal > 0){
    name = '混合烤拼盘'; icon = '拼'; color = '#aa8855'; tier = 'uncommon';
  } else if(counts.tank >= 2){
    name = '双份铁板厚肉'; icon = '铁'; color = '#a85838'; tier = 'uncommon';
  } else if(counts.fast >= 2){
    name = '双份瘦肉串'; icon = '瘦'; color = '#d89878'; tier = 'uncommon';
  } else if(counts.normal >= 3){
    name = '大份烤肉拼盘'; icon = '大'; color = '#c87862'; tier = 'common';
  } else if(hasTank){
    name = '厚肉铁板烧'; icon = '铁'; color = '#a85838'; tier = 'common';
  } else if(hasFast){
    name = '瘦肉烤串'; icon = '瘦'; color = '#d89878'; tier = 'common';
  } else {
    name = '烤肉串'; icon = '烤'; color = '#c87862'; tier = 'common';
  }
  cookTime = Math.min(12, Math.floor(cookTime));
  return { name, icon, color, price, cookTime, tier, meatCount: total };
}

// 顾客评价（社交媒体风格）
const QUALITY_REVIEWS = {
  burned: [
    '这肉...是碳烤的吗？吃了一嘴灰 #避雷',
    '老板你是不是把灶台点着了？这肉黑得跟沥青一样',
    '我咬了一口，牙差点崩了。这是肉还是石头？',
    '难吃死了！这哪是烤肉，这是烤鞋底！ #差评',
    '吃了一口就饱了——因为恶心饱了。呕...',
    '这肉烤得比我前男友的心还黑 #分手既视感',
    '我给这盘菜起个名：碳化僵尸标本 #博物馆级别',
    '老板你确定这不是从焦土里挖出来的？',
  ],
  poor: [
    '嗯...能吃。就像末日前食堂的大锅饭',
    '味道一般，但这个年头有口吃的就不错了',
    '不难吃也不好吃，就是...嗯...存在着',
    '填肚子够了，但别问我味道如何',
    '性价比一般，不过比啃树皮强',
    '这味道...像是在吃回忆，而且是不好的那种',
  ],
  good: [
    '味道不错！在废土里能吃到这样的已经很满足了',
    '老板手艺可以啊，下次还来',
    '这肉烤得恰到好处，嫩度刚好',
    '吃完感觉又活过来了，谢谢老板！',
    '这手艺，末日前的馆子都未必比得上',
    '我来废土三年了，这是第一顿让我觉得"活着真好"的饭',
    '肉汁锁得很好，看得出来用了心 #小赞',
  ],
  perfect: [
    '天哪这也太好吃了8！！我哭了 #米其林废土',
    '这味道...让我想起了末日前的日子 😭',
    '老板你是不是偷了上帝的食谱？这简直绝了！',
    '我宣布这是废土第一餐厅！不接受反驳 #YYDS',
    '吃了一口就升天了，这是人间能有的味道吗？',
    '这不只是一顿饭，这是废土中的一束光 ✨',
    '如果我明天就死了，至少我吃到了这口 #此生无憾',
    '我当场决定：死后要葬在这家餐厅旁边 #圣地巡礼',
  ],
  legendary: [
    '我...我词穷了。这不是菜，这是艺术品 #封神',
    '一口咬下去，我看到了末日前的巴黎街头 😭😭😭',
    '如果废土有一个米其林十星，那就是这盘菜 #历史最佳',
    '老板，你是不是从旧世界穿越来的厨师？ #降维打击',
    '我吃了三十年饭，这是我这辈子吃过最好的一口 #此生必吃',
    '这盘菜值一个避难所的永久居住权 #无价之宝',
    '我决定改信"烤肉教"了，老板就是教皇 #美食邪教',
    '我现在理解了为什么僵尸要吃人——因为它们没吃过这家 #僵尸都嫉妒',
  ],
};

// 打开烹饪台——经营重做：菜单制（选今晚菜单里的菜谱烹饪，替代自由配肉）
let cookingPot = [];
function openCookingStation(){
  const modal = document.getElementById('rest-modal');
  const title = document.getElementById('rest-modal-title');
  if(!modal) return;
  cookingPot = [];
  title.textContent = '🍳 烹饪台 — 选择今晚菜单中的菜谱';
  renderCookingStation();
  modal.classList.add('open');
  sndShopOpen();
}

function renderCookingStation(){
  const coinsEl = document.getElementById('rest-modal-coins');
  const list = document.getElementById('rest-modal-list');
  coinsEl.innerHTML = `🥩普通×${meatInventory.normal} 🍗瘦×${meatInventory.fast} 🥩厚×${meatInventory.tank} 💜异×${meatInventory.elite} | 📋 今晚菜单: ${tonightMenu.length>0?tonightMenu.map(id=>(REST_RECIPES.find(r=>r.id===id)||{}).name).join('·'):'空（点顾客看TA点什么）'}`;
  list.innerHTML = '';
  // 菜谱列表：今晚注册菜单优先+肉够才能做；空菜单时允许做所有解锁菜（兜底）
  const menuIds = tonightMenu.length > 0 ? tonightMenu : getUnlockedRecipes().map(r=>r.id);
  const cookable = menuIds
    .map(id => REST_RECIPES.find(r => r.id === id))
    .filter(r => r);
  if(cookable.length === 0){
    const empty = document.createElement('div');
    empty.className = 'rest-modal-empty';
    empty.textContent = '暂无可做的菜——先在据点厨房注册今晚菜单';
    list.appendChild(empty);
    return;
  }
  cookable.forEach(recipe => {
    const canCook = Object.keys(recipe.cost).every(m => meatInventory[m] >= recipe.cost[m]);
    const div = document.createElement('div');
    div.className = 'rest-modal-item' + (canCook ? ' rmi-afford' : ' rmi-disabled');
    const inMenuTag = tonightMenu.includes(recipe.id) ? '📋' : '';
    div.innerHTML = `
      <span class="rest-modal-icon" style="color:${recipe.color};">${recipe.icon}</span>
      <span class="rest-modal-info">
        <span class="rest-modal-name">${inMenuTag}${recipe.name} <span style="font-size:.6rem;color:#f0c060;">${recipe.price}金</span></span>
        <span class="rest-modal-desc" style="font-size:.68rem;">${Object.keys(recipe.cost).map(m=>`${MEAT_TYPES[m].icon}${recipe.cost[m]}`).join(' ')} · ${recipe.cookTime}秒</span>
      </span>
      <span class="rest-modal-cost">${canCook?'✓可做':'缺肉'}</span>
    `;
    if(canCook){
      div.onclick = () => {
        closeRestModal();
        startCookingQTE(recipe);
      };
    }
    list.appendChild(div);
  });
}

function startCookingQTE(dish){
  // 菜单制：dish 是 REST_RECIPES 菜谱对象——先扣肉，QTE 只定品质
  const recipe = dish;
  const canCook = Object.keys(recipe.cost).every(m => meatInventory[m] >= recipe.cost[m]);
  if(!canCook){ addBanner('⚠ 肉不够了！'); return; }
  Object.keys(recipe.cost).forEach(m => { meatInventory[m] -= recipe.cost[m]; });
  startQTE('rhythm', { dish: recipe }, (result) => {
    let quality;
    if(result === 'perfect'){
      // 高级菜谱+运气 → 传说品质
      if(recipe.price >= 50 && Math.random() < 0.3) quality = 'legendary';
      else quality = 'perfect';
    }
    else if(result === 'good') quality = 'good';
    else quality = 'poor';  // v50模块四：QTE失败不再50%烤焦（主流程惩罚过重）——只出poor
    const cookTime = quality === 'poor' ? recipe.cookTime * 0.8 : recipe.cookTime;
    const stove = restStoves.find(s => s.recipe === null);
    if(!stove){
      // 灶满了：退肉（防呆）
      Object.keys(recipe.cost).forEach(m => { meatInventory[m] += recipe.cost[m]; });
      addBanner('灶眼都满了！肉已退回');
      return;
    }
    stove.recipe = recipe;
    stove.progress = 0;
    stove.totalTime = cookTime;
    stove.sizzleT = 0;
    stove._quality = quality;
    stove._cookedBy = null;
    sndCookSizzle();
    RestAudio.init();
    RestAudio.playSizzle();
    for(let i=0;i<6;i++){
      const fx = stove.x + 20 + (Math.random()-.5)*20;
      const fy = stove.y + 30;
      if(window._restParticles) window._restParticles.push({
        x:fx, y:fy, vx:(Math.random()-.5)*1.5, vy:-1-Math.random()*1.5,
        r:2+Math.random()*2, life:30, color:Math.random()>.5?'#ff6600':'#ffaa00'
      });
    }
    const qInfo = DISH_QUALITY[quality];
    addBanner(`🍳 烹饪中... ${qInfo.name}${recipe.name}（${qInfo.desc}）`);
    buildRestControls();
    cookingPot = [];
  });
}

function getDishReview(quality, dish, customer){
  const reviews = QUALITY_REVIEWS[quality] || QUALITY_REVIEWS.poor;
  return reviews[Math.floor(Math.random() * reviews.length)];
}

// v52清理：closeRestModal 在 11261 行已有定义，此处重复定义已删除（后者会静默覆盖前者）

// 旧的startCooking/cookBestRecipe保留但不再被UI调用（buildRestControls已改为openCookingStation）
function startCooking(recipe){
  // 兼容：转为新系统
  openCookingStation();
}
function cookBestRecipe(){
  // 兼容：转为新系统
  openCookingStation();
  return true;
}

// ── 一键上菜：任何就绪的菜给任何等待的顾客（不匹配order）
function serveAllReadyDishes(){
  if(!restState || restState.ended) return;
  let served = 0;
  let mismatch = 0;
  for(let i = restReadyDishes.length - 1; i >= 0; i--){
    const dish = restReadyDishes[i];
    // ── 经营重做：一键上菜只给"点对单"的顾客端菜 ──
    // 先找点了这道菜的顾客；没人点这道菜则跳过（不硬塞）
    const dishName = dish.recipe && dish.recipe.name;
    const matchCust = restState.customers.find(c =>
      c.state === 'seated' && (
        (c.order && dish.recipe && dish.recipe.recipeId === c.order) ||
        (c.order && (REST_RECIPES.find(r=>r.id===c.order)||{}).name === dishName) ||
        (!c.order)  // 没点单的顾客兜底
      )
    );
    if(matchCust){
      if(restWasabi < 5){
        addBanner('⚠ 芥末不够！点击芥末台补充');
        break;
      }
      restReadyDishes.splice(i, 1);
      matchCust.state = 'eating';
      matchCust.eatTimer = 2;
      matchCust._dishQuality = dish.quality || 'good';
      matchCust._servedDish = dish.recipe;
      const accepted = serveCustomer(matchCust);
      if(accepted === false){
        // 被拒（罕见兜底）：菜退回
        restReadyDishes.splice(i, 0, dish);
        matchCust.state = 'seated';
        matchCust.eatTimer = 0;
        mismatch++;
      }else{
        served++;
      }
    }
  }
  if(served > 0){
    addBanner('🍽️ 一键上菜 ' + served + ' 份！');
  } else {
    if(restReadyDishes.length > 0 && mismatch === 0){
      addBanner('⚠ 没有顾客点这些菜——看顾客头顶的点单气泡做对应的菜');
    } else if(restReadyDishes.length === 0){
      addBanner('出餐口没有菜，去烹饪台做菜吧');
    }
  }
}

// 烹饪音效：嗞嗤声（替代错误的 sndReload）
function sndCookSizzle(){
  try{
    const ac = getACtx(); if(!ac) return;
    const now = ac.currentTime;
    // 白噪声嗞嗤
    const bufferSize = ac.sampleRate * 0.3;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0; i<bufferSize; i++){ data[i] = (Math.random()*2-1) * (1 - i/bufferSize) * 0.3; }
    const src = ac.createBufferSource(); src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 2000;
    const gain = ac.createGain(); gain.gain.value = 0.18;
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    src.start(now); src.stop(now + 0.3);
    // 低频"滋"声
    const osc = ac.createOscillator();
    const og = ac.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = 180;
    og.gain.setValueAtTime(0.08, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(og); og.connect(ac.destination);
    osc.start(now); osc.stop(now + 0.25);
  }catch(e){}
}

// 菜品完成音效
function sndDishReady(){
  try{
    const ac = getACtx(); if(!ac) return;
    const now = ac.currentTime;
    [0, 0.08, 0.16].forEach((t, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600 + i*200;
      g.gain.setValueAtTime(0.12, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.15);
      osc.connect(g); g.connect(ac.destination);
      osc.start(now + t); osc.stop(now + t + 0.15);
    });
  }catch(e){}
}

// 轻量更新菜品按钮状态（不重建DOM）
function updateRestButtonStates(){
  const recipes = getUnlockedRecipes();
  // 只更新菜品按钮（排除雇佣/升级管理按钮，它们没有 .can-make-count 子元素）
  const dishBtns = document.querySelectorAll('.dish-btn .can-make-count');
  dishBtns.forEach((canMakeEl) => {
    const btn = canMakeEl.closest('.dish-btn');
    if(!btn) return;
    // 通过 data-recipe-id 找到对应菜谱
    const recipeId = btn.dataset.recipeId;
    const r = recipes.find(rr => rr.id === recipeId);
    if(!r) return;
    let canMake = Infinity;
    for(const m in r.cost){
      canMake = Math.min(canMake, Math.floor((meatInventory[m]||0) / r.cost[m]));
    }
    canMake = canMake === Infinity ? 0 : canMake;
    btn.disabled = canMake === 0;
    canMakeEl.textContent = '×' + canMake;
    canMakeEl.style.color = canMake > 0 ? '#88ff88' : '#ff6666';
  });
  // 更新食材库存显示
  const stockRow = document.querySelector('.rest-stock-row');
  if(stockRow){
    const meatTypes = [
      {key:'normal', icon:'🥩', color:'#c87862'},
      {key:'fast', icon:'🍗', color:'#d89878'},
      {key:'tank', icon:'🥩', color:'#a85838'},
      {key:'elite', icon:'💜', color:'#aa44cc'},
    ];
    stockRow.innerHTML = '<span style="color:#b0a284;">食材:</span>' + meatTypes.map(m =>
      `<span style="color:${m.color}">${m.icon}${meatInventory[m.key]||0}</span>`
    ).join('');
  }
}

// ── 顾客生成（参考戴夫：满座时排队，部分客人会点饮料加小费）──
function spawnRestCustomer(){
  let emptySeats = [];
  restTables.forEach(t => {
    t.seats.forEach(s => { if(!s.occupied) emptySeats.push(s); });
  });
  // 检查是否生成VIP顾客（粉丝数驱动）
  const vipResult = maybeSpawnVIPCustomer();

  // 构建顾客数据（无order字段）
  function buildCustomer(seat, isQueuing){
    let ctype;
    let persona = null;
    if(vipResult){
      const vip = vipResult.vip;
      ctype = { id:'vip', name:vip.name, color:vip.color, patienceMul:vip.patienceMul, tipMul:vip.tipBonus, weight:0, icon:vip.icon, desc:vip.bg, personality:vip.personalityType, dialogues:vip.dialogues };
      if(vipResult.isFirstMeet){
        triggerVIPFirstMeet(vip, () => {
          addBanner('✨ ' + vip.name + ' 入座了！');
          pushWastegramPost({author:vip.name, tag:'[VIP]', text:'初次光临据点餐厅！', color:vip.color});
          // 侧边通知
          pushSideNotification('✨ VIP 来访！', vip.name + ' 入座了', VIP_TIERS[vip.tier].name + ' · ' + vip.personality, vip.color, 'vip');
        });
      } else {
        addBanner('👋 老顾客回来了：' + vip.name);
        pushSideNotification('👋 老顾客', vip.name + ' 回来了', '', vip.color, 'vip');
      }
    } else {
      ctype = pickCustomerType();
      // 为每个普通顾客生成名字+故事
      persona = generateNormalCustomerPersona();
    }
    const decorBonus = 1 + restUpgradeLevel.decor * 0.1;
    const patience = (35 + Math.random()*20) * ctype.patienceMul * decorBonus;
    // ── 经营重做：顾客点单（从今晚注册菜单按偏好加权抽取）──
    // 偏好：美食家/评论家偏贵菜（吃得起）、急躁顾客偏快手菜（等不起）
    let orderDishId = null;
    const menuRecipes = tonightMenu
      .map(id => REST_RECIPES.find(r => r.id === id))
      .filter(r => r);
    if(menuRecipes.length > 0){
      let pool = menuRecipes;
      const cid = ctype.id;
      if((cid === 'gourmet' || cid === 'critic' || cid === 'vip') && menuRecipes.length > 1){
        pool = [...menuRecipes].sort((a,b) => b.price - a.price);  // 偏好贵的
        if(Math.random() < 0.35) pool = [pool[Math.floor(Math.random()*Math.min(2,pool.length))]];
      }else if(cid === 'impatient' && menuRecipes.length > 1){
        pool = [...menuRecipes].sort((a,b) => a.cookTime - b.cookTime);  // 偏好快的
        if(Math.random() < 0.35) pool = [pool[Math.floor(Math.random()*Math.min(2,pool.length))]];
      }
      const pick = pool[Math.floor(Math.random()*pool.length)];
      orderDishId = pick ? pick.id : menuRecipes[0].id;
    }
    const customer = {
      id: ++restState.customerIdCounter,
      seat: seat,
      ctype: ctype,
      persona: persona,  // 普通顾客的名字+故事
      patience: patience,
      maxPatience: patience,
      state: isQueuing ? 'queuing' : 'walking',
      walkX: isQueuing ? (REST_CANVAS_W * 0.7 + (restState.customers.filter(c => c.state === 'queuing').length) * 26) : -30,
      queueIdx: isQueuing ? restState.customers.filter(c => c.state === 'queuing').length : -1,
      eatTimer: 0,
      satisfaction: 1.0,
      wantsDrink: Math.random() < 0.45,
      drinkServed: false,
      drinkTimer: 0,
      order: orderDishId,  // 经营重做：顾客点具体菜（null=今晚没注册菜单，兜底任意菜）
      orderRejected: 0,    // 上错菜被拒次数（摇头动画计时）
      isVIP: !!vipResult,
      vipId: vipResult ? vipResult.vip.id : null,
      personalityType: vipResult ? vipResult.vip.personalityType : null,
      sleeping: false,
    };
    return customer;
  }

  // 有空位 → 直接入座
  if(emptySeats.length > 0){
    const seat = emptySeats[Math.floor(Math.random()*emptySeats.length)];
    const customer = buildCustomer(seat, false);
    seat.occupied = customer;
    restState.customers.push(customer);
  } else {
    // 满座 → 排队（最多2人，减少排队）
    const queueCount = restState.customers.filter(c => c.state === 'queuing').length;
    if(queueCount < 2){
      const customer = buildCustomer(null, true);
      restState.customers.push(customer);
    }
  }
}

// 按权重选择顾客类型（声望越高，特殊客人权重越高）
function pickCustomerType(){
  const repBonus = Math.min(1.0, restRep / 30);  // 声望30时达到最大加成
  const totalWeight = CUSTOMER_TYPES.reduce((s,t) => {
    // 普通客人权重随声望略降，特殊客人权重略升
    const w = t.id === 'normal' ? t.weight * (1 - repBonus * 0.3) : t.weight * (1 + repBonus * 0.5);
    return s + w;
  }, 0);
  let roll = Math.random() * totalWeight;
  for(const t of CUSTOMER_TYPES){
    const w = t.id === 'normal' ? t.weight * (1 - repBonus * 0.3) : t.weight * (1 + repBonus * 0.5);
    roll -= w;
    if(roll <= 0) return t;
  }
  return CUSTOMER_TYPES[0];
}

// ── 餐厅主循环 ──
function restLoop(now){
  if(!restState || gameState !== 'restaurant') return;
  // 暂停时跳过逻辑但保持 rAF 链，避免恢复后 dt 跳跃
  if(gamePaused){ restState.lastFrame = now; restRafId = requestAnimationFrame(restLoop); return; }
  // 教程/剧情显示时暂停客人生成和计时（让玩家看完提示）
  const tutScr = document.getElementById('tutorial-scr');
  if(tutScr && tutScr.style.display === 'flex'){ restState.lastFrame = now; restRafId = requestAnimationFrame(restLoop); return; }
  if(cinActive){ restState.lastFrame = now; restRafId = requestAnimationFrame(restLoop); return; }
  try{
  const dt = Math.min(0.1, (now - restState.lastFrame) / 1000);
  restState.lastFrame = now;

  restState.timeLeft -= dt;
  if(restState.timeLeft <= 0){
    // 时间到：不再生成新客人
    restState.timeLeft = 0;
    const unservedCustomers = restState.customers.filter(c => 
      c.state === 'seated' || c.state === 'queuing' || c.state === 'walking'
    );
    if(unservedCustomers.length === 0 && restReadyDishes.length === 0){
      // 所有客人都服务完毕，显示"打烊结算"按钮让玩家主动结束
      if(!restState.closingShown){
        restState.closingShown = true;
        addBanner('🌙 今日营业已结束！所有客人都服务完毕。点击"打烊结算"按钮结束今夜。');
        showCloseButton();
      }
    } else {
      if(!restState.timeUpNotice){
        restState.timeUpNotice = true;
        addBanner('⏰ 营业时间已到！不再来新客人，请服务完剩余客人后打烊。');
      }
    }
  } else {
    // 营业中：如果场上没客人了（都走了），也允许提前打烊
    const activeCustomers = restState.customers.filter(c => 
      c.state === 'seated' || c.state === 'queuing' || c.state === 'walking' || c.state === 'eating'
    );
    if(activeCustomers.length === 0 && restReadyDishes.length === 0 && restState.served > 0){
      // 没有客人了，显示"打烊结算"按钮
      if(!restState.closingShown){
        restState.closingShown = true;
        addBanner('🌙 所有客人都走了！可以点击"打烊结算"提前结束今夜，或等待新客人。');
        showCloseButton();
      }
    }
  }

  // 顾客生成：少而精致，10-15秒一个（给玩家充分时间做菜+QTE）
  restState.spawnTimer -= dt;
  if(restState.spawnTimer <= 0 && restState.timeLeft > 0){
    // 统计当前桌位使用情况
    let totalSeats = 0, occupiedSeats = 0;
    restTables.forEach(t => {
      t.seats.forEach(s => {
        totalSeats++;
        if(s.occupied) occupiedSeats++;
      });
    });
    const queueCount = restState.customers.filter(c => c.state === 'queuing').length;
    // ── 经营重做：声望阶级容量生效（REP_TIERS.maxCustomers=同时在店顾客上限）──
    // 低声望客源少（劣迹斑斑只来3人），高声望门庭若市（末日米其林12人）
    const repTierCap = (getRepTier() || {}).maxCustomers || 6;
    const activeNow = restState.customers.filter(c => c.state !== 'leaving').length;
    // 生成条件：有空位 或 排队人数<2（减少排队），且没超过声望容量
    const canSpawn = ((occupiedSeats < totalSeats) || (queueCount < 2)) && activeNow < repTierCap;
    if(canSpawn){
      spawnRestCustomer();
    }
    // 生成间隔：10-15秒一个（大幅减慢，给玩家时间做菜）
    const influencerMul = 1 + (restState.influencerBoost || 0) * 0.3;
    const baseInterval = Math.max(8.0, (12.0 - wastegramFans * 0.001) / influencerMul);
    restState.spawnTimer = baseInterval + Math.random() * 4.0;
  }

  // 更新顾客
  for(let i = restState.customers.length - 1; i >= 0; i--){
    const c = restState.customers[i];
    if(c.state === 'queuing'){
      // 排队等位：耐心缓慢下降，比就座时慢
      c.patience -= dt * 0.5;
      // 检查是否有空位了
      let emptySeats = [];
      restTables.forEach(t => {
        t.seats.forEach(s => { if(!s.occupied) emptySeats.push(s); });
      });
      if(emptySeats.length > 0){
        // 入座！
        const seat = emptySeats[Math.floor(Math.random()*emptySeats.length)];
        c.seat = seat;
        c.state = 'walking';
        c.queueIdx = -1;
        seat.occupied = c;
        // 重新计算排队的其他人位置
        const qCustomers = restState.customers.filter(cc => cc.state === 'queuing');
        qCustomers.forEach((qc, idx) => { qc.queueIdx = idx; qc.walkX = REST_CANVAS_W * 0.7 + idx * 26; });
      } else if(c.patience <= 0){
        // 排队等位耐心耗尽
        c.state = 'leaving';
        restState.angry++;
        restRep = Math.max(-50, restRep - 2);
        addRestFloatText('排队太久，走了!', c.walkX, REST_CANVAS_H * 0.52, '#ff8844');
        // 重新排队位置
        const qCustomers = restState.customers.filter(cc => cc.state === 'queuing' && cc !== c);
        qCustomers.forEach((qc, idx) => { qc.queueIdx = idx; qc.walkX = REST_CANVAS_W * 0.7 + idx * 26; });
      }
    } else if(c.state === 'walking'){
      const targetX = c.seat.x;
      const speed = 80;
      if(c.walkX < targetX) c.walkX = Math.min(targetX, c.walkX + speed * dt);
      else if(c.walkX > targetX) c.walkX = Math.max(targetX, c.walkX - speed * dt);
      if(Math.abs(c.walkX - targetX) < 2){
        c.state = 'seated'; c.walkX = targetX;
        // ── v51模块五：入座演出——桌板金光扩散+入座提示音 ──
        const fx2 = c.seat.x, fy2 = c.seat.y;
        for(let i=0;i<8;i++){
          const a2=Math.random()*Math.PI*2, sp2=1+Math.random()*2;
          window._restParticles.push({x:fx2,y:fy2-10,vx:Math.cos(a2)*sp2,vy:Math.sin(a2)*sp2-1,r:2+Math.random()*1.5,life:24,color:'#ffd840'});
        }
        try{  // 入座叮提示音
          const a=getACtx(); if(a){
            const now=a.currentTime;
            const o=a.createOscillator(),g=a.createGain();
            o.type='sine';o.frequency.setValueAtTime(880,now);
            o.frequency.setValueAtTime(1174,now+0.07);
            g.gain.setValueAtTime(0.08,now);
            g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
            o.connect(g);g.connect(a.destination);o.start(now);o.stop(now+0.2);
          }
        }catch(e){}
      }
    } else if(c.state === 'seated'){
      // 员工被动加成：耐心衰减减慢（每个员工-5%，最多-30%）
      const patienceMul = 1 - (restState.staffPatienceBonus || 0);
      c.patience -= dt * patienceMul;
      c.drinkTimer += dt;
      // 满意度随等待时间下降
      const patiencePct = c.patience / c.maxPatience;
      c.satisfaction = Math.max(0.3, patiencePct);
      if(c.patience <= 0){
        c.state = 'leaving';
        restState.angry++;
        restRep = Math.max(-50, restRep - 3);
        RestEventBus.emit(EVT.CUSTOMER_ANGRY, { customer: c });
        RestAudio.playGibberish('不等了', 150);
        // 评论家生气 → 额外声望损失
        if(c.ctype.id === 'critic'){ restRep = Math.max(-50, restRep - 5); addRestFloatText('评论家差评! -5声望', c.walkX, c.seat.y - 40, '#ff0000'); }
        c.seat.occupied = null;
        addRestFloatText('生气!', c.walkX, c.seat.y - 30, '#ff4444');
      }
    } else if(c.state === 'eating'){
      const bpEatSpd = (typeof getBackpackEatSpeedBonus === 'function') ? getBackpackEatSpeedBonus() : 0;
      c.eatTimer -= dt * (1 + bpEatSpd);
      if(c.eatTimer <= 0){
        c.state = 'leaving';
        c.seat.occupied = null;
      }
    } else if(c.state === 'leaving'){
      c.walkX -= 100 * dt;
      if(c.walkX < -30){ restState.customers.splice(i, 1); }
    }
  }

  // 更新灶台（含员工自动烹饪）
  restStoves.forEach(stove => {
    if(stove.recipe){
      stove.progress += dt;
      // 烹饪中冒泡特效
      if(window._restParticles && Math.random() < 0.3){
        window._restParticles.push({
          x: stove.x + 20 + (Math.random()-.5)*16,
          y: stove.y + 25,
          vx: (Math.random()-.5)*.8, vy: -1 - Math.random()*1.2,
          r: 1.5 + Math.random()*1.5, life: 20,
          color: Math.random()>.6 ? '#ff6600' : '#ffaa00'
        });
      }
      if(stove.progress >= stove.totalTime){
        // 观测者的上帝模式：所有菜品自动变成传说品质
        let finalQuality = restState.godModeActive ? 'legendary' : (stove._quality || 'good');
        // ── v52肉鸽·餐厅线：风味大师——20%/层几率品质升一档（在员工判定前）──
        if(!restState.godModeActive && playerPerks.flavorguru && finalQuality!=='legendary'){
          const qOrderF=['burned','poor','good','perfect','legendary'];
          const qiF=qOrderF.indexOf(finalQuality);
          if(qiF>=0 && qiF<qOrderF.length-1 && Math.random() < 0.20*playerPerks.flavorguru){
            finalQuality=qOrderF[qiF+1];
            addRestFloatText('👨‍🍳 风味大师!', stove.x+20, stove.y-10, '#ffdd66');
          }
        }
        // ── 员工养成：高等级厨师烹饪品质加成（Lv3+ 15%/级几率升一档品质）──
        if(!restState.godModeActive && stove._cookLevel >= 3){
          const qOrder=['burned','poor','good','perfect','legendary'];
          const qi=qOrder.indexOf(finalQuality);
          if(qi>=0 && qi<qOrder.length-1 && Math.random() < 0.15*(stove._cookLevel-2)){
            finalQuality=qOrder[qi+1];
          }
        }
        restReadyDishes.push({ recipeId: stove.recipe.id || 'dynamic', recipe: stove.recipe, quality: finalQuality });
        // 记录厨师贡献
        if(stove._cookedBy){stove._cookedBy.dishesCooked = (stove._cookedBy.dishesCooked||0)+1;}
        stove.recipe = null;
        stove.progress = 0;
        stove._cookedBy = null;
        stove._cookLevel = 0;
        sndDishReady();  // 菜品完成音效（替代错误的 sndCoin）
        // 完成视觉：金色粒子
        if(window._restParticles){
          for(let i=0;i<8;i++){
            window._restParticles.push({
              x: stove.x + 20, y: stove.y + 20,
              vx: (Math.random()-.5)*3, vy: -2 - Math.random()*2,
              r: 2+Math.random()*2, life: 30, color: '#ffee44'
            });
          }
        }
      }
    }
  });

  // ── 员工AI（增强版：更快烹饪+自动上菜+自动补芥末/饮料+顾客耐心加成）──
  // 员工贡献跟踪：staff.dishesCooked, staff.customersServed, staff.drinksServed
  // 经营重做：员工等级养成——每做3道菜/服务3位客人升1级（最高5级），等级提升品质与速度
  restState.staff.forEach(staff => {
    staff.timer -= dt;
    if(!staff.dishesCooked) staff.dishesCooked = 0;
    if(!staff.customersServed) staff.customersServed = 0;
    if(!staff.drinksServed) staff.drinksServed = 0;
    if(!staff.level) staff.level = 1;
    if(!staff.xp) staff.xp = 0;
    // ── 员工升级检查：烹饪/服务次数累计 → 升级（1-5级）──
    const oldLevel = staff.level;
    staff.xp = staff.type==='cook' ? staff.dishesCooked : (staff.customersServed + staff.drinksServed);
    staff.level = Math.min(5, 1 + Math.floor(staff.xp / 3));
    if(staff.level > oldLevel){
      addRestFloatText(`⭐${staff.name} 升到 Lv.${staff.level}!`, REST_CANVAS_W*0.5, REST_CANVAS_H*0.3, '#ffd840');
      // 升级同步回永久员工表（跨夜保留养成进度）
      const perm = restHiredStaff.find(s => s.id === staff.id);
      if(perm){ perm.level = staff.level; perm.xp = staff.xp; }
    }
    // 等级加速：Lv2+ 每级+15%工作速度
    const lvlSpeed = 1 + (staff.level - 1) * 0.15;
    if(staff.type === 'cook' && staff.timer <= 0){
      // 厨师自动烹饪（菜单制：只做今晚菜单里的菜；Lv3+ 有几率直接出完美品质）
      const stove = restStoves.find(s => s.recipe === null);
      if(stove){
        // 菜单优先；空菜单兜底用全部解锁菜
        const menuIds = tonightMenu.length > 0 ? tonightMenu : getUnlockedRecipes().map(r=>r.id);
        const recipes = menuIds.map(id => REST_RECIPES.find(r => r.id === id)).filter(r => r);
        let cookable = recipes.filter(r => Object.keys(r.cost).every(m => meatInventory[m] >= r.cost[m]));
        // 聪明厨师：优先做"有点单等菜"的顾客需要的菜
        const waitingOrders = restState.customers.filter(c => c.state === 'seated' && c.order).map(c => c.order);
        if(waitingOrders.length > 0){
          cookable.sort((a,b) => {
            const aNeed = waitingOrders.includes(a.id) ? 0 : 1;
            const bNeed = waitingOrders.includes(b.id) ? 0 : 1;
            return aNeed - bNeed || b.price - a.price;
          });
        }else if(staff.skill >= 1.0){
          cookable.sort((a,b) => b.price - a.price);
        }
        if(cookable.length > 0){
          if(restReadyDishes.length >= 2){
            // 暂停烹饪，避免堆积
          } else {
            const pick = cookable[0];  // 优先做等菜的顾客点的菜
            Object.keys(pick.cost).forEach(m => meatInventory[m] -= pick.cost[m]);
            stove.recipe = pick;
            stove.progress = 0;
            stove.totalTime = pick.cookTime / staff.skill / lvlSpeed / (restState.cookSpeedBuff || 1);
            stove._cookedBy = staff;  // 记录是哪个厨师做的
            stove._cookLevel = staff.level;  // 厨师等级（出餐品质用）
            sndCookSizzle();
          }
        }
      }
      // 厨师检查间隔：技能越高检查越频繁（0.6/skill → 更灵敏）
      staff.timer = 0.8 / staff.skill / lvlSpeed;
    }
    if(staff.type === 'server' && staff.timer <= 0){
      let didAction = false;
      // 服务员（菜单制）：只给点对单的顾客端对应的菜
      for(let ci = 0; ci < restState.customers.length; ci++){
        const c = restState.customers[ci];
        if(c.state !== 'seated') continue;
        if(restWasabi < 5) break;
        if(restReadyDishes.length > 0){
          // 找该顾客点的菜
          let dishIdx = -1;
          if(c.order){
            dishIdx = restReadyDishes.findIndex(d => d.recipe && (d.recipe.recipeId === c.order || (REST_RECIPES.find(r=>r.id===c.order)||{}).name === d.recipe.name));
          }else{
            dishIdx = 0;  // 没点单的顾客兜底
          }
          if(dishIdx >= 0){
            const dish = restReadyDishes.splice(dishIdx, 1)[0];
            c.state = 'eating';
            c.eatTimer = 2;
            c._dishQuality = dish.quality || 'good';
            c._servedDish = dish.recipe;
            const accepted = serveCustomer(c);
            if(accepted === false){
              restReadyDishes.splice(dishIdx, 0, dish);  // 退回
              c.state = 'seated';
              c.eatTimer = 0;
            }else{
              staff.serveFlash = 1.0;
              staff.customersServed++;
            }
            didAction = true;
            break;
          }
        }
      }
      // 服务员优先2：自动送饮料
      if(!didAction){
        for(let ci = 0; ci < restState.customers.length; ci++){
          const c = restState.customers[ci];
          if(c.state !== 'seated') continue;
          if(c.wantsDrink && !c.drinkServed){
            if(restDrinks <= 0) break;
            c.drinkServed = true;
            c.wantsDrink = false;
            restDrinks--;
            const drinkPay = Math.floor(5 + c.ctype.tipMul * 3);
            restState.earnings += drinkPay;
            coins += drinkPay;
            updateCoinUI();
            addRestFloatText('饮料+' + drinkPay + '金', c.walkX, c.seat.y - 20, '#88ccff');
            sndCoin();
            staff.serveFlash = 1.0;
            staff.drinksServed++;  // 员工贡献跟踪
            restState.drinksServed = (restState.drinksServed || 0) + 1;  // 每日任务追踪
            checkDailyTasks();
            didAction = true;
            break;
          }
        }
      }
      // 服务员优先3：芥末低于30%时自动补充
      if(!didAction && restWasabi < 30 && coins >= 10){
        coins -= 10;
        restWasabi = 100;
        updateCoinUI();
        addRestFloatText('芥末补满', 570, 100, '#88cc44');
        staff.serveFlash = 1.0;
      }
      staff.timer = 0.5 / staff.skill;  // 服务员检查更频繁（增强：0.5/skill 更灵敏）
    }
  });
  // ── 员工被动加成：每有一个员工，顾客耐心衰减减慢5%（最多减慢30%）──
  // 在 customer update 中通过 restState.staffPatienceBonus 读取
  restState.staffPatienceBonus = Math.min(0.3, restState.staff.length * 0.05);

  // 更新浮动文字
  for(let i = restState.floatTexts.length - 1; i >= 0; i--){
    restState.floatTexts[i].life -= dt;
    restState.floatTexts[i].y -= 30 * dt;
    if(restState.floatTexts[i].life <= 0) restState.floatTexts.splice(i, 1);
  }

  // 更新HUD（节流：每0.5秒更新一次，避免每帧操作DOM卡顿）
  if(!restState.hudTimer || restState.hudTimer <= 0){
    restState.hudTimer = 0.5;
    document.getElementById('rest-timer').textContent = Math.ceil(restState.timeLeft) + 's';
    document.getElementById('rest-rep').textContent = '声望: ' + restRep;
    document.getElementById('rest-earnings').textContent = '收入: ' + restState.earnings + '金';
    // 更新粉丝数显示
    const fansEl = document.getElementById('rest-fans-display');
    if(fansEl) fansEl.textContent = '📱粉丝 ' + wastegramFans + ' [' + wastegramRank + ']';
    // 更新声望阶级显示
    const tierEl = document.getElementById('rep-tier-display');
    if(tierEl){ const t = getRepTier(); tierEl.textContent = t.icon + ' ' + t.name + ' (声望' + restRep + ')'; tierEl.style.color = t.color; }
    // 更新每日任务面板
    const tasksList = document.getElementById('daily-tasks-list');
    if(tasksList){ tasksList.innerHTML = getDailyTasksHTML(); }
    // 更新今日热搜显示
    const trendEl = document.getElementById('trending-text');
    if(trendEl && currentTrend){
      trendEl.textContent = currentTrend.text;
      trendEl.title = currentTrend.desc;
    }
    // 更新社媒等级到粉丝显示
    const fansDisplay = document.getElementById('rest-fans-display');
    if(fansDisplay){
      const smRank = getSocialMediaRank();
      fansDisplay.textContent = '📱' + smRank.icon + wastegramFans + '[' + wastegramRank + ']';
      fansDisplay.title = smRank.name + ' | ' + smRank.unlock;
    }
    // 更新 Cooksta 徽章（新评价数）
    const badge = document.getElementById('cooksta-badge');
    if(badge){
      const feedCount = restState.wastegramFeed ? restState.wastegramFeed.length : 0;
      if(feedCount > 0){ badge.textContent = feedCount > 99 ? '99+' : feedCount; badge.style.display = 'flex'; }
      else { badge.style.display = 'none'; }
    }
    // 如果 Cooksta 面板开着，刷新内容
    const cookstaPanel = document.getElementById('cooksta-panel');
    if(cookstaPanel && cookstaPanel.classList.contains('open')) renderCookstaFeed();
    // 轻量更新按钮状态
    updateRestButtonStates();
    // ── v50模块四：烹饪行刷新——顾客入座/点单变化后菜谱高亮要跟着变
    // 节流重建（每2秒一次；只在"有客等的菜谱集合"或"可做状态"变化时重建，防闪烁）
    const waitingOrdersNow = restState.customers.filter(c=>c.state==='seated'&&c.order).map(c=>c.order).sort().join(',');
    const meatSig = meatInventory.normal+','+meatInventory.fast+','+meatInventory.tank+','+meatInventory.elite;
    const sig = waitingOrdersNow+'|'+meatSig;
    if(window._cookRowSig !== sig){
      window._cookRowSig = sig;
      buildRestControls();
    }
  } else {
    restState.hudTimer -= dt;
  }

  drawRestaurant();
  restRafId = requestAnimationFrame(restLoop);
  }catch(err){
    console.error('[restLoop] 异常:', err);
    restRafId = requestAnimationFrame(restLoop);
  }
}

// ── 上菜结算 ──
function serveCustomer(c){
  // ── 经营重做：点单校验（潜水员戴夫式——上错菜被拒）──
  // 顾客点了具体菜（c.order）：只有对的菜才被接受；错菜摇头拒绝，菜不消耗
  if(c.order && c._servedDish){
    const ordered = REST_RECIPES.find(r => r.id === c.order);
    const served = c._servedDish;
    const isMatch = served.recipeId ? (served.recipeId === c.order) : (ordered && served.name === ordered.name);
    if(!isMatch){
      c.orderRejected = 45;  // 摇头动画计时
      c.satisfaction = Math.max(0.3, c.satisfaction - 0.15);  // 上错菜降满意度
      addRestFloatText('✋ 我点的是' + (ordered ? ordered.name : '?') + '!', c.walkX, c.seat.y - 60, '#ff6644');
      RestAudio.playGibberish('点错了', 260);
      return false;  // 拒绝上菜（菜保留在出餐口）
    }
  }
  restWasabi = Math.max(0, restWasabi - 5);
  const decorBonus = 1 + restUpgradeLevel.decor * 0.15;
  const quality = c._dishQuality || 'good';
  const qInfo = DISH_QUALITY[quality] || DISH_QUALITY.good;
  const dishInfo = c._servedDish || c.order || { name:'烤肉', price:10, icon:'烤', color:'#c87862' };
  // ── 三位一体联动：标签+相性+热搜加成 ──
  const dishTags = getDishTags(dishInfo, null);
  const synergies = detectSynergy(dishTags);
  let synergyMult = 1;
  let synergyNames = [];
  synergies.forEach(s => { synergyMult *= s.mult; synergyNames.push(s.name); });
  // 热搜匹配加成
  let trendMult = 1;
  if(currentTrend && matchesTrend(dishTags)){
    trendMult = currentTrend.mult;
    c._trendMatched = true;  // 标记给粉丝系统用
  }
  // ── 行囊被动：战前窖藏干红 VIP打赏+50%，废土野山椒 菜品售价+25% ──
  const isVipCust = (c.ctype.id === 'vip' || c.ctype.id === 'gourmet' || c.ctype.id === 'critic' || c.ctype.id === 'influencer');
  const bpVipBonus = (isVipCust && typeof getBackpackVipTipBonus === 'function') ? getBackpackVipTipBonus() : 0;
  const bpDishBonus = (typeof getBackpackDishPriceBonus === 'function') ? getBackpackDishPriceBonus() : 0;
  const tipMul = c.ctype.tipMul * (1 + bpVipBonus) * c.satisfaction * decorBonus * qInfo.mult * synergyMult * trendMult;
  // ── 经营重做：米其林大厨 Lv3+ 菜品加价20%（员工养成激活）──
  let chefPriceBonus = 1;
  const chef3 = restState.staff.find(s => s.id === 'cook3' && s.level >= 3);
  if(chef3) chefPriceBonus = 1.2;
  // ── 收入平衡：餐厅收入系数0.6（原自由配肉定价虚高，菜单制后按菜谱价平衡到与战斗4:6）──
  const restEcon = 0.6 * (1 + (playerPerks.coinflow||0)*0.25) * (1 + bpDishBonus);
  const pay = Math.floor(dishInfo.price * tipMul * chefPriceBonus * restEcon);
  restState.earnings += pay;
  restState.served++;
  if(c.ctype.id === 'vip' || c.ctype.id === 'gourmet' || c.ctype.id === 'critic' || c.ctype.id === 'influencer') restState.vipServed++;
  coins += pay;
  updateCoinUI();
  // 相性触发提示
  if(synergyNames.length > 0){
    addRestFloatText('✨ ' + synergyNames[0] + '! x' + synergyMult.toFixed(1), c.walkX, c.seat.y - 75, '#ff44dd');
  }
  // 热搜匹配提示
  if(trendMult > 1){
    addRestFloatText('🔥 热搜匹配! x' + trendMult, c.walkX, c.seat.y - 88, '#ff8844');
  }
  // 声望增长：品质越好声望越高
  let repGain = c.ctype.id === 'vip' ? 4 : c.ctype.id === 'gourmet' ? 5 : 2;
  if(quality === 'perfect') repGain += 2;
  else if(quality === 'legendary') repGain += 4;
  else if(quality === 'burned') repGain -= 3;
  else if(quality === 'poor') repGain -= 1;
  // 评论家
  if(c.ctype.id === 'critic'){
    if(quality === 'perfect' || quality === 'legendary'){
      repGain = quality === 'legendary' ? 10 : 8;
      addRestFloatText('评论家狂赞! +' + repGain + '声望', c.walkX, c.seat.y - 50, '#22aaff');
    } else if(quality === 'burned'){
      repGain = -5;
      addRestFloatText('评论家怒批! -5声望', c.walkX, c.seat.y - 50, '#ff0000');
    } else if(c.satisfaction > 0.8){
      repGain = 5;
      addRestFloatText('评论家好评! +5声望', c.walkX, c.seat.y - 50, '#22aaff');
    } else {
      repGain = -2;
      addRestFloatText('评论家一般... -2声望', c.walkX, c.seat.y - 50, '#ff8800');
    }
  }
  // 网红
  if(c.ctype.id === 'influencer' && (quality === 'perfect' || quality === 'legendary')){
    restState.influencerBoost = (restState.influencerBoost || 0) + 1;
    restState.influencerBoostNew = (restState.influencerBoostNew || 0) + 1;
    addRestFloatText('网红打卡! 下一夜客流+30%', c.walkX, c.seat.y - 50, '#ff66cc');
  }
  restRep = Math.min(60, Math.max(-50, restRep + Math.floor(repGain * (repGain > 0 ? c.satisfaction : 1))));
  // ── 经营→战斗联动（激活 buffId）：品质 good+ 的菜按菜谱增益入队，下一波生效 ──
  // v52两界互锁：perfect+品质带 boosted 标记——下一波该增益效果×1.5、时长+50%
  if(quality === 'good' || quality === 'perfect' || quality === 'legendary'){
    const buffRecipe = c.order ? REST_RECIPES.find(r => r.id === c.order) : null;
    const buffId = (buffRecipe && buffRecipe.buffId) || null;
    if(buffId){
      const boosted = (quality === 'perfect' || quality === 'legendary');
      queuedBattleBuffs = queuedBattleBuffs.filter(b => b.id !== buffId);  // 同名增益刷新时长
      queuedBattleBuffs.push({ id: buffId, stacks: quality === 'legendary' ? 2 : 1, boosted });
      if(boosted){
        addRestFloatText('⚔ 完美品质！下波增益强化', c.walkX, c.seat.y - 105, '#ffd840');
      }
    }
  }
  // ── 美术E：上菜金色闪光（品质越高闪越强；粒子版闪光+放大金币飘字）──
  {
    const fx = c.walkX, fy = c.seat.y - 30;
    const shineN = quality === 'legendary' ? 16 : quality === 'perfect' ? 12 : 8;
    for(let i=0;i<shineN;i++){
      const a=Math.random()*Math.PI*2, sp=0.8+Math.random()*2.4;
      window._restParticles.push({x:fx,y:fy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.6,r:1.5+Math.random()*2,life:26,color:Math.random()>.3?'#ffd840':'#fff0a0'});
    }
    // 金币迸出弧线（3-5枚小金币弹跳）
    const coinsN = quality==='legendary'?5:3;
    for(let i=0;i<coinsN;i++){
      window._restParticles.push({x:fx,y:fy,vx:(Math.random()-.5)*3,vy:-2.5-Math.random()*1.5,r:2.5,life:34,color:'#ffcc44'});
    }
  }
  addRestFloatText('+' + pay + '金', c.walkX, c.seat.y - 20, quality==='burned'?'#999':'#ffd840');
  if(quality === 'legendary') addRestFloatText('传说!', c.walkX, c.seat.y - 35, '#ff44dd');
  else if(quality === 'perfect') addRestFloatText('完美!', c.walkX, c.seat.y - 35, '#FFD45E');
  else if(quality === 'burned') addRestFloatText('烤焦了...', c.walkX, c.seat.y - 35, '#666');
  else if(c.satisfaction > 0.8) addRestFloatText('好评!', c.walkX, c.seat.y - 35, '#88ff88');
  // ── VIP性格驱动反应 ──
  if(c.isVIP && c.vipId){
    const vip = VIP_CUSTOMERS.find(v => v.id === c.vipId);
    if(vip){
      // 显示VIP反应台词
      const reaction = getVIPReaction(vip, quality);
      if(reaction){
        addRestFloatText(reaction.length > 20 ? reaction.substring(0,20)+'...' : reaction, c.walkX, c.seat.y - 65, vip.accent);
      }
      // 记录最佳品质
      if(vipCompendium[vip.id]){
        const qOrder = ['burned','poor','good','perfect','legendary'];
        const curBest = vipCompendium[vip.id].bestQuality;
        if(!curBest || qOrder.indexOf(quality) > qOrder.indexOf(curBest)){
          vipCompendium[vip.id].bestQuality = quality;
        }
      }
      // 应用VIP特殊效果
      applyVIPSpecialEffect(vip, quality, c);
      // 释放VIP占位（允许下一个VIP来访）
      vipActiveInRestaurant = null;
    }
  }
  sndCoin();
  // EventBus
  RestEventBus.emit(EVT.CUSTOMER_SERVED, { satisfaction: c.satisfaction, customer: c, quality: quality });
  RestEventBus.emit(EVT.COIN_COLLECTED, { x: c.walkX, y: c.seat ? c.seat.y - 20 : 200, amount: pay });
  if(c.isVIP){
    RestAudio.playGibberish('太好吃了', 320);
  } else {
    RestAudio.playGibberish(c.ctype.id === 'critic' ? '值得好评' : '好吃', c.ctype.id === 'vip' ? 280 : 200);
  }
  // 废土社媒评价（Cooksta 式）— 每次服务都生成评价
  const review = generateCookstaReview(c, quality, dishInfo);
  pushWastegramPost(review);
  // 侧边通知
  pushReviewNotification(review);
  // 声望阶级变化检查
  checkRepTierChange();
  // 每日任务：追踪完美/传说菜品
  if(quality === 'perfect' || quality === 'legendary'){
    restState.perfectCount = (restState.perfectCount || 0) + 1;
  }
  // 每日任务检查
  checkDailyTasks();
}

function addRestFloatText(text, x, y, color){
  if(!restState) return;
  restState.floatTexts.push({text, x, y, color, life:1.2});
}

// ── 渲染 ──
// ── 渲染（参考潜水员戴夫的精致像素风餐厅）──
function drawRestaurant(){
  const c = document.getElementById('rest-canvas');
  const ctx2 = c.getContext('2d');
  // ── 美术重构：餐厅画布高DPR高清渲染（与主画布同方案；只做一次初始化）──
  if(!c._hdpr){
    c._hdpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = REST_CANVAS_W * c._hdpr;
    c.height = REST_CANVAS_H * c._hdpr;
    c.style.width = '100%';
    c.style.aspectRatio = REST_CANVAS_W + ' / ' + REST_CANVAS_H;
    ctx2.scale(c._hdpr, c._hdpr);
  }
  ctx2.clearRect(0, 0, REST_CANVAS_W, REST_CANVAS_H);
  const tt = Date.now() * 0.001;
  const W = REST_CANVAS_W, H = REST_CANVAS_H;
  const FLOOR_Y = Math.floor(H * 0.68);  // 地面线（按画布高度比例）
  // 初始化粒子池
  if(!window._restParticles) window._restParticles = [];

  // ═══════════════════════════════════════════
  // 1. 【v51模块五】背景墙：砖墙+菜单黑板+悬挂厨具（Dave纵深三层之"后墙层"）
  // ═══════════════════════════════════════════
  const wallGrad = ctx2.createLinearGradient(0, 0, 0, FLOOR_Y);
  wallGrad.addColorStop(0, '#4a3226');
  wallGrad.addColorStop(0.5, '#3e2a1e');
  wallGrad.addColorStop(1, '#2e1e14');
  ctx2.fillStyle = wallGrad;
  ctx2.fillRect(0, 0, W, FLOOR_Y);
  // 砖缝（错缝砖墙——横缝+竖缝错位）
  ctx2.strokeStyle = 'rgba(20,12,6,.45)';ctx2.lineWidth = 1;
  for(let by = 0; by < FLOOR_Y; by += 16){
    ctx2.beginPath();ctx2.moveTo(0,by);ctx2.lineTo(W,by);ctx2.stroke();
    const off = (by/16)%2 ? 22 : 0;
    for(let bx = off; bx < W; bx += 44){
      ctx2.beginPath();ctx2.moveTo(bx,by);ctx2.lineTo(bx,by+16);ctx2.stroke();
    }
  }
  // 砖面微高光（顶部受光）
  ctx2.fillStyle = 'rgba(255,220,160,.025)';
  for(let by = 0; by < FLOOR_Y; by += 16){ctx2.fillRect(0,by,W,2);}
  // ── 菜单黑板（中央：今晚菜单手写风）──
  ctx2.fillStyle = '#2a1e12';
  ctx2.fillRect(330, 26, 200, 74);
  ctx2.strokeStyle = '#8a5a2a';ctx2.lineWidth = 3;ctx2.strokeRect(330, 26, 200, 74);
  ctx2.fillStyle = '#c8b080';ctx2.font = 'bold 11px Microsoft YaHei UI,sans-serif';ctx2.textAlign = 'center';
  ctx2.fillText('📜 今晚菜单', 430, 44);
  ctx2.font = '9px Microsoft YaHei UI,sans-serif';ctx2.fillStyle = '#a89468';
  const menuTxt = tonightMenu.length>0 ? tonightMenu.slice(0,3).map(id=>(REST_RECIPES.find(r=>r.id===id)||{}).name).join(' · ') : '尚未开张';
  ctx2.fillText(menuTxt, 430, 60);
  ctx2.fillStyle = '#8a7a54';ctx2.font = '8px Microsoft YaHei UI,sans-serif';
  ctx2.fillText('深夜食堂 · 僵尸肉料理', 430, 76);
  // ── 悬挂厨具剪影（左：锅铲汤勺挂钩；右同）──
  const hangUtensils = (ux)=>{
    ctx2.strokeStyle = '#5a4028';ctx2.lineWidth = 2;
    ctx2.beginPath();ctx2.moveTo(ux, 20);ctx2.lineTo(ux+66, 20);ctx2.stroke();  // 横杆
    for(let k=0;k<4;k++){
      const hx = ux+8+k*16;
      ctx2.strokeStyle = '#4a3420';ctx2.lineWidth = 1;
      ctx2.beginPath();ctx2.moveTo(hx, 20);ctx2.lineTo(hx, 32);ctx2.stroke();   // 挂钩绳
      ctx2.fillStyle = '#3a3430';
      if(k%2===0){  // 锅铲
        ctx2.fillRect(hx-1.5, 32, 3, 14);ctx2.fillRect(hx-3, 46, 6, 6);
      }else{        // 汤勺
        ctx2.beginPath();ctx2.arc(hx, 38, 4, 0, Math.PI*2);ctx2.fill();ctx2.fillRect(hx-1, 42, 2, 10);
      }
    }
  };
  hangUtensils(150); hangUtensils(780);
  // 下半墙踢脚线
  ctx2.fillStyle = '#6a4426';
  ctx2.fillRect(0, FLOOR_Y - 12, W, 12);
  ctx2.fillStyle = '#3a2410';
  ctx2.fillRect(0, FLOOR_Y - 12, W, 2);

  // ── 装修等级装饰（v51保留+精修）──
  // Lv0: 基础灯笼→v51改吊灯（暖黄主吊灯×3：灯罩+光锥+地面光斑）
  for(let i = 0; i < 3; i++){
    const lx = 180 + i * 380, ly = 6;
    const flicker = 0.85 + 0.15 * Math.sin(tt * 2.4 + i*1.7);
    // 吊线
    ctx2.strokeStyle = '#2a1c10';ctx2.lineWidth = 1.5;
    ctx2.beginPath();ctx2.moveTo(lx, 0);ctx2.lineTo(lx, ly+10);ctx2.stroke();
    // 灯罩（锥形金属罩）
    ctx2.fillStyle = '#6a4a28';
    ctx2.beginPath();ctx2.moveTo(lx-14, ly+26);ctx2.lineTo(lx, ly+10);ctx2.lineTo(lx+14, ly+26);ctx2.closePath();ctx2.fill();
    ctx2.fillStyle = '#8a6a3a';ctx2.fillRect(lx-14, ly+24, 28, 3);
    // 灯泡（发光球）
    const bulbGlow = ctx2.createRadialGradient(lx, ly+30, 1, lx, ly+30, 26);
    bulbGlow.addColorStop(0, `rgba(255,230,150,${.9*flicker})`);
    bulbGlow.addColorStop(.4, `rgba(255,210,110,${.4*flicker})`);
    bulbGlow.addColorStop(1, 'rgba(255,180,80,0)');
    ctx2.fillStyle = bulbGlow;
    ctx2.fillRect(lx-30, ly+6, 60, 52);
    ctx2.fillStyle = `rgba(255,240,190,${flicker})`;
    ctx2.beginPath();ctx2.arc(lx, ly+29, 4.5, 0, Math.PI*2);ctx2.fill();
    // 已按用户要求移除背后刺眼的向下光锥柱与地面光斑，保留小巧灯罩与柔和暖光发光泡
  }
  // Lv1: 挂画
  if(restUpgradeLevel.decor >= 1){
    for(const px of [60, 720]){
      ctx2.fillStyle = '#6a4a28';
      ctx2.fillRect(px - 25, 55, 50, 38);
      ctx2.fillStyle = '#3a2a15';
      ctx2.fillRect(px - 22, 58, 44, 32);
      // 画内容（小风景）
      ctx2.fillStyle = '#4a6a8a';
      ctx2.fillRect(px - 18, 62, 36, 14);
      ctx2.fillStyle = '#5a8a4a';
      ctx2.fillRect(px - 18, 76, 36, 10);
      ctx2.fillStyle = '#aa8844';
      ctx2.beginPath(); ctx2.arc(px, 68, 4, 0, Math.PI * 2); ctx2.fill();
    }
  }
  // Lv2: 窗户 + 月光
  if(restUpgradeLevel.decor >= 2){
    ctx2.fillStyle = '#1a2a3a';
    ctx2.fillRect(360, 45, 120, 60);
    ctx2.strokeStyle = '#6a4a28';
    ctx2.lineWidth = 4;
    ctx2.strokeRect(360, 45, 120, 60);
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.moveTo(420, 45); ctx2.lineTo(420, 105);
    ctx2.moveTo(360, 75); ctx2.lineTo(480, 75);
    ctx2.stroke();
    // 月光
    const moonG = ctx2.createRadialGradient(420, 65, 5, 420, 65, 40);
    moonG.addColorStop(0, 'rgba(220,230,255,.35)');
    moonG.addColorStop(1, 'rgba(180,200,255,0)');
    ctx2.fillStyle = moonG;
    ctx2.fillRect(360, 45, 120, 60);
    // 月亮
    ctx2.fillStyle = 'rgba(240,240,200,.6)';
    ctx2.beginPath(); ctx2.arc(450, 60, 8, 0, Math.PI * 2); ctx2.fill();
  }
  // Lv3: 吊灯
  if(restUpgradeLevel.decor >= 3){
    for(let i = 0; i < 3; i++){
      const lx = 180 + i * 240, ly = 15;
      ctx2.strokeStyle = '#3a2818';
      ctx2.lineWidth = 1.5;
      ctx2.beginPath(); ctx2.moveTo(lx, 0); ctx2.lineTo(lx, ly); ctx2.stroke();
      // 灯罩
      ctx2.fillStyle = '#8a6a3a';
      ctx2.beginPath();
      ctx2.moveTo(lx - 10, ly); ctx2.lineTo(lx + 10, ly);
      ctx2.lineTo(lx + 8, ly + 14); ctx2.lineTo(lx - 8, ly + 14);
      ctx2.closePath(); ctx2.fill();
      // 灯泡光
      const lightFlicker = 0.8 + 0.2 * Math.sin(tt * 5 + i);
      ctx2.fillStyle = `rgba(255,220,120,${lightFlicker})`;
      ctx2.beginPath(); ctx2.arc(lx, ly + 16, 5, 0, Math.PI * 2); ctx2.fill();
      ctx2.shadowBlur = 20; ctx2.shadowColor = '#ffaa44';
      ctx2.beginPath(); ctx2.arc(lx, ly + 16, 3, 0, Math.PI * 2); ctx2.fill();
      ctx2.shadowBlur = 0;
    }
  }

  // ═══════════════════════════════════════════
  // 2. 【v51模块五】地面：透视木地板（横向木板渐宽+木纹+反光+前排压暗——纵深感）
  // ═══════════════════════════════════════════
  const floorGrad = ctx2.createLinearGradient(0, FLOOR_Y, 0, H);
  floorGrad.addColorStop(0, '#6a4526');
  floorGrad.addColorStop(0.35, '#503418');
  floorGrad.addColorStop(1, '#241405');
  ctx2.fillStyle = floorGrad;
  ctx2.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  // 透视木板：近FLOOR_Y处窄、越往下越宽（每行间距递增+板宽递增）
  let plankY = FLOOR_Y + 14, plankStep = 16;
  for(let row = 0; plankY < H; row++){
    ctx2.strokeStyle = 'rgba(15,8,3,.5)';ctx2.lineWidth = row > 3 ? 1.6 : 1;
    ctx2.beginPath(); ctx2.moveTo(0, plankY); ctx2.lineTo(W, plankY); ctx2.stroke();
    // 板缝（竖向，错开；间距随行变宽=透视）
    const gap = 60 + row * 10;
    const offset = (row % 2) * (gap/2);
    for(let x = offset; x < W; x += gap){
      ctx2.beginPath(); ctx2.moveTo(x, plankY - plankStep); ctx2.lineTo(x, plankY); ctx2.stroke();
    }
    // 每板木纹（1-2条浅色纹理线）
    ctx2.strokeStyle = 'rgba(120,80,40,.14)';ctx2.lineWidth = 1;
    const gx = (row*37) % W;
    ctx2.beginPath();ctx2.moveTo(Math.max(0,gx-40), plankY - plankStep*0.5);ctx2.lineTo(Math.min(W,gx+30), plankY - plankStep*0.4);ctx2.stroke();
    plankY += plankStep;
    plankStep = Math.min(30, plankStep + 2.2);  // 行距渐宽（透视）
  }
  // 地板高光（受吊灯照射的横带反光）
  ctx2.fillStyle = 'rgba(255,200,100,.07)';
  ctx2.fillRect(0, FLOOR_Y, W, 4);
  ctx2.fillStyle = 'rgba(255,190,110,.03)';
  ctx2.fillRect(0, FLOOR_Y, W, 22);
  // 前排压暗（画面最下沿渐暗——把视线推向中景）
  const fgDark = ctx2.createLinearGradient(0, H-40, 0, H);
  fgDark.addColorStop(0, 'rgba(10,5,2,0)');fgDark.addColorStop(1, 'rgba(10,5,2,.4)');
  ctx2.fillStyle = fgDark;ctx2.fillRect(0, H-40, W, 40);
  // ── v51模块五：氛围蒸汽粒子（灶台/菜品上方缓慢上升的白雾——餐厅"活"起来）──
  if(Math.random()>.4){
    const sx3 = [160, 280, 400][Math.floor(Math.random()*3)];
    window._restParticles.push({x:sx3+(Math.random()-.5)*30, y:120, vx:(Math.random()-.5)*.3, vy:-.5-Math.random()*.4, r:2.5+Math.random()*3, life:50, color:`rgba(240,230,210,${.10+Math.random()*.10})`});
  }

  // ═══════════════════════════════════════════
  // 3. 料理台（左侧）：灶台 + 抽油烟机 + 调料架 + 芥末台
  // ═══════════════════════════════════════════
  // 抽油烟机
  ctx2.fillStyle = '#2a2a2a';
  ctx2.fillRect(70, 45, 400, 35);
  ctx2.fillStyle = '#1a1a1a';
  ctx2.fillRect(70, 78, 400, 5);
  ctx2.fillStyle = '#444';
  ctx2.fillRect(75, 50, 390, 3);  // 顶部高光
  // 抽油烟机灯
  for(let i = 0; i < 3; i++){
    const lx = 150 + i * 120;
    ctx2.fillStyle = '#ffcc44';
    ctx2.shadowBlur = 8; ctx2.shadowColor = '#ffaa00';
    ctx2.beginPath(); ctx2.arc(lx, 70, 3, 0, Math.PI * 2); ctx2.fill();
    ctx2.shadowBlur = 0;
  }
  // 灶台底座
  ctx2.fillStyle = '#3a3a3a';
  ctx2.fillRect(70, 95, 400, 55);
  ctx2.fillStyle = '#555';
  ctx2.fillRect(70, 95, 400, 3);  // 顶部高光
  ctx2.fillStyle = '#2a2a2a';
  ctx2.fillRect(70, 145, 400, 6);
  // 灶台柜门
  ctx2.strokeStyle = '#1a1a1a';
  ctx2.lineWidth = 1;
  for(let x = 100; x < 470; x += 60){
    ctx2.strokeRect(x, 115, 50, 28);
    // 把手
    ctx2.fillStyle = '#888';
    ctx2.fillRect(x + 22, 128, 6, 2);
  }

  // 各灶眼（精致版）
  restStoves.forEach((stove, i) => {
    const sx = stove.x, sy = stove.y;
    // 灶眼外圈（金属）
    ctx2.fillStyle = '#4a4a4a';
    ctx2.beginPath(); ctx2.arc(sx, sy + 12, 16, 0, Math.PI * 2); ctx2.fill();
    ctx2.fillStyle = '#2a2a2a';
    ctx2.beginPath(); ctx2.arc(sx, sy + 12, 13, 0, Math.PI * 2); ctx2.fill();
    // 火焰（烹饪中）
    if(stove.recipe){
      const flicker = 0.7 + 0.3 * Math.sin(tt * 25 + i * 2);
      // 外焰
      ctx2.fillStyle = `rgba(255,80,20,${flicker * 0.6})`;
      ctx2.beginPath();
      ctx2.ellipse(sx, sy + 8, 11, 10 + flicker * 4, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 内焰
      ctx2.fillStyle = `rgba(255,180,40,${flicker * 0.9})`;
      ctx2.beginPath();
      ctx2.ellipse(sx, sy + 10, 8, 8 + flicker * 3, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 焰心
      ctx2.fillStyle = `rgba(255,250,200,${flicker})`;
      ctx2.beginPath();
      ctx2.ellipse(sx, sy + 12, 3, 4 + flicker * 2, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 锅
      ctx2.fillStyle = '#1a1a1a';
      ctx2.beginPath();
      ctx2.ellipse(sx, sy + 3, 14, 5, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.fillStyle = '#3a3a3a';
      ctx2.fillRect(sx - 12, sy + 3, 24, 7);
      // 锅把手
      ctx2.fillStyle = '#222';
      ctx2.fillRect(sx + 12, sy + 4, 8, 2);
      // 菜图标
      ctx2.fillStyle = stove.recipe.color;
      ctx2.font = 'bold 12px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(stove.recipe.icon, sx, sy + 11);
      // 蒸汽
      for(let s = 0; s < 3; s++){
        const sx2 = sx + (s - 1) * 5 + Math.sin(tt * 2 + s) * 2;
        const sy2 = sy - 6 - (tt * 25 + s * 18) % 28;
        const alpha = 0.25 * (1 - (sy - 6 - sy2) / 28);
        ctx2.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx2.beginPath();
        ctx2.ellipse(sx2, sy2, 4 + s, 6 + s, 0, 0, Math.PI * 2);
        ctx2.fill();
      }
      // 进度条（精致版）
      const pct = Math.min(1, stove.progress / stove.totalTime);
      ctx2.fillStyle = '#1a1a1a';
      ctx2.fillRect(sx - 22, sy - 16, 44, 6);
      // 进度条背景
      ctx2.fillStyle = '#333';
      ctx2.fillRect(sx - 21, sy - 15, 42, 4);
      // 进度
      const barColor = pct >= 1 ? '#44ff66' : pct > 0.5 ? '#ffcc44' : '#ff8844';
      ctx2.fillStyle = barColor;
      ctx2.fillRect(sx - 21, sy - 15, 42 * pct, 4);
      // 边框
      ctx2.strokeStyle = '#000';
      ctx2.lineWidth = 0.5;
      ctx2.strokeRect(sx - 22, sy - 16, 44, 6);
      // ── v50模块四：品质预示角标（QTE出的品质提前可见——perfect偏金/poor偏灰）──
      if(stove._quality){
        const qColor = stove._quality==='perfect'?'#ffd840':stove._quality==='legendary'?'#ff88ee':stove._quality==='good'?'#aaff88':'#999';
        ctx2.fillStyle = qColor;
        ctx2.font = 'bold 8px Microsoft YaHei UI,sans-serif';
        ctx2.textAlign = 'left';
        const qName = {legendary:'传说',perfect:'完美',good:'良好',poor:'普通',burned:'焦'}[stove._quality]||'';
        ctx2.fillText(qName, sx + 24, sy - 12);
      }
      // 完成标记
      if(pct >= 1){
        ctx2.fillStyle = '#44ff66';
        ctx2.font = 'bold 9px sans-serif';
        ctx2.fillText('✓', sx + 28, sy - 24);
      }
    } else {
      // 空灶眼十字格
      ctx2.strokeStyle = '#555';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(sx - 10, sy + 12); ctx2.lineTo(sx + 10, sy + 12);
      ctx2.moveTo(sx, sy + 2); ctx2.lineTo(sx, sy + 22);
      ctx2.stroke();
    }
    // 灶眼编号
    ctx2.fillStyle = '#b0a284';
    ctx2.font = 'bold 8px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('灶' + (i + 1), sx, sy + 50);
  });

  // 调料架（精致版）
  ctx2.fillStyle = '#5a4030';
  ctx2.fillRect(475, 88, 65, 65);
  ctx2.fillStyle = '#3a2818';
  ctx2.fillRect(475, 88, 65, 3);
  // 调料瓶
  const spices = [
    {x: 482, y: 95, color: '#aa4422'}, {x: 494, y: 95, color: '#88aa44'},
    {x: 506, y: 95, color: '#ffaa44'}, {x: 518, y: 95, color: '#4488aa'},
    {x: 482, y: 120, color: '#aa44aa'}, {x: 494, y: 120, color: '#88aa88'},
    {x: 506, y: 120, color: '#cc6644'}, {x: 518, y: 120, color: '#ddddaa'},
  ];
  spices.forEach(sp => {
    ctx2.fillStyle = sp.color;
    ctx2.fillRect(sp.x, sp.y, 9, 18);
    ctx2.fillStyle = '#3a2818';
    ctx2.fillRect(sp.x, sp.y, 9, 3);  // 瓶盖
  });

  // 芥末台（戴夫核心机制）
  const wasabiX = 545, wasabiY = 100;
  ctx2.fillStyle = '#3a2a1a';
  ctx2.fillRect(wasabiX, wasabiY, 50, 50);
  ctx2.fillStyle = '#5a4a30';
  ctx2.fillRect(wasabiX, wasabiY, 50, 3);
  // 芥末罐
  ctx2.fillStyle = '#2a2a1a';
  ctx2.fillRect(wasabiX + 8, wasabiY + 8, 34, 30);
  // 芥末（绿色，高度根据存量）
  const wasabiH = Math.max(2, (restWasabi / 100) * 24);
  ctx2.fillStyle = '#88cc44';
  ctx2.fillRect(wasabiX + 10, wasabiY + 36 - wasabiH, 30, wasabiH);
  ctx2.fillStyle = '#aadd66';
  ctx2.fillRect(wasabiX + 10, wasabiY + 36 - wasabiH, 30, 2);  // 顶部高光
  // 芥末标签
  ctx2.fillStyle = '#ffcc44';
  ctx2.font = 'bold 9px sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('芥末', wasabiX + 25, wasabiY + 48);
  // 芥末量条
  ctx2.fillStyle = '#1a1a1a';
  ctx2.fillRect(wasabiX - 3, wasabiY - 8, 56, 5);
  ctx2.fillStyle = restWasabi > 30 ? '#88cc44' : '#ff4444';
  ctx2.fillRect(wasabiX - 3, wasabiY - 8, 56 * (restWasabi / 100), 5);
  ctx2.strokeStyle = '#000';
  ctx2.lineWidth = 0.5;
  ctx2.strokeRect(wasabiX - 3, wasabiY - 8, 56, 5);
  // 低芥末警告
  if(restWasabi < 20){
    const pulse = 0.5 + 0.5 * Math.sin(tt * 6);
    ctx2.fillStyle = `rgba(255,80,80,${pulse})`;
    ctx2.font = 'bold 8px sans-serif';
    ctx2.fillText('⚠低', wasabiX + 25, wasabiY - 12);
  }

  // ═══════════════════════════════════════════
  // 4. 出餐口/吧台（右侧）：台面 + 已做好菜品 + 酒柜
  // ═══════════════════════════════════════════
  // 吧台
  ctx2.fillStyle = '#7a5a3a';
  ctx2.fillRect(610, 90, 200, 55);
  ctx2.fillStyle = '#9a7a5a';
  ctx2.fillRect(610, 90, 200, 3);  // 顶部高光
  ctx2.fillStyle = '#5a3a20';
  ctx2.fillRect(610, 140, 200, 6);
  // 吧台木纹
  ctx2.strokeStyle = 'rgba(0,0,0,.25)';
  ctx2.lineWidth = 1;
  for(let x = 620; x < 810; x += 35){
    ctx2.beginPath(); ctx2.moveTo(x, 90); ctx2.lineTo(x, 145); ctx2.stroke();
  }
  // 标签
  ctx2.fillStyle = '#d2b48c';
  ctx2.font = 'bold 11px Microsoft YaHei UI,sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('▼ 出餐口 ▼', 710, 82);

  // 已做好的菜（精致版：盘子+食物+热气+装饰）
  restReadyDishes.forEach((d, i) => {
    const dx = 625 + i * 45, dy = 115;
    // 盘子阴影
    ctx2.fillStyle = 'rgba(0,0,0,.3)';
    ctx2.beginPath();
    ctx2.ellipse(dx, dy + 8, 16, 4, 0, 0, Math.PI * 2);
    ctx2.fill();
    // 盘子
    ctx2.fillStyle = '#f5ecd8';
    ctx2.beginPath();
    ctx2.ellipse(dx, dy, 15, 10, 0, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = '#c0a878';
    ctx2.lineWidth = 1;
    ctx2.stroke();
    // 盘子内圈
    ctx2.strokeStyle = '#d4c4a0';
    ctx2.beginPath();
    ctx2.ellipse(dx, dy, 11, 7, 0, 0, Math.PI * 2);
    ctx2.stroke();
    // 食物
    ctx2.fillStyle = d.recipe.color;
    ctx2.beginPath();
    ctx2.arc(dx, dy, 8, 0, Math.PI * 2);
    ctx2.fill();
    // 食物高光
    ctx2.fillStyle = 'rgba(255,255,255,.3)';
    ctx2.beginPath();
    ctx2.arc(dx - 2, dy - 2, 3, 0, Math.PI * 2);
    ctx2.fill();
    // 热气
    for(let s = 0; s < 2; s++){
      const sx2 = dx + (s - 0.5) * 4;
      const sy2 = dy - 8 - (tt * 20 + s * 15 + i * 5) % 20;
      ctx2.fillStyle = `rgba(255,255,255,${0.2 * (1 - (dy - 8 - sy2) / 20)})`;
      ctx2.beginPath();
      ctx2.ellipse(sx2, sy2, 3, 5, 0, 0, Math.PI * 2);
      ctx2.fill();
    }
    // 菜图标
    ctx2.fillStyle = '#fff';
    ctx2.font = 'bold 10px sans-serif';
    ctx2.fillText(d.recipe.icon, dx, dy + 3);
    // ── v50模块四：交付管线可视——出餐口的菜头顶箭头指向点它的顾客+名字角标 ──
    const orderer = restState.customers.find(c => c.state === 'seated' && c.order && d.recipe.recipeId === c.order);
    if(orderer){
      const ox = orderer.walkX, oy = orderer.seat ? orderer.seat.y - 30 : dy;
      const ang = Math.atan2(oy - dy, ox - dx);
      // 指向箭头（金色，微浮动）
      const bob = Math.sin(tt*3 + i)*2;
      const ax = dx + Math.cos(ang)*18, ay = dy - 14 + bob;
      ctx2.save();
      ctx2.translate(ax, ay);
      ctx2.rotate(ang);
      ctx2.fillStyle = 'rgba(255,216,64,.9)';
      ctx2.beginPath();
      ctx2.moveTo(6,0);ctx2.lineTo(-4,-4);ctx2.lineTo(-4,4);
      ctx2.closePath();ctx2.fill();
      ctx2.restore();
      // 顾客名字角标（小字）
      ctx2.fillStyle = 'rgba(255,216,64,.75)';
      ctx2.font = '7px Microsoft YaHei UI,sans-serif';
      ctx2.textAlign = 'center';
      const shortName = (orderer.persona && orderer.persona.name) ? orderer.persona.name.slice(0,3) : '顾客';
      ctx2.fillText('→'+shortName, dx, dy - 24 + bob);
    }
  });

  // 酒柜（吧台上方）
  const wineX = 620, wineY = 30;
  ctx2.fillStyle = '#4a3220';
  ctx2.fillRect(wineX, wineY, 180, 50);
  ctx2.fillStyle = '#3a2410';
  ctx2.fillRect(wineX, wineY, 180, 3);
  // 酒柜隔板
  ctx2.strokeStyle = '#2a1808';
  ctx2.lineWidth = 1;
  for(let i = 1; i < 4; i++){
    ctx2.beginPath();
    ctx2.moveTo(wineX, wineY + i * 12); ctx2.lineTo(wineX + 180, wineY + i * 12);
    ctx2.stroke();
  }
  // 酒瓶（根据 restDrinks 数量显示）
  const drinkColors = ['#aa3344', '#4488aa', '#44aa66', '#aaaa44', '#8844aa', '#cc8844'];
  for(let i = 0; i < 6; i++){
    const bx = wineX + 15 + i * 28;
    if(i < restDrinks){
      ctx2.fillStyle = drinkColors[i];
      ctx2.fillRect(bx - 4, wineY + 8, 8, 32);
      ctx2.fillStyle = '#3a2410';
      ctx2.fillRect(bx - 3, wineY + 5, 6, 5);  // 瓶颈
      ctx2.fillStyle = 'rgba(255,255,255,.3)';
      ctx2.fillRect(bx - 3, wineY + 10, 2, 20);  // 高光
    } else {
      // 空瓶位
      ctx2.strokeStyle = '#5a3a20';
      ctx2.lineWidth = 1;
      ctx2.strokeRect(bx - 4, wineY + 8, 8, 32);
    }
  }
  // 酒柜标签
  ctx2.fillStyle = '#d2b48c';
  ctx2.font = 'bold 8px sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('酒柜 ' + restDrinks + '/6', wineX + 90, wineY - 3);

  // ═══════════════════════════════════════════
  // 5. 餐桌椅（精致版）
  // ═══════════════════════════════════════════
  restTables.forEach((t, ti) => {
    // 桌子阴影
    ctx2.fillStyle = 'rgba(0,0,0,.3)';
    ctx2.beginPath();
    ctx2.ellipse(t.x, t.y + 28, 42, 5, 0, 0, Math.PI * 2);
    ctx2.fill();
    // 桌面
    ctx2.fillStyle = '#8a6a44';
    ctx2.fillRect(t.x - 40, t.y, 80, 8);
    ctx2.fillStyle = '#aa8a5a';
    ctx2.fillRect(t.x - 40, t.y, 80, 2);  // 顶部高光
    // 桌布
    ctx2.fillStyle = '#9a7a54';
    ctx2.fillRect(t.x - 38, t.y + 8, 76, 18);
    ctx2.fillStyle = 'rgba(0,0,0,.15)';
    ctx2.fillRect(t.x - 38, t.y + 22, 76, 2);
    // 桌腿
    ctx2.fillStyle = '#4a3220';
    ctx2.fillRect(t.x - 3, t.y + 26, 6, 22);
    // 餐具（如果没顾客）
    if(!t.seats[0].occupied && !t.seats[1].occupied){
      // 盘子
      ctx2.fillStyle = '#e8dfc8';
      ctx2.beginPath();
      ctx2.ellipse(t.x, t.y + 14, 8, 4, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 筷子
      ctx2.fillStyle = '#3a2818';
      ctx2.fillRect(t.x - 12, t.y + 12, 8, 1);
      ctx2.fillRect(t.x + 4, t.y + 12, 8, 1);
      // 小花瓶
      ctx2.fillStyle = '#4488aa';
      ctx2.fillRect(t.x - 2, t.y + 4, 4, 6);
      ctx2.fillStyle = '#ff6644';
      ctx2.beginPath(); ctx2.arc(t.x, t.y + 3, 2, 0, Math.PI * 2); ctx2.fill();
    }
    // 椅子（左右各一）
    for(const side of [-1, 1]){
      const chx = t.x + side * 48;
      // 椅背
      ctx2.fillStyle = '#5a3a20';
      ctx2.fillRect(chx - 6, t.y - 8, 12, 20);
      ctx2.fillStyle = '#7a5a3a';
      ctx2.fillRect(chx - 6, t.y - 8, 12, 2);
      // 椅座
      ctx2.fillStyle = '#6a4a28';
      ctx2.fillRect(chx - 8, t.y + 12, 16, 6);
      // 椅腿
      ctx2.fillStyle = '#3a2410';
      ctx2.fillRect(chx - 7, t.y + 18, 2, 8);
      ctx2.fillRect(chx + 5, t.y + 18, 2, 8);
    }
  });

  // ═══════════════════════════════════════════
  // 6. 员工显示（精致版）
  // ═══════════════════════════════════════════
  restState.staff.forEach((staff, i) => {
    const walkBob = Math.sin(tt * 6 + i) * 2;
    if(staff.type === 'cook'){
      const sx = restStoves[restStoves.length-1].x + 45;
      const sy = 120 + walkBob;
      // 影子
      ctx2.fillStyle = 'rgba(0,0,0,.35)';
      ctx2.beginPath();
      ctx2.ellipse(sx, sy + 25, 10, 3, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 厨师帽
      ctx2.fillStyle = '#fff';
      ctx2.fillRect(sx - 7, sy - 32, 14, 5);
      ctx2.beginPath();
      ctx2.ellipse(sx, sy - 32, 9, 6, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 帽子皱褶
      ctx2.strokeStyle = '#ddd';
      ctx2.lineWidth = 0.5;
      ctx2.beginPath();
      ctx2.ellipse(sx, sy - 30, 6, 3, 0, 0, Math.PI * 2);
      ctx2.stroke();
      // 身体（白色厨师服）
      ctx2.fillStyle = '#f5f5f5';
      ctx2.fillRect(sx - 9, sy - 18, 18, 24);
      // 围裙
      ctx2.fillStyle = '#ddd';
      ctx2.fillRect(sx - 7, sy - 8, 14, 14);
      // 围裙带
      ctx2.strokeStyle = '#aaa';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(sx - 7, sy - 8); ctx2.lineTo(sx - 9, sy - 18);
      ctx2.moveTo(sx + 7, sy - 8); ctx2.lineTo(sx + 9, sy - 18);
      ctx2.stroke();
      // 头
      ctx2.fillStyle = '#d4a574';
      ctx2.fillRect(sx - 5, sy - 27, 10, 9);
      // 眼睛
      ctx2.fillStyle = '#000';
      ctx2.fillRect(sx - 3, sy - 24, 1.5, 1.5);
      ctx2.fillRect(sx + 1, sy - 24, 1.5, 1.5);
      // 胡子
      ctx2.fillStyle = '#3a2818';
      ctx2.fillRect(sx - 3, sy - 20, 6, 1);
      // 名字
      ctx2.fillStyle = staff.color;
      ctx2.font = '7px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(staff.name, sx, sy - 38);
      // 上菜闪光
      if(staff.serveFlash > 0){
        staff.serveFlash -= 0.02;
        ctx2.fillStyle = `rgba(136,255,136,${staff.serveFlash})`;
        ctx2.font = 'bold 9px sans-serif';
        ctx2.fillText('上菜!', sx, sy - 42);
      }
    } else if(staff.type === 'server'){
      const sx = 620 + (i * 30);
      const sy = 165 + walkBob;
      // 影子
      ctx2.fillStyle = 'rgba(0,0,0,.35)';
      ctx2.beginPath();
      ctx2.ellipse(sx, sy + 25, 10, 3, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 身体（侍应服）
      ctx2.fillStyle = staff.color;
      ctx2.fillRect(sx - 8, sy - 18, 16, 22);
      // 领结
      ctx2.fillStyle = '#aa3333';
      ctx2.beginPath();
      ctx2.moveTo(sx - 4, sy - 14); ctx2.lineTo(sx, sy - 12); ctx2.lineTo(sx + 4, sy - 14);
      ctx2.lineTo(sx, sy - 10); ctx2.closePath();
      ctx2.fill();
      // 围裙
      ctx2.fillStyle = 'rgba(255,255,255,.8)';
      ctx2.fillRect(sx - 6, sy - 8, 12, 12);
      // 头
      ctx2.fillStyle = '#d4a574';
      ctx2.fillRect(sx - 5, sy - 27, 10, 9);
      // 头发
      ctx2.fillStyle = '#3a2818';
      ctx2.fillRect(sx - 5, sy - 29, 10, 4);
      // 眼睛
      ctx2.fillStyle = '#000';
      ctx2.fillRect(sx - 3, sy - 24, 1.5, 1.5);
      ctx2.fillRect(sx + 1, sy - 24, 1.5, 1.5);
      // 托盘
      ctx2.fillStyle = '#888';
      ctx2.fillRect(sx + 8, sy - 5, 10, 2);
      ctx2.fillStyle = '#f5ecd8';
      ctx2.beginPath(); ctx2.arc(sx + 13, sy - 7, 3, 0, Math.PI * 2); ctx2.fill();
      // 名字
      ctx2.fillStyle = staff.color;
      ctx2.font = '7px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(staff.name, sx, sy - 35);
      // 上菜闪光
      if(staff.serveFlash > 0){
        staff.serveFlash -= 0.02;
        ctx2.fillStyle = `rgba(136,255,136,${staff.serveFlash})`;
        ctx2.font = 'bold 9px sans-serif';
        ctx2.fillText('上菜!', sx, sy - 42);
      }
    }
  });

  // ═══════════════════════════════════════════
  // 7. 顾客（精致版：身体+头+发型+服装+走路动画+表情+气泡+耐心条）
  // Bug修复：坐姿锚点原=桌面y(t.y≈242)，顾客画到桌面上且腿穿桌布；站位脚底=H*0.64(281)
  // 一坐下"下陷40px"。改为：坐姿锚点=桌前地面(t.y+26)，顾客脚踩真实地面；
  // 层次拆分：顾客在本节先画，桌面前景板在第8节后画——真实"坐在桌后只露上半身"。
  // ═══════════════════════════════════════════
  const _seatedCustomers = [];  // 记录坐姿顾客的桌位（第8节画前景桌板遮腿）
  restState.customers.forEach(c => {
    const cx = c.walkX;
    const cy = (c.state === 'walking' || c.state === 'queuing') ? Math.floor(REST_CANVAS_H * 0.64) : (c.seat ? c.seat.y + 26 : Math.floor(REST_CANVAS_H * 0.64));
    if(c.state !== 'walking' && c.state !== 'queuing' && c.seat){
      // 找到该座位所属的桌子（画前景板时用）
      const tbl = restTables.find(t => t.seats.includes(c.seat));
      if(tbl) _seatedCustomers.push({c, cx, cy, tbl});
    }
    const bob = (c.state === 'walking' || c.state === 'queuing') ? Math.sin(tt * 8 + c.id) * 2 : 0;
    // ── VIP顾客：使用专属立绘渲染 ──
    if(c.isVIP && c.vipId){
      drawVIPInRestaurant(ctx2, c, cx, cy, bob, tt);
      // VIP点单气泡（经营重做：显示具体点的菜名）
      if(c.state === 'seated'){
        const bx = cx, by = cy - 54;
        const bubbleBob = Math.sin(tt * 3) * 2;
        ctx2.fillStyle = 'rgba(255,255,200,.95)';
        ctx2.beginPath();
        ctx2.ellipse(bx, by + bubbleBob, 26, 17, 0, 0, Math.PI * 2);
        ctx2.fill();
        const tierInfo = VIP_TIERS[(VIP_CUSTOMERS.find(v=>v.id===c.vipId)||{}).tier] || {color:'#dd88ff'};
        ctx2.strokeStyle = tierInfo.color;
        ctx2.lineWidth = 2;
        ctx2.stroke();
        ctx2.fillStyle = 'rgba(255,255,200,.95)';
        ctx2.beginPath();
        ctx2.moveTo(bx - 4, by + 12 + bubbleBob);
        ctx2.lineTo(bx, by + 18 + bubbleBob);
        ctx2.lineTo(bx + 4, by + 12 + bubbleBob);
        ctx2.fill();
        // 点单内容：具体菜名（没注册菜单时显示通用餐盘）
        const orderedRecipe = c.order ? REST_RECIPES.find(r => r.id === c.order) : null;
        if(orderedRecipe){
          ctx2.fillStyle = '#5a3a10';
          ctx2.font = 'bold 10px Microsoft YaHei UI,sans-serif';
          ctx2.textAlign = 'center';
          ctx2.fillText(orderedRecipe.name, bx, by + 5 + bubbleBob);
          ctx2.fillStyle = orderedRecipe.color;
          ctx2.font = '8px sans-serif';
          ctx2.fillText(orderedRecipe.icon, bx, by + 13 + bubbleBob);
        }else{
          ctx2.fillStyle = '#ffcc44';
          ctx2.font = 'bold 14px sans-serif';
          ctx2.textAlign = 'center';
          ctx2.fillText('🍽️', bx, by + 5 + bubbleBob);
        }
        // 摇头拒绝动画（上错菜）
        if(c.orderRejected > 0){
          c.orderRejected--;
          ctx2.save();
          ctx2.translate(bx, by + bubbleBob);
          ctx2.rotate(Math.sin(tt*20)*0.25);
          ctx2.fillStyle = '#ff4444';
          ctx2.font = 'bold 16px sans-serif';
          ctx2.fillText('✋', 0, -14);
          ctx2.restore();
        }
        // VIP阶级图标标记（v52：移到气泡左上角——右侧上方已有名牌，避免撞）
        ctx2.font = '10px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.fillText(tierInfo.icon, bx - 20, by - 10 + bubbleBob);
        // 饮料需求
        if(c.wantsDrink && !c.drinkServed){
          const drinkPulse = 0.5 + 0.5 * Math.sin(tt * 4);
          ctx2.fillStyle = `rgba(136,204,255,${0.7 + drinkPulse * 0.3})`;
          ctx2.font = 'bold 11px sans-serif';
          ctx2.fillText('🥤', bx - 16, by - 4 + bubbleBob);
        }
        // 耐心条（v52对齐：VIP立绘头顶~cy-44、名牌cy-62、气泡cy-54——条移到 cy-34 头侧右移，
        // 避开头部；不再插在气泡和头之间挤成一团）
        const pct = c.patience / c.maxPatience;
        const vipBarX = cx + 20, vipBarY = cy - 44;
        ctx2.fillStyle = '#1a1a1a';
        ctx2.fillRect(vipBarX, vipBarY, 30, 5);
        ctx2.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff4444';
        ctx2.fillRect(vipBarX, vipBarY, 30 * pct, 5);
        ctx2.strokeStyle = tierInfo.color;
        ctx2.lineWidth = 0.8;
        ctx2.strokeRect(vipBarX, vipBarY, 30, 5);
      }
      // 进食（VIP星标也上移让开头顶）
      if(c.state === 'eating'){
        ctx2.fillStyle = '#ff44dd';
        ctx2.font = 'bold 12px sans-serif';
        ctx2.textAlign = 'center';
        const starBob = Math.sin(tt * 5) * 2;
        ctx2.fillText('★', cx, cy - 66 + starBob);
      }
      return; // VIP渲染完毕，跳过普通渲染
    }
    // ══ v52美术：普通顾客精建模（体型×发型×配件×表情动画——独立函数）══
    drawCustomerBody_v52(ctx2, c, cx, cy, bob, tt);
    // ══ v52修·显示冲突：头顶UI统一布局 ══
    // 旧版气泡/耐心条/名牌全用固定 cy-46/-54/-56 坐标——v52体型变高后气泡盖脸、
    // 耐心条插进发型、名牌压帽子；不同体型高度还不一样，导致"经常冲突"。
    // 布局规则（碰撞检测驱动，任何两件不重叠）：
    //   头顶(含发型) headTopY → 气泡[headTopY-30, headTopY-2]（含尾巴） →
    //   名牌底 = 气泡顶-2 → 耐心条挂身体右侧（水平错开，不占垂直空间）
    const _build = (c.persona && c.persona.build) ? c.persona.build : CUSTOMER_BUILDS[1];
    const _hw = _build.hw;
    // 发型/帽子在头上的增量高度
    const _hairRise = (c.persona && (c.persona.hairStyle === 'spiky' || c.persona.hairStyle === 'bun')) ? 6
                    : (c.persona && c.persona.hairStyle === 'cap') ? 4
                    : (c.persona && c.persona.accessory === 'hat') ? 5 : 2;
    // 头顶 y = cy - 腿(9) - 躯干(bh+10) - 脖(4+hw+5) - 发顶增量
    const headTopY = cy - 9 - (_build.bh + 10) - (4 + _hw + 5) - _hairRise + bob;
    // 垂直分层：气泡中心（主体ry15+尾巴6 → 占头顶上方30px）
    const uiBubbleY = headTopY - 17;          // 气泡中心（seated 时 by=uiBubbleY-10 → 主体[headTopY-42,-12]）
    const uiNameY = headTopY - 45;            // 名牌基线（带[-54,-45]，与气泡顶-42 间留 3px 缓冲）
    const uiBarX = cx + _build.bw/2 + 5;      // 耐心条挂身体右侧（水平错开）
    const uiBarY = cy - _build.bh - 18;       // 与肩部同高
    // 排队状态：显示"等位"小气泡（锚定新头顶）
    if(c.state === 'queuing'){
      const bubbleBob = Math.sin(tt * 3 + c.id) * 1.5;
      ctx2.fillStyle = 'rgba(255,255,180,.9)';
      ctx2.beginPath();
      ctx2.ellipse(cx, uiBubbleY - 12 + bubbleBob, 14, 9, 0, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.strokeStyle = '#aa8844';
      ctx2.lineWidth = 1;
      ctx2.stroke();
      // 气泡尾巴
      ctx2.fillStyle = 'rgba(255,255,180,.9)';
      ctx2.beginPath();
      ctx2.moveTo(cx - 3, uiBubbleY - 5 + bubbleBob);
      ctx2.lineTo(cx, uiBubbleY + bubbleBob);
      ctx2.lineTo(cx + 3, uiBubbleY - 5 + bubbleBob);
      ctx2.fill();
      ctx2.fillStyle = '#5a4020';
      ctx2.font = 'bold 8px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText('等位', cx, uiBubbleY - 9 + bubbleBob);
      // 耐心条（挂身体右侧，贴头顶层不遮脸）
      const pct = c.patience / c.maxPatience;
      ctx2.fillStyle = '#1a1a1a';
      ctx2.fillRect(uiBarX, uiBarY - 24, 26, 4);
      ctx2.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff4444';
      ctx2.fillRect(uiBarX, uiBarY - 24, 26 * pct, 4);
    }
    // 点单气泡（就座时）——锚定新头顶（奶白气泡+菜谱描边+菜盘+价格角标）
    if(c.state === 'seated'){
      const bx = cx, by = uiBubbleY - 10;
      const bubbleBob = Math.sin(tt * 3) * 2;
      const orderedRecipe = c.order ? REST_RECIPES.find(r => r.id === c.order) : null;
      const bw = orderedRecipe ? 30 : 22;
      // 气泡主体（奶白→暖白渐变的立体感）
      const bubGrad = ctx2.createLinearGradient(0, by - 15 + bubbleBob, 0, by + 15 + bubbleBob);
      bubGrad.addColorStop(0,'#fffbe8');bubGrad.addColorStop(1,'#f0e0c0');
      ctx2.fillStyle = bubGrad;
      ctx2.beginPath();
      ctx2.ellipse(bx, by + bubbleBob, bw, 15, 0, 0, Math.PI * 2);
      ctx2.fill();
      // 菜谱配色描边（点的什么菜=什么颜色边）
      ctx2.strokeStyle = orderedRecipe ? orderedRecipe.color : c.ctype.color;
      ctx2.lineWidth = 2;
      ctx2.stroke();
      // 内侧亮线（精致感）
      ctx2.strokeStyle = 'rgba(255,255,255,.6)';ctx2.lineWidth = 1;
      ctx2.beginPath();ctx2.ellipse(bx, by + bubbleBob, bw-2, 13, 0, 0, Math.PI*2);ctx2.stroke();
      // 气泡尾巴（带描边）
      ctx2.fillStyle = '#f0e0c0';
      ctx2.beginPath();
      ctx2.moveTo(bx - 4, by + 13 + bubbleBob);
      ctx2.lineTo(bx, by + 19 + bubbleBob);
      ctx2.lineTo(bx + 4, by + 13 + bubbleBob);
      ctx2.closePath();ctx2.fill();
      ctx2.strokeStyle = orderedRecipe ? orderedRecipe.color : c.ctype.color;
      ctx2.lineWidth = 1;ctx2.stroke();
      // 点单内容：菜名+小菜盘图+价格角标
      if(orderedRecipe){
        ctx2.fillStyle = '#4a2e10';
        ctx2.font = 'bold 10px Microsoft YaHei UI,sans-serif';
        ctx2.textAlign = 'center';
        ctx2.fillText(orderedRecipe.name, bx, by + 1 + bubbleBob);
        // 小菜盘（盘子+菜色团）
        ctx2.fillStyle = '#e8dfc8';
        ctx2.beginPath();ctx2.ellipse(bx, by + 8 + bubbleBob, 7, 3.5, 0, 0, Math.PI*2);ctx2.fill();
        ctx2.fillStyle = orderedRecipe.color;
        ctx2.beginPath();ctx2.ellipse(bx, by + 7.5 + bubbleBob, 4.5, 2.2, 0, 0, Math.PI*2);ctx2.fill();
        ctx2.fillStyle = 'rgba(255,255,255,.5)';
        ctx2.beginPath();ctx2.ellipse(bx-1.5, by + 7 + bubbleBob, 1.5, 0.7, 0, 0, Math.PI*2);ctx2.fill();
        // 价格角标（右上小金币）
        ctx2.fillStyle = '#c89530';
        ctx2.font = 'bold 7px Microsoft YaHei UI,sans-serif';
        ctx2.fillText('¥'+orderedRecipe.price, bx + bw - 8, by - 8 + bubbleBob);
      }else{
        ctx2.fillStyle = '#ffcc44';
        ctx2.font = 'bold 14px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.fillText('🍽️', bx, by + 5 + bubbleBob);
      }
      // 摇头拒绝动画（上错菜）
      if(c.orderRejected > 0){
        c.orderRejected--;
        ctx2.save();
        ctx2.translate(bx, by + bubbleBob);
        ctx2.rotate(Math.sin(tt*20)*0.25);
        ctx2.fillStyle = '#ff4444';
        ctx2.font = 'bold 16px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.fillText('✋', 0, -14);
        ctx2.restore();
      }
      // 顾客类型标记
      ctx2.fillStyle = c.ctype.color;
      ctx2.font = 'bold 8px sans-serif';
      ctx2.fillText(c.ctype.icon, bx + 15, by - 8 + bubbleBob);
      // 饮料需求标记（参考戴夫：杯图标闪烁）
      if(c.wantsDrink && !c.drinkServed){
        const drinkPulse = 0.5 + 0.5 * Math.sin(tt * 4);
        ctx2.fillStyle = `rgba(136,204,255,${0.7 + drinkPulse * 0.3})`;
        ctx2.font = 'bold 11px sans-serif';
        ctx2.fillText('🥤', bx - 15, by - 4 + bubbleBob);
      }
      // 耐心条（v52：挂身体右侧与肩同高——不再插发型/不与气泡抢垂直空间）
      const pct = c.patience / c.maxPatience;
      ctx2.fillStyle = '#1a1a1a';
      ctx2.fillRect(uiBarX, uiBarY, 30, 5);
      const barColor = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff4444';
      ctx2.fillStyle = barColor;
      ctx2.fillRect(uiBarX, uiBarY, 30 * pct, 5);
      ctx2.strokeStyle = '#000';
      ctx2.lineWidth = 0.5;
      ctx2.strokeRect(uiBarX, uiBarY, 30, 5);
    }
    // 进食状态（星标占气泡层高度——头顶正上方，不与吃面低头/筷子冲突）
    if(c.state === 'eating'){
      ctx2.fillStyle = '#88ff88';
      ctx2.font = 'bold 11px sans-serif';
      ctx2.textAlign = 'center';
      const starBob = Math.sin(tt * 5) * 2;
      ctx2.fillText('★', cx, headTopY - 14 + starBob);
    }
    // 顾客名牌（锚定统一布局层：名牌在最上，气泡已让位）
    if(c.persona && c.persona.name && (c.state === 'seated' || c.state === 'walking' || c.state === 'queuing')){
      ctx2.font = 'bold 9px Microsoft YaHei UI,sans-serif';
      ctx2.textAlign = 'center';
      const nameY = uiNameY;   // 所有状态统一锚点（旧版 seated/walking 两个值=不同状态高度跳变）
      const nameW = ctx2.measureText(c.persona.name).width + 8;
      // 背景框
      ctx2.fillStyle = 'rgba(0,0,0,.7)';
      ctx2.fillRect(cx - nameW/2, nameY - 8, nameW, 11);
      ctx2.strokeStyle = c.persona.shirt || '#d4a574';
      ctx2.lineWidth = 0.8;
      ctx2.strokeRect(cx - nameW/2, nameY - 8, nameW, 11);
      // 名字
      ctx2.fillStyle = c.persona.shirt || '#d4a574';
      ctx2.fillText(c.persona.name, cx, nameY);
    }
    // 顾客类型图标（非VIP；锚在名牌左侧对称位——右侧已有耐心条，避免堆叠）
    if(!c.isVIP && c.ctype.id !== 'normal' && c.state === 'seated'){
      ctx2.fillStyle = c.ctype.color;
      ctx2.font = 'bold 9px sans-serif';
      ctx2.textAlign = 'center';
      ctx2.fillText(c.ctype.icon, cx - 28, uiNameY);
    }
  });

  // ═══════════════════════════════════════════
  // 7.5 桌面前景板（Bug修复层次拆分：顾客先画、桌板后画——坐姿顾客下半身被桌板遮挡，
  // 形成"坐在桌后"的真实纵深，替代原来顾客整体浮在桌子表面的错位感）
  // ═══════════════════════════════════════════
  _seatedCustomers.forEach(({c, cx, tbl}) => {
    // 只为有坐客的桌子画前景板（桌面+桌布+餐具，盖住顾客下半身）
    const t = tbl;
    // 桌面（前景板，盖住顾客腿部）
    ctx2.fillStyle = '#8a6a44';
    ctx2.fillRect(t.x - 42, t.y, 84, 10);
    ctx2.fillStyle = '#b09060';
    ctx2.fillRect(t.x - 42, t.y, 84, 2.5);  // 顶缘高光
    ctx2.fillStyle = 'rgba(0,0,0,.25)';
    ctx2.fillRect(t.x - 42, t.y + 8, 84, 2);  // 底缘阴影
    // 桌布（垂下，同款但作为前景）
    ctx2.fillStyle = '#9a7a54';
    ctx2.fillRect(t.x - 40, t.y + 10, 80, 16);
    ctx2.fillStyle = 'rgba(0,0,0,.15)';
    ctx2.fillRect(t.x - 40, t.y + 24, 80, 2);
    // 桌上：该桌顾客的菜（正在吃的显示盘中菜）
    const eater = restState.customers.find(cc => cc.seat && (cc.seat.occupied === cc) && cc.state === 'eating' && (t.seats.includes(cc.seat)));
    if(eater && eater._servedDish){
      ctx2.fillStyle = eater._servedDish.color || '#c87862';
      ctx2.beginPath();ctx2.ellipse(t.x, t.y + 6, 9, 4, 0, 0, Math.PI*2);ctx2.fill();
      ctx2.fillStyle = 'rgba(255,255,255,.4)';
      ctx2.beginPath();ctx2.ellipse(t.x - 2, t.y + 5, 3, 1.5, 0, 0, Math.PI*2);ctx2.fill();
    }else{
      // 盘子+筷子
      ctx2.fillStyle = '#e8dfc8';
      ctx2.beginPath();ctx2.ellipse(t.x, t.y + 6, 8, 3.5, 0, 0, Math.PI*2);ctx2.fill();
      ctx2.fillStyle = '#3a2818';
      ctx2.fillRect(t.x - 12, t.y + 5, 8, 1);ctx2.fillRect(t.x + 4, t.y + 5, 8, 1);
    }
  });

  // ═══════════════════════════════════════════
  // 8. 浮动文字
  // ═══════════════════════════════════════════
  restState.floatTexts.forEach(ft => {
    ctx2.globalAlpha = Math.max(0, ft.life);
    ctx2.fillStyle = ft.color;
    ctx2.font = 'bold 13px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.shadowColor = '#000';
    ctx2.shadowBlur = 4;
    ctx2.fillText(ft.text, ft.x, ft.y);
    ctx2.shadowBlur = 0;
    ctx2.globalAlpha = 1;
  });

  // ═══════════════════════════════════════════
  // 9. 顶部提示栏（精致版：显示所有状态）
  // ═══════════════════════════════════════════
  ctx2.fillStyle = 'rgba(0,0,0,.65)';
  ctx2.fillRect(0, 0, W, 24);
  ctx2.fillStyle = '#f5deb3';
  ctx2.font = '10px Microsoft YaHei UI,sans-serif';
  ctx2.textAlign = 'center';
  const staffInfo = restState.staff.length > 0 ? ' | 员工:' + restState.staff.length : '';
  const repTier = getRepTier();
  ctx2.fillText('点击菜品烹饪→出餐口做好→点击顾客上菜 | 芥末:' + Math.floor(restWasabi) + '% | 酒柜:' + restDrinks + ' | 装修Lv.' + restUpgradeLevel.decor + ' | ' + repTier.icon + '声望' + restRep + '(' + repTier.name + ') | 📱粉丝' + wastegramFans + staffInfo, W / 2, 15);

  // ═══════════════════════════════════════════
  // 10. 粒子系统（烹饪火苗/完成金光）
  // ═══════════════════════════════════════════
  const parts = window._restParticles;
  for(let i = parts.length - 1; i >= 0; i--){
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
    if(p.life <= 0){ parts.splice(i, 1); continue; }
    ctx2.globalAlpha = Math.max(0, p.life / 30);
    ctx2.fillStyle = p.color;
    ctx2.beginPath(); ctx2.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx2.fill();
  }
  ctx2.globalAlpha = 1;
}


// ── 点击上菜 ──
function restCanvasClick(e){
  if(!restState) return;
  const c = document.getElementById('rest-canvas');
  const r = c.getBoundingClientRect();
  const sx = REST_CANVAS_W / r.width;
  const sy = REST_CANVAS_H / r.height;
  const x = (e.clientX - r.left) * sx;
  const y = (e.clientY - r.top) * sy;
  // ── 点击芥末台补充芥末（戴夫核心机制）── 按画布比例自适应
  const wasabiX = REST_CANVAS_W * 0.65, wasabiY = REST_CANVAS_H * 0.23;
  if(x >= wasabiX - 30 && x <= wasabiX + 30 && y >= wasabiY - 30 && y <= wasabiY + 35){
    if(restWasabi >= 100){
      addBanner('芥末已满！');
    } else if(coins >= 10){
      coins -= 10;
      restWasabi = 100;
      updateCoinUI();
      addRestFloatText('芥末补满! -10金', wasabiX, wasabiY, '#88cc44');
      sndReload();
    } else {
      addBanner('金币不足补芥末（需10金）');
    }
    return;
  }
  // ── 点击酒柜补充饮料 ──
  const drinkX1 = REST_CANVAS_W * 0.74, drinkX2 = REST_CANVAS_W * 0.95, drinkY1 = REST_CANVAS_H * 0.07, drinkY2 = REST_CANVAS_H * 0.18;
  if(x >= drinkX1 && x <= drinkX2 && y >= drinkY1 && y <= drinkY2){
    if(restDrinks >= 6){
      addBanner('酒柜已满！');
    } else if(coins >= 15){
      coins -= 15;
      restDrinks = 6;
      updateCoinUI();
      addRestFloatText('酒柜补满! -15金', 710, 50, '#aa6644');
      sndReload();
    } else {
      addBanner('金币不足补饮料（需15金）');
    }
    return;
  }
  for(let c2 of restState.customers){
    if(c2.state !== 'seated') continue;
    // 扩大点击区域：按画布比例自适应，宽40px高50px（更容易点中）
    if(Math.abs(x - c2.walkX) < 30 && Math.abs(y - c2.seat.y) < 45){
      // 优先：如果客人想要饮料且没上 → 先送饮料（消耗酒柜1杯）
      if(c2.wantsDrink && !c2.drinkServed){
        if(restDrinks <= 0){
          addBanner('酒柜空了！点击右上酒柜补充（15金）');
          return;
        }
        c2.drinkServed = true;
        c2.wantsDrink = false;
        restDrinks--;
        const drinkPay = Math.floor(5 + c2.ctype.tipMul * 3);
        restState.earnings += drinkPay;
        coins += drinkPay;
        updateCoinUI();
        addRestFloatText('🥤饮料+' + drinkPay + '金', c2.walkX, c2.seat.y - 30, '#88ccff');
        sndCoin();
        return;
      }
      // 上菜（经营重做：优先端顾客点的菜；点单不匹配→摇头拒绝，菜退回出餐口）
      if(restWasabi < 5){
        addBanner('芥末不够！点击芥末台补充');
        return;
      }
      if(restReadyDishes.length > 0){
        // 找顾客点的菜（按 recipeId 匹配，旧菜按菜名匹配）
        let dishIdx = -1;
        if(c2.order){
          dishIdx = restReadyDishes.findIndex(d => d.recipe && (d.recipe.recipeId === c2.order || (REST_RECIPES.find(r=>r.id===c2.order)||{}).name === d.recipe.name));
        }
        if(dishIdx < 0){
          // 没有顾客点的菜：如果顾客点了单，端别的菜会被拒——提示玩家
          if(c2.order){
            const ordered = REST_RECIPES.find(r => r.id === c2.order);
            addBanner(`⚠ ${ordered?ordered.name:'?'} 还没做好——出餐口没有 TA 点的菜`);
            return;
          }
          dishIdx = 0;  // 没点单的顾客（兜底）：端第一道菜
        }
        const dish = restReadyDishes.splice(dishIdx, 1)[0];
        c2.state = 'eating';
        c2.eatTimer = 2;
        c2._dishQuality = dish.quality || 'good';
        c2._servedDish = dish.recipe;
        // ── v50模块四：飞行上菜动画——菜从出餐口飞到顾客桌前0.4秒+上菜闪光 ──
        const fx = 625 + dishIdx * 45, fy = 115;   // 出餐口该菜原位
        const tx = c2.walkX, ty = c2.seat ? c2.seat.y + 6 : 250;
        for(let f = 0; f <= 6; f++){
          setTimeout(()=>{
            if(!restState || restState.ended)return;
            const p = f / 6;
            const px = fx + (tx - fx) * p, py = fy + (ty - fy) * p - Math.sin(p * Math.PI) * 30;  // 弧线
            mkP({x:px, y:py, vx:0, vy:0, r:5, rDecay:.1, decay:.3, color:dish.recipe.color, type:'circle', alpha:.9, grav:0, blur:true});
          }, f * 60);
        }
        // 到达闪光
        setTimeout(()=>{
          if(!restState || restState.ended)return;
          for(let s=0;s<6;s++){
            const a=s/6*Math.PI*2;
            mkP({x:tx, y:ty-10, vx:Math.cos(a)*2, vy:Math.sin(a)*2-1, r:2, rDecay:.06, decay:.08, color:'#ffd840', type:'spark', grav:.05, alpha:.9});
          }
        }, 420);
        const accepted = serveCustomer(c2);
        if(accepted === false){
          // 上错菜被拒：菜退回出餐口，顾客继续等
          restReadyDishes.unshift(dish);
          c2.state = 'seated';
          c2.eatTimer = 0;
        }
      } else {
        addBanner('出餐口没有菜！底部菜谱按钮直接做菜');
      }
      return;
    }
  }
}

// 显示"打烊结算"按钮（营业结束后玩家主动点击结束）
function showCloseButton(){
  const ctrl = document.getElementById('rest-controls');
  if(!ctrl) return;
  // 检查是否已存在
  if(document.getElementById('close-night-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'close-night-btn';
  btn.className = 'dish-btn';
  btn.style.cssText = 'min-width:140px;border-color:#ff8844;background:linear-gradient(180deg,#3a1a08,#2a1004);animation:blink 1.2s ease-in-out infinite;';
  btn.innerHTML = '<div class="dish-btn-icon" style="color:#ff8844;font-size:1.6rem;">🌙</div><div class="dish-btn-name" style="color:#ffcc66;font-size:.7rem;">打烊结算</div><div class="dish-btn-cost" style="color:#ff8844;">点击结束今夜</div>';
  btn.onclick = () => {
    if(restState && !restState.ended){
      endRestaurantNight();
    }
  };
  // 插入到最前面
  if(ctrl.firstChild) ctrl.insertBefore(btn, ctrl.firstChild);
  else ctrl.appendChild(btn);
}

function endRestaurantNight(){
  // v52修：防双击/重复触发（打烊按钮与看门狗可能先后调到）
  if(window._restNightEnding) return;
  window._restNightEnding = true;
  if(restRafId){ cancelAnimationFrame(restRafId); restRafId = null; }
  // 只把本夜新产生的网红好评存到下一夜（继承的不重复存）
  restPendingInfluencerBoost = restState.influencerBoostNew || 0;
  // ── 计算士气加成：餐厅经营越好，下一波战斗越强 ──
  // 每服务1个顾客 +1士气，每个生气顾客 -1士气，每50金币收入 +1士气
  // v52肉鸽·餐厅线：士气高昂——士气收益×1.5/层
  const moraleMul2 = 1 + (playerPerks.moraleboost||0)*0.5;
  const moraleGain = Math.floor((restState.served - restState.angry + Math.floor(restState.earnings / 50)) * moraleMul2);
  moraleBuff = Math.max(0, moraleGain);
  const stats = document.getElementById('rest-end-stats');
  const happy = restState.served;
  const angry = restState.angry;
  const total = restState.earnings;
  const vip = restState.vipServed;
  const influencerBoost = restState.influencerBoostNew || 0;
  // 员工贡献统计
  let staffStatsHtml = '';
  let totalCooked = 0, totalServed = 0, totalDrinks = 0;
  if(restState.staff.length > 0){
    staffStatsHtml = '<div style="margin-top:6px;border-top:1px solid #4a2c10;padding-top:6px;"><b style="color:#d2b48c;">👥 员工贡献：</b></div>';
    restState.staff.forEach(s => {
      const cooked = s.dishesCooked || 0;
      const served = s.customersServed || 0;
      const drinks = s.drinksServed || 0;
      totalCooked += cooked; totalServed += served; totalDrinks += drinks;
      staffStatsHtml += `<div style="font-size:.68rem;color:#b0a284;">${s.name}(${s.type==='cook'?'厨':'服'}): ${cooked}菜 ${served}客 ${drinks}饮</div>`;
    });
    staffStatsHtml += `<div style="font-size:.7rem;color:#88cc88;margin-top:2px;">合计: ${totalCooked}菜 ${totalServed}客 ${totalDrinks}饮</div>`;
  }
  // 士气加成显示
  const moraleHtml = moraleBuff > 0
    ? `<div style="margin-top:6px;color:#ffcc44;font-size:.8rem;">⚔️ 士气高昂 +${moraleBuff} → 下一波战斗伤害+${moraleBuff*5}% 移速+${moraleBuff*3}%</div>`
    : '<div style="margin-top:6px;color:#8a8474;font-size:.72rem;">士气平平，多服务顾客获得战斗加成</div>';
  // 废土社媒评级
  const rankColors = { E:'#888', D:'#88cc88', C:'#88ccff', B:'#ffcc44', A:'#ff8844', S:'#ff4444' };
  const wastegramHtml = `
    <div style="margin-top:8px;border-top:1px solid #4a2c10;padding-top:8px;">
      <div style="font-size:.9rem;color:${rankColors[wastegramRank]};font-weight:bold;">📱 废土社媒 [${wastegramRank}] ${getWastegramRankLabel()}</div>
      <div style="font-size:.68rem;color:#b0a284;">粉丝: ${wastegramFans} | 评级越高客流越多</div>
    </div>
  `;
  // 强化菜品统计
  const enhancedCount = Object.keys(restEnhancedDishes).length;
  const enhancedHtml = enhancedCount > 0
    ? `<div style="color:#ff66cc;font-size:.7rem;margin-top:4px;">✨ 本夜强化 ${enhancedCount} 道菜</div>`
    : '';
  // VIP图鉴统计
  const metCount = Object.keys(vipCompendium || {}).filter(k => vipCompendium[k].met).length;
  const unlockedCount = getUnlockedVIPs().length;
  const nightVIPs = restState.vipVisitedThisNight ? restState.vipVisitedThisNight.length : 0;
  const vipHtml = `
    <div style="margin-top:6px;border-top:1px solid #4a2c10;padding-top:6px;">
      <div style="font-size:.85rem;color:#dd88ff;font-weight:bold;">📖 VIP顾客图鉴</div>
      <div style="font-size:.68rem;color:#b0a284;">本夜接待VIP: ${nightVIPs} 人 | 图鉴: ${metCount}/${VIP_CUSTOMERS.length} 已相遇 · ${unlockedCount}/${VIP_CUSTOMERS.length} 已解锁</div>
    </div>
  `;
  // ── 美术E：结算面板 Dave 风重排版（大数字图标卡代替纯文本行堆叠）──
  const tier = getRepTier();
  const statCard = (icon, label, value, valueColor) => `
    <div style="display:flex;align-items:center;gap:10px;background:rgba(40,24,14,.75);border:1px solid #5a3a1a;border-radius:8px;padding:6px 14px;min-width:150px;">
      <span style="font-size:1.3rem;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));">${icon}</span>
      <span style="flex:1;">
        <span style="display:block;font-size:.62rem;color:#b0a284;letter-spacing:1px;">${label}</span>
        <span style="display:block;font-family:var(--font-num);font-weight:800;font-size:1.25rem;color:${valueColor};text-shadow:0 1px 2px rgba(0,0,0,.6);">${value}</span>
      </span>
    </div>`;
  stats.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;width:100%;max-width:560px;">
      ${statCard('🍽️', '服务顾客', happy + ' 人', '#88ff88')}
      ${statCard('💰', '总收入', total + ' 金', '#ffd840')}
      ${statCard('😤', '生气离开', angry + ' 人', '#ff7766')}
      ${statCard('⭐', '特殊客人', vip + ' 人', '#ffcc44')}
      ${statCard(tier.icon, '当前声望', restRep + ' ' + tier.name, tier.color)}
      ${statCard('👥', '员工·装修', restHiredStaff.length + '人 · Lv' + restUpgradeLevel.decor, '#d2b48c')}
    </div>
    <div style="width:100%;max-width:560px;">
      ${staffStatsHtml}
      ${enhancedHtml}
      ${moraleHtml}
      ${wastegramHtml}
      ${vipHtml}
      ${influencerBoost > 0 ? `<div style="color:#ff66cc;margin-top:6px;">📱 网红好评 ×${influencerBoost} → 下一夜客流+${influencerBoost * 30}%</div>` : ''}
      ${currentTrend ? `<div style="color:#ff8844;margin-top:4px;font-size:.72rem;">📱 今日热搜：${currentTrend.text}</div>` : ''}
      <div style="margin-top:6px;color:#dd88ff;font-size:.72rem;">${getSocialMediaRank().icon} 社媒等级：${getSocialMediaRank().name} (粉丝${wastegramFans})${getNextSocialMediaRank() ? ' → 下一级:'+getNextSocialMediaRank().name+'(需'+getNextSocialMediaRank().minFans+'粉)' : ' (满级)'}</div>
      <div style="margin-top:8px;color:#b0a284;font-size:.72rem;">${happy > angry ? '生意兴隆！声望提升，明天更多顾客。' : '需要改进...可雇佣员工或升级装修。'}</div>
    </div>
  `;
  // 派发夜晚结束事件
  RestEventBus.emit(EVT.NIGHT_END, { served: happy, angry, earnings: total, fans: wastegramFans, rank: wastegramRank });
  // 重置本夜强化记录
  restEnhancedDishes = {};
  document.getElementById('rest-end-scr').classList.add('open');
}


