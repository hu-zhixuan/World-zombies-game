// ═══════════════════════════════════════════


/* ═══════════════════════════════════════════════════════════════════════════════
   ══ 05. RESTAURANT SYSTEM ══
   深夜食堂状态机 / 后厨烹饪QTE / 顾客耐心排队 / 经营收益 / 粉丝评价与Cooksta
═══════════════════════════════════════════════════════════════════════════════ */


//  【夜晚模块 B1-B5】NIGHT RESTAURANT v2.0（夜晚餐厅深度经营系统）
//  全面模仿潜水员戴夫：芥末/酒柜/排队/评论家/网红/员工/剧情
// ═══════════════════════════════════════════
let restState = null;
let restRafId = null;
let restRep = 0;           // 餐厅声望（跨夜保留）
let restUpgradeLevel = {   // 餐厅升级等级（跨夜保留）
  stoves: 3,     // 灶眼数量（3-5）
  tables: 4,     // 桌位数量（4-6）
  decor: 0,      // 装修等级（0-3，提升顾客耐心和小费）
};
let restHiredStaff = [];   // 已雇佣员工 [{type, name, color, skill, cost}]
let restPendingInfluencerBoost = 0;  // 网红好评累计（下一夜生效，跨夜保留）
let restWasabi = 100;  // 芥末存量（0-100，每道菜消耗5，低于20要补充）
let restDrinks = 6;  // 酒柜饮料存量（每杯消耗1，低于2要补充）
const REST_CANVAS_W = 1100, REST_CANVAS_H = 440;
const REST_NIGHT_DURATION = 90;  // 每夜90秒（延长，配合更多内容）

// ═══════════════════════════════════════════
//  【经营重做】菜单注册制（参考潜水员戴夫：顾客只点"注册过的菜"）
//  - tonightMenu: 今晚注册的菜谱id列表（开餐前在菜单面板选）
//  - 菜单槽位：基础2个，社媒等级解锁到5个（激活SOCIAL_MEDIA_RANKS成长线）
//  - 顾客点单：从今晚菜单按顾客类型偏好加权抽取
// ═══════════════════════════════════════════
let tonightMenu = [];  // 今晚注册的菜谱id（如 ['grilled_meat','meat_soup']）
// 菜单槽位数：社媒等级 0/1/2/3/4 → 2/3/3/4/5 槽
function getMenuSlots(){
  const fans = wastegramFans;
  if(fans >= 10000) return 5;
  if(fans >= 2000) return 4;
  if(fans >= 500) return 3;
  if(fans >= 100) return 3;
  return 2;
}
// 切换菜谱注册状态（菜单面板点击）
function toggleMenuRegistration(recipeId){
  const maxSlots = getMenuSlots();
  const inMenu = tonightMenu.includes(recipeId);
  if(inMenu){
    tonightMenu = tonightMenu.filter(id => id !== recipeId);
  }else{
    if(tonightMenu.length >= maxSlots){
      addBanner(`⚠ 菜单槽位已满（${maxSlots}个）——提升社媒等级解锁更多槽位`);
      return;
    }
    tonightMenu.push(recipeId);
  }
  buildMenuRegistrationUI();  // 刷新菜单面板
}
// 今晚菜单是否有效（至少1道菜）
function isMenuValid(){
  return tonightMenu.length > 0;
}
// 构建菜单注册面板（开餐前/据点厨房里显示）
function buildMenuRegistrationUI(containerEl){
  const grid = containerEl || document.getElementById('menu-reg-grid');
  if(!grid) return;
  const unlocked = getUnlockedRecipes();
  const maxSlots = getMenuSlots();
  let html = `<div style="width:100%;text-align:center;font-family:var(--font-display);font-weight:800;font-size:.72rem;color:#d2b48c;margin-bottom:6px;">
    📋 今晚菜单 ${tonightMenu.length}/${maxSlots} 槽位（社媒粉丝升级解锁更多）</div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;width:100%;max-width:560px;">';
  unlocked.forEach(r => {
    const active = tonightMenu.includes(r.id);
    const canAfford = Object.keys(r.cost).every(m => meatInventory[m] >= r.cost[m]);
    // v52两界互锁：菜单卡明示战斗增益——"注册这道菜=给下一波战斗买这个Buff"
    const buffDef = BATTLE_BUFF_DEFS[r.buffId];
    const buffHtml = buffDef
      ? `<div style="font-size:.62rem;color:#88ff88;margin-top:2px;background:rgba(136,255,136,.08);border-left:2px solid #88ff88;padding:2px 6px;border-radius:2px;">⚔战斗增益：${buffDef.icon}${buffDef.name} ${buffDef.desc}</div>`
      : '';
    html += `<div class="recipe-card" data-menu-id="${r.id}" style="${active?'border-color:#ffd868;box-shadow:0 0 10px rgba(255,216,104,.35);':''}${canAfford?'':'opacity:.55;'}cursor:pointer;${active?'background:linear-gradient(180deg,#2d2410,#1a1408);':''}">
      <div class="recipe-header">
        <span class="recipe-name" style="font-size:.8rem;">${active?'✅ ':''}${r.name}</span>
        <span class="recipe-price">${r.price}金</span>
      </div>
      <div class="recipe-desc" style="font-size:.66rem;">${r.icon} ${r.cookTime}秒 · ${r.desc}</div>
      <div class="recipe-cost" style="font-size:.6rem;">${Object.keys(r.cost).map(m=>`${MEAT_TYPES[m].icon}${r.cost[m]}`).join(' ')}</div>
      ${buffHtml}
      <div style="font-size:.66rem;color:${active?'#ffd868':'#b0a284'};margin-top:2px;">${active?'已注册 · 点击移除':'点击注册到今晚菜单'}</div>
    </div>`;
  });
  html += '</div>';
  if(unlocked.length === 0){
    html = '<div style="color:#b0a284;font-size:.7rem;padding:16px;text-align:center;">暂无解锁菜谱（推进波次+提升声望解锁）</div>';
  }
  grid.innerHTML = html;
  // 绑定点击
  grid.querySelectorAll('[data-menu-id]').forEach(card => {
    card.onclick = () => toggleMenuRegistration(card.getAttribute('data-menu-id'));
  });
}

// ── 餐厅剧情对话（声望里程碑触发）──
const REST_STORY_EVENTS = {
  // 首次开张
  firstOpen: [
    {npc:'ming', text:'（清完第一波，我靠在墙上喘气。地上散落着僵尸掉落的肉块）\n……这些肉，能吃吗？'},
    {npc:'ming', text:'（犹豫了一下，捡起一块。闻了闻）\n没腐烂。反而……有一股奇异的香味。\n（咽了口唾沫）末世了，浪费可耻。'},
    {npc:'ming', text:'（推着自己小屋的门。这屋子从爸妈走后就一直空着）\n屋里有一张旧桌子，三口灶，墙上还挂着妈妈的菜谱。\n……十年没回来了。'},
    {npc:'radio', text:'【外界广播杂音】……城西幸存者聚集点……有人求救……听说城西有个杀僵尸的英雄……僵尸肉能吃……求一顿热饭……', enterDelay:500},
    {npc:'ming', text:'（愣住）……他们说的杀僵尸英雄，是我？\n僵尸肉能吃……是我先发现的？'},
    {npc:'ming', text:'（门外传来敲门声。一个瘦弱的声音）\n"请问……是这里吗？听说你有僵尸肉……我们已经三天没吃东西了……"'},
    {npc:'ming', text:'（沉默了几秒，打开了门）\n……进来吧。\n（看了看妈妈的菜谱）\n烤肉串……我试试。'},
    {npc:'ming', text:'（肉下锅的瞬间，香味飘了出来。那个人眼睛亮了）\n……原来僵尸肉真的能做菜。\n（看着妈妈的菜谱）\n妈，我好像找到活下去的方式了。'},
    {npc:'ming', text:'（把灯笼点亮，挂上旧招牌）\n"小胡的深夜食堂"——秘密餐厅。\n外面那些僵尸还在游荡，但这里……能给人一口热饭。\n活过今夜的人，都值得吃顿好的。'},
  ],
  // 声望达到10：全城人赶来
  rep10: [
    {npc:'ming', text:'（消息传开了。城东、城北的人都摸黑跑来，就为吃一口僵尸肉）\n……我怎么成英雄了？我就是个会打枪的厨子。'},
    {npc:'ming', text:'（老兵张端着碗走过来）\n生意不错啊，老板。'},
    {npc:'zhang', text:'别叫我老板。叫我老张就行。\n（喝一口汤）嗯——这肉……比军粮强多了。\n你这手艺，是跟谁学的？'},
    {npc:'ming', text:'……我妈。她以前开过饭馆。'},
    {npc:'zhang', text:'好手艺。守住了据点，又守住了这口锅。\n这地方，现在全城人都指着你了。\n你是这片唯一的杀僵尸英雄——也是唯一的厨子。'},
  ],
  // 声望达到25：评论家来访
  rep25: [
    {npc:'ming', text:'（今晚来了个戴眼镜的陌生人，一直在小本上写写画画）\n那是……评论家？'},
    {npc:'ming', text:'（紧张）如果给差评，声望就完了。\n（深吸一口气）做好每一道菜。别的不管。'},
  ],
  // 声望达到40：网红打卡
  rep40: [
    {npc:'ming', text:'（一个染着头发的年轻人举着手机在拍）\n这是什么？网红？'},
    {npc:'ming', text:'（端上菜）尝尝。不好吃不要钱。'},
    {npc:'ming', text:'（年轻人吃完，眼睛亮了，连发三条动态）\n……行吧。免费广告。'},
  ],
};
let restStoryTriggered = {};  // 记录已触发的剧情

// ── 顾客类型定义（参考潜水员戴夫）──
// 戴夫的客人类型：普通/VIP/急躁/美食家/评论家（评论家会给声望大起大落）
const CUSTOMER_TYPES = [
  { id:'normal',   name:'普通顾客', color:'#5a7a9a', patienceMul:1.0,  tipMul:0.8,  weight:55, icon:'客', desc:'普通食客' },
  { id:'vip',      name:'VIP贵宾',  color:'#ffcc44', patienceMul:1.3,  tipMul:1.4,  weight:10, icon:'V',  desc:'高消费，小费丰厚' },
  { id:'impatient',name:'急躁顾客', color:'#ff6655', patienceMul:0.55, tipMul:1.0,  weight:18, icon:'急', desc:'耐心短但小费高' },
  { id:'gourmet',  name:'美食家',   color:'#cc66ff', patienceMul:1.15, tipMul:1.6,  weight:10, icon:'家', desc:'挑剔但肯付钱' },
  { id:'critic',   name:'美食评论家',color:'#22aaff', patienceMul:1.1, tipMul:0.8, weight:4,  icon:'评', desc:'评价影响声望±5' },
  { id:'influencer',name:'网红打卡', color:'#ff66cc', patienceMul:0.85,tipMul:1.2, weight:3,  icon:'网', desc:'好评带来下波客流+30%' },
];

