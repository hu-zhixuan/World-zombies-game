// ════════════════════════════════════════════════════════════════════════════
//  【Cooksta 式社交媒体评价系统】参考 Dave the Diver
//  每次服务顾客后生成评价帖，按品质+顾客性格生成不同内容
//  评价帖会推送到侧边通知栏 + 社交媒体面板
// ════════════════════════════════════════════════════════════════════════════

// 评价池：按品质分级（参考 Cooksta 的 best/good/normal/bad）
const COOKSTA_REVIEWS = {
  legendary: [
    '救命！这是什么神仙料理！我以为在做梦！',
    '吃完哭了。是想念妈妈的味道的那种哭。',
    '我愿意用三个月的罐头换这一口。',
    '这是废土上吃过最好的东西，没有之一。',
    '老板你是不是战前米其林大厨？',
    '天呐！这味道让我想起了和平年代。',
    '绝了绝了绝了！三连发！',
    '我单方面宣布这是据点之光。',
    '吃完想给老板磕头。',
    '这盘菜值一条命。真的。',
    '不可思议……废土上还有这种美味存在。',
    '我要天天来！谁来拦我我跟谁急！',
  ],
  perfect: [
    '相当不错！手艺扎实，食材新鲜。',
    '比上次更好了，老板在进步。',
    '稳定输出，这店靠谱。',
    '味道对得起这个价格。',
    '推荐！朋友吃了也说好。',
    '分量足，火候到位。',
    '据点里数一数二的好店。',
    '老板用心了，吃得出来。',
    '满意！下次还来。',
    '这水准在废土算顶级了。',
  ],
  good: [
    '还行吧，能填饱肚子。',
    '中规中矩，没惊喜也没雷。',
    '凑合一顿，不挑。',
    '味道一般，但热乎的就行。',
    '勉勉强强，下次可以试试别的。',
    '吃惯了，就这味儿。',
    '不功不过。',
    '能吃，饿不着就行。',
    '普通水平，但比外面强。',
    '还行，至少没拉肚子。',
  ],
  poor: [
    '这……有点失望。',
    '今天是状态不好吗？',
    '味道淡了点，肉也老。',
    '不如上次，退步了。',
    'emmm，期望有点高。',
    '凑合吃吧，也不好意思说。',
    '感觉没放盐？',
    '这盘肉有点不对劲……',
    '希望下次改进。',
    '价格略高了，这水准。',
  ],
  burned: [
    '焦了！老板你没事吧？！',
    '这是炭吧？我是在吃炭吧？',
    '差点崩了我的牙！',
    '这是对食材的亵渎！',
    '我花钱买罪受……',
    '能不能用心点？',
    '这盘东西侮辱了我的舌头。',
    '再也不点这个了。',
    '老板今天是不是走神了？',
    '难吃哭了，真的哭。',
  ],
};

// 顾客类型专属评价修饰（VIP/评论家/网红/美食家）
const COOKSTA_TYPE_TAGS = {
  vip: ['[VIP]', '[贵宾]', '[大佬]'],
  gourmet: ['[美食家]', '[老饕]', '[行家]'],
  critic: ['[评论家]', '[探店]', '[专栏]'],
  influencer: ['[网红]', '[打卡]', '[推荐]'],
  impatient: ['[急性子]', '[赶时间]'],
  normal: ['', '', '', ''],
};

// 生成评价帖
function generateCookstaReview(customer, quality, dishInfo){
  let pool = COOKSTA_REVIEWS[quality] || COOKSTA_REVIEWS.good;
  let review = pool[Math.floor(Math.random() * pool.length)];
  // 顾客类型标签
  const typeTag = COOKSTA_TYPE_TAGS[customer.ctype.id] || [''];
  const tag = typeTag[Math.floor(Math.random() * typeTag.length)];
  // 菜品名
  const dishName = dishInfo ? dishInfo.name : '烤肉';
  // VIP 顾客用他们的名字；普通顾客用生成的名字
  const author = customer.isVIP ? customer.ctype.name : (customer.persona ? customer.persona.name : '幸存者' + Math.floor(Math.random()*999));
  // 评价内容（带菜名）
  let fullReview = review;
  if(Math.random() < 0.4 && dishName){
    fullReview += ' —— ' + dishName;
  }
  // 品质颜色
  const qColors = { legendary:'#ff44dd', perfect:'#FFD45E', good:'#88ff88', poor:'#ff8844', burned:'#666666' };
  const qNames = { legendary:'⭐传说', perfect:'✨完美', good:'👍好评', poor:'😕一般', burned:'💔差评' };
  return {
    author: author,
    tag: tag,
    text: fullReview,
    quality: quality,
    qualityLabel: qNames[quality] || '👍',
    color: qColors[quality] || '#88ff88',
    dishName: dishName,
    timestamp: Date.now(),
    customer: customer,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  【声望阶级系统】参考 Dave the Diver Cooksta 评级
//  声望 -50~60 分为 6 个阶级，每个阶级影响客流/特殊顾客/解锁
// ════════════════════════════════════════════════════════════════════════════

const REP_TIERS = [
  { name:'劣迹斑斑', min:-50, color:'#8b0000', icon:'💀', desc:'没人想来的黑店', maxCustomers:3 },
  { name:'门可罗雀', min:-20, color:'#aa4444', icon:'🏚️', desc:'只有走投无路的人来', maxCustomers:4 },
  { name:'小有名气', min:-5,  color:'#cc8844', icon:'🏚️', desc:'据点里有人知道了', maxCustomers:6 },
  { name:'废土名店', min:10,  color:'#ffcc44', icon:'🏪', desc:'吃货们开始打卡', maxCustomers:8 },
  { name:'据点食堂', min:25,  color:'#88cc44', icon:'⭐', desc:'人人都推荐的好店', maxCustomers:10 },
  { name:'末日米其林', min:45, color:'#ff44aa', icon:'👑', desc:'废土传奇餐厅', maxCustomers:12 },
];

function getRepTier(){
  let tier = REP_TIERS[0];
  for(const t of REP_TIERS){
    if(restRep >= t.min) tier = t;
  }
  return tier;
}

function getRepTierLabel(){
  const t = getRepTier();
  return t.icon + ' ' + t.name;
}

// 声望变化时触发通知
let lastRepTierIdx = 0;
function checkRepTierChange(){
  const curTier = getRepTier();
  const curIdx = REP_TIERS.indexOf(curTier);
  if(curIdx !== lastRepTierIdx){
    const oldTier = REP_TIERS[lastRepTierIdx];
    const isUpgrade = curIdx > lastRepTierIdx;
    lastRepTierIdx = curIdx;
    // 侧边通知
    pushSideNotification(
      isUpgrade ? '📈 声望晋升！' : '📉 声望下降',
      `${oldTier.icon} ${oldTier.name} → ${curTier.icon} ${curTier.name}`,
      curTier.desc + ' (上限' + curTier.maxCustomers + '人)',
      curTier.color,
      isUpgrade ? 'upgrade' : 'downgrade'
    );
    // 升级音效
    if(isUpgrade) sndLevelUp();
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  【侧边通知弹窗系统】Dave the Diver 式右上角通知
//  用于评价、声望变化、VIP 来访、社媒动态等
// ════════════════════════════════════════════════════════════════════════════

let sideNotificationQueue = [];
let sideNotificationActive = false;

function pushSideNotification(title, body, sub, color, type){
  sideNotificationQueue.push({ title, body, sub: sub||'', color: color||'#dd88ff', type: type||'info' });
  if(!sideNotificationActive) processSideNotificationQueue();
}

function processSideNotificationQueue(){
  if(sideNotificationQueue.length === 0){
    sideNotificationActive = false;
    return;
  }
  sideNotificationActive = true;
  const notif = sideNotificationQueue.shift();
  showSideNotification(notif);
}

function showSideNotification(notif){
  const container = document.getElementById('side-notification-container');
  if(!container){
    // 创建容器
    const c = document.createElement('div');
    c.id = 'side-notification-container';
    c.style.cssText = 'position:absolute;top:30px;right:8px;z-index:130;width:240px;pointer-events:none;';
    const restScr = document.getElementById('restaurant-scr');
    if(restScr) restScr.appendChild(c);
    else document.body.appendChild(c);
  }
  const cont = document.getElementById('side-notification-container');
  const el = document.createElement('div');
  el.className = 'side-notif side-notif-' + (notif.type||'info');
  const iconMap = { upgrade:'📈', downgrade:'📉', review:'💬', vip:'✨', fans:'📱', info:'ℹ️' };
  const icon = iconMap[notif.type] || 'ℹ️';
  el.innerHTML = `
    <div class="side-notif-title" style="color:${notif.color}">${icon} ${notif.title}</div>
    <div class="side-notif-body">${notif.body}</div>
    ${notif.sub ? `<div class="side-notif-sub">${notif.sub}</div>` : ''}
  `;
  cont.appendChild(el);
  // 入场动画
  requestAnimationFrame(() => { el.classList.add('show'); });
  // 4秒后移除
  setTimeout(() => {
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => { el.remove(); processSideNotificationQueue(); }, 400);
  }, 4000);
}

// 推送评价到侧边通知
function pushReviewNotification(review){
  pushSideNotification(
    '💬 新评价 ' + review.qualityLabel,
    review.author + (review.tag ? ' ' + review.tag : '') + ': "' + (review.text.length > 30 ? review.text.substring(0,30)+'...' : review.text) + '"',
    '',
    review.color,
    'review'
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  【Cooksta 社交媒体面板】可展开的社媒动态流
// ════════════════════════════════════════════════════════════════════════════

function toggleCookstaPanel(){
  const panel = document.getElementById('cooksta-panel');
  if(!panel) return;
  panel.classList.toggle('open');
  if(panel.classList.contains('open')){
    renderCookstaFeed();
    sndShopOpen();
  } else {
    sndShopClose();
  }
}

function renderCookstaFeed(){
  const feed = document.getElementById('cooksta-feed');
  if(!feed) return;
  const tier = getRepTier();
  // 顶部信息
  const header = document.getElementById('cooksta-panel-header');
  if(header){
    header.innerHTML = `
      <div style="font-family:var(--font-display);font-weight:800;font-size:1.1rem;color:${tier.color};">${tier.icon} ${tier.name}</div>
      <div style="font-size:.65rem;color:#b0a284;">声望 ${restRep} | 粉丝 ${wastegramFans} | ${tier.desc}</div>
    `;
  }
  // 动态流
  const posts = (restState && restState.wastegramFeed) ? restState.wastegramFeed : [];
  if(posts.length === 0){
    feed.innerHTML = '<div style="text-align:center;color:#b0a284;font-size:.75rem;padding:20px;font-style:italic;">还没有评价，服务顾客后会在这里更新</div>';
    return;
  }
  feed.innerHTML = posts.map(p => `
    <div class="cooksta-post" style="border-left:3px solid ${p.color||'#b0a284'};">
      <div class="cooksta-post-header">
        <span class="cooksta-post-author" style="color:${p.color||'#f5deb3'}">${p.author}</span>
        <span class="cooksta-post-tag" style="color:${p.color||'#b0a284'}">${p.tag||''}</span>
      </div>
      <div class="cooksta-post-text">${p.text}</div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════════════════════════════
//  【粉丝系统升级】更高门槛，配合VIP解锁
