/* ═══════════════════════════════════════════════════════════════════════════════
   ══ 02. CORE ENGINE & INPUT ══
   主游戏循环 gameLoop / 画布视口缩放 / Web Audio 复调音效引擎 / 键鼠触屏输入与快捷监听
═══════════════════════════════════════════════════════════════════════════════ */


//  【共享模块 1】AUDIO ENGINE (Web Audio API — no files)
// ═══════════════════════════════════════════
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let actx = null;
function getACtx(){
  if(!actx){actx=new AudioCtx();}
  if(actx.state==='suspended')actx.resume();
  return actx;
}

// Master volume
const SFX_VOL = 0.55;

// Generic noise burst helper
function noise(duration, freq, type='square', volStart=0.4, volEnd=0, detune=0, lpFreq=null){
  try{
    const a=getACtx();
    const osc=a.createOscillator();
    const gain=a.createGain();
    const now=a.currentTime;
    osc.type=type;
    osc.frequency.setValueAtTime(freq,now);
    osc.detune.setValueAtTime(detune,now);
    gain.gain.setValueAtTime(volStart*SFX_VOL,now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001,volEnd*SFX_VOL),now+duration);
    if(lpFreq){const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=lpFreq;osc.connect(lp);lp.connect(gain);}
    else osc.connect(gain);
    gain.connect(a.destination);
    osc.start(now);osc.stop(now+duration);
  }catch(e){}
}
function noiseFreqRamp(duration, freqStart, freqEnd, type='square', vol=0.4, lpFreq=null){
  try{
    const a=getACtx();
    const osc=a.createOscillator();
    const gain=a.createGain();
    const now=a.currentTime;
    osc.type=type;
    osc.frequency.setValueAtTime(freqStart,now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1,freqEnd),now+duration);
    gain.gain.setValueAtTime(vol*SFX_VOL,now);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
    if(lpFreq){const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=lpFreq;osc.connect(lp);lp.connect(gain);}
    else osc.connect(gain);
    gain.connect(a.destination);
    osc.start(now);osc.stop(now+duration);
  }catch(e){}
}
function whiteNoiseBurst(duration, vol=0.3, lpFreq=2000){
  try{
    const a=getACtx();
    const bufLen=Math.ceil(a.sampleRate*duration);
    const buf=a.createBuffer(1,bufLen,a.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<bufLen;i++)data[i]=(Math.random()*2-1);
    const src=a.createBufferSource();
    src.buffer=buf;
    const gain=a.createGain();
    const lp=a.createBiquadFilter();
    lp.type='lowpass';lp.frequency.value=lpFreq;
    const now=a.currentTime;
    gain.gain.setValueAtTime(vol*SFX_VOL,now);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
    src.connect(lp);lp.connect(gain);gain.connect(a.destination);
    src.start(now);src.stop(now+duration);
  }catch(e){}
}

// ── Per-weapon shoot sounds ───────────────────────────────
function sndShoot(wpnId){
  switch(wpnId){
    case'pistol':
      noiseFreqRamp(0.10,900,120,'square',0.35,1200);
      whiteNoiseBurst(0.06,0.18,3000);
      break;
    case'shotgun':
      noiseFreqRamp(0.18,600,60,'sawtooth',0.55,900);
      whiteNoiseBurst(0.14,0.4,4000);
      noiseFreqRamp(0.12,400,50,'square',0.3,600);
      break;
    case'smg': // 冲锋枪：轻快短促
      noiseFreqRamp(0.06,1100,300,'square',0.22,2000);
      whiteNoiseBurst(0.04,0.12,3000);
      break;
    case'smg_heavy': // 重型冲锋枪：低沉
      noiseFreqRamp(0.07,800,200,'square',0.28,1600);
      whiteNoiseBurst(0.05,0.16,2200);
      break;
    case'crossbow': // 十字弩：弦响
      noiseFreqRamp(0.10,1800,400,'sawtooth',0.30,3000);
      whiteNoiseBurst(0.04,0.10,2000);
      break;
    case'sniper': // 狙击枪：响亮长尾
      noiseFreqRamp(0.18,1400,80,'sawtooth',0.5,3000);
      whiteNoiseBurst(0.10,0.3,3500);
      noiseFreqRamp(0.15,300,50,'square',0.25,800);
      break;
    case'tesla': // 特斯拉：电火花噼啪
      noiseFreqRamp(0.08,3000,800,'square',0.3,5000);
      whiteNoiseBurst(0.06,0.2,4000);
      setTimeout(()=>whiteNoiseBurst(0.05,0.15,3500),30);
      break;
    case'railgun':
      noiseFreqRamp(0.06,4000,200,'sawtooth',0.5,8000);
      noiseFreqRamp(0.30,2000,80,'square',0.4,3000);
      noise(0.25,60,'sine',0.6,0,0,200);
      break;
    case'grenade':
      noiseFreqRamp(0.12,300,80,'square',0.35,800);
      whiteNoiseBurst(0.06,0.15,1500);
      break;
    case'ice': // 冰冻枪：清脆碎裂
      noiseFreqRamp(0.10,2000,1200,'sine',0.28,4000);
      whiteNoiseBurst(0.05,0.15,5000);
      break;
    case'poison': // 毒液枪：黏稠喷射
      noiseFreqRamp(0.12,400,150,'sawtooth',0.25,700);
      whiteNoiseBurst(0.06,0.10,900);
      break;
    case'flame':
      if(Math.random()<0.15){
        noiseFreqRamp(0.18,200,80,'sawtooth',0.22,600);
        whiteNoiseBurst(0.12,0.12,800);
      }
      break;
    case'minigun':
      noiseFreqRamp(0.05,800,200,'square',0.18,1800);
      whiteNoiseBurst(0.04,0.1,2500);
      break;
    case'rocket': // 火箭筒：发射轰鸣
      noiseFreqRamp(0.20,500,80,'sawtooth',0.5,1200);
      whiteNoiseBurst(0.15,0.35,2000);
      noise(0.25,80,'sine',0.5,0,0,300);
      break;
    case'plasma': // 等离子：能量嗡鸣
      noiseFreqRamp(0.12,1200,600,'sine',0.35,4000);
      noiseFreqRamp(0.10,800,300,'square',0.25,3000);
      break;
    case'annihilator': // 湮灭者：毁灭性轰鸣
      noiseFreqRamp(0.30,200,30,'sawtooth',0.7,500);
      whiteNoiseBurst(0.25,0.6,800);
      noise(0.40,40,'sine',1.0,0,0,200);
      addShake(10);
      break;
    // ═══ v53武器音效补全：原12把武器射击无声（sndShoot 无 case 静默开火）═══
    case'revolver': // 左轮：大口径重炮——低频重击+金属回响
      noiseFreqRamp(0.16,700,60,'square',0.5,1000);
      whiteNoiseBurst(0.12,0.4,2800);
      noiseFreqRamp(0.10,220,40,'sine',0.35,500);
      addShake(3);
      break;
    case'sawoff': // 锯短霰弹：更宽更闷的双爆
      noiseFreqRamp(0.20,500,50,'sawtooth',0.6,800);
      whiteNoiseBurst(0.16,0.5,3500);
      noiseFreqRamp(0.12,300,40,'square',0.35,600);
      addShake(4);
      break;
    case'boomerang': // 回旋镖：投掷呼啸（滑音扫频）
      noiseFreqRamp(0.18,600,1400,'sine',0.3,2000);
      noiseFreqRamp(0.22,1400,300,'sine',0.2,1800);
      break;
    case'landmine': // 地雷发射器：气缸弹射"咚噗"
      noiseFreqRamp(0.14,350,100,'square',0.4,700);
      whiteNoiseBurst(0.10,0.3,1800);
      break;
    case'harpoon': // 鱼叉枪：气动破空"嗖——咄"
      noiseFreqRamp(0.24,1800,500,'sawtooth',0.3,2600);
      whiteNoiseBurst(0.08,0.25,4000);
      setTimeout(()=>noiseFreqRamp(0.06,900,100,'square',0.22,1200),140);  // 命中前金属震颤
      break;
    case'sonic': // 声波枪：低频脉冲环（嗡——扩散）
      noise(0.30,180,'sine',0.4,0,0,90);
      noiseFreqRamp(0.20,600,120,'sine',0.25,900);
      break;
    case'napalm': // 凝固汽油：黏稠喷射+油料迸溅
      noiseFreqRamp(0.22,250,60,'sawtooth',0.45,500);
      whiteNoiseBurst(0.18,0.45,1200);
      noise(0.28,60,'sine',0.4,0,0,240);
      break;
    case'shockwave': // 冲击波锤：前冲气爆"嗡砰"
      noiseFreqRamp(0.18,450,90,'square',0.5,800);
      noise(0.30,90,'sine',0.55,0,0,300);
      addShake(5);
      break;
    case'railcharger': // 磁轨充能狙击：充能嗡鸣+电磁释放
      noiseFreqRamp(0.08,2400,800,'sawtooth',0.35,5000);
      noiseFreqRamp(0.24,1500,100,'square',0.4,2200);
      break;
    case'chiliflamer': // 辣椒喷焰枪：喷火+嘶辣尾音
      if(Math.random()<0.2){
        noiseFreqRamp(0.16,320,120,'sawtooth',0.3,700);
        whiteNoiseBurst(0.14,0.28,1500);
      }
      break;
    case'quakehammer': // 裂地援护锤：抡挥风声+锤地闷响
      noiseFreqRamp(0.15,900,200,'sawtooth',0.28,1400);
      noise(0.22,80,'sine',0.5,0,0,220);
      break;
    case'bloodblades': // 血肉双刃：短刃破空"唰"
      noiseFreqRamp(0.09,2200,600,'sine',0.22,3000);
      whiteNoiseBurst(0.05,0.15,5000);
      break;
  }
}

// ── Hit & kill ────────────────────────────────────────────
function sndHit(){
  noiseFreqRamp(0.08,300,80,'square',0.25,500);
  whiteNoiseBurst(0.05,0.12,1000);
}
function sndKill(){
  noiseFreqRamp(0.15,500,40,'sawtooth',0.4,700);
  whiteNoiseBurst(0.12,0.25,1500);
  noise(0.1,80,'sine',0.3,0,0,300);
}
function sndExplosion(){
  whiteNoiseBurst(0.5,0.7,400);
  noiseFreqRamp(0.4,200,30,'sawtooth',0.6,600);
  noise(0.3,50,'sine',0.8,0,0,150);
}
function sndPlayerHurt(){
  noiseFreqRamp(0.2,600,100,'sawtooth',0.5,800);
  noise(0.15,200,'sine',0.4,0,0,400);
}
function sndJump(){
  noiseFreqRamp(0.12,150,500,'sine',0.2);
}
function sndLand(){
  whiteNoiseBurst(0.06,0.15,600);
  noise(0.08,100,'sine',0.3,0,0,300);
}
function sndCoin(){
  noiseFreqRamp(0.06,600,1200,'sine',0.25);
  setTimeout(()=>noiseFreqRamp(0.06,800,1600,'sine',0.2),60);
}
function sndShopOpen(){
  [0,60,120].forEach((t,i)=>setTimeout(()=>noiseFreqRamp(0.1,300+i*200,600+i*200,'sine',0.2),t));
}
function sndShopClose(){
  noiseFreqRamp(0.15,800,200,'sine',0.2);
}
function sndWave(){
  noiseFreqRamp(0.3,80,160,'sawtooth',0.35,300);
  setTimeout(()=>noiseFreqRamp(0.3,120,240,'sawtooth',0.3,400),150);
}
function sndBossAppear(){
  // Deep dramatic sting
  noise(0.6,55,'sawtooth',0.7,0,0,300);
  setTimeout(()=>noise(0.4,40,'sawtooth',0.8,0,0,200),200);
  setTimeout(()=>noiseFreqRamp(0.5,200,50,'sawtooth',0.6,500),400);
  whiteNoiseBurst(0.4,0.4,600);
}
function sndBossDie(){
  whiteNoiseBurst(0.8,0.9,800);
  noiseFreqRamp(0.6,300,20,'sawtooth',0.8,500);
  noise(0.5,60,'sine',1.0,0,0,200);
  setTimeout(()=>whiteNoiseBurst(0.5,0.6,400),300);
}
function sndBossRoar(){
  noiseFreqRamp(0.4,100,200,'sawtooth',0.5,400);
  noiseFreqRamp(0.4,80,160,'square',0.4,300);
}
function sndSlam(){
  whiteNoiseBurst(0.3,0.6,500);
  noise(0.25,60,'sine',0.9,0,0,250);
}
// ── 机械"咔哒"音（用于换弹各阶段） ─────────────────────
function sndClick(freq=900, dur=0.04, vol=0.22, type='square'){
  // 短促方波咔哒 + 极短白噪
  noise(dur, freq, type, vol, 0, 0, freq*1.5);
  whiteNoiseBurst(dur*0.8, vol*0.5, freq*2.2);
}
function sndClack(freq=220, dur=0.09, vol=0.32){
  // 低频闷响（弹匣入位、上膛）
  noiseFreqRamp(dur, freq*1.8, freq*0.7, 'square', vol, 700);
  whiteNoiseBurst(dur*0.7, vol*0.55, 1100);
  noise(dur*0.6, freq*0.5, 'sine', vol*0.7, 0, 0, 400);
}
function sndMagOut(){
  // 弹匣释放按钮 + 弹匣滑落
  sndClick(1400, 0.035, 0.18);
  setTimeout(()=>{ whiteNoiseBurst(0.10, 0.16, 1600); noiseFreqRamp(0.12, 700, 280, 'sawtooth', 0.16, 900); }, 60);
}
function sndMagIn(){
  // 弹匣入位：脆响 + 闷响
  sndClick(1100, 0.04, 0.22);
  setTimeout(()=>sndClack(260, 0.10, 0.34), 35);
}
function sndChamber(wpnId){
  // 上膛声：依武器差异化
  switch(wpnId){
    case 'pistol':      // 手枪滑套拉放
      noiseFreqRamp(0.10, 380, 240, 'sawtooth', 0.18, 1400);
      setTimeout(()=>sndClack(320, 0.09, 0.36), 110);
      break;
    case 'shotgun':     // 霰弹枪泵动：咔-咔
      noiseFreqRamp(0.14, 280, 150, 'sawtooth', 0.26, 900);
      whiteNoiseBurst(0.12, 0.22, 1200);
      setTimeout(()=>{ sndClack(180, 0.16, 0.42); whiteNoiseBurst(0.14, 0.28, 900); }, 180);
      break;
    case 'smg':         // 冲锋枪拉栓
    case 'smg_heavy':
      noiseFreqRamp(0.08, 420, 200, 'sawtooth', 0.18, 1500);
      setTimeout(()=>sndClack(360, 0.07, 0.30), 80);
      break;
    case 'crossbow':    // 十字弩上弦
      noiseFreqRamp(0.16, 600, 200, 'sawtooth', 0.20, 1800);
      setTimeout(()=>sndClick(1200, 0.06, 0.24), 140);
      break;
    case 'sniper':      // 狙击枪拉栓
      noiseFreqRamp(0.14, 300, 180, 'sawtooth', 0.24, 1000);
      setTimeout(()=>{ sndClack(220, 0.12, 0.40); whiteNoiseBurst(0.08, 0.16, 1100); }, 130);
      break;
    case 'tesla':       // 特斯拉线圈充能 + 嗡鸣
      noiseFreqRamp(0.18, 300, 2400, 'sawtooth', 0.22, 3500);
      setTimeout(()=>{ sndClick(1800, 0.05, 0.26, 'sine'); noise(0.10, 800, 'sine', 0.18); }, 180);
      break;
    case 'railgun':     // 电磁炮电容充能 + 锁定
      noiseFreqRamp(0.22, 200, 2600, 'sawtooth', 0.22, 4000);
      setTimeout(()=>{ sndClick(2200, 0.05, 0.28, 'sine'); noiseFreqRamp(0.08, 2600, 1400, 'sine', 0.18, 5000); }, 230);
      break;
    case 'grenade':     // 拉环 + 保险针回位
      sndClick(1700, 0.05, 0.20);
      setTimeout(()=>noiseFreqRamp(0.10, 500, 900, 'square', 0.18, 1500), 70);
      break;
    case 'ice':         // 冰冻枪：制冷压缩声
      noiseFreqRamp(0.14, 800, 300, 'sine', 0.22, 2500);
      setTimeout(()=>sndClick(1500, 0.05, 0.22, 'sine'), 120);
      break;
    case 'poison':      // 毒液枪：泵压 + 喷涌
      noiseFreqRamp(0.12, 400, 200, 'sawtooth', 0.20, 800);
      setTimeout(()=>whiteNoiseBurst(0.08, 0.16, 600), 100);
      break;
    case 'flame':       // 喷火器阀门关 + 罐装 + 阀门开
      whiteNoiseBurst(0.18, 0.18, 500);
      setTimeout(()=>sndClack(240, 0.08, 0.26), 120);
      setTimeout(()=>{ whiteNoiseBurst(0.12, 0.14, 700); noiseFreqRamp(0.10, 300, 600, 'sine', 0.16); }, 240);
      break;
    case 'rocket':      // 火箭筒装填：沉重咔哒
      sndClack(160, 0.14, 0.46);
      setTimeout(()=>{ noiseFreqRamp(0.10, 200, 120, 'sawtooth', 0.24, 600); sndClack(140, 0.10, 0.38); }, 120);
      break;
    case 'plasma':      // 等离子炮：能量聚焦嗡鸣
      noiseFreqRamp(0.20, 400, 2000, 'sine', 0.24, 3000);
      setTimeout(()=>{ sndClick(2000, 0.05, 0.28, 'sine'); noise(0.10, 1000, 'sine', 0.20); }, 200);
      break;
    default:
      sndClack(300, 0.10, 0.34);
  }
}
// ── 换弹完整序列：按总时长比例调度卸弹→装弹→上膛 ──────
function sndReloadSequence(wpnId, totalMs){
  // 阶段时间比例：卸弹 0~22%，装弹 35~58%，上膛 78~100%
  const t1 = Math.round(totalMs * 0.06);   // 卸弹开始
  const t2 = Math.round(totalMs * 0.42);   // 装弹开始
  const t3 = Math.round(totalMs * 0.80);   // 上膛开始
  sndMagOut();
  setTimeout(()=>sndMagIn(), t2);
  setTimeout(()=>sndChamber(wpnId), t3);
}
function sndReload(){
  // 兼容旧调用：走默认手枪序列（短）
  sndReloadSequence('pistol', 1100);
}
function sndVehicleEngine(){
  if(Math.random()<0.04){
    noiseFreqRamp(0.15,80,60,'sawtooth',0.12,200);
  }
}
function sndHeal(){
  [0,80,160].forEach((t,i)=>setTimeout(()=>noiseFreqRamp(0.1,400+i*150,800+i*150,'sine',0.18),t));
}
function sndBossProj(){
  noiseFreqRamp(0.1,1200,300,'square',0.2,2000);
}

// ── Resume audio on first interaction ────────────────────
document.addEventListener('mousedown',()=>{getACtx();},{once:true});
document.addEventListener('keydown',()=>{getACtx();},{once:true});

// ═══════════════════════════════════════════

//  【系统模块 C3】BGM（动态背景音乐）
// ═══════════════════════════════════════════
let bgmIntensity=0; // 0=平静 1=激烈
let bgmAudioEl=null;       // HTMLAudioElement 用于播放真实音乐
let bgmCurrentTrack=null;  // 当前正在播放的曲目名
let bgmTargetVolume=0.35;  // 目标音量
let bgmFadeInterval=null;  // 音量淡入淡出定时器

// 三种状态的BGM曲目（archive.org 免版税音乐，CORS 允许跨域）
const BGM_TRACKS = {
  calm:  'https://archive.org/download/CinematicVol9HorrorDarkSuspense/06%20-%20Gregoire%20Lourme%20-%20Insomnia.mp3',     // 悬疑氛围（休息期）
  combat:'https://archive.org/download/royalty-free-music/Battle%20Cinematic%20Trailer%20%28Royalty%20Free%20Music%29.mp3', // 战斗曲（普通波次）
  boss:  'https://archive.org/download/royalty-free-music/Brutal%20Terror%20%28Dark%20Trailer%29.mp3',                       // Boss战曲
  restaurant: 'https://archive.org/download/JazzAndBluesCollection/05%20-%20Smooth%20Jazz%20Bar%20%28Royalty%20Free%29.mp3', // 餐厅轻松爵士（参考戴夫）
  restaurant_lofi:  'https://archive.org/download/lofi-chillhop-1/LoFi%20Chillhop%20Midnight%20Diner.mp3',                  // 餐厅LoFi（深夜食堂感）
  restaurant_acoustic: 'https://archive.org/download/acoustic-folk-1/Acoustic%20Folk%20Warm%20Diner.mp3',                   // 餐厅原声吉他（温暖感）
  restaurant_blues:  'https://archive.org/download/JazzAndBluesCollection/12%20-%20Slow%20Blues%20in%20Bb.mp3',             // 餐厅慢蓝调
};
// 餐厅音乐播放列表（玩家可循环切换）
const REST_MUSIC_PLAYLIST = [
  {key:'restaurant',         label:'音乐：爵士'},
  {key:'restaurant_lofi',    label:'音乐：LoFi'},
  {key:'restaurant_acoustic',label:'音乐：原声'},
  {key:'restaurant_blues',   label:'音乐：蓝调'},
  {key:'calm',               label:'音乐：氛围'},
];
let restMusicIdx = 0;
let restMusicManual = false;  // 玩家手动切换后，不再自动跟随战斗状态
let bgmMuted = false;

// 餐厅音乐切换（玩家手动控制）
function cycleRestMusic(){
  restMusicManual = true;
  restMusicIdx = (restMusicIdx + 1) % REST_MUSIC_PLAYLIST.length;
  const track = REST_MUSIC_PLAYLIST[restMusicIdx];
  switchBGMTrack(track.key);
  addBanner('餐厅音乐切换为：' + track.label.replace('音乐：',''));
  updateRestMusicBtn();
}
function updateRestMusicBtn(){
  const btn = document.getElementById('rest-music-btn');
  if(btn) btn.textContent = REST_MUSIC_PLAYLIST[restMusicIdx].label;
}
function toggleRestMute(){
  bgmMuted = !bgmMuted;
  if(bgmMuted){
    if(bgmAudioEl){ bgmAudioEl.volume = 0; }
    bgmTargetVolume = 0;
  } else {
    bgmTargetVolume = 0.35;
    if(bgmAudioEl){ bgmAudioEl.volume = 0.35; }
  }
  const btn = document.getElementById('rest-mute-btn');
  if(btn) btn.textContent = bgmMuted ? '🔇' : '🔊';
  addBanner(bgmMuted ? '🔇 已静音' : '🔊 取消静音');
}

function startBGM(){
  // 不再使用 Web Audio 合成的低频嗡嗡声——改用真实音乐文件
  if(bgmFadeInterval)return;
  // 默认播放平静曲目
  switchBGMTrack('calm');
  // 定期根据战斗强度切换曲目
  bgmFadeInterval=setInterval(()=>{
    if(!gameRunning){return;}
    // 餐厅模式：始终保持餐厅音乐，不自动切换到战斗/平静曲（修复爵士被覆盖的bug）
    if(gameState==='restaurant'){
      // 确保餐厅BGM在播放（若没在播放则重新触发）
      const restTrack = REST_MUSIC_PLAYLIST[restMusicIdx].key;
      if(bgmCurrentTrack !== restTrack || !bgmAudioEl || bgmAudioEl.paused){
        switchBGMTrack(restTrack);
      }
      return;
    }
    // 据点模式：播放平静曲
    if(gameState==='hub'){
      if(bgmCurrentTrack !== 'calm' || !bgmAudioEl || bgmAudioEl.paused){
        switchBGMTrack('calm');
      }
      return;
    }
    // 计算战斗强度
    let danger=0;
    zombies.forEach(z=>{
      if(!z.alive)return;
      const d=Math.abs(z.x-player.x);
      if(d<200)danger+=0.15;
      else if(d<400)danger+=0.05;
    });
    if(bossActive&&boss&&boss.alive)danger+=0.8;
    bgmIntensity+=(Math.min(1,danger)-bgmIntensity)*0.05;

    // 根据强度切换曲目
    let targetTrack;
    if(bossActive&&boss&&boss.alive) targetTrack='boss';
    else if(bgmIntensity>0.35) targetTrack='combat';
    else targetTrack='calm';
    if(targetTrack!==bgmCurrentTrack){
      switchBGMTrack(targetTrack);
    }
  },800);
}

// 切换BGM曲目（带淡入淡出 + Web Audio API 合成备用）
let _bgmSynthInterval = null;  // 合成BGM的定时器
let _bgmSynthFailed = false;   // 外部音乐加载是否失败（失败后用合成器）

function switchBGMTrack(trackName){
  if(!BGM_TRACKS[trackName])return;
  if(bgmCurrentTrack===trackName&&bgmAudioEl&&!bgmAudioEl.paused)return;

  // 停止合成备用BGM
  if(_bgmSynthInterval){clearInterval(_bgmSynthInterval);_bgmSynthInterval=null;}

  // 淡出当前曲目
  if(bgmAudioEl&&bgmCurrentTrack){
    const oldEl=bgmAudioEl;
    const fadeOut=setInterval(()=>{
      oldEl.volume=Math.max(0,oldEl.volume-0.03);
      if(oldEl.volume<=0.01){
        clearInterval(fadeOut);
        try{oldEl.pause();oldEl.currentTime=0;}catch(e){}
      }
    },50);
  }

  // 创建新的音频元素
  const newEl=new Audio(BGM_TRACKS[trackName]);
  newEl.loop=true;
  newEl.volume=0;
  newEl.crossOrigin='anonymous';
  let _loadedOK=false;
  newEl.play().then(()=>{
    _loadedOK=true;
    // 淡入
    const fadeIn=setInterval(()=>{
      newEl.volume=Math.min(bgmTargetVolume,newEl.volume+0.02);
      if(newEl.volume>=bgmTargetVolume-0.01)clearInterval(fadeIn);
    },60);
  }).catch(e=>{
    // 浏览器自动播放策略阻止 或 加载失败——用合成备用
    console.log('BGM play failed, using synth fallback:', trackName);
    _bgmSynthFailed=true;
    startSynthBGM(trackName);
    const retry=()=>{
      if(!_loadedOK){
        newEl.play().then(()=>{_loadedOK=true;stopSynthBGM();}).catch(()=>{});
      }
      document.removeEventListener('click',retry);
      document.removeEventListener('keydown',retry);
    };
    document.addEventListener('click',retry);
    document.addEventListener('keydown',retry);
  });
  // 加载错误时也启用合成备用
  newEl.onerror=()=>{
    console.log('BGM load error, using synth fallback:', trackName);
    _bgmSynthFailed=true;
    startSynthBGM(trackName);
  };
  bgmAudioEl=newEl;
  bgmCurrentTrack=trackName;
}

// ── Web Audio API 复调音乐引擎（完全消除刺耳蜂鸣，提供悦耳高质感旋律BGM）──
let _bgmMasterGain = null;
let _bgmFilterNode = null;

function stopSynthBGM(){
  if(_bgmSynthInterval){clearInterval(_bgmSynthInterval);_bgmSynthInterval=null;}
  if(_bgmMasterGain){
    try {
      const a=getACtx();
      if(a && a.currentTime) {
        _bgmMasterGain.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.1);
      }
    }catch(e){}
    _bgmMasterGain=null;
  }
}

function startSynthBGM(trackName){
  stopSynthBGM();
  if(!settingsBgm || bgmMuted) return;
  const a=getACtx();if(!a)return;
  if(a.state==='suspended'){ a.resume().catch(()=>{}); }

  // 模拟合成器温润总线：低通滤波器 + 主增益控制（消除刺耳高频，声音柔和温润）
  const master = a.createGain();
  master.gain.value = 0.22;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = trackName==='combat' ? 1000 : trackName==='boss' ? 1300 : 750;
  filter.Q.value = 1.8;
  master.connect(filter);
  filter.connect(a.destination);
  _bgmMasterGain = master;
  _bgmFilterNode = filter;

  const now = () => a.currentTime;

  // 柔和复音发声器（带平滑 ADSR 渐入渐出）
  const playVoice = (freq, dur, type='triangle', vol=0.06, detune=0) => {
    try {
      const osc=a.createOscillator();const gain=a.createGain();const t=now();
      osc.type=type;osc.frequency.setValueAtTime(freq, t);
      if(detune) osc.detune.setValueAtTime(detune, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);gain.connect(master);
      osc.start(t);osc.stop(t + dur + 0.05);
    }catch(e){}
  };

  // 饱满模拟低音（808 / Synth Bass，深沉且不刺耳）
  const playBass = (freq, dur, vol=0.11) => {
    try {
      const osc=a.createOscillator();const gain=a.createGain();const t=now();
      osc.type='sine';osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);gain.connect(master);
      osc.start(t);osc.stop(t + dur + 0.05);
    }catch(e){}
  };

  // 轻巧节奏脉冲
  const playRhythm = (isKick=false, vol=0.03) => {
    try {
      const t=now();
      const osc=a.createOscillator();const gain=a.createGain();
      osc.type=isKick?'triangle':'sine';
      osc.frequency.setValueAtTime(isKick?90:800, t);
      if(isKick) osc.frequency.exponentialRampToValueAtTime(30, t+0.06);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t+(isKick?0.08:0.03));
      osc.connect(gain);gain.connect(master);
      osc.start(t);osc.stop(t+0.09);
    }catch(e){}
  };

  let beat = 0;

  if(trackName==='combat'){
    // ════ 战斗曲：动感合成波 (Cyberpunk Synthwave Combat) ════
    // 和弦：Am -> F -> C -> G，经典史诗律动
    const rootBass = [55, 43.65, 65.41, 49]; // A1, F1, C2, G1 (Hz)
    const chords = [
      [220, 261.63, 329.63], // Am (A3, C4, E4)
      [174.61, 220, 261.63], // F (F3, A3, C4)
      [261.63, 329.63, 392], // C (C4, E4, G4)
      [196, 246.94, 293.66], // G (G3, B3, D4)
    ];
    const arpMelody = [
      440, 523.25, 659.25, 523.25,   // A4, C5, E5, C5
      349.23, 440, 523.25, 440,      // F4, A4, C5, A4
      523.25, 659.25, 783.99, 659.25, // C5, E5, G5, E5
      392, 493.88, 587.33, 493.88    // G4, B4, D5, B4
    ];

    _bgmSynthInterval = setInterval(()=>{
      const chordIdx = Math.floor(beat / 8) % 4;
      const sub = beat % 8;

      // 和弦长音垫底
      if(sub === 0){
        chords[chordIdx].forEach(f=>playVoice(f, 1.8, 'triangle', 0.035));
      }

      // 低音强劲驱动
      if(sub % 2 === 0){
        playBass(rootBass[chordIdx], 0.35, 0.10);
      }

      // 旋律琶音
      const n = arpMelody[beat % arpMelody.length];
      playVoice(n, 0.22, 'sine', 0.045, (sub % 2 === 0 ? 4 : -4));

      // 节奏驱动
      if(sub === 0 || sub === 4) playRhythm(true, 0.04);
      if(sub % 2 === 1) playRhythm(false, 0.02);

      beat++;
    }, 220); // ~136 BPM

  }else if(trackName==='restaurant'||trackName==='restaurant_lofi'||trackName==='restaurant_blues'){
    // ════ 餐厅/深夜食堂：戴夫风格温暖爵士 Lofi (Cozy Lofi Jazz) ════
    const jazzChords = [
      [146.83, 220, 261.63, 329.63], // Dm9
      [196, 246.94, 349.23, 440],    // G13
      [130.81, 196, 246.94, 329.63], // Cmaj7
      [220, 277.18, 329.63, 392],    // A7
    ];
    const lofiMelody = [329.63, 293.66, 261.63, 220, 246.94, 261.63, 293.66, 196];

    _bgmSynthInterval = setInterval(()=>{
      const chordIdx = Math.floor(beat / 4) % 4;
      const sub = beat % 4;

      // 温暖电钢琴和弦
      if(sub === 0){
        jazzChords[chordIdx].forEach((f, idx)=>{
          setTimeout(()=>playVoice(f, 1.6, 'sine', 0.04), idx * 25);
        });
      }

      // 爵士步行贝斯
      if(sub === 0 || sub === 2){
        playBass(jazzChords[chordIdx][0] * 0.5, 0.45, 0.06);
      }

      // 悠闲主旋律
      if(beat % 2 === 1){
        const mn = lofiMelody[(beat >> 1) % lofiMelody.length];
        playVoice(mn, 0.55, 'triangle', 0.035);
      }

      if(sub % 2 === 1) playRhythm(false, 0.015);

      beat++;
    }, 420); // ~72 BPM 悠闲温暖

  }else if(trackName==='boss'){
    // ════ Boss战：紧迫工业暗黑合成器 (Industrial Darksynth) ════
    const bossBass = [43.65, 46.25, 49, 41.2]; // F1, F#1, G1, E1
    const bossArp = [349.23, 440, 523.25, 698.46, 523.25, 440];

    _bgmSynthInterval = setInterval(()=>{
      const bar = Math.floor(beat / 6) % bossBass.length;
      playBass(bossBass[bar], 0.28, 0.13);
      playVoice(bossArp[beat % bossArp.length], 0.18, 'sawtooth', 0.035);
      if(beat % 2 === 0) playRhythm(true, 0.05);
      else playRhythm(false, 0.025);
      beat++;
    }, 180); // ~166 BPM 紧张爆发

  }else{
    // ════ 平静据点：空灵柔和环境音 (Atmospheric Ambient) ════
    const ambientChords = [261.63, 329.63, 392, 493.88];
    _bgmSynthInterval = setInterval(()=>{
      const f = ambientChords[beat % ambientChords.length];
      playVoice(f, 3.2, 'sine', 0.03);
      playVoice(f * 0.5, 3.5, 'sine', 0.035);
      beat++;
    }, 900);
  }
}

function stopBGM(){
  if(bgmFadeInterval){clearInterval(bgmFadeInterval);bgmFadeInterval=null;}
  stopSynthBGM();  // 停止合成备用BGM
  if(bgmAudioEl){
    // 淡出后停止
    const el=bgmAudioEl;
    const fadeOut=setInterval(()=>{
      el.volume=Math.max(0,el.volume-0.05);
      if(el.volume<=0.01){
        clearInterval(fadeOut);
        try{el.pause();el.currentTime=0;}catch(e){}
      }
    },40);
    bgmAudioEl=null;
    bgmCurrentTrack=null;
  }
}

// ═══════════════════════════════════════════

//  CINEMATIC DIALOGUE（全屏剧情对话系统）
//  NPC友军会从屏幕两侧主动走过来，与玩家进行剧情对话
// ═══════════════════════════════════════════
let cinQueue = [];
let cinActive = false;
let cinOnDone = null;
let cinTypeTimer = null;
let cinTextDone = false;
let cinOnStage = {};  // npcId -> DOM element
let cinAutoplay = false;
let cinAutoplayTimer = null;
let cinWalkInTimer = null;
let cinTotalLines = 0;  // 总对话句数（用于进度显示）

// 启动全屏剧情对话
function showCinematic(lines, onDone){
  if(!lines || lines.length === 0){ if(onDone)onDone(); return; }
  cinQueue = [...lines];
  cinTotalLines = lines.length;
  cinOnDone = onDone || null;
  cinActive = true;
  cinOnStage = {};
  // 生成背景粒子
  const particles = document.getElementById('cin-particles');
  if(particles){
    particles.innerHTML = '';
    for(let i = 0; i < 25; i++){
      const p = document.createElement('div');
      p.className = 'cin-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = '-10px';
      p.style.animationDuration = (6 + Math.random() * 8) + 's';
      p.style.animationDelay = Math.random() * 6 + 's';
      p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
      p.style.opacity = 0.2 + Math.random() * 0.4;
      particles.appendChild(p);
    }
  }
  // 显示全屏覆盖层
  // forceDismissAllOverlays（进出据点都会调）用行内样式 display:none/opacity:0 关它；只加 .open 盖不过行内样式，
  // 剧情在看不见的层里跑（cinActive=true 吞掉所有操作）= 回小屋后卡死。先清掉行内样式。
  const scr = document.getElementById('cinematic-scr');
  scr.style.display = ''; scr.style.opacity = ''; scr.style.pointerEvents = '';
  scr.classList.add('open');
  // 背景点击推进对话
  scr.onclick = (e) => {
    if(e.target.id === 'cinematic-scr' || e.target.id === 'cinematic-stage' || e.target.id === 'cin-particles' || e.target.id === 'cin-scene-bg') advanceCinematic();
  };
  // 显示第一句
  showCinLine(cinQueue[0], 0);
}

// 生成CSS立绘HTML
function buildPortraitHTML(npc){
  const p = npc.portrait;
  return `<div class="portrait-body">
    <div class="portrait-name" style="color:${npc.color};border-color:${npc.color}66;">${npc.name}</div>
    <div class="portrait-head" style="background:${p.skin};">
      <div class="portrait-hair" style="background:${p.hair};"></div>
      <div class="portrait-eyes"><div class="portrait-eye"></div><div class="portrait-eye"></div></div>
      <div class="portrait-mouth"></div>
    </div>
    <div class="portrait-torso" style="background:${p.torso};"></div>
  </div>`;
}

// 显示一句对话
function showCinLine(line, idx){
  if(!line){ closeCinematic(); return; }
  const npc = NPC_CHARACTERS[line.npc];
  if(!npc){
    cinQueue.shift();
    if(cinQueue.length === 0) closeCinematic();
    else showCinLine(cinQueue[0], idx);
    return;
  }
  // 更新进度
  const progEl = document.getElementById('cin-progress');
  if(progEl) progEl.textContent = (idx + 1) + ' / ' + cinTotalLines;
  // 切换场景背景
  const bgEl = document.getElementById('cin-scene-bg');
  if(bgEl){
    bgEl.className = '';
    bgEl.classList.add('scene-' + (npc.scene || 'hub'));
  }
  // 场景描述
  const labelEl = document.getElementById('cin-scene-label');
  if(labelEl){
    const sceneNames = {night:'夜', dawn:'黎明', battle:'战场', ruin:'废墟', hub:'避难所'};
    labelEl.textContent = '— ' + (sceneNames[npc.scene] || '避难所') + ' —';
    labelEl.classList.add('show');
  }
  // 取消所有speaking/dimmed状态
  Object.values(cinOnStage).forEach(el => {
    if(el){ el.classList.remove('speaking'); el.classList.add('dimmed'); }
  });
  // 如果该NPC不在舞台上，添加立绘
  if(!cinOnStage[line.npc]){
    const stage = document.getElementById('cinematic-stage');
    const el = document.createElement('div');
    el.className = 'cin-portrait';
    el.dataset.npc = line.npc;
    el.style.color = npc.color;
    el.innerHTML = buildPortraitHTML(npc);
    const side = npc.enterSide;
    if(side === 'left') el.classList.add('left-side');
    else if(side === 'right') el.classList.add('right-side');
    else el.classList.add('center-side');
    stage.appendChild(el);
    cinOnStage[line.npc] = el;
    // 延迟显示（入场动画）
    setTimeout(() => {
      if(cinActive && cinOnStage[line.npc]) cinOnStage[line.npc].classList.add('shown');
    }, line.enterDelay || 300);
  } else {
    cinOnStage[line.npc].classList.remove('dimmed');
  }
  // 标记当前说话人
  setTimeout(() => {
    if(cinActive && cinOnStage[line.npc]) cinOnStage[line.npc].classList.add('speaking');
  }, 100);
  // 更新对话框
  setCinDlgBox(npc, line);
}

// 设置对话框（含打字机效果 + 音效）
function setCinDlgBox(npc, line){
  const iconEl = document.getElementById('cin-speaker-icon');
  iconEl.textContent = npc.initial;
  iconEl.style.borderColor = npc.color;
  iconEl.style.color = npc.color;
  iconEl.style.background = `radial-gradient(circle, ${npc.color}33, transparent)`;
  const spk = document.getElementById('cin-speaker');
  spk.textContent = npc.name;
  spk.style.color = npc.color;
  // 打字机效果
  cinTextDone = false;
  const el = document.getElementById('cin-text');
  el.textContent = '';
  let i = 0;
  const clean = line.text;
  let lastSound = 0;
  (function next(){
    if(i <= clean.length){
      el.textContent = clean.slice(0, i);
      // 打字音效（每3字响一次，避免太吵）
      if(i % 3 === 0 && i > 0 && Date.now() - lastSound > 60){
        try{
          const a = getACtx();
          const osc = a.createOscillator();
          const gain = a.createGain();
          const now = a.currentTime;
          osc.type = 'square';
          osc.frequency.setValueAtTime(800 + Math.random()*200, now);
          gain.gain.setValueAtTime(0.03 * SFX_VOL, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          osc.connect(gain); gain.connect(a.destination);
          osc.start(now); osc.stop(now + 0.04);
          lastSound = Date.now();
        }catch(e){}
      }
      i++;
      cinTypeTimer = setTimeout(next, 30);
    } else {
      cinTextDone = true;
    }
  })();
}

// 推进对话
function advanceCinematic(){
  if(!cinActive) return;
  if(!cinTextDone){
    // 快进当前句
    clearTimeout(cinTypeTimer);
    const line = cinQueue[0];
    if(line) document.getElementById('cin-text').textContent = line.text;
    cinTextDone = true;
    return;
  }
  cinQueue.shift();
  if(cinQueue.length === 0){
    closeCinematic();
  } else {
    showCinLine(cinQueue[0], cinTotalLines - cinQueue.length);
  }
}

// 关闭全屏对话
function closeCinematic(){
  clearTimeout(cinTypeTimer);
  clearTimeout(cinAutoplayTimer);
  cinActive = false;
  // 所有立绘淡出
  Object.values(cinOnStage).forEach(el => {
    if(el) el.classList.remove('shown', 'speaking');
  });
  setTimeout(() => {
    const stage = document.getElementById('cinematic-stage');
    if(stage) stage.innerHTML = '';
    cinOnStage = {};
    const scr = document.getElementById('cinematic-scr');
    if(scr) scr.classList.remove('open');
    const labelEl = document.getElementById('cin-scene-label');
    if(labelEl) labelEl.classList.remove('show');
    if(cinOnDone){ const cb = cinOnDone; cinOnDone = null; cb(); }
  }, 600);
}

// 跳过整段剧情对话
function skipCinematic(){
  if(!cinActive) return;
  cinQueue = [];
  // v50修（黑屏根因#2）：skip 从不调用 onDone——序章跳过后 showClassChoice/教程链全断，
  // wave=0 卡死黑屏。现在跳过也把完成回调接上。
  const cb = cinOnDone || null;
  cinOnDone = null;
  closeCinematic();
  if(cb) setTimeout(()=>cb(), 80);
}

// ── Ending sequence ──────────────────────────────────────
const ENDING_TEXT = `直升机的螺旋桨在头顶轰鸣，小胡抓住放下绳梯，最后一个爬了上去。

他回头望着脚下的城堡据点。十五天前，这里还是一座废弃的石头废墟；现在，城墙布满弹孔，塔楼半塌，护城河里堆满了感染者的尸体。

"干得漂亮，地面单位。"机长递过来一瓶水，"你是城西唯一的幸存者。"

小胡接过水，灌了半瓶，然后靠在舱壁上闭上眼睛。远处，尸潮仍在涌向那座空荡荡的城堡，撞在已经没有主人的城墙上。

十五天，十五波尸潮。他活下来了。

直升机掠过废墟城市，向远方的安全区飞去。下方，感染者的嘶吼声渐渐消失在风里。`;

function showEnding(){
  gameRunning = false;
  cancelAnimationFrame(animFrame);
  clearTimeout(spawnTimer); clearInterval(waveTimer);
  document.getElementById('ending-scr').style.display = 'flex';
  document.getElementById('ending-chapter-label').textContent = '终章';
  document.getElementById('ending-title').textContent = '十五波围城 · 撤离成功';
  const stats = document.getElementById('ending-stats');
  stats.innerHTML = `
    <div class="est">击杀僵尸 <span>${killCount}</span></div>
    <div class="est">到达第 <span>${wave}</span> 波</div>
    <div class="est">最终得分 <span>${score}</span></div>
    <div class="est">硬币剩余 <span>💰 ${coins}</span></div>`;
  const tw = document.getElementById('ending-typewriter');
  typewrite(tw, ENDING_TEXT, 22, null);
  // Play victory tones
  setTimeout(()=>{
    [0,200,400,700,1000].forEach((t,i)=>{
      setTimeout(()=>noiseFreqRamp(0.2, 300+i*120, 600+i*120, 'sine', 0.18), t);
    });
  }, 800);
}
function endingDone(){
  // Bug修复：通关"再次出发"原来回旧版序章剧情页，应回主菜单（新局从主菜单开）
  document.getElementById('ending-scr').style.display = 'none';
  showMainMenu();
}

// Init story on load
window.addEventListener('DOMContentLoaded', ()=>{
  // 显示主菜单（不再直接进入序章剧情）
  showMainMenu();
});

// ── 主菜单系统 ──
function showMainMenu(){
  // 隐藏所有其他界面
  document.getElementById('story-intro-scr').style.display = 'none';
  document.getElementById('start-scr').style.display = 'none';
  document.getElementById('pause-scr').style.display = 'none';
  document.getElementById('over-scr').style.display = 'none';
  // 检测是否有存档
  const hasSave = !!localStorage.getItem('zombie_game_autosave');
  const continueBtn = document.getElementById('continue-btn');
  const saveInfo = document.getElementById('save-info');
  if(hasSave){
    if(continueBtn) continueBtn.style.display = 'block';
    if(saveInfo) saveInfo.style.display = 'block';
    try{
      const save = JSON.parse(localStorage.getItem('zombie_game_autosave'));
      if(saveInfo) saveInfo.textContent = '📂 存档: 第' + (save.wave||1) + '波 · 击杀' + (save.killCount||0) + ' · 💰' + (save.coins||0);
    }catch(e){ if(saveInfo) saveInfo.textContent = '📂 检测到存档'; }
  } else {
    if(continueBtn) continueBtn.style.display = 'none';
    if(saveInfo) saveInfo.style.display = 'none';
  }
  // 动态更新主菜单战备看板
  if(typeof updateMainMenuSaveDossier === 'function') updateMainMenuSaveDossier();
  // 启动主菜单夜景粒子与探照灯
  if(typeof startMenuBgAnimation === 'function') startMenuBgAnimation();
  // 显示主菜单
  document.getElementById('main-menu-scr').style.display = 'flex';
}

// 继续游戏：从localStorage加载存档
function continueGame(){
  const saveStr = localStorage.getItem('zombie_game_autosave');
  if(!saveStr){ addBanner('没有存档！'); return; }
  try{
    const state = JSON.parse(saveStr);
    if(typeof stopMenuBgAnimation === 'function') stopMenuBgAnimation();
    try{ sndBtnClick(); }catch(e){}
    document.getElementById('main-menu-scr').style.display = 'none';
    // 直接恢复存档（不调用startGame，避免重置）
    restoreSaveState(state);
    gameRunning = true;
    gamePaused = false;
    document.getElementById('pause-scr').style.display = 'none';
    // 恢复游戏循环
    cancelAnimationFrame(animFrame);
    gameLoop();
    addBanner('📂 存档已加载！继续战斗！');
  }catch(e){
    addBanner('❌ 存档损坏，无法加载');
    console.error('存档加载失败:', e);
  }
}

// 返回主菜单（从暂停界面）
function returnToMainMenu(){
  // 先保存当前进度
  if(gameRunning) autoSaveToStorage();
  gameRunning = false;
  gamePaused = false;
  cancelAnimationFrame(animFrame);
  stopBGM();
  showMainMenu();
}

// 设置界面
let settingsBgm = true, settingsSfx = true;
function openSettings(){
  document.getElementById('main-menu-scr').style.display = 'none';
  document.getElementById('settings-scr').style.display = 'flex';
  // 显示设备信息
  const devInfo = document.getElementById('device-info');
  if(isMobile()){
    devInfo.textContent = '📱 移动设备 (已启用触屏)';
    devInfo.style.color = '#88ccff';
  } else {
    devInfo.textContent = '💻 桌面设备 (键盘鼠标)';
    devInfo.style.color = '#88ff88';
  }
}
function closeSettings(){
  document.getElementById('settings-scr').style.display = 'none';
  document.getElementById('main-menu-scr').style.display = 'flex';
}
function toggleSettingBgm(){
  settingsBgm = !settingsBgm;
  const btn = document.getElementById('setting-bgm');
  btn.textContent = settingsBgm ? '开' : '关';
  btn.style.color = settingsBgm ? '#88ff88' : '#ff6666';
  if(!settingsBgm && bgmAudioEl){ bgmAudioEl.volume = 0; }
  else if(settingsBgm && bgmAudioEl){ bgmAudioEl.volume = bgmTargetVolume; }
}
function toggleSettingSfx(){
  settingsSfx = !settingsSfx;
  const btn = document.getElementById('setting-sfx');
  btn.textContent = settingsSfx ? '开' : '关';
  btn.style.color = settingsSfx ? '#88ff88' : '#ff6666';
}

