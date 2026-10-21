// ═══════════════════════════════════════════

//  STORY ENGINE
// ═══════════════════════════════════════════

// ── NPC 角色定义（视觉小说式立绘） ──
// enterSide: 'left' / 'right' / 'center' — 立绘位置
// color: 主色调
// portrait: { skin, hair, torso } 立绘配色
const NPC_CHARACTERS = {
  ming:    { name:'小胡',       initial:'胡', enterSide:'left',   color:'#f0c060', scene:'hub',
             portrait:{skin:'#d4a574', hair:'#2a1a08', torso:'#4a6a9a'}, desc:'大学生，被迫扛起责任' },
  zhang:   { name:'老兵张',     initial:'张', enterSide:'right',  color:'#ffaa66', scene:'ruin',
             portrait:{skin:'#c89878', hair:'#cccccc', torso:'#4a3a2a'}, desc:'前特战老兵' },
  lin:     { name:'护士小林',   initial:'林', enterSide:'right',  color:'#ff88aa', scene:'ruin',
             portrait:{skin:'#e8c8a8', hair:'#3a2a1a', torso:'#e8e8e8'}, desc:'战地护士' },
  qiang:   { name:'工程师阿强', initial:'强', enterSide:'right',  color:'#88ccff', scene:'hub',
             portrait:{skin:'#c89878', hair:'#2a2a2a', torso:'#8a8a4a'}, desc:'机械师' },
  zhao:    { name:'通信兵小赵', initial:'赵', enterSide:'right',  color:'#88ffcc', scene:'hub',
             portrait:{skin:'#d4a574', hair:'#1a1a1a', torso:'#4a5a3a'}, desc:'通信兵' },
  radio:   { name:'军方广播',   initial:'广', enterSide:'center', color:'#ff6644', scene:'night',
             portrait:{skin:'#888888', hair:'#444444', torso:'#444466'}, desc:'军方广播' },
  boss1:   { name:'暴君变异体', initial:'暴', enterSide:'right',  color:'#cc4444', scene:'battle',
             portrait:{skin:'#6a8a3a', hair:'#4a6a2a', torso:'#3a5a1a'}, desc:'第一个Boss' },
  boss2:   { name:'喷吐者',     initial:'喷', enterSide:'right',  color:'#88aa44', scene:'battle',
             portrait:{skin:'#8a7a3a', hair:'#6a5a2a', torso:'#5a4a1a'}, desc:'第二个Boss' },
  boss3:   { name:'尸王',       initial:'王', enterSide:'right',  color:'#aa44aa', scene:'battle',
             portrait:{skin:'#5a3a5a', hair:'#3a1a3a', torso:'#2a0a2a'}, desc:'最终Boss' },
  heli:    { name:'直升机机长', initial:'机', enterSide:'right',  color:'#ffee44', scene:'dawn',
             portrait:{skin:'#d4a574', hair:'#3a3a3a', torso:'#5a5a8a'}, desc:'撤离直升机机长' },
};

// 全屏剧情对话：序章——小胡，一个被迫扛起责任的大学生
const CINEMATIC_INTRO = [
  {npc:'ming',  text:'我叫小胡。十五天前，我还在准备期末考试。\n人生格言就四个字：活着干，死了算。\n没想到末世来了，这套哲学还真用上了。'},
  {npc:'ming',  text:'病毒爆发那晚，全城都疯了。我跑到城西废墟，\n撞见这座破城堡。\n心想——反正没处去，就这儿吧。\n（其实是因为跑不动了。体育课从来没及格过。）'},
  {npc:'ming',  text:'第一夜，我杀了七只僵尸。饿急眼了，割了块肉烤了。\n……别说，味道还真不赖。\n（我在心里给自己道了个歉。然后又咬了一口。）'},
  {npc:'ming',  text:'结果那些流浪者闻着味儿就来了。\n一个两个三个……排队要我烤肉。\n我寻思：我一个学生，怎么就成了厨子了？\n但没人管你愿不愿意，他们就叫你"老板"。'},
  {npc:'radio', text:'【军方广播】……所有幸存者……坚守……第十五天……直升机撤离……', enterDelay:500},
  {npc:'ming',  text:'十五天。行吧。\n白天打僵尸，晚上烤肉。\n反正死了算，活着就接着干。\n……但说实话，我还挺不想死的。期末考试还没考呢。'},
];

// ── Story data ─────────────────────────────────────────────
const STORY_SCENES = [
  // Scene 0 — 序章·爆发
  { chapter:'序章', title:'末日降临',
    text:`没人知道病毒从哪里来。\n一夜之间，城市沦陷。感染者失去理智，只剩攻击本能，成群结队扑向幸存者。\n政府垮台，通讯中断，救援遥遥无期。\n\n你记得那天——街角的消防栓被失控的公交车撞断，水柱直冲上天，喷了三天三夜没人管。\n那是文明最后的喘息。` },
  // Scene 1 — 序章·据守
  { chapter:'序章', title:'最后的堡垒',
    text:`你叫小胡，一个大学生。\n你在城西废墟里找到一座废弃的石砌城堡，高墙厚壁，易守难攻。\n你加固了城墙，囤积了武器，把这里变成了最后的据点。\n\n城堡门口倒着一只僵尸——它脖子上挂着一条铁链，链子另一头拴在路边的消防栓上。\n它挣扎了三天，栓子都被它拽歪了，最后饿死在原地。\n你把那条铁链收了，说不定有用。\n\n城堡里还有一间废弃的老厨房——那是你爸妈留下的，十年没进了。` },
  // Scene 2 — 序章·求生
  { chapter:'序章', title:'十五波围城',
    text:`收音机里传来断断续续的军方信号：\n"……所有幸存者……坚守……第十五天……直升机撤离……"\n十五天，十五波尸潮。\n守住城堡，活到撤离。这就是你唯一的任务。\n\n你不知道的是——那些被你打倒的僵尸，掉落的肉块……竟然能吃。\n而全城饥饿的幸存者，很快就会找上门来。\n\n城堡斜对面的消防栓还在喷水，水流穿过整条街，汇成一道天然壕沟。\n也许……它能挡住点什么。` },
];

// 波次对话——小胡：大学生，内心戏丰富，嘴上嫌弃但身体诚实
const WAVE_DIALOGUES = {
  // ── 第一章·围城初夜（小胡独守） ──
  1: [
    {npc:'ming',  text:'来了来了……\n（内心OS：能不能明天再来？我今天不想死。明天也不想。）\n算了，先把枪栓拉了再说。'},
    {npc:'radio', text:'【军方广播】……检测到大规模感染体移动……方向：城西……幸存者请加固防御……', enterDelay:400},
    {npc:'ming',  text:'加固防御？我连早饭都没吃。\n（拉枪栓）行吧。多杀几只，今晚菜单丰富点。\n活着干，死了算。开杀。'},
    {npc:'ming',  text:'（打倒第一只僵尸，地上掉了一块肉）\n……这肉，看着没腐烂？\n（捡起来闻了闻）居然有股香味？\n末世了，浪费可耻……先收着，回头试试能不能吃。'},
  ],
  2: [
    {npc:'ming',  text:'第二波。数量又涨了。\n（内心OS：我就想安安静静烤个肉，怎么就这么难呢？）'},
    {npc:'ming',  text:'……等等，那边有枪声？\n不是僵尸——是人？\n（内心OS：完了，又来一张嘴要喂的。）'},
    {npc:'ming',  text:'（瞥了一眼街角还在喷水的消防栓）\n那玩意儿喷了一周了，水压居然还没掉。\n zombie 踩进去滑了一跤——好家伙，还能当地雷用。'},
  ],
  // ── 第2波清场后，老兵张登场 ──
  3: [
    {npc:'ming',  text:'第三波。老兵张在旁边帮我看着右翼。\n（内心OS：有个老兵就是好。起码死的时候有人帮我收尸。）'},
    {npc:'zhang', text:'小伙子，你前两波一个人扛下来的？\n我打了二十年仗，没见过这么硬的 rookies。你这身手，学校里练的？', enterDelay:600},
    {npc:'ming',  text:'翻墙逃课练的。\n更大的家伙要来了吧？我听见过吼声。'},
    {npc:'zhang', text:'是变异体。第五波它会到。\n在那之前，把墙升到石墙——这东西能撞碎木墙。', enterDelay:500},
    {npc:'radio', text:'【军方广播】……警告……变异体已出现在目标区域……体型巨大……极度危险……', enterDelay:400},
    {npc:'ming',  text:'变异体。来吧。\n（检查枪膛）我等着。'},
  ],
  // ── 第二章·尸潮升级 ──
  4: [
    {npc:'ming',  text:'第四波。石墙立住了，弹药消耗越来越快。\n要是有个会治伤的就好了。'},
    {npc:'zhang', text:'我之前在城西医院那边见过一个护士，不知道她还在不在。', enterDelay:500},
    {npc:'ming',  text:'……\n（远处传来玻璃碎裂声和女人的喊叫——干脆利落）\n医院方向。我去接她。'},
  ],
  // ── 第4波清场后，护士小林加入 ──
  5: [
    {npc:'ming',  text:'第五波。小林来了，我不用怕受伤了。\n可以放开打。'},
    {npc:'lin',   text:'药品我只够撑三天。但只要你还能站着打，我就能让你站着活。', enterDelay:500},
    {npc:'zhang', text:'注意走位，别被围住。陷阱也该铺了——地雷、地刺，能拖就拖。', enterDelay:500},
    {npc:'ming',  text:'明白。这波清完我把塔防铺开。\n（举枪）来了。'},
  ],
  6: [
    {npc:'ming',  text:'第六波。第二个Boss——会喷酸液那个。\n（冷笑）上次它差点把墙撞塌，这次我先下手。'},
    {npc:'lin',   text:'担架准备好了。受伤就拖回来，我负责缝。', enterDelay:500},
    {npc:'zhang', text:'别让它一直喷墙——铁墙也扛不住酸液。用射程长的武器压制。', enterDelay:500},
    {npc:'ming',  text:'……\n（远处传来金属切割声）\n又有人？今天真热闹。'},
  ],
  // ── 第6波清场后，工程师阿强加入 ──
  7: [
    {npc:'ming',  text:'第七波。阿强来了，围墙能上铁墙了。\n400血，能顶很久。'},
    {npc:'qiang', text:'我把钢筋都焊死在墙体里了。这墙现在能扛火箭筒——别说僵尸了。', enterDelay:500},
    {npc:'zhang', text:'塔防也该满级了。最后三波，不能省。\n我打过最硬的仗，就是这种时候。', enterDelay:500},
    {npc:'ming',  text:'（点头）最后三波。\n撑过去，回家。'},
  ],
  8: [
    {npc:'ming',  text:'第八波。弹药、金币、围墙血量……样样告急。\n但还没崩。'},
    {npc:'lin',   text:'每一只都得精打细算。漏一只就可能崩盘。我盯紧伤员，你专心打。', enterDelay:500},
    {npc:'zhang', text:'最后两个Boss。打完它们，就自由了——\n我就能回家见孙子了。', enterDelay:500},
    {npc:'ming',  text:'……\n（远处树林里有动静）\n军装？有人从北边来。'},
  ],
  // ── 第8波清场后，通信兵小赵加入 ──
  9: [
    {npc:'ming',  text:'最终Boss。这东西……比楼还高。身上挂着几十个感染者。\n（举枪）正好，一锅端。'},
    {npc:'zhao',  text:'我接上军方信号了！机长说直升机已经起飞，15分钟后到。', enterDelay:500},
    {npc:'radio', text:'【军方广播】……直升机已起飞……预计15分钟抵达……请清除着陆区……', enterDelay:400},
    {npc:'zhao',  text:'15分钟。机长说他会等——但只能等15分钟。这是最后一班。', enterDelay:500},
    {npc:'ming',  text:'15分钟。\n（拉枪栓）够了。\n干掉它，回家。'},
  ],
};

// ── v49批4：W10-15 波次对白（原版只写到W9）──
const WAVE_DIALOGUES_LATE = {
  10: [
    {npc:'zhang', text:'第10波了。楼那边的尸群越来越密——别恋战，打完就撤回墙内。'},
    {npc:'radio',  text:'【军方广播】……检测到大规模变异体活动……幸存者请注意……', enterDelay:600},
  ],
  11: [
    {npc:'qiang', text:'围墙结构疲劳度38%。建议优先加固东侧——那边承重最弱。'},
    {npc:'ming',   text:'谁在跟我说承重……哦，阿强。行，东墙归你管。'},
  ],
  12: [
    {npc:'zhang', text:'那些巨型家伙出现了。别省子弹——省子弹的代价是省命。'},
    {npc:'lin',   text:'枪声一停我就心慌。打个漂亮的，我给你们炖肉汤。', enterDelay:600},
  ],
  13: [
    {npc:'zhao',  text:'军、军方回话了！说15波结束就有直升机……还有两波，顶住！'},
    {npc:'zhang', text:'两波。老子打了二十年仗，就为活着喝上这碗肉汤。', enterDelay:600},
  ],
  14: [
    {npc:'ming',  text:'最后一波之前……大家。都别死。'},
    {npc:'zhang', text:'废话。谁敢死，我打断谁的腿再救活。', enterDelay:500},
    {npc:'lin',   text:'都别死。这也是医嘱。', enterDelay:400},
  ],
  15: [
    {npc:'radio', text:'【军方广播】……直升机编队进入最后空域……清理着陆区……这是最后广播……祝你们好运……'},
    {npc:'ming',  text:'最后一次守城。打完这波——回家。', enterDelay:600},
  ],
};

// ═══════════════════════════════════════════
//  【v49批4】非模态波次对白条（复活死掉的WAVE_DIALOGUES）
//  原版唯一调用点被注释（"阻塞gameLoop"）——本系统不暂停游戏：
//  屏幕顶部滑入对白条，NPC 头像+名字+一行字，自动消失，可点击跳下一条
// ═══════════════════════════════════════════
let waveDlgQueue = [];      // 本波待播对白 [{npc, text}]
let waveDlgCurrent = null;  // 当前显示
let waveDlgTimer = null;
let waveDlgTotalLines = 1;
let waveDlgCurIndex = 0;
window._waveDlgActive = false;

function queueWaveDialogue(w){
  // 合并 W1-9 原版 + W10-15 新写
  const lines = (WAVE_DIALOGUES[w] || WAVE_DIALOGUES_LATE[w] || null);
  if(!lines)return;
  waveDlgQueue = lines.map(l=>({...l}));
  waveDlgTotalLines = lines.length;
  waveDlgCurIndex = 0;
  // 波开始后等弹窗（教程/章节卡/剧情）关闭再延迟1.5秒播——防对白错过首条
  let waited = 0;
  const poll = setInterval(()=>{
    const blocked = isTutorialOpen() || cinActive || shopOpen || cabinUIOpen || (document.getElementById('chapter-scr') && document.getElementById('chapter-scr').style.display==='flex') || (document.getElementById('backpack-modal') && document.getElementById('backpack-modal').classList.contains('open'));
    if(!gameRunning || waveDlgQueue.length===0 || (!blocked && (waited+=100)>=1200)){
      clearInterval(poll);
      if(gameRunning && gameState==='world' && waveDlgQueue.length) playNextWaveDlg();
    }
  }, 100);
}
function playNextWaveDlg(){
  if(!waveDlgQueue || waveDlgQueue.length===0){ hideWaveDlg(); return; }
  waveDlgCurrent = waveDlgQueue.shift();
  waveDlgCurIndex++;
  window._waveDlgActive = true;
  gameWrap.querySelectorAll('.banner-msg').forEach(el => { el.style.top = '128px'; });
  const ch = NPC_CHARACTERS[waveDlgCurrent.npc] || {name:'据点通讯', color:'#f0c060', initial:'📻'};
  let bar = document.getElementById('wave-dlg-bar');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'wave-dlg-bar';
    gameWrap.appendChild(bar);
  }
  const roleTags = {
    ming: '据点守卫',
    zhang: '特战老兵',
    lin: '战地医疗',
    zhuang: '重火机枪手',
    radio: '军方紧急频道',
    npc: '避难幸存者'
  };
  const roleTag = roleTags[waveDlgCurrent.npc] || '无线电连线';

  bar.innerHTML = `
    <div class="wd-top-bar">
      <span>📻 据点无线电通讯 · 频道 104.2</span>
      <span id="wd-page-indicator" style="color:#ffd875;font-weight:700;">[第 ${waveDlgCurIndex} / ${waveDlgTotalLines} 句]</span>
      <span style="color:#9be89b;">🟢 信号正常</span>
    </div>
    <div class="wd-main">
      <div class="wd-avatar" style="color:${ch.color};border-color:${ch.color};box-shadow:0 0 10px ${ch.color};">
        ${ch.initial || (ch.name ? ch.name[0] : '🧔')}
      </div>
      <div class="wd-body">
        <div class="wd-speaker-row">
          <span class="wd-speaker" style="color:${ch.color};">${ch.name}</span>
          <span class="wd-tag">${roleTag}</span>
        </div>
        <div class="wd-text">${waveDlgCurrent.text}</div>
      </div>
      <div class="wd-actions">
        <div class="wd-btn-next" onclick="event.stopPropagation();advWaveDlg()">[点击/T] 推进 ▶</div>
        <div class="wd-btn-close" onclick="event.stopPropagation();clearWaveDlg()">[Esc/✕] 跳过</div>
      </div>
    </div>
    <div class="wd-timer-track">
      <div id="wd-timer-fill" class="wd-timer-fill" style="width:100%;"></div>
    </div>`;

  bar.style.display = 'flex';
  bar.classList.add('open');
  bar.style.transform = 'translate(-50%,0)';
  bar.onclick = (e) => { e.stopPropagation(); advWaveDlg(); };

  clearTimeout(waveDlgTimer);
  const dur = Math.min(6500, 2800 + waveDlgCurrent.text.length * 80);
  const tf = document.getElementById('wd-timer-fill');
  if(tf){
    tf.style.transition = 'none';
    tf.style.width = '100%';
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const tf2 = document.getElementById('wd-timer-fill');
        if(tf2){
          tf2.style.transition = `width ${dur}ms linear`;
          tf2.style.width = '0%';
        }
      });
    });
  }
  waveDlgTimer = setTimeout(()=>{ if(gameRunning) playNextWaveDlg(); }, dur);
}
function advWaveDlg(){
  clearTimeout(waveDlgTimer);
  playNextWaveDlg();
}
function hideWaveDlg(){
  const bar = document.getElementById('wave-dlg-bar');
  if(bar){
    bar.classList.remove('open');
    bar.style.transform = '';
    bar.style.display = 'none';
  }
  window._waveDlgActive = false;
  waveDlgCurrent = null;
}
// 波结束/清场：清队列收条
function clearWaveDlg(){
  waveDlgQueue = [];
  clearTimeout(waveDlgTimer);
  hideWaveDlg();
}

// ── 波次清场后的加入对话（NPC 首次登场） ──
const NPC_JOIN_DIALOGUES = {
  2: [
    // 老兵张在第2波后加入——被小胡的硬实力折服
    {npc:'ming',  text:'（枪声停了。我靠在墙上换弹，听到废墟那边有脚步声）\n出来。\n（举枪）别装。'},
    {npc:'zhang', text:'别开枪，自己人。\n（一个头发花白的老兵从废墟里走出来，手里提着一把沾血的步枪）', enterDelay:700},
    {npc:'zhang', text:'我叫老张，特战部队退役。\n听见你这边枪声不断——一个人守这地方，你疯了？', enterDelay:500},
    {npc:'ming',  text:'没疯。这是城西唯一的据点。\n（放下枪）你枪法不错，能打。'},
    {npc:'zhang', text:'我打了二十年仗，退休回家种地，结果碰上这鬼事。\n老婆孩子都没了。我现在只想多杀几个。\n你这地方不错——我留下。', enterDelay:500},
    {npc:'zhang', text:'但我不能白吃饭。你修墙、买武器，我教你打仗。\n下一波开始，我帮你看着右翼。', enterDelay:400},
    {npc:'ming',  text:'不用教。我翻墙逃课练出来的手。\n但右翼交给你——我信得过你那把枪。'},
  ],
  4: [
    // 护士小林在第4波后加入——小胡受伤不吭声
    {npc:'ming',  text:'（第四波清完，我胳膊上被咬了一道口子，血流了一地）\n……小伤。不用管。'},
    {npc:'lin',   text:'别动！让我看看。\n（一个穿着白大褂的女人从医院废墟方向跑过来，背着一个鼓鼓囊囊的药箱）', enterDelay:700},
    {npc:'lin',   text:'我叫小林，城西医院的护士。\n医院被尸潮冲了，我带着药箱跑出来——听见你这边有枪声，想着可能还有人活着。', enterDelay:500},
    {npc:'lin',   text:'（她撕开绷带，利落地包扎）\n伤口不深，但再晚半小时就感染了。\n你刚才为什么不喊？', enterDelay:400},
    {npc:'ming',  text:'喊什么？又没断。'},
    {npc:'lin',   text:'（愣了一下，然后笑）……你这个人。\n我一个人也活不了几天。但如果有据点、有能打的人——我就能救更多的人。\n我留下。', enterDelay:500},
    {npc:'zhang', text:'护士小姐，欢迎入伙。\n（老兵张咧嘴笑）这下我们仨了。', enterDelay:400},
    {npc:'ming',  text:'（点头）谢了，绷带。\n下一波我放心打。'},
  ],
  6: [
    // 工程师阿强在第6波后加入——小胡一眼看出墙的问题
    {npc:'ming',  text:'（第六波清完，围墙被酸液烧出几个大洞，我盯着焦黑的墙体）\n钢筋没焊死。这墙扛不住下一波。'},
    {npc:'qiang', text:'好眼力。\n（一个穿着工装、背着工具箱的男人从东边走过来，安全帽上还沾着水泥灰）', enterDelay:700},
    {npc:'qiang', text:'我叫阿强，学校隔壁工地的焊工。病毒爆发那天我在浇筑混凝土，\n工友全没了，我一个人躲在搅拌机里活了下来。', enterDelay:500},
    {npc:'qiang', text:'我听见你们这边天天打枪，琢磨着这地方肯定有人守。\n沿着墙根摸过来——你们这墙修得不错，但钢筋没焊死，扛不住大东西。', enterDelay:500},
    {npc:'ming',  text:'我知道。没焊枪，焊不了。'},
    {npc:'qiang', text:'我有。\n给我废铁和金币，铁墙、钢墙、连塔防底座我都能给你焊出来。\n关键是——你们收人吗？', enterDelay:500},
    {npc:'zhang', text:'会修墙的，比会开枪的还金贵。留下吧，兄弟。\n（老兵张拍拍阿强的肩）', enterDelay:400},
    {npc:'ming',  text:'（伸手）欢迎。墙交给你——我专心杀。'},
  ],
  8: [
    // 通信兵小赵在第8波后加入——小胡一直在等撤离消息
    {npc:'ming',  text:'（第八波清完，我们四个坐在墙根下喘气）\n收音机一直没信号。撤离的事一点消息都没有。\n要是能联系上军方就好了。'},
    {npc:'zhao',  text:'需要联系军方？\n（一个背着电台、戴着耳机的年轻人从北边树林里钻出来，军装上满是泥污）', enterDelay:700},
    {npc:'zhao',  text:'我是小赵，通信兵。我们部队三天前在城北被尸潮冲散了，\n我一个人带着电台跑出来，信号断断续续——但刚才，我接到了一段广播。', enterDelay:500},
    {npc:'zhao',  text:'（他从背包里掏出电台，调频）\n听——', enterDelay:400},
    {npc:'radio', text:'【军方广播】……撤离行动已启动……直升机编队已起飞……预计15分钟抵达城西……请清除着陆区……', enterDelay:500},
    {npc:'zhao',  text:'听到了吗？第十五天，直升机来接人。\n但我需要个地方架天线——你们这儿地势高，正合适。', enterDelay:500},
    {npc:'ming',  text:'留下。我们现在就缺你这个。\n（握住他的手）欢迎入伙，小赵。\n天线你想架哪都行。'},
    {npc:'zhang', text:'五个人了。\n（老兵张站起来，看着远方）\n够了。最后一波，我们五个一起上。', enterDelay:500},
    {npc:'ming',  text:'（站起身，检查枪膛）\n十五天，十五波。\n今天就结束了。'},
  ],
};

const BOSS_INTROS = [
  // Boss 0 — 暴君变异体（巨型冲撞型）第5波
  { lines:[
    {npc:'ming',  text:'这玩意儿……三米高，全是肌肉。冲过来能把石墙撞碎。\n（冷笑）正好，我手痒。'},
    {npc:'boss1', text:'（低沉嘶吼）……腥……血……', enterDelay:400},
    {npc:'zhang', text:'不能硬接。等它冲锋时闪开，让它撞墙——然后打背。\n这是老兵的经验，记住了。', enterDelay:600},
    {npc:'ming',  text:'不用教。\n（举枪）我来。'},
  ]},
  // Boss 1 — 喷吐者（远程酸液型）第10波
  { lines:[
    {npc:'ming',  text:'远处那个……嘴里在喷酸液？射程比我的枪还远。\n（拉枪栓）那就贴脸打。'},
    {npc:'boss2', text:'（嘶嘶声）……腐蚀……一切……', enterDelay:400},
    {npc:'qiang', text:'远程压制。用射程更长的武器，或者贴脸近战——\n别让它一直喷墙！铁墙也扛不住酸液！', enterDelay:600},
    {npc:'ming',  text:'明白。\n（举枪）它喷一次，我打十枪。'},
  ]},
  // Boss 2 — 尸王（最终Boss·综合型）第15波
  { lines:[
    {npc:'ming',  text:'这就是尸王？……比楼还高。身上挂着几十个感染者。\n（深吸一口气）最后一战。'},
    {npc:'boss3', text:'（震耳欲聋的咆哮）', enterDelay:400},
    {npc:'zhao',  text:'直升机还有几分钟。机长说他会等——但这是最后一班！\n所有人，准备最后一战！', enterDelay:600},
    {npc:'ming',  text:'十五天，十五波尸潮。今天就结束了。\n（举枪）干掉它，清理着陆区——回家！'},
  ]},
];

// ── Story engine state ────────────────────────────────────
let storySceneIdx = 0;
let typewriterTimer = null;
let typewriterDone = false;

// ── Typewriter effect ────────────────────────────────────
function typewrite(el, text, speed, onDone){
  clearTimeout(typewriterTimer);
  el.textContent = '';
  typewriterDone = false;
  let i = 0;
  function next(){
    if(i <= text.length){
      el.textContent = text.slice(0, i);
      i++;
      typewriterTimer = setTimeout(next, speed);
    } else {
      typewriterDone = true;
      if(onDone) onDone();
    }
  }
  next();
}
function typewriteInstant(el, text){
  clearTimeout(typewriterTimer);
  el.textContent = text;
  typewriterDone = true;
}

// ── Show story intro scene ────────────────────────────────
function showStoryScene(idx){
  const s = STORY_SCENES[idx];
  if(!s){ // All scenes done → go to main menu
    document.getElementById('story-intro-scr').style.display = 'none';
    showMainMenu();
    return;
  }
  document.getElementById('story-chapter-label').textContent = s.chapter;
  document.getElementById('story-title-text').textContent = s.title;
  const tw = document.getElementById('story-typewriter');
  const btn = document.getElementById('story-next-btn');
  btn.style.display = 'none';
  typewrite(tw, s.text, 28, ()=>{
    btn.style.display = 'inline-block';
    btn.textContent = idx < STORY_SCENES.length - 1 ? '继续 ▶' : '迎接命运 ▶';
  });
}
function storyNext(){
  if(!typewriterDone){
    // Fast-finish current text
    typewriteInstant(document.getElementById('story-typewriter'), STORY_SCENES[storySceneIdx].text);
    document.getElementById('story-next-btn').style.display = 'inline-block';
    return;
  }
  storySceneIdx++;
  showStoryScene(storySceneIdx);
}
function storySkip(){
  clearTimeout(typewriterTimer);
  document.getElementById('story-intro-scr').style.display = 'none';
  showMainMenu();
}

// ── Legacy dialogue-box purged (dialogues unified to wave-dlg-bar & showCinematic) ──
let dlgActive = false;
function closeDlg(){ dlgActive = false; }

// ── Trigger wave dialogue ────────────────────────────────
function triggerWaveDlg(waveNum, onDone){
  const lines = WAVE_DIALOGUES[waveNum];
  if(lines) showCinematic(lines, onDone);
  else if(onDone) onDone();
}
// ── Trigger boss intro dialogue ──────────────────────────
function triggerBossIntro(bossTypeIdx, onDone){
  const data = BOSS_INTROS[bossTypeIdx % BOSS_INTROS.length];
  if(data) showCinematic(data.lines, onDone);
  else if(onDone) onDone();
}

// ═══════════════════════════════════════════



