// ════════════════════════════════════════════════════════════════════════════
//  【VIP 图鉴 UI 系统】Customer Compendium Screen
// ════════════════════════════════════════════════════════════════════════════

function openVIPCompendium(){
  const scr = document.getElementById('vip-compendium-scr');
  if(!scr) return;
  const wasPaused = gamePaused;
  if(gameState === 'restaurant' && !gamePaused){ /* 餐厅用自己的rAF，不需要暂停游戏循环 */ }
  buildVIPCompendiumUI();
  scr.classList.add('open');
  sndShopOpen();
}

function closeVIPCompendium(){
  const scr = document.getElementById('vip-compendium-scr');
  if(!scr) return;
  scr.classList.remove('open');
  sndShopClose();
}

function buildVIPCompendiumUI(){
  const grid = document.getElementById('vip-compendium-grid');
  if(!grid) return;
  const statsEl = document.getElementById('vip-compendium-stats');
  const metCount = Object.keys(vipCompendium).filter(k => vipCompendium[k].met).length;
  const unlockedCount = getUnlockedVIPs().length;
  if(statsEl){
    statsEl.textContent = `已解锁 ${unlockedCount}/${VIP_CUSTOMERS.length} · 已相遇 ${metCount}/${VIP_CUSTOMERS.length} · 粉丝 ${wastegramFans}`;
  }
  grid.innerHTML = '';
  // 按阶级分组
  const tiers = ['bronze','silver','gold','platinum','diamond'];
  tiers.forEach(tierKey => {
    const tier = VIP_TIERS[tierKey];
    const vips = VIP_CUSTOMERS.filter(v => v.tier === tierKey);
    // 阶级标题
    const tierHeader = document.createElement('div');
    tierHeader.className = 'vip-tier-header';
    const tierUnlocked = wastegramFans >= tier.minFans;
    tierHeader.innerHTML = `
      <span class="vip-tier-icon" style="color:${tier.color}">${tier.icon}</span>
      <span class="vip-tier-name" style="color:${tier.color}">${tier.name}</span>
      <span class="vip-tier-label">${tier.label}</span>
      <span class="vip-tier-threshold" style="color:${tierUnlocked ? '#88ff88' : '#aa6644'}">
        ${tierUnlocked ? '✓ 已解锁' : `🔒 ${tier.minFans} 粉丝解锁`}
      </span>
    `;
    tierHeader.style.borderColor = tier.color;
    grid.appendChild(tierHeader);
    // VIP卡片
    const tierGrid = document.createElement('div');
    tierGrid.className = 'vip-tier-grid';
    vips.forEach(vip => {
      const unlocked = wastegramFans >= vip.unlockFans;
      const met = vipCompendium[vip.id] && vipCompendium[vip.id].met;
      const card = document.createElement('div');
      card.className = 'vip-card' + (unlocked ? '' : ' vip-locked') + (met ? ' vip-met' : '');
      const portraitCanvasId = 'vip-portrait-' + vip.id;
      let bestQualityBadge = '';
      if(met && vipCompendium[vip.id].bestQuality){
        const qColors = { legendary:'#ff44dd', perfect:'#FFD45E', good:'#88ff88', poor:'#ff8844', burned:'#666666' };
        const qNames = { legendary:'传说', perfect:'完美', good:'好评', poor:'差评', burned:'烤焦' };
        bestQualityBadge = `<span class="vip-best-quality" style="background:${qColors[vipCompendium[vip.id].bestQuality]}20;color:${qColors[vipCompendium[vip.id].bestQuality]}">最佳：${qNames[vipCompendium[vip.id].bestQuality]}</span>`;
      }
      card.innerHTML = `
        <div class="vip-card-header">
          <div class="vip-card-portrait"><canvas id="${portraitCanvasId}" width="56" height="64"></canvas></div>
          <div class="vip-card-info">
            <div class="vip-card-name" style="color:${unlocked ? vip.color : '#5a4a3a'}">${unlocked ? vip.name : '???'}</div>
            <div class="vip-card-tier" style="color:${tier.color}">${tier.icon} ${tier.name}</div>
            ${met ? `<div class="vip-card-visits" style="color:#b0a284">光临 ${vipCompendium[vip.id].meetCount} 次</div>` : ''}
            ${bestQualityBadge}
          </div>
        </div>
        ${unlocked ? `
          <div class="vip-card-personality">
            <span class="vip-personality-label">性格：</span>
            <span class="vip-personality-trait" style="color:${vip.accent}">${vip.personality}</span>
          </div>
          <div class="vip-card-desc">${met ? vip.personalityDesc : '未相遇 · ' + vip.bg}</div>
          ${met ? `<div class="vip-card-special" style="color:${vip.accent}">✨ ${getVIPSpecialLabel(vip)}</div>` : ''}
        ` : `
          <div class="vip-card-locked-overlay">
            <div class="vip-lock-icon">🔒</div>
            <div class="vip-lock-text">${vip.unlockFans} 粉丝</div>
          </div>
        `}
      `;
      tierGrid.appendChild(card);
    });
    grid.appendChild(tierGrid);
  });
  // 延迟绘制立绘（等DOM渲染）
  setTimeout(() => {
    VIP_CUSTOMERS.forEach(vip => {
      const canvas = document.getElementById('vip-portrait-' + vip.id);
      if(canvas){
        const ctx2 = canvas.getContext('2d');
        const unlocked = wastegramFans >= vip.unlockFans;
        const met = vipCompendium[vip.id] && vipCompendium[vip.id].met;
        drawVIPPortrait(ctx2, vip, 56, 64, unlocked && met, Date.now()*0.001);
      }
    });
  }, 50);
}

function getVIPSpecialLabel(vip){
  const labels = {
    humble:'满意时声望+1',
    stimulant:'满意时回血+5',
    mechanic:'满意时烹饪加速',
    haggler:'满意时赠弹药',
    paranoid:'满意时给情报',
    scout:'满意时给战术预警',
    broadcaster:'满意时粉丝+15',
    cyborg:'满意时武器升级',
    guardian:'满意时下波帮忙守',
    alchemist:'满意时给强化药剂',
    tycoon:'满意时给资源',
    legend:'赠黑桃子弹/传说信物',
    ghost:'赠旧时代金币',
    beastlord:'满意时地狱犬帮守',
    godmode:'解锁全成就',
  };
  return labels[vip.specialEffect] || '';
}

// ════════════════════════════════════════════════════════════════════════════
//  【VIP 精灵绘制】15 位独特立绘（canvas矢量）
// ════════════════════════════════════════════════════════════════════════════

function drawVIPPortrait(ctx2, vip, w, h, revealed, t){
  ctx2.clearRect(0,0,w,h);
  if(!revealed){
    // 未解锁：剪影
    ctx2.fillStyle = '#1a0e08';
    ctx2.fillRect(w*0.2, h*0.15, w*0.6, h*0.7);
    ctx2.beginPath();
    ctx2.arc(w/2, h*0.3, w*0.18, 0, Math.PI*2);
    ctx2.fill();
    ctx2.fillStyle = '#3a2a1a';
    ctx2.font = 'bold ' + Math.floor(h*0.4) + 'px sans-serif';
    ctx2.textAlign = 'center';
    ctx2.fillText('?', w/2, h*0.55);
    return;
  }
  // 根据spriteType调用对应绘制
  if(window['drawVIP_' + vip.spriteType]){
    window['drawVIP_' + vip.spriteType](ctx2, w, h, vip, t);
  } else {
    drawVIP_default(ctx2, w, h, vip, t);
  }
}

// Bug修复兜底：drawNormalCustomerInRest 曾被 drawVIPInRestaurant 引用但从未定义
// （VIP id 无效时会 ReferenceError 中断整帧餐厅渲染）——这里绘制一个普通顾客简版
function drawNormalCustomerInRest(ctx2, c, cx, cy, bob, t){
  const shirtColor = (c.persona && c.persona.shirt) ? c.persona.shirt : '#d4a574';
  const skinColor = (c.persona && c.persona.skin) ? c.persona.skin : '#c89868';
  // 影子
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath();ctx2.ellipse(cx, cy + 2, 14, 3.5, 0, 0, Math.PI * 2);ctx2.fill();
  // 腿
  ctx2.fillStyle = '#2a2a3a';
  ctx2.fillRect(cx - 7, cy - 5, 5, 9);
  ctx2.fillRect(cx + 2, cy - 5, 5, 9);
  // 身体
  ctx2.fillStyle = shirtColor;
  ctx2.fillRect(cx - 10, cy - 28 + bob, 20, 24);
  // 头
  ctx2.fillStyle = skinColor;
  ctx2.fillRect(cx - 6, cy - 42 + bob, 12, 13);
  // 眼睛
  ctx2.fillStyle = '#1a1a1a';
  ctx2.fillRect(cx - 3, cy - 37 + bob, 2, 2);
  ctx2.fillRect(cx + 1, cy - 37 + bob, 2, 2);
}

// 在餐厅canvas中绘制VIP顾客（缩小版，约30px宽）
function drawVIPInRestaurant(ctx2, c, cx, cy, bob, t){
  const vip = VIP_CUSTOMERS.find(v => v.id === c.vipId);
  if(!vip){
    // 回退到普通顾客绘制
    drawNormalCustomerInRest(ctx2, c, cx, cy, bob, t);
    return;
  }
  // VIP光环
  const tierInfo = VIP_TIERS[vip.tier];
  const auraPulse = 0.5 + 0.3 * Math.sin(t * 3);
  ctx2.save();
  ctx2.globalAlpha = auraPulse * 0.4;
  ctx2.fillStyle = tierInfo.color;
  ctx2.beginPath();
  ctx2.ellipse(cx, cy - 14, 16, 24, 0, 0, Math.PI*2);
  ctx2.fill();
  ctx2.restore();
  // 调用缩小版立绘
  const scale = 0.5;
  ctx2.save();
  ctx2.translate(cx, cy);
  ctx2.scale(scale, scale);
  if(window['drawVIP_' + vip.spriteType]){
    window['drawVIP_' + vip.spriteType](ctx2, 60, 80, vip, t);
  }
  ctx2.restore();
  // VIP名牌（v52修冲突：旧版名牌(cy-58~46)与点单气泡(cy-71~37)垂直完全重叠——常冲突的根源之一。
  // 改为锚在立绘头顶右上方水平错开，与中央气泡零交集）
  const vipShortName = vip.name.split('·')[0] || vip.name;
  ctx2.font = 'bold 9px Microsoft YaHei UI,sans-serif';
  ctx2.textAlign = 'left';
  const vipNameW = ctx2.measureText(vipShortName).width + 12;
  const vipNX = cx + 14, vipNY = cy - 52;   // 头右上
  ctx2.fillStyle = 'rgba(0,0,0,.75)';
  ctx2.fillRect(vipNX, vipNY, vipNameW, 12);
  ctx2.strokeStyle = tierInfo.color;
  ctx2.lineWidth = 1;
  ctx2.strokeRect(vipNX, vipNY, vipNameW, 12);
  ctx2.fillStyle = vip.color;
  ctx2.fillText(vipShortName, vipNX + 5, vipNY + 9);
  // 阶级图标（嵌进名牌右侧，同层不漂移）
  ctx2.font = '9px sans-serif';
  ctx2.textAlign = 'left';
  ctx2.fillText(tierInfo.icon, vipNX + vipNameW - 10, vipNY + 9);
}

// ── 15位VIP立绘绘制函数 ──
function drawVIP_default(ctx2, w, h, vip, t){
  ctx2.fillStyle = vip.color;
  ctx2.fillRect(w*0.25, h*0.35, w*0.5, h*0.5);
  ctx2.fillStyle = '#d4a574';
  ctx2.fillRect(w*0.35, h*0.15, w*0.3, h*0.25);
}

// 1. 阿狗 - 驼背自卑
function drawVIP_hunched(ctx2, w, h, vip, t){
  const cx = w/2;
  // 影子
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 驼背身体
  ctx2.fillStyle = '#6a5a3a';
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.22, h*0.9);
  ctx2.quadraticCurveTo(cx-w*0.28, h*0.6, cx-w*0.1, h*0.5);
  ctx2.lineTo(cx+w*0.1, h*0.5);
  ctx2.quadraticCurveTo(cx+w*0.28, h*0.6, cx+w*0.22, h*0.9);
  ctx2.fill();
  // 头（低垂）
  ctx2.fillStyle = '#c8a878';
  ctx2.beginPath(); ctx2.arc(cx, h*0.4, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 头发
  ctx2.fillStyle = '#3a2a1a';
  ctx2.beginPath(); ctx2.arc(cx, h*0.36, w*0.13, Math.PI, Math.PI*2); ctx2.fill();
  // 眼睛（躲闪，看下方）
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.06, h*0.42, w*0.03, h*0.025);
  ctx2.fillRect(cx+w*0.03, h*0.42, w*0.03, h*0.025);
  // 嘴（紧张抿嘴）
  ctx2.strokeStyle = '#5a3a2a';
  ctx2.lineWidth = 1;
  ctx2.beginPath(); ctx2.moveTo(cx-w*0.04, h*0.47); ctx2.lineTo(cx+w*0.04, h*0.47); ctx2.stroke();
}

// 2. 老包 - 刀疤脸大汉
function drawVIP_scarred(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 身体（军绿大衣）
  ctx2.fillStyle = '#4a5a3a';
  ctx2.fillRect(cx-w*0.22, h*0.45, w*0.44, h*0.45);
  // 衣领
  ctx2.fillStyle = '#3a4a2a';
  ctx2.fillRect(cx-w*0.08, h*0.45, w*0.16, h*0.06);
  // 头
  ctx2.fillStyle = '#b89878';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.14, 0, Math.PI*2); ctx2.fill();
  // 刀疤
  ctx2.strokeStyle = '#8a3a2a';
  ctx2.lineWidth = 1.5;
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.1, h*0.25); ctx2.lineTo(cx-w*0.02, h*0.4);
  ctx2.stroke();
  // 血丝眼睛
  ctx2.fillStyle = '#fff';
  ctx2.fillRect(cx-w*0.08, h*0.3, w*0.05, h*0.03);
  ctx2.fillRect(cx+w*0.03, h*0.3, w*0.05, h*0.03);
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.06, h*0.31, w*0.02, h*0.02);
  ctx2.fillRect(cx+w*0.04, h*0.31, w*0.02, h*0.02);
  // 血丝
  ctx2.strokeStyle = '#aa3333';
  ctx2.lineWidth = 0.5;
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.07, h*0.305); ctx2.lineTo(cx-w*0.05, h*0.31);
  ctx2.moveTo(cx+w*0.04, h*0.305); ctx2.lineTo(cx+w*0.06, h*0.31);
  ctx2.stroke();
  // 胡茬
  ctx2.fillStyle = '#3a2a1a';
  ctx2.fillRect(cx-w*0.08, h*0.38, w*0.16, h*0.03);
  // 硬糖（口袋露出）
  ctx2.fillStyle = '#ffcc44';
  ctx2.beginPath(); ctx2.arc(cx+w*0.18, h*0.82, w*0.04, 0, Math.PI*2); ctx2.fill();
}

// 3. 七姐 - 扛扳手的女工
function drawVIP_wrench(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 身体（工装）
  ctx2.fillStyle = '#b85a3a';
  ctx2.fillRect(cx-w*0.2, h*0.45, w*0.4, h*0.45);
  // 工装带
  ctx2.fillStyle = '#3a2a1a';
  ctx2.fillRect(cx-w*0.2, h*0.6, w*0.4, h*0.04);
  // 头
  ctx2.fillStyle = '#d4a574';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 马尾
  ctx2.fillStyle = '#2a1a0a';
  ctx2.beginPath();
  ctx2.moveTo(cx+w*0.08, h*0.28);
  ctx2.quadraticCurveTo(cx+w*0.2, h*0.25, cx+w*0.22, h*0.4);
  ctx2.quadraticCurveTo(cx+w*0.15, h*0.35, cx+w*0.08, h*0.32);
  ctx2.fill();
  // 眼睛（怒目）
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.07, h*0.3, w*0.04, h*0.025);
  ctx2.fillRect(cx+w*0.03, h*0.3, w*0.04, h*0.025);
  // 眉毛（皱眉）
  ctx2.strokeStyle = '#2a1a0a';
  ctx2.lineWidth = 1.5;
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.09, h*0.27); ctx2.lineTo(cx-w*0.02, h*0.29);
  ctx2.moveTo(cx+w*0.09, h*0.27); ctx2.lineTo(cx+w*0.02, h*0.29);
  ctx2.stroke();
  // 嘴（骂骂咧咧）
  ctx2.fillStyle = '#5a2a1a';
  ctx2.fillRect(cx-w*0.04, h*0.38, w*0.08, h*0.02);
  // 巨型扳手
  ctx2.save();
  ctx2.translate(cx+w*0.2, h*0.5);
  ctx2.rotate(0.3);
  ctx2.fillStyle = '#8a8a9a';
  ctx2.fillRect(-w*0.03, 0, w*0.06, h*0.4);
  ctx2.fillRect(-w*0.08, h*0.38, w*0.16, h*0.08);
  ctx2.restore();
}

// 4. 泥鳅 - 斗篷鼠相
function drawVIP_hooded(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 斗篷
  ctx2.fillStyle = '#3a5a3a';
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.28, h*0.9);
  ctx2.lineTo(cx-w*0.18, h*0.35);
  ctx2.quadraticCurveTo(cx, h*0.25, cx+w*0.18, h*0.35);
  ctx2.lineTo(cx+w*0.28, h*0.9);
  ctx2.closePath();
  ctx2.fill();
  // 兜帽阴影里的脸
  ctx2.fillStyle = '#2a1a0a';
  ctx2.beginPath(); ctx2.arc(cx, h*0.38, w*0.12, 0, Math.PI*2); ctx2.fill();
  // 贼溜溜的眼睛
  ctx2.fillStyle = '#ffcc44';
  ctx2.fillRect(cx-w*0.06, h*0.36, w*0.025, h*0.02);
  ctx2.fillRect(cx+w*0.035, h*0.36, w*0.025, h*0.02);
  // 嘴（嬉笑）
  ctx2.strokeStyle = '#5a4a2a';
  ctx2.lineWidth = 1;
  ctx2.beginPath();
  ctx2.arc(cx, h*0.43, w*0.04, 0, Math.PI);
  ctx2.stroke();
}

// 5. 高老头 - 锡箔帽
function drawVIP_tinfoil(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 身体
  ctx2.fillStyle = '#5a4a6a';
  ctx2.fillRect(cx-w*0.2, h*0.45, w*0.4, h*0.45);
  // 头
  ctx2.fillStyle = '#c8b898';
  ctx2.beginPath(); ctx2.arc(cx, h*0.35, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 锡箔帽
  ctx2.fillStyle = '#cccccc';
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.15, h*0.3);
  ctx2.quadraticCurveTo(cx, h*0.1, cx+w*0.15, h*0.3);
  ctx2.lineTo(cx+w*0.13, h*0.32);
  ctx2.quadraticCurveTo(cx, h*0.15, cx-w*0.13, h*0.32);
  ctx2.closePath();
  ctx2.fill();
  // 锡箔帽褶皱
  ctx2.strokeStyle = '#8a8a8a';
  ctx2.lineWidth = 0.5;
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.08, h*0.22); ctx2.lineTo(cx-w*0.05, h*0.28);
  ctx2.moveTo(cx+w*0.08, h*0.22); ctx2.lineTo(cx+w*0.05, h*0.28);
  ctx2.stroke();
  // 猜疑的眼睛
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.07, h*0.35, w*0.035, h*0.025);
  ctx2.fillRect(cx+w*0.035, h*0.35, w*0.035, h*0.025);
  // 眉毛（紧锁）
  ctx2.strokeStyle = '#3a2a1a';
  ctx2.lineWidth = 1.5;
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.09, h*0.32); ctx2.lineTo(cx-w*0.02, h*0.34);
  ctx2.moveTo(cx+w*0.09, h*0.32); ctx2.lineTo(cx+w*0.02, h*0.34);
  ctx2.stroke();
}

// 6. 孤影 - 黑衣赏金猎人
function drawVIP_bounty(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 黑色风衣
  ctx2.fillStyle = '#1a1a2a';
  ctx2.fillRect(cx-w*0.24, h*0.4, w*0.48, h*0.5);
  // 风衣高领
  ctx2.fillStyle = '#0a0a1a';
  ctx2.fillRect(cx-w*0.1, h*0.4, w*0.2, h*0.08);
  // 头
  ctx2.fillStyle = '#a89878';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.12, 0, Math.PI*2); ctx2.fill();
  // 兜帽阴影
  ctx2.fillStyle = 'rgba(0,0,0,.5)';
  ctx2.beginPath(); ctx2.arc(cx, h*0.3, w*0.12, Math.PI, Math.PI*2); ctx2.fill();
  // 冷峻的眼睛
  ctx2.fillStyle = '#ff4444';
  ctx2.fillRect(cx-w*0.07, h*0.32, w*0.03, h*0.015);
  ctx2.fillRect(cx+w*0.04, h*0.32, w*0.03, h*0.015);
  // 嘴（一条线）
  ctx2.strokeStyle = '#3a2a1a';
  ctx2.lineWidth = 1;
  ctx2.beginPath(); ctx2.moveTo(cx-w*0.03, h*0.4); ctx2.lineTo(cx+w*0.03, h*0.4); ctx2.stroke();
  // 弹带
  ctx2.fillStyle = '#aa8844';
  for(let i=0; i<4; i++){
    ctx2.fillRect(cx-w*0.15+i*w*0.08, h*0.6, w*0.04, h*0.04);
  }
}

// 7. 幻音 - 主播
function drawVIP_streamer(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 身体（亮粉外套）
  ctx2.fillStyle = '#ff44aa';
  ctx2.fillRect(cx-w*0.2, h*0.45, w*0.4, h*0.45);
  // 头
  ctx2.fillStyle = '#f4d4c4';
  ctx2.beginPath(); ctx2.arc(cx, h*0.33, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 长发
  ctx2.fillStyle = '#cc2266';
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.14, h*0.3);
  ctx2.quadraticCurveTo(cx-w*0.2, h*0.5, cx-w*0.12, h*0.6);
  ctx2.lineTo(cx+w*0.12, h*0.6);
  ctx2.quadraticCurveTo(cx+w*0.2, h*0.5, cx+w*0.14, h*0.3);
  ctx2.fill();
  // 头顶头发
  ctx2.fillStyle = '#cc2266';
  ctx2.beginPath(); ctx2.arc(cx, h*0.28, w*0.14, Math.PI, Math.PI*2); ctx2.fill();
  // 眼睛（大眼+睫毛）
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.07, h*0.32, w*0.04, h*0.03);
  ctx2.fillRect(cx+w*0.03, h*0.32, w*0.04, h*0.03);
  // 腮红
  ctx2.fillStyle = 'rgba(255,150,150,.5)';
  ctx2.beginPath(); ctx2.arc(cx-w*0.08, h*0.37, w*0.025, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx+w*0.08, h*0.37, w*0.025, 0, Math.PI*2); ctx2.fill();
  // 嘴（播音微笑）
  ctx2.fillStyle = '#dd3366';
  ctx2.beginPath();
  ctx2.arc(cx, h*0.4, w*0.03, 0, Math.PI);
  ctx2.fill();
  // 麦克风
  ctx2.fillStyle = '#444';
  ctx2.fillRect(cx+w*0.18, h*0.5, w*0.04, h*0.15);
  ctx2.fillStyle = '#888';
  ctx2.beginPath(); ctx2.arc(cx+w*0.2, h*0.5, w*0.04, 0, Math.PI*2); ctx2.fill();
}

// 8. 铜叔 - 半机械人
function drawVIP_cyborg(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 身体（左半肉身右半机械）
  ctx2.fillStyle = '#6a7a8a';
  ctx2.fillRect(cx-w*0.2, h*0.45, w*0.4, h*0.45);
  // 右半机械臂
  ctx2.fillStyle = '#888899';
  ctx2.fillRect(cx+w*0.05, h*0.45, w*0.15, h*0.4);
  // 机械关节
  ctx2.fillStyle = '#444';
  ctx2.beginPath(); ctx2.arc(cx+w*0.12, h*0.55, w*0.025, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx+w*0.12, h*0.7, w*0.025, 0, Math.PI*2); ctx2.fill();
  // 头
  ctx2.fillStyle = '#c8b8a8';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 右半机械面罩
  ctx2.fillStyle = '#888899';
  ctx2.beginPath();
  ctx2.arc(cx, h*0.32, w*0.13, -Math.PI/2, Math.PI/2);
  ctx2.fill();
  // 机械眼（发光）
  ctx2.fillStyle = '#00ddff';
  ctx2.fillRect(cx+w*0.02, h*0.3, w*0.04, h*0.025);
  ctx2.shadowColor = '#00ddff';
  ctx2.shadowBlur = 4;
  ctx2.fillRect(cx+w*0.02, h*0.3, w*0.04, h*0.025);
  ctx2.shadowBlur = 0;
  // 左眼（人眼）
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.07, h*0.3, w*0.035, h*0.025);
  // 嘴
  ctx2.strokeStyle = '#3a2a1a';
  ctx2.lineWidth = 1;
  ctx2.beginPath(); ctx2.moveTo(cx-w*0.04, h*0.4); ctx2.lineTo(cx+w*0.04, h*0.4); ctx2.stroke();
  // 机械管线
  ctx2.strokeStyle = '#cc6644';
  ctx2.lineWidth = 1;
  ctx2.beginPath();
  ctx2.moveTo(cx+w*0.1, h*0.5); ctx2.lineTo(cx+w*0.18, h*0.65);
  ctx2.stroke();
}

// 9. 大山 - 三米巨汉
function drawVIP_giant(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.35, h*0.05, 0, 0, Math.PI*2); ctx2.fill();
  // 巨大身体
  ctx2.fillStyle = '#8a6a4a';
  ctx2.fillRect(cx-w*0.3, h*0.4, w*0.6, h*0.5);
  // 背带裤
  ctx2.fillStyle = '#5a4a2a';
  ctx2.fillRect(cx-w*0.28, h*0.55, w*0.56, h*0.35);
  ctx2.fillRect(cx-w*0.18, h*0.4, w*0.06, h*0.2);
  ctx2.fillRect(cx+w*0.12, h*0.4, w*0.06, h*0.2);
  // 大头
  ctx2.fillStyle = '#d8b888';
  ctx2.beginPath(); ctx2.arc(cx, h*0.28, w*0.17, 0, Math.PI*2); ctx2.fill();
  // 头发（乱蓬蓬）
  ctx2.fillStyle = '#4a3a1a';
  ctx2.beginPath(); ctx2.arc(cx, h*0.2, w*0.17, Math.PI, Math.PI*2); ctx2.fill();
  // 大眼睛（纯真）
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.09, h*0.26, w*0.05, h*0.04);
  ctx2.fillRect(cx+w*0.04, h*0.26, w*0.05, h*0.04);
  // 嘴（憨笑）
  ctx2.strokeStyle = '#5a3a2a';
  ctx2.lineWidth = 1.5;
  ctx2.beginPath();
  ctx2.arc(cx, h*0.35, w*0.06, 0.1, Math.PI-0.1);
  ctx2.stroke();
  // 眼泪（委屈但开心）
  ctx2.fillStyle = '#88ccff';
  ctx2.beginPath(); ctx2.arc(cx-w*0.1, h*0.32, w*0.015, 0, Math.PI*2); ctx2.fill();
}

// 10. 怪医白石 - 疯狂科学家
function drawVIP_doctor(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 白大褂（千疮百孔）
  ctx2.fillStyle = '#d4d4c4';
  ctx2.fillRect(cx-w*0.22, h*0.42, w*0.44, h*0.48);
  // 破洞
  ctx2.fillStyle = '#2a1a0a';
  ctx2.beginPath(); ctx2.arc(cx-w*0.1, h*0.6, w*0.03, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx+w*0.08, h*0.7, w*0.04, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx+w*0.12, h*0.55, w*0.025, 0, Math.PI*2); ctx2.fill();
  // 头
  ctx2.fillStyle = '#c8b898';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 乱发
  ctx2.fillStyle = '#3a3a2a';
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.14, h*0.28);
  ctx2.lineTo(cx-w*0.1, h*0.15);
  ctx2.lineTo(cx-w*0.04, h*0.22);
  ctx2.lineTo(cx, h*0.12);
  ctx2.lineTo(cx+w*0.05, h*0.22);
  ctx2.lineTo(cx+w*0.12, h*0.16);
  ctx2.lineTo(cx+w*0.14, h*0.28);
  ctx2.fill();
  // 护目镜
  ctx2.fillStyle = '#88ffcc';
  ctx2.beginPath(); ctx2.arc(cx-w*0.05, h*0.32, w*0.04, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx+w*0.05, h*0.32, w*0.04, 0, Math.PI*2); ctx2.fill();
  ctx2.strokeStyle = '#444';
  ctx2.lineWidth = 1;
  ctx2.stroke();
  // 疯狂的嘴（狂笑）
  ctx2.fillStyle = '#5a2a1a';
  ctx2.beginPath();
  ctx2.arc(cx, h*0.4, w*0.05, 0, Math.PI);
  ctx2.fill();
  // 牙齿
  ctx2.fillStyle = '#fff';
  ctx2.fillRect(cx-w*0.03, h*0.4, w*0.06, h*0.015);
  // 试剂管
  ctx2.fillStyle = '#88ff44';
  ctx2.fillRect(cx+w*0.15, h*0.5, w*0.04, h*0.12);
  ctx2.fillStyle = '#444';
  ctx2.fillRect(cx+w*0.15, h*0.48, w*0.04, h*0.03);
}

// 11. 金老板 - 珠光宝气财阀
function drawVIP_tycoon(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 华贵外套
  ctx2.fillStyle = '#daa520';
  ctx2.fillRect(cx-w*0.22, h*0.42, w*0.44, h*0.48);
  // 毛领
  ctx2.fillStyle = '#f4e4bc';
  ctx2.fillRect(cx-w*0.14, h*0.42, w*0.28, h*0.06);
  // 项链
  ctx2.fillStyle = '#fff';
  for(let i=0; i<5; i++){
    ctx2.beginPath(); ctx2.arc(cx-w*0.1+i*w*0.05, h*0.5, w*0.012, 0, Math.PI*2); ctx2.fill();
  }
  ctx2.fillStyle = '#ff4444';
  ctx2.beginPath(); ctx2.arc(cx, h*0.53, w*0.02, 0, Math.PI*2); ctx2.fill();
  // 头
  ctx2.fillStyle = '#f4d4c4';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 精致发型
  ctx2.fillStyle = '#2a1a0a';
  ctx2.beginPath();
  ctx2.ellipse(cx, h*0.26, w*0.15, w*0.06, 0, 0, Math.PI*2);
  ctx2.fill();
  // 墨镜
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.1, h*0.3, w*0.2, h*0.04);
  // 嘴（嫌弃的撇嘴）
  ctx2.strokeStyle = '#aa3366';
  ctx2.lineWidth = 1.5;
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.04, h*0.4); ctx2.quadraticCurveTo(cx, h*0.38, cx+w*0.04, h*0.4);
  ctx2.stroke();
  // 手帕（捂鼻）
  ctx2.fillStyle = '#fff';
  ctx2.fillRect(cx-w*0.2, h*0.55, w*0.08, h*0.08);
}

// 12. 无名客 - 弹孔风衣信使
function drawVIP_wanderer(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 旧风衣
  ctx2.fillStyle = '#5a5560';
  ctx2.fillRect(cx-w*0.22, h*0.42, w*0.44, h*0.48);
  // 弹孔
  ctx2.fillStyle = '#1a1015';
  ctx2.beginPath(); ctx2.arc(cx-w*0.08, h*0.55, w*0.02, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx+w*0.1, h*0.65, w*0.025, 0, Math.PI*2); ctx2.fill();
  ctx2.beginPath(); ctx2.arc(cx-w*0.05, h*0.75, w*0.018, 0, Math.PI*2); ctx2.fill();
  // 衣领竖起
  ctx2.fillStyle = '#4a4550';
  ctx2.fillRect(cx-w*0.12, h*0.42, w*0.08, h*0.1);
  ctx2.fillRect(cx+w*0.04, h*0.42, w*0.08, h*0.1);
  // 头
  ctx2.fillStyle = '#b8a898';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.12, 0, Math.PI*2); ctx2.fill();
  // 风吹乱的头发
  ctx2.fillStyle = '#3a3540';
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.13, h*0.3);
  ctx2.quadraticCurveTo(cx-w*0.05, h*0.18, cx+w*0.08, h*0.22);
  ctx2.quadraticCurveTo(cx+w*0.14, h*0.25, cx+w*0.13, h*0.3);
  ctx2.fill();
  // 淡漠的眼睛
  ctx2.fillStyle = '#8a88aa';
  ctx2.fillRect(cx-w*0.07, h*0.31, w*0.03, h*0.02);
  ctx2.fillRect(cx+w*0.04, h*0.31, w*0.03, h*0.02);
  // 嘴（平静）
  ctx2.strokeStyle = '#3a2a2a';
  ctx2.lineWidth = 1;
  ctx2.beginPath(); ctx2.moveTo(cx-w*0.02, h*0.39); ctx2.lineTo(cx+w*0.02, h*0.39); ctx2.stroke();
  // 黑桃子弹
  ctx2.fillStyle = '#222';
  ctx2.fillRect(cx+w*0.15, h*0.6, w*0.03, h*0.1);
  ctx2.fillStyle = '#fff';
  ctx2.font = 'bold 6px sans-serif';
  ctx2.textAlign = 'center';
  ctx2.fillText('♠', cx+w*0.165, h*0.67);
}

// 13. 阎老 - 尸鬼旧贵族
function drawVIP_ghost(ctx2, w, h, vip, t){
  const cx = w/2;
  // 半透明影子
  ctx2.globalAlpha = 0.7;
  ctx2.fillStyle = 'rgba(0,0,0,.2)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 燕尾服
  ctx2.fillStyle = '#3a2a1a';
  ctx2.fillRect(cx-w*0.2, h*0.4, w*0.4, h*0.5);
  // 燕尾
  ctx2.beginPath();
  ctx2.moveTo(cx-w*0.2, h*0.8);
  ctx2.lineTo(cx-w*0.15, h*0.92);
  ctx2.lineTo(cx-w*0.05, h*0.85);
  ctx2.fill();
  ctx2.beginPath();
  ctx2.moveTo(cx+w*0.2, h*0.8);
  ctx2.lineTo(cx+w*0.15, h*0.92);
  ctx2.lineTo(cx+w*0.05, h*0.85);
  ctx2.fill();
  // 白衬衫领
  ctx2.fillStyle = '#d4d0c0';
  ctx2.fillRect(cx-w*0.05, h*0.4, w*0.1, h*0.12);
  // 蝴蝶领结
  ctx2.fillStyle = '#5a1a1a';
  ctx2.fillRect(cx-w*0.04, h*0.42, w*0.08, h*0.04);
  // 头（干枯灰败）
  ctx2.fillStyle = '#9a8a7a';
  ctx2.beginPath(); ctx2.arc(cx, h*0.3, w*0.12, 0, Math.PI*2); ctx2.fill();
  // 灰白头发
  ctx2.fillStyle = '#c4c0b0';
  ctx2.beginPath(); ctx2.arc(cx, h*0.25, w*0.12, Math.PI, Math.PI*2); ctx2.fill();
  // 深陷的眼窝
  ctx2.fillStyle = '#000';
  ctx2.fillRect(cx-w*0.06, h*0.28, w*0.03, h*0.02);
  ctx2.fillRect(cx+w*0.03, h*0.28, w*0.03, h*0.02);
  // 悲伤的嘴
  ctx2.strokeStyle = '#3a2a1a';
  ctx2.lineWidth = 1;
  ctx2.beginPath();
  ctx2.arc(cx, h*0.38, w*0.03, Math.PI, Math.PI*2);
  ctx2.stroke();
  ctx2.globalAlpha = 1;
  // 飘散的光尘
  ctx2.fillStyle = 'rgba(255,255,200,.4)';
  for(let i=0; i<4; i++){
    const px = cx + Math.sin(t+i)*w*0.2;
    const py = h*0.3 + Math.cos(t*0.5+i)*h*0.1;
    ctx2.beginPath(); ctx2.arc(px, py, 1, 0, Math.PI*2); ctx2.fill();
  }
}

// 14. 兽王狂牙 - 骑地狱犬
function drawVIP_beast(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.35, h*0.05, 0, 0, Math.PI*2); ctx2.fill();
  // 地狱犬（底部）
  ctx2.fillStyle = '#2a1a0a';
  ctx2.beginPath();
  ctx2.ellipse(cx, h*0.85, w*0.3, h*0.12, 0, 0, Math.PI*2);
  ctx2.fill();
  // 犬头
  ctx2.fillStyle = '#3a2a1a';
  ctx2.beginPath(); ctx2.arc(cx-w*0.22, h*0.82, w*0.1, 0, Math.PI*2); ctx2.fill();
  // 犬眼（红光）
  ctx2.fillStyle = '#ff2222';
  ctx2.shadowColor = '#ff0000'; ctx2.shadowBlur = 4;
  ctx2.fillRect(cx-w*0.25, h*0.8, w*0.02, h*0.02);
  ctx2.shadowBlur = 0;
  // 犬牙
  ctx2.fillStyle = '#fff';
  ctx2.fillRect(cx-w*0.24, h*0.85, w*0.015, h*0.03);
  ctx2.fillRect(cx-w*0.21, h*0.85, w*0.015, h*0.03);
  // 狂牙（骑在犬上）
  ctx2.fillStyle = '#5a2a1a';
  ctx2.fillRect(cx-w*0.15, h*0.5, w*0.3, h*0.35);
  // 纹身
  ctx2.fillStyle = '#cc6633';
  ctx2.fillRect(cx-w*0.1, h*0.55, w*0.04, h*0.04);
  ctx2.fillRect(cx+w*0.06, h*0.6, w*0.04, h*0.04);
  // 头
  ctx2.fillStyle = '#c89878';
  ctx2.beginPath(); ctx2.arc(cx, h*0.4, w*0.12, 0, Math.PI*2); ctx2.fill();
  // 野兽鬃毛
  ctx2.fillStyle = '#3a1a0a';
  ctx2.beginPath();
  for(let i=0; i<8; i++){
    const a = Math.PI + (i/7)*Math.PI;
    ctx2.moveTo(cx+Math.cos(a)*w*0.1, h*0.4+Math.sin(a)*w*0.1);
    ctx2.lineTo(cx+Math.cos(a)*w*0.16, h*0.4+Math.sin(a)*w*0.16);
  }
  ctx2.fill();
  // 狂野的眼睛
  ctx2.fillStyle = '#ff6600';
  ctx2.fillRect(cx-w*0.06, h*0.38, w*0.03, h*0.025);
  ctx2.fillRect(cx+w*0.03, h*0.38, w*0.03, h*0.025);
  // 獠牙嘴
  ctx2.fillStyle = '#fff';
  ctx2.fillRect(cx-w*0.04, h*0.44, w*0.08, h*0.02);
  ctx2.fillRect(cx-w*0.03, h*0.44, w*0.01, h*0.03);
  ctx2.fillRect(cx+w*0.02, h*0.44, w*0.01, h*0.03);
}

// 15. 观测者 - 格子衬衫Geek（画风突变的彩蛋）
function drawVIP_meta(ctx2, w, h, vip, t){
  const cx = w/2;
  ctx2.fillStyle = 'rgba(0,0,0,.3)';
  ctx2.beginPath(); ctx2.ellipse(cx, h*0.95, w*0.3, h*0.04, 0, 0, Math.PI*2); ctx2.fill();
  // 格子衬衫
  ctx2.fillStyle = '#2a4a6a';
  ctx2.fillRect(cx-w*0.22, h*0.45, w*0.44, h*0.45);
  // 格子图案
  ctx2.strokeStyle = '#88ccff';
  ctx2.lineWidth = 0.8;
  for(let i=0; i<5; i++){
    ctx2.beginPath();
    ctx2.moveTo(cx-w*0.22+i*w*0.11, h*0.45);
    ctx2.lineTo(cx-w*0.22+i*w*0.11, h*0.9);
    ctx2.stroke();
  }
  for(let i=0; i<4; i++){
    ctx2.beginPath();
    ctx2.moveTo(cx-w*0.22, h*0.45+i*h*0.12);
    ctx2.lineTo(cx+w*0.22, h*0.45+i*h*0.12);
    ctx2.stroke();
  }
  // 头（画风明显不同——干净圆润）
  ctx2.fillStyle = '#f4d4b4';
  ctx2.beginPath(); ctx2.arc(cx, h*0.32, w*0.13, 0, Math.PI*2); ctx2.fill();
  // 黑框眼镜
  ctx2.strokeStyle = '#1a1a1a';
  ctx2.lineWidth = 1.5;
  ctx2.beginPath();
  ctx2.arc(cx-w*0.05, h*0.32, w*0.04, 0, Math.PI*2);
  ctx2.arc(cx+w*0.05, h*0.32, w*0.04, 0, Math.PI*2);
  ctx2.moveTo(cx-w*0.01, h*0.32); ctx2.lineTo(cx+w*0.01, h*0.32);
  ctx2.stroke();
  // 镜片反光
  ctx2.fillStyle = 'rgba(255,255,255,.3)';
  ctx2.beginPath(); ctx2.arc(cx-w*0.06, h*0.31, w*0.015, 0, Math.PI*2); ctx2.fill();
  // 眼睛（眨眼）
  const blink = Math.floor(t*0.5) % 6 === 0;
  ctx2.fillStyle = '#000';
  if(blink){
    ctx2.fillRect(cx-w*0.06, h*0.32, w*0.025, h*0.01);
    ctx2.fillRect(cx+w*0.035, h*0.32, w*0.025, h*0.01);
  } else {
    ctx2.fillRect(cx-w*0.06, h*0.31, w*0.025, h*0.02);
    ctx2.fillRect(cx+w*0.035, h*0.31, w*0.025, h*0.02);
  }
  // 嘴（神秘微笑）
  ctx2.strokeStyle = '#3a2a1a';
  ctx2.lineWidth = 1;
  ctx2.beginPath();
  ctx2.arc(cx, h*0.39, w*0.03, 0.2, Math.PI-0.2);
  ctx2.stroke();
  // 代码粒子（漂浮的0和1）
  ctx2.fillStyle = 'rgba(136,204,255,.6)';
  ctx2.font = '5px monospace';
  const codes = ['0','1','01','10'];
  for(let i=0; i<3; i++){
    const px = cx + Math.sin(t*0.7+i*2)*w*0.25;
    const py = h*0.5 + Math.cos(t*0.5+i)*h*0.15;
    ctx2.fillText(codes[i%4], px, py);
  }
}

