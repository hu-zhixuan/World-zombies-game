// ════════════════════════════════════════════════════════════════════════════
//  【普通顾客名字与故事系统】参考 Dave the Diver — 每个客人都有身份
//  非 VIP 顾客也会从名字池中抽取，并附带简短废土背景故事
// ════════════════════════════════════════════════════════════════════════════

const NORMAL_CUSTOMER_NAMES = [
  { name:'老周', story:'前修车工，如今靠卖废铁度日', skin:'#d4a574', hair:'#3a2a1a', shirt:'#5a6a4a' },
  { name:'阿芳', story:'带着两个孩子的母亲，总点最便宜的', skin:'#e4c4a4', hair:'#4a3a2a', shirt:'#a85a6a' },
  { name:'铁柱', story:'前拳击手，沉默寡言，吃完就走', skin:'#c89878', hair:'#1a1a1a', shirt:'#3a3a5a' },
  { name:'小梅', story:'诊所学徒，爱偷听别人谈话', skin:'#f4d4c4', hair:'#2a1a0a', shirt:'#6a8a9a' },
  { name:'瘸腿老李', story:'老兵，腿是撤城时被砸的', skin:'#b89878', hair:'#5a4a3a', shirt:'#4a5a3a' },
  { name:'眼镜王', story:'自称战前大学教授，没人信', skin:'#d4b494', hair:'#3a3a3a', shirt:'#6a5a3a' },
  { name:'胖婶', story:'据点食堂帮工，总偷学菜谱', skin:'#e4c4a4', hair:'#4a2a2a', shirt:'#8a6a4a' },
  { name:'哑巴孙', story:'喉咙在逃亡时被灼伤，用手语点菜', skin:'#c8a888', hair:'#2a2a1a', shirt:'#5a4a6a' },
  { name:'烟枪张', story:'永远叼着熄灭的烟头，怀念烟草', skin:'#b89878', hair:'#3a2a2a', shirt:'#4a4a4a' },
  { name:'双辫小薇', story:'据点最小的孩子，才12岁就出来打饭', skin:'#f4d4b4', hair:'#1a1a1a', shirt:'#cc6688' },
  { name:'独眼赵', story:'左眼是变异体抓的，戴着眼罩', skin:'#c89878', hair:'#3a3a3a', shirt:'#5a5a4a' },
  { name:'花衬衫阿飞', story:'自称战前摇滚乐手', skin:'#d4a574', hair:'#cc4422', shirt:'#aa4488' },
  { name:'补丁婆', story:'衣服上缝满补丁，每块都是一段故事', skin:'#b89878', hair:'#6a6a6a', shirt:'#7a6a5a' },
  { name:'光头强', story:'前伐木工，如今专砍僵尸头', skin:'#d4a574', hair:'#1a1a1a', shirt:'#4a3a2a' },
  { name:'护士小兰', story:'和小林一起的护士，性格胆小', skin:'#f4d4c4', hair:'#3a2a1a', shirt:'#ddeeff' },
  { name:'老烟斗', story:'叼着自制烟斗，抽的是干草叶', skin:'#c8a888', hair:'#4a3a2a', shirt:'#5a4a3a' },
  { name:'麻子脸阿牛', story:'脸上是辐射斑，但心肠不坏', skin:'#b89878', hair:'#2a2a1a', shirt:'#6a5a4a' },
  { name:'红头巾阿珍', story:'据点巡逻队员，下班来吃夜宵', skin:'#e4c4a4', hair:'#1a1a1a', shirt:'#cc3333' },
  { name:'瘸腿猫叔', story:'带着一只三腿猫，猫也吃肉', skin:'#d4b494', hair:'#3a3a3a', shirt:'#5a5a5a' },
  { name:'小个子阿明', story:'15岁就独自逃难到此的少年', skin:'#f4d4b4', hair:'#2a2a1a', shirt:'#4488aa' },
  { name:'铜牙老马', story:'镶着一口铜牙，笑起来金光闪闪', skin:'#c89878', hair:'#5a4a3a', shirt:'#6a6a4a' },
  { name:'疤面阿龙', story:'脸上刀疤是跟人抢罐头留下的', skin:'#b89878', hair:'#1a1a1a', shirt:'#3a3a4a' },
  { name:'背锅婆', story:'永远背着一口锅，说随时要逃', skin:'#d4a484', hair:'#4a3a2a', shirt:'#7a5a4a' },
  { name:'瞎子阿炳', story:'双目失明，靠鼻子闻菜香点单', skin:'#c8a888', hair:'#3a3a3a', shirt:'#5a5a5a' },
  { name:'高个阿翔', story:'两米高的瘦子，进门总要弯腰', skin:'#e4c4a4', hair:'#2a1a0a', shirt:'#4a6a5a' },
  { name:'酒鬼老郑', story:'把一切能发酵的东西都叫酒', skin:'#b89878', hair:'#3a2a2a', shirt:'#5a3a3a' },
  { name:'绣花婆', story:'衣服上绣着花，说战争前她是裁缝', skin:'#d4a484', hair:'#5a4a3a', shirt:'#8a5a7a' },
  { name:'快手阿杰', story:'据点最快的装卸工，吃饭也快', skin:'#d4a574', hair:'#1a1a1a', shirt:'#cc8844' },
  { name:'白毛老太', story:'头发一夜变白，是撤离那晚吓的', skin:'#e4c4a4', hair:'#dddddd', shirt:'#6a4a5a' },
  { name:'手套哥', story:'永远戴着手套，不肯说是为什么', skin:'#d4b494', hair:'#2a2a1a', shirt:'#4a4a3a' },
  { name:'胖厨老吴', story:'以前也开过饭馆，后来僵尸把他店砸了', skin:'#e4b494', hair:'#3a2a1a', shirt:'#aa6644' },
  { name:'尖嘴阿鼠', story:'瘦小机灵，专偷僵尸身上的零碎', skin:'#c8a888', hair:'#2a1a0a', shirt:'#5a6a4a' },
  { name:'断指阿峰', story:'左手缺两根指头，是冻掉的', skin:'#d4a574', hair:'#3a3a3a', shirt:'#4a5a6a' },
  { name:'花脸小豆子', story:'7岁，脸上是胎记不是伤', skin:'#f4d4b4', hair:'#1a1a1a', shirt:'#44aacc' },
  { name:'铁匠老邓', story:'给据点打刀的，手粗得像树皮', skin:'#c89878', hair:'#3a2a2a', shirt:'#5a4a3a' },
  { name:'染发阿May', story:'头发是绿色，说是海藻染的', skin:'#e4c4a4', hair:'#44aa44', shirt:'#aa44aa' },
];

// 为普通顾客生成名字+故事
// v52美术：普通顾客体型档（瘦/标准/壮/胖——影响身体宽高与头身比）
const CUSTOMER_BUILDS = [
  { id:'slim',  bw:16, bh:22, hw:7  },   // 瘦削
  { id:'normal',bw:20, bh:24, hw:8  },   // 标准
  { id:'buff',  bw:24, bh:25, hw:8.5},   // 壮实（拳击手/铁匠）
  { id:'fat',   bw:26, bh:22, hw:8.5},   // 圆润（胖婶/胖厨）
];
// v52美术：发型库（每种有独特轮廓绘制法）
const CUSTOMER_HAIRSTYLES = ['short','bob','ponytail','spiky','bald','long','cap','bun'];

function generateNormalCustomerPersona(){
  const p = NORMAL_CUSTOMER_NAMES[Math.floor(Math.random() * NORMAL_CUSTOMER_NAMES.length)];
  return {
    name: p.name,
    story: p.story,
    skin: p.skin,
    hair: p.hair,
    shirt: p.shirt,
    // v52美术：随机体型+发型（同一人物下次来店也可能换了发型——生活感）
    build: CUSTOMER_BUILDS[Math.floor(Math.random() * CUSTOMER_BUILDS.length)],
    hairStyle: CUSTOMER_HAIRSTYLES[Math.floor(Math.random() * CUSTOMER_HAIRSTYLES.length)],
    beard: Math.random() < 0.3,          // 30% 有胡茬
    accessory: Math.random() < 0.22 ? (['hat','goggles','scarf','eyepatch'][Math.floor(Math.random()*4)]) : null,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  【v52美术·餐厅客人建模】普通顾客分层精建模
//  体型(4档) × 发型(8种) × 配件(帽/风镜/围巾/眼罩) × 胡茬 × 表情动画
//  坐/走/排队/吃 4 状态姿态；吃面动画（筷子+低头+嚼动）
// ════════════════════════════════════════════════════════════════════════════


function _restHair(ctx2, style, hx, hy, hc, hw){
  ctx2.fillStyle = hc;
  switch(style){
    case 'bald':  // 光头：只剩鬓角一圈
      ctx2.beginPath();ctx2.ellipse(hx, hy+4, hw*0.95, hw*0.35, 0, Math.PI*0.15, Math.PI*0.85);ctx2.fill();
      break;
    case 'short': // 短发：贴头薄层
      ctx2.beginPath();ctx2.arc(hx, hy, hw, Math.PI*0.95, Math.PI*2.05);ctx2.fill();
      ctx2.fillRect(hx-hw, hy-1, hw*2, 2.5);
      break;
    case 'bob':   // 齐耳短发：头两侧鼓出
      ctx2.beginPath();ctx2.arc(hx, hy, hw, Math.PI*0.8, Math.PI*2.2);ctx2.fill();
      ctx2.fillRect(hx-hw-1.5, hy, 3, hw*0.9);   // 左侧发垂
      ctx2.fillRect(hx+hw-1.5, hy, 3, hw*0.9);   // 右侧发垂
      ctx2.fillRect(hx-hw, hy-1, hw*2, 3);
      break;
    case 'ponytail': // 马尾：头顶+脑后一束
      ctx2.beginPath();ctx2.arc(hx, hy, hw, Math.PI*0.9, Math.PI*2.1);ctx2.fill();
      ctx2.beginPath();
      ctx2.moveTo(hx+hw-2, hy+1);
      ctx2.quadraticCurveTo(hx+hw+4, hy+5, hx+hw+2, hy+9);
      ctx2.quadraticCurveTo(hx+hw, hy+5, hx+hw-3, hy+4);
      ctx2.closePath();ctx2.fill();
      break;
    case 'spiky': // 刺猬头：头上一圈尖刺
      ctx2.beginPath();ctx2.arc(hx, hy+1, hw, Math.PI, Math.PI*2);ctx2.fill();
      for(let s=0;s<4;s++){
        const sx = hx-hw+1.5+s*(hw*2-3)/3;
        ctx2.beginPath();
        ctx2.moveTo(sx-1.6, hy-0.5);
        ctx2.lineTo(sx, hy-5.5);
        ctx2.lineTo(sx+1.6, hy-0.5);
        ctx2.closePath();ctx2.fill();
      }
      break;
    case 'long':  // 长发：披肩两层
      ctx2.fillRect(hx-hw-2, hy-1, 4, hw*1.9);   // 左披发
      ctx2.fillRect(hx+hw-2, hy-1, 4, hw*1.9);   // 右披发
      ctx2.fillRect(hx-hw, hy-2, hw*2, 3.5);     // 刘海层
      ctx2.beginPath();ctx2.arc(hx, hy, hw, Math.PI*0.85, Math.PI*2.15);ctx2.fill();
      break;
    case 'bun':   // 丸子头：头顶发髻球
      ctx2.beginPath();ctx2.arc(hx, hy, hw, Math.PI*0.95, Math.PI*2.05);ctx2.fill();
      ctx2.beginPath();ctx2.arc(hx, hy-hw-1.5, 3.2, 0, Math.PI*2);ctx2.fill();
      ctx2.fillStyle = 'rgba(255,255,255,.25)';
      ctx2.beginPath();ctx2.arc(hx-1, hy-hw-2, 1.1, 0, Math.PI*2);ctx2.fill();  // 发髻高光
      break;
    case 'cap':   // 棒球帽：帽冠+帽檐
    default:
      ctx2.beginPath();ctx2.arc(hx, hy+0.5, hw, Math.PI, Math.PI*2);ctx2.fill();
      ctx2.fillRect(hx-hw, hy-0.5, hw*2, 2);
      ctx2.beginPath();ctx2.ellipse(hx+hw*0.55, hy-0.5, hw*0.75, 1.6, 0, 0, Math.PI*2);ctx2.fill(); // 帽檐
      break;
  }
}
// v52：普通顾客整体绘制（drawRestaurant 顾客段调用）
function drawCustomerBody_v52(ctx2, c, cx, cy, bob, tt){
  const skin = (c.persona && c.persona.skin) ? c.persona.skin : '#d4a574';
  const shirt = (c.persona && c.persona.shirt) ? c.persona.shirt : c.ctype.color;
  const hairC = (c.persona && c.persona.hair) ? c.persona.hair : '#3a2a2a';
  const build = (c.persona && c.persona.build) ? c.persona.build : CUSTOMER_BUILDS[1];
  const hairStyle = (c.persona && c.persona.hairStyle) ? c.persona.hairStyle : 'short';
  const acc = c.persona ? c.persona.accessory : null;
  const bw = build.bw, bh = build.bh, hw = build.hw;
  const seated = (c.state === 'seated' || c.state === 'eating');
  const walking = (c.state === 'walking' || c.state === 'queuing');
  const isSpecial = c.ctype.id === 'gourmet' || c.ctype.id === 'critic' || c.ctype.id === 'influencer' || c.ctype.id === 'vip';

  // ── 影子 ──
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath();ctx2.ellipse(cx, cy + 2, bw*0.72, 3.5, 0, 0, Math.PI*2);ctx2.fill();

  // ── 腿（走路摆动/坐姿弯折）──
  if(walking){
    const legA = Math.sin(tt * 10 + c.id) * 5;
    ctx2.fillStyle = '#2a2a3a';
    ctx2.fillRect(cx - 6, cy - 9, 5, 11 + legA);
    ctx2.fillRect(cx + 1, cy - 9, 5, 11 - legA);
    ctx2.fillStyle = '#1a1a1a';
    ctx2.fillRect(cx - 7, cy + legA, 6, 3);
    ctx2.fillRect(cx + 1, cy - legA, 6, 3);
    ctx2.fillStyle = '#3a3a3a';
    ctx2.fillRect(cx - 7, cy + legA, 6, 1);
    ctx2.fillRect(cx + 1, cy - legA, 6, 1);
  } else if(seated){
    ctx2.fillStyle = '#2a2a3a';
    ctx2.fillRect(cx - 7, cy - 5, 5, 9);
    ctx2.fillRect(cx + 2, cy - 5, 5, 9);
    ctx2.fillStyle = '#1a1a1a';
    ctx2.fillRect(cx - 8, cy + 2, 6, 3);
    ctx2.fillRect(cx + 2, cy + 2, 6, 3);
  }

  // ── 躯干（体型差异化轮廓+受光/背光渐变）──
  const bodyY = cy - bh - 10 + bob;
  ctx2.fillStyle = shirt;
  if(build.id === 'fat'){
    ctx2.beginPath();
    ctx2.moveTo(cx - bw/2, bodyY + 4);
    ctx2.quadraticCurveTo(cx - bw/2 - 2, bodyY + bh/2, cx - bw/2 + 3, bodyY + bh);
    ctx2.lineTo(cx + bw/2 - 3, bodyY + bh);
    ctx2.quadraticCurveTo(cx + bw/2 + 2, bodyY + bh/2, cx + bw/2, bodyY + 4);
    ctx2.quadraticCurveTo(cx, bodyY - 3, cx - bw/2, bodyY + 4);
    ctx2.closePath();ctx2.fill();
  } else if(build.id === 'buff'){
    ctx2.beginPath();
    ctx2.moveTo(cx - bw/2 - 1, bodyY);
    ctx2.lineTo(cx + bw/2 + 1, bodyY);
    ctx2.lineTo(cx + bw/2 - 4, bodyY + bh);
    ctx2.lineTo(cx - bw/2 + 4, bodyY + bh);
    ctx2.closePath();ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx - bw/2, bodyY + 3, 3.5, 0, Math.PI*2);ctx2.fill();  // 三角肌左
    ctx2.beginPath();ctx2.arc(cx + bw/2, bodyY + 3, 3.5, 0, Math.PI*2);ctx2.fill();  // 三角肌右
  } else {
    ctx2.beginPath();
    ctx2.moveTo(cx - bw/2, bodyY + 3);
    ctx2.quadraticCurveTo(cx - bw/2, bodyY, cx - bw/2 + 3, bodyY);
    ctx2.lineTo(cx + bw/2 - 3, bodyY);
    ctx2.quadraticCurveTo(cx + bw/2, bodyY, cx + bw/2, bodyY + 3);
    ctx2.lineTo(cx + bw/2, bodyY + bh - 3);
    ctx2.quadraticCurveTo(cx + bw/2, bodyY + bh, cx + bw/2 - 3, bodyY + bh);
    ctx2.lineTo(cx - bw/2 + 3, bodyY + bh);
    ctx2.quadraticCurveTo(cx - bw/2, bodyY + bh, cx - bw/2, bodyY + bh - 3);
    ctx2.closePath();ctx2.fill();
  }
  const bodyG = ctx2.createLinearGradient(cx - bw/2, 0, cx + bw/2, 0);
  bodyG.addColorStop(0, 'rgba(255,255,255,.22)');
  bodyG.addColorStop(0.5, 'rgba(255,255,255,0)');
  bodyG.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx2.fillStyle = bodyG;
  ctx2.fillRect(cx - bw/2 - 2, bodyY, bw + 4, bh);
  // 衣领 V 口
  ctx2.fillStyle = skin;
  ctx2.beginPath();
  ctx2.moveTo(cx - 4, bodyY);ctx2.lineTo(cx, bodyY + 5);ctx2.lineTo(cx + 4, bodyY);
  ctx2.closePath();ctx2.fill();
  // 腰带
  ctx2.fillStyle = 'rgba(0,0,0,.35)';
  ctx2.fillRect(cx - bw/2, bodyY + bh - 4, bw, 2);
  ctx2.fillStyle = '#aa8844';
  ctx2.fillRect(cx - 2, bodyY + bh - 4, 4, 2);
  // 特殊顾客描边金框+纽扣
  if(isSpecial){
    const rim = c.ctype.id === 'critic' ? '#22aaff' : c.ctype.id === 'influencer' ? '#ff66cc' : '#ffcc44';
    ctx2.strokeStyle = rim;ctx2.lineWidth = 1.5;
    ctx2.strokeRect(cx - bw/2, bodyY, bw, bh);
    ctx2.fillStyle = rim;
    ctx2.shadowBlur = 4;ctx2.shadowColor = rim;
    ctx2.beginPath();ctx2.arc(cx, bodyY + bh*0.3, 1.5, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx, bodyY + bh*0.6, 1.5, 0, Math.PI*2);ctx2.fill();
    ctx2.shadowBlur = 0;
  }
  // 围巾配件
  if(acc === 'scarf'){
    ctx2.fillStyle = '#a8442a';
    ctx2.fillRect(cx - bw/2 + 1, bodyY + 2, bw - 2, 3);
    ctx2.fillRect(cx - 2, bodyY + 3, 4, 8);
    ctx2.fillStyle = 'rgba(255,255,255,.15)';
    ctx2.fillRect(cx - bw/2 + 1, bodyY + 2, bw - 2, 1);
  }

  // ── 手臂（坐姿搭桌/站姿摆动/吃面持筷）──
  if(c.state === 'eating'){
    const chopBob = Math.sin(tt * 14) * 1.2;
    ctx2.fillStyle = shirt;
    ctx2.fillRect(cx - bw/2 - 3, bodyY + 8, 4, 8);
    ctx2.fillRect(cx + bw/2 - 1, bodyY + 8, 4, 8);
    ctx2.fillStyle = skin;
    ctx2.beginPath();ctx2.arc(cx - bw/2 - 1, bodyY + 16, 2.4, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + bw/2 + 1, bodyY + 16, 2.4, 0, Math.PI*2);ctx2.fill();
    // 筷子（两根细杆交替起落）
    ctx2.strokeStyle = '#c8a060';ctx2.lineWidth = 1.2;
    ctx2.beginPath();
    ctx2.moveTo(cx + bw/2 - 1, bodyY + 15 + chopBob);
    ctx2.lineTo(cx + bw/2 + 6, bodyY + 9 + chopBob);
    ctx2.stroke();
    ctx2.beginPath();
    ctx2.moveTo(cx + bw/2 - 1, bodyY + 16);
    ctx2.lineTo(cx + bw/2 + 7, bodyY + 11);
    ctx2.stroke();
  } else if(seated){
    ctx2.fillStyle = shirt;
    ctx2.fillRect(cx - bw/2 - 3, bodyY + 8, 4, 10);
    ctx2.fillRect(cx + bw/2 - 1, bodyY + 8, 4, 10);
    ctx2.fillStyle = skin;
    ctx2.beginPath();ctx2.arc(cx - bw/2 - 1, bodyY + 18, 2.4, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + bw/2 + 1, bodyY + 18, 2.4, 0, Math.PI*2);ctx2.fill();
  } else {
    const armA = Math.sin(tt * 8 + c.id) * 2;
    ctx2.fillStyle = shirt;
    ctx2.fillRect(cx - bw/2 - 3, bodyY + 2 + armA, 4, 16);
    ctx2.fillRect(cx + bw/2 - 1, bodyY + 2 - armA, 4, 16);
    ctx2.fillStyle = skin;
    ctx2.beginPath();ctx2.arc(cx - bw/2 - 1, bodyY + 18 + armA, 2.4, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + bw/2 + 1, bodyY + 18 - armA, 2.4, 0, Math.PI*2);ctx2.fill();
  }

  // ── 脖子+头 ──
  ctx2.fillStyle = skin;
  ctx2.fillRect(cx - 3, bodyY - 4, 6, 6);
  ctx2.fillStyle = 'rgba(0,0,0,.15)';
  ctx2.fillRect(cx - 3, bodyY - 2, 6, 2);
  const headY = bodyY - hw - 5 + bob + (c.state === 'eating' ? 2 : 0);  // 吃面低头
  ctx2.fillStyle = skin;
  ctx2.beginPath();ctx2.arc(cx, headY + 6, hw, 0, Math.PI*2);ctx2.fill();
  ctx2.fillStyle = 'rgba(0,0,0,.12)';
  ctx2.beginPath();ctx2.arc(cx + hw*0.35, headY + 6, hw*0.62, -Math.PI/2, Math.PI/2);ctx2.fill();
  ctx2.fillStyle = skin;
  ctx2.beginPath();ctx2.arc(cx - hw, headY + 7, 2, 0, Math.PI*2);ctx2.fill();
  ctx2.beginPath();ctx2.arc(cx + hw, headY + 7, 2, 0, Math.PI*2);ctx2.fill();
  // 眼罩配件（发型前画，遮一只眼）
  if(acc === 'eyepatch'){
    ctx2.fillStyle = '#1a1a1a';
    ctx2.beginPath();ctx2.moveTo(cx - hw*0.7, headY + 3);ctx2.lineTo(cx + 0.5, headY + 4);ctx2.lineTo(cx + 0.5, headY + 9);ctx2.lineTo(cx - hw*0.7, headY + 8);ctx2.closePath();ctx2.fill();
    ctx2.strokeStyle = '#1a1a1a';ctx2.lineWidth = 1;
    ctx2.beginPath();ctx2.moveTo(cx - hw, headY + 3.5);ctx2.lineTo(cx + hw, headY + 3);ctx2.stroke();
  }

  // ── 发型 + 帽子配件 ──
  _restHair(ctx2, hairStyle, cx, headY + 3, hairC, hw);
  if(acc === 'hat'){
    ctx2.fillStyle = '#5a4a2a';
    ctx2.beginPath();ctx2.ellipse(cx, headY - 2, hw + 2, 3.5, 0, 0, Math.PI*2);ctx2.fill();
    ctx2.fillStyle = '#6a5a3a';
    ctx2.beginPath();ctx2.ellipse(cx, headY - 3.5, hw - 1, 4, 0, Math.PI, Math.PI*2);ctx2.fill();
    ctx2.fillStyle = '#3a3020';
    ctx2.fillRect(cx - hw + 1, headY - 3, hw*2 - 2, 1.5);
  }

  // ── 表情：眉毛+眼睛（眨眼/环视）+眼镜/风镜+腮红+鼻+胡茬+嘴 ──
  const blinkPhase = Math.floor(tt * 0.8 + c.id * 1.7) % 14;
  const lookPhase = Math.floor(tt * 0.3 + c.id * 0.9) % 4;
  const isBlinking = blinkPhase === 0;
  const lookOffX = lookPhase === 1 ? -1 : lookPhase === 3 ? 1 : 0;
  const eyeY = headY + 6;
  const angry = c.patience < c.maxPatience * 0.3;
  ctx2.strokeStyle = hairC;ctx2.lineWidth = 1.1;
  const browDy = angry ? 1.5 : 0;
  ctx2.beginPath();ctx2.moveTo(cx - 4.5, eyeY - 3.5 + browDy);ctx2.lineTo(cx - 1, eyeY - 4.5 - browDy*0.5);ctx2.stroke();
  ctx2.beginPath();ctx2.moveTo(cx + 1, eyeY - 4.5 - browDy*0.5);ctx2.lineTo(cx + 4.5, eyeY - 3.5 + browDy);ctx2.stroke();
  if(isBlinking){
    ctx2.strokeStyle = '#000';ctx2.lineWidth = 1;
    ctx2.beginPath();ctx2.moveTo(cx - 4 + lookOffX, eyeY);ctx2.lineTo(cx - 1 + lookOffX, eyeY);ctx2.stroke();
    ctx2.beginPath();ctx2.moveTo(cx + 1 + lookOffX, eyeY);ctx2.lineTo(cx + 4 + lookOffX, eyeY);ctx2.stroke();
  } else {
    ctx2.fillStyle = '#fff';
    ctx2.beginPath();ctx2.arc(cx - 2.5 + lookOffX, eyeY, 1.8, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + 2.5 + lookOffX, eyeY, 1.8, 0, Math.PI*2);ctx2.fill();
    ctx2.fillStyle = '#000';
    ctx2.beginPath();ctx2.arc(cx - 2 + lookOffX, eyeY, 1, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + 3 + lookOffX, eyeY, 1, 0, Math.PI*2);ctx2.fill();
  }
  if(c.ctype.id === 'critic'){
    ctx2.strokeStyle = '#1a1a1a';ctx2.lineWidth = 1.2;
    ctx2.beginPath();
    ctx2.arc(cx - 2.5, eyeY, 3, 0, Math.PI*2);
    ctx2.moveTo(cx + 0.5, eyeY);ctx2.lineTo(cx - 0.5, eyeY);
    ctx2.stroke();
    ctx2.beginPath();ctx2.arc(cx + 2.5, eyeY, 3, 0, Math.PI*2);ctx2.stroke();
    ctx2.fillStyle = 'rgba(255,255,255,.3)';
    ctx2.beginPath();ctx2.arc(cx - 3, eyeY - 1, 1, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + 2, eyeY - 1, 1, 0, Math.PI*2);ctx2.fill();
  }
  if(acc === 'goggles'){
    ctx2.fillStyle = 'rgba(160,200,190,.85)';ctx2.strokeStyle = '#3a3a2a';ctx2.lineWidth = 1;
    ctx2.beginPath();ctx2.ellipse(cx - 3.5, eyeY - 1, 3, 2.5, 0, 0, Math.PI*2);ctx2.fill();ctx2.stroke();
    ctx2.beginPath();ctx2.ellipse(cx + 3.5, eyeY - 1, 3, 2.5, 0, 0, Math.PI*2);ctx2.fill();ctx2.stroke();
  }
  if(c.ctype.id === 'influencer'){
    ctx2.fillStyle = 'rgba(255,100,150,.4)';
    ctx2.beginPath();ctx2.arc(cx - 5, eyeY + 3, 1.5, 0, Math.PI*2);ctx2.fill();
    ctx2.beginPath();ctx2.arc(cx + 5, eyeY + 3, 1.5, 0, Math.PI*2);ctx2.fill();
  }
  ctx2.fillStyle = 'rgba(0,0,0,.2)';
  ctx2.fillRect(cx - 0.5, eyeY + 2, 1, 2);
  if(c.persona && c.persona.beard){
    ctx2.fillStyle = 'rgba(30,26,22,.35)';
    ctx2.beginPath();ctx2.arc(cx, headY + 10, hw*0.68, Math.PI*0.12, Math.PI*0.88);ctx2.fill();
  }
  if(angry){
    ctx2.strokeStyle = '#aa3333';ctx2.lineWidth = 1;
    ctx2.beginPath();
    ctx2.moveTo(cx - 2.5, headY + 10);ctx2.lineTo(cx, headY + 8.5);ctx2.lineTo(cx + 2.5, headY + 10);
    ctx2.stroke();
  } else if(c.state === 'eating'){
    const chew = Math.sin(tt * 12) * 0.8;
    ctx2.fillStyle = '#5a2a1a';
    ctx2.beginPath();ctx2.ellipse(cx, headY + 10 + chew*0.4, 2.2, 1.2 + Math.abs(chew), 0, 0, Math.PI*2);ctx2.fill();
  } else if(seated){
    ctx2.strokeStyle = '#3a2818';ctx2.lineWidth = 1;
    ctx2.beginPath();ctx2.arc(cx, headY + 9, 2, 0.15, Math.PI - 0.15);ctx2.stroke();
  }
}

