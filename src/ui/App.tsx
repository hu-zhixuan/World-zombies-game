import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import {
  CLASSES, DIFFICULTIES, DIFFICULTY_ORDER, DRINKS, FORT_LEVELS, FORT_REPAIR_COST, GUEST_SUPPORTS, LAST_DAY, MAX_DISH_LV, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAL_ORDER, MEAT_ORDER, RARITY_NAME, RARITY_TIER_COLOR, RYE_FALLBACK, SEAT_UPGRADE_ORDER, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST,
  STAR_COST, STAR_PERKS, TAVERN_UPGRADES, TAVERN_UPGRADE_ORDER, TURRETS, WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, WEATHERS, ZOMBIES,
  classUnlockStars, newZombieOn, nextUnlock, partyForDay, perkDef, sustainedDps, unlockName,
  type TurretType, type WeaponId,
} from '../content/data';
import {
  ALLIES, ALLY_ORDER, CHAPTER_CARDS, CINEMATIC_INTRO, COMPANION_JOIN_STORIES, QUALITY_META, REST_STORY, STORY_SCENES, VIP_CUSTOMERS,
  type RestStoryKey, type StorySceneKey,
} from '../content/story';
import {
  MAX_CARRY, computeTomorrowBattleBuff, crateSalvageCoins, dayRemaining, dinerRank, dishLevel, dishPrice, dishXp, dishXpTarget, formatRecipeCost, hasAlly, hasIngredients, hasTavernUpgrade, houseBuff,
  meatPrice, nearbyCampTarget, pourQuality, shopReplaceRefund, tavernUpgradeCost, turretBuildCost, turretRefundCoins, turretUpgradeCost, vipSupportKind,
} from '../sim/sim';
import { TURRET_SLOTS, type GameEvent, type TurretTargetMode } from '../sim/types';
import { CampBar, CampKeys, GroundLootTags, Keys, Pad, PickupBar, WeaponChip } from './controls';
import { Bar, Btn, Chip, Icon, NpcPortrait, Panel, Stars } from './parts';

function StorySceneView(p: { scene?: StorySceneKey }) {
  const sc: StorySceneKey = p.scene ?? 'rooftop';
  return (
    <div class="scene-art" data-scene={sc}>
      <span class="sc-sky" />
      <span class="sc-town" />
      <span class="sc-tint" />
      <span class="sc-ground" />
      <span class="sc-house" />
      <span class="sc-actor-hero" />
      <span class="sc-actor-side" />
    </div>
  );
}

function Hud() {
  const run = game.run, p = run.player;
  const boss = run.zombies.find((z) => ZOMBIES[z.kind].boss);
  const fresh = run.phase === 'camp' ? newZombieOn(run.day + 1) : null;
  const wallUp = run.wall.hp > 0;
  const defRatio = wallUp ? run.wall.hp / run.wall.maxHp : run.home.hp / run.home.maxHp;
  const defLabel = wallUp ? `防线 ${run.wall.hp}` : `大屋 ${run.home.hp}`;
  const diffName = DIFFICULTIES[run.difficulty ?? 'normal'].name;
  const weatherTag = !run.inside && run.phase !== 'camp' && run.weather && run.weather !== 'clear'
    ? ` · ${WEATHERS[run.weather].short}`
    : '';

  return (
    <header class="hud">
      <div class="hud-left">
        <Chip icon="ic_hp" id="hud-hp">
          <Bar v={p.hp / p.maxHp} />{Math.ceil(p.hp)}{p.armor > 0 ? ` +${Math.ceil(p.armor)}甲` : ''}
        </Chip>
        <Chip icon={wallUp ? 'ic_wall' : 'ic_fort'} id="hud-wall">
          <Bar cls={wallUp ? 'wall' : 'fort'} v={defRatio} />{defLabel}
        </Chip>
        {run.perks.length > 0 && <div class="perks" id="hud-perks">{run.perks.map((id) => <Icon key={id} k={perkDef(id).icon} />)}</div>}
      </div>

      <div class="hud-mid">
        <Chip id="hud-day">
          {run.endless
            ? `无尽·第${run.day}夜·${run.inside ? '酒馆' : '猎场'}${weatherTag}`
            : `${diffName}·${run.phase === 'camp' ? `第${run.day}夜·${run.inside ? '酒馆' : '外院'}` : `第${run.day}/${LAST_DAY}天${weatherTag}`}`}
        </Chip>
        {boss ? (
          <Chip cls="boss" id="hud-left">
            {ZOMBIES[boss.kind].name.split('·')[0]} <Bar cls="boss" v={boss.hp / boss.maxHp} />
          </Chip>
        ) : run.phase === 'camp' ? (
          <Chip cls="tag" id="hud-left">{fresh ? `明晚:${fresh.name}` : '休整之夜'}</Chip>
        ) : (
          <Chip icon="ic_zombie" id="hud-left">{run.phase === 'clear' ? '清场！' : `剩 ${dayRemaining(run)}`}</Chip>
        )}
      </div>

      <div class="hud-right">
        <Chip icon="ic_coin" id="hud-coins">{run.coins}</Chip>
        <Chip icon="ic_meat" id="hud-meat">
          <b>{run.meats.tender}</b>/<b>{run.meats.thick}</b>/<b>{run.meats.essence}</b>
        </Chip>
        <button class={`btn-icon ${audio.muted ? 'muted' : ''}`} id="btn-mute" onClick={() => game.toggleMute()}>{audio.muted ? '静音' : '音效'}</button>
        <button class="btn-icon" id="btn-pause" onClick={() => game.open('pause')}>暂停</button>
      </div>
    </header>
  );
}

function HouseBadge() {
  const run = game.run;
  if (run.inside) return null;
  const hb = houseBuff(run);
  const zoneText = hb.zone === 'roof'
    ? `${hb.name} · 伤+${Math.round((hb.dmgMul - 1) * 100)}%`
    : hb.zone === 'porch'
      ? `${hb.name} · 伤+12%`
      : '前院地面';
  const c = run.diner.contract;
  const contractText = c && run.phase === 'fight'
    ? (c.done ? ` · ${c.title}达成` : ` · ${c.title} ${c.progress}/${c.target}`)
    : '';
  const buffText = run.buff.dmgMul > 0 ? ` · 战备+${Math.round(run.buff.dmgMul * 100)}%` : '';
  return (
    <div class="house-badge" id="hud-house" data-zone={hb.zone}>
      <Icon k="ic_rooftop" />
      <span>{zoneText}{buffText}{contractText}</span>
    </div>
  );
}

/** 局外成长：星星、下一解锁与跨局酒馆传承 */
function Progress(p: { gain?: number }) {
  const stars = game.meta.stars, next = nextUnlock(stars);
  const vipCount = game.meta.metVips?.length ?? 0;
  const decorCount = game.meta.unlockedDecor?.length ?? 0;
  return (
    <div class="note" id="meta-progress">
      <Icon k="ic_star" />{p.gain !== undefined && <><b>+{p.gain}</b> · </>}星星 <b>{stars}</b>
      {next ? <> · {next.stars}★解锁 {unlockName(next)}</> : <> · 全部解锁</>}
      {(vipCount > 0 || decorCount > 0) && <> · 熟客档案 {vipCount}/15 · 图纸 {decorCount}/5</>}
    </div>
  );
}

const Purse = () => (
  <div class="purse">
    <Chip icon="ic_coin">{game.run.coins}</Chip>
    <Chip icon="ic_meat">{game.run.meats.tender}/{game.run.meats.thick}/{game.run.meats.essence}</Chip>
  </div>
);


/** 剧情对话弹窗（有场景图时左图右文，平常对话仅保留人物立绘与台词） */
function StoryPanel() {
  const q = game.storyQueue;
  if (!q.length) return null;
  const cur = q[0], total = q.length;
  return (
    <Panel id="panel-story" cls={`story-panel ${cur.line.scene ? 'wide' : ''}`} title={cur.title}>
      <div class={cur.line.scene ? 'story-split' : 'story-solo'}>
        {cur.line.scene && (
          <div class="story-visual">
            <StorySceneView scene={cur.line.scene} />
          </div>
        )}
        <div class="story-stage">
          <NpcPortrait avatar={cur.line.avatar} initial={cur.line.initial} cls="lg" />
          <div class="story-body">
            <div class="story-speaker">
              <strong>{cur.line.name}</strong>
              {cur.line.role && <span class="story-role">{cur.line.role}</span>}
            </div>
            <p class="story-text">{cur.line.text}</p>
          </div>
        </div>
      </div>
      <div class="story-actions">
        <Btn id="btn-story-skip" kind="ghost" onClick={() => game.skipStory()}>跳过</Btn>
        <Btn id="btn-story-next" kind="primary" onClick={() => game.nextStory()}>
          {total > 1 ? '下一句' : game.run.phase === 'camp' ? '好的' : '进入战局'}
        </Btn>
      </div>
    </Panel>
  );
}

/** 突围手札：前情 / 章节 / 战友 */
function LorePanel() {
  const [tab, setTab] = useState<'intro' | 'chapters' | 'allies'>('intro');
  const [sceneIdx, setSceneIdx] = useState(0);
  const run = game.run;
  const scene = STORY_SCENES[sceneIdx] ?? STORY_SCENES[0];

  return (
    <Panel id="panel-lore" cls="wide" title="突围手札 · 小胡反叛录" head={<Btn id="btn-close" kind="primary" onClick={() => game.close()}>返回</Btn>}>
      <div class="diner-tabs">
        <button id="tab-lore-intro" class={`tab-btn ${tab === 'intro' ? 'on' : ''}`} onClick={() => setTab('intro')}>序章前情</button>
        <button id="tab-lore-chapters" class={`tab-btn ${tab === 'chapters' ? 'on' : ''}`} onClick={() => setTab('chapters')}>突围脉络</button>
        <button id="tab-lore-allies" class={`tab-btn ${tab === 'allies' ? 'on' : ''}`} onClick={() => setTab('allies')}>反叛同袍 ({run.story.allies.length}/4)</button>
        {tab === 'intro' && game.started && (
          <Btn id="btn-replay-intro" kind="small" cls="tab-right" onClick={() => { game.close(); game.enqueueStory('序幕 · 逆夜突围', CINEMATIC_INTRO, true); }}>
            重温序幕
          </Btn>
        )}
      </div>

      {tab === 'intro' && (
        <div class="lore-intro">
          <div class="lore-storyboard">
            <StorySceneView scene={scene.sceneKey} />
            <div class="lore-scene-box">
              <strong>{scene.chapter} · {scene.title}</strong>
              <p>{scene.text}</p>
              <div class="lore-nav">
                <Btn id="btn-scene-prev" kind="small" disabled={sceneIdx <= 0} onClick={() => setSceneIdx((i) => Math.max(0, i - 1))}>上一幕</Btn>
                <span class="lore-idx">{sceneIdx + 1} / {STORY_SCENES.length}</span>
                <Btn id="btn-scene-next" kind="small" disabled={sceneIdx >= STORY_SCENES.length - 1} onClick={() => setSceneIdx((i) => Math.min(STORY_SCENES.length - 1, i + 1))}>下一幕</Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'chapters' && (
        <div class="cols2 lore-grid">
          {CHAPTER_CARDS.map((ch) => {
            const active = game.started && run.day >= ch.minDay && run.day <= ch.maxDay;
            const cleared = game.started && run.day > ch.maxDay;
            return (
              <div class={`item lore-card ${active ? 'on' : ''}`} key={ch.chapter}>
                <div class="grow">
                  <div class="card-top">
                    <b>{ch.chapter} · {ch.title}</b>
                    <em>{active ? '进行中' : cleared ? '已度过' : ch.sub}</em>
                  </div>
                  <small class="wrap">{ch.text}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'allies' && (
        <div class="cols2 lore-grid">
          {ALLY_ORDER.map((id) => {
            const a = ALLIES[id], joined = hasAlly(run, id);
            return (
              <div class={`item lore-card ${joined ? 'on' : ''}`} key={id}>
                <NpcPortrait avatar={a.sprite} initial={a.initial} cls="sm" />
                <div class="grow">
                  <div class="card-top">
                    <b>{a.name}</b>
                    <em>{joined ? '已入驻' : `第${a.joinDay}天`}</em>
                  </div>
                  <small class="wrap">{a.buffDesc}</small>
                </div>
                {game.started && joined && (
                  <Btn id={`btn-ally-story-${id}`} kind="small" onClick={() => {
                    const j = COMPANION_JOIN_STORIES[a.joinDay];
                    if (j) game.enqueueStory(`${a.name} · 入伙前情`, j.lines, true);
                  }}>回看</Btn>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function PerkPanel() {
  const run = game.run;
  return (
    <Panel id="panel-perk" title={`第 ${run.day} 天清场`}>
      <div class="row">
        {run.perkChoices.map((id) => {
          const perk = perkDef(id);
          return (
            <button class="card" key={id} data-perk={id} data-rarity={perk.rarity} onClick={() => game.send({ t: 'pickPerk', id })}>
              <Icon k={perk.icon} cls="x3" /><strong>{perk.name}</strong><em>{RARITY_NAME[perk.rarity]}</em><span>{perk.desc}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/** 出战选择：极简难度切换 + 职业 */
function ClassPanel() {
  const stars = game.meta.stars;
  const selDiff = game.selectedDifficulty;
  return (
    <Panel id="panel-class" title="选择出战">
      <div class="diff-picker" id="diff-picker">
        <span class="diff-lbl">难度</span>
        {DIFFICULTY_ORDER.map((id) => {
          const d = DIFFICULTIES[id], on = selDiff === id;
          return (
            <button key={id} id={`btn-diff-${id}`} data-diff={id} class={`diff-btn ${on ? 'on' : ''}`} onClick={() => game.setDifficulty(id)}>
              {d.name}
            </button>
          );
        })}
      </div>
      <div class="row">
        {Object.values(CLASSES).map((c) => {
          const need = classUnlockStars(c.id) ?? 0;
          const lock = c.comingSoon ?? (stars < need ? `${need}★ 解锁` : '');
          return (
            <button class="card" key={c.id} data-class={c.id} disabled={!!lock} onClick={() => game.restart(c.id, selDiff)}>
              <Icon k={c.icon} cls="x3" /><strong>{c.name}</strong>
              <span>{c.passive}</span><small>{c.skill}：{c.skillDesc}</small>
              {lock && <u>{lock}</u>}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/** 暮夜酒馆：清晰分为「备菜招待 / 酒馆升级 / 熟客录」三页，每页只做一件事、零杂物 */
function KitchenPanel() {
  const run = game.run;
  const [tab, setTab] = useState<'dine' | 'upg' | 'vip'>('dine');

  const fansRank = dinerRank(run);
  const tenderPrice = meatPrice(run.cls, 'tender');
  const thickPrice = meatPrice(run.cls, 'thick');
  const essencePrice = meatPrice(run.cls, 'essence');
  const totalSellVal = run.meats.tender * tenderPrice + run.meats.thick * thickPrice + run.meats.essence * essencePrice;
  const fansProgress = fansRank.next
    ? Math.max(0, run.diner.fans - fansRank.cur.minFans) / Math.max(1, fansRank.next.minFans - fansRank.cur.minFans)
    : 1;

  const sellAllMeats = () => {
    for (const k of MEAT_ORDER) {
      if (game.run.meats[k] > 0) game.send({ t: 'sellMeatKind', kind: k, count: game.run.meats[k] });
    }
  };

  const tBuff = computeTomorrowBattleBuff(run);
  const feastDishes = run.diner.feastDishes ?? [];
  const extraCrates = run.diner.extraCrates ?? 0;
  const buffPills: string[] = [];
  if (tBuff.dmgMul > 0) buffPills.push(`枪伤+${Math.round(tBuff.dmgMul * 100)}%`);
  if (tBuff.haste > 0) buffPills.push(`攻速+${Math.round(tBuff.haste * 100)}%`);
  if (tBuff.turretMul > 0) buffPills.push(`炮塔+${Math.round(tBuff.turretMul * 100)}%`);
  if (tBuff.critBonus > 0) buffPills.push(`暴击+${Math.round(tBuff.critBonus * 100)}%`);
  if (tBuff.frostRounds) buffPills.push('寒霜弹');
  if (run.diner.smithDiscount) buffPills.push('造塔85折');
  if (extraCrates > 0) buffPills.push(`空投+${extraCrates}`);
  if (run.diner.allyFuryNext) buffPills.push('战友狂飙');

  const canFeastAny = run.guests.some((g) => !g.served && (g.orderKind === 'drink' || hasIngredients(run, MEALS[g.dish].cost)))
    || (!feastDishes.length && MEAL_ORDER.some((id) => hasIngredients(run, MEALS[id].cost)));
  const contract = run.diner.contract;
  const seatUid = !hasTavernUpgrade(run, SEAT_UPGRADE_ORDER[0]) ? SEAT_UPGRADE_ORDER[0] : SEAT_UPGRADE_ORDER[1];
  const upgIds = [seatUid, ...TAVERN_UPGRADE_ORDER];
  const canUpgradeCount = upgIds.filter((uid) => !hasTavernUpgrade(run, uid) && run.coins >= tavernUpgradeCost(run, uid)).length;

  return (
    <Panel id="panel-kitchen" cls="wide" title="暮夜酒馆" head={
      <div class="diner-head-right">
        <div class="diner-tabs">
          <button id="tab-kitchen-dine" class={`tab-btn ${tab === 'dine' ? 'on' : ''}`} onClick={() => setTab('dine')}>备菜招待</button>
          <button id="tab-kitchen-upg" class={`tab-btn ${tab === 'upg' ? 'on' : ''}`} onClick={() => setTab('upg')}>
            酒馆升级{canUpgradeCount > 0 ? ` (${canUpgradeCount})` : ''}
          </button>
          <button id="tab-kitchen-vip" class={`tab-btn ${tab === 'vip' ? 'on' : ''}`} onClick={() => setTab('vip')}>熟客录 ({run.diner.metVips.length}/15)</button>
        </div>
        <Purse />
        <Btn id="btn-close" kind="primary" onClick={() => game.close()}>返回</Btn>
      </div>
    }>
      {tab === 'dine' && (
        <>
          <div class="diner-ribbon war-ribbon">
            <span id="tavern-battle-buffs" class="war-buff-summary">
              <b>明日战备：</b>{buffPills.length > 0 ? buffPills.join(' · ') : '上菜或烹制料理即可叠加明日火力'}
            </span>
            <div class="war-ribbon-acts">
              <Btn kind="small" id="btn-feast-all" disabled={!canFeastAny} onClick={() => game.send({ t: 'feastAll' })}>一键犒赏</Btn>
              <Btn kind="primary" cls="small" id="btn-kitchen-shift"
                onClick={() => {
                  if (run.dinerShift.mode === 'open') { game.send({ t: 'closeShift' }); game.close(); }
                  else { game.send({ t: 'startShift' }); game.close(); }
                }}>
                {run.dinerShift.mode === 'open' ? '提前打烊' : '开张营业'}
              </Btn>
            </div>
          </div>

          <div class="cols2 war-tavern-split">
            <div class="box war-guest-box">
              <div class="section-title">
                <span>今夜来客 ({run.guests.filter((g) => g.served).length}/{run.guests.length})</span>
                <small>点头像聊剧情</small>
              </div>
              <div class="war-guest-list">
                {run.guests.slice(0, 3).map((g, i) => {
                  const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId);
                  const sk = g.supportKind ?? vipSupportKind(g.vipId);
                  const sup = GUEST_SUPPORTS[sk];
                  const isDrink = g.orderKind === 'drink';
                  const dishIcon = isDrink && g.drink ? DRINKS[g.drink].icon : (g.isRye ? RYE_FALLBACK.icon : MEALS[g.dish].icon);
                  const mealDef = MEALS[g.dish];
                  const canServe = isDrink || (run.diner.menuStock[g.dish] ?? 0) > 0 || hasIngredients(run, mealDef.cost);
                  return (
                    <div class={`item war-guest-card ${g.served ? 'served' : ''}`} key={g.id}>
                      <button id={`btn-guest-story-${i}`} class="guest-avatar-btn" title="查看熟客对话"
                        onClick={() => { if (vip && vip.firstMeet.length > 0) game.enqueueStory(`${g.name} · 初遇`, vip.firstMeet, true); }}>
                        <NpcPortrait avatar={g.sprite} initial={g.name[0]} cls="xs" />
                      </button>
                      <div class="grow">
                        <div class="card-top">
                          <b>{g.name}</b>
                          <em class={`support-badge sup-${sk}`}>{sup.shortTag}</em>
                          <small class="pay-tag">+{g.pay}金</small>
                        </div>
                        <small class="guest-order-line">
                          <Icon k={dishIcon} />
                          <span>{g.dishName}{!isDrink ? ` (${formatRecipeCost(mealDef.cost)})` : ''}</span>
                        </small>
                      </div>
                      <Btn kind="small" id={`btn-serve-${i}`} disabled={g.served || !canServe}
                        onClick={() => game.send({ t: 'serveGuest', guestId: g.id, quality: 'good' })}>
                        {g.served ? '已援' : '上菜'}
                      </Btn>
                    </div>
                  );
                })}
              </div>
            </div>

            <div class="box war-meal-box">
              <div class="section-title">
                <span>战备料理 ({feastDishes.length}/3)</span>
                <small>越做越精自动升招牌</small>
              </div>
              <div class="war-meal-grid">
                {MEAL_ORDER.map((id) => {
                  const m = MEALS[id];
                  const lv = dishLevel(run, id);
                  const xp = dishXp(run, id);
                  const need = dishXpTarget(lv);
                  const isMaxLv = lv >= MAX_DISH_LV;
                  const activeInFeast = feastDishes.includes(id);
                  const canEat = !activeInFeast && hasIngredients(run, m.cost);
                  const prog = isMaxLv ? 1 : Math.min(1, xp / Math.max(1, need));
                  return (
                    <div class={`item war-meal-card ${activeInFeast ? 'active' : ''}`} key={id} title={`${m.desc}（售 ${dishPrice(run, id)} 金）`}>
                      <div class="recipe-top">
                        <Icon k={m.icon} />
                        <b>{m.name}</b>
                        <em class="dish-lv">{isMaxLv ? '绝活' : `Lv.${lv}`}</em>
                      </div>
                      <div class="war-meal-foot">
                        <span class="meal-cost">{formatRecipeCost(m.cost)}</span>
                        <u class="battle-tag">{m.battleTag}</u>
                        <Btn kind="small" id={`btn-meal-${id}`} cls={activeInFeast ? 'menu-on' : ''} disabled={!canEat}
                          onClick={() => game.send({ t: 'pickMeal', id, quality: 'good' })}>
                          {activeInFeast ? '已备' : '烹制'}
                        </Btn>
                      </div>
                      <span class="meal-xp-bar"><i ref={(el) => { el?.style.setProperty('--p', prog.toFixed(2)); }} /></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'upg' && (
        <>
          <div class="upg-grid">
            {upgIds.map((uid, idx) => {
              const u = TAVERN_UPGRADES[uid], own = hasTavernUpgrade(run, uid);
              const cost = tavernUpgradeCost(run, uid);
              const btnId = idx === 0 ? 'btn-tavern-seats' : `btn-tavern-${uid}`;
              return (
                <div class={`upg-card ${own ? 'own' : ''}`} key={uid}>
                  <Icon k={u.icon} cls="x2" />
                  <div class="upg-card-body">
                    <div class="upg-card-top">
                      <b>{u.name}</b>
                      <u class="battle-tag">{u.battleTag}</u>
                    </div>
                    <small>{u.desc}</small>
                  </div>
                  <Btn kind={own ? 'small' : 'primary'} cls="small" id={btnId} disabled={own || run.coins < cost}
                    onClick={() => game.send({ t: 'buyTavernUpgrade', id: uid })}>
                    {own ? '已建成' : `${cost}金`}
                  </Btn>
                </div>
              );
            })}
          </div>

          <div class="upg-footer">
            <span id="tavern-contract" class="war-contract-pill">
              {contract ? (
                <><b>猎令·{contract.title}</b> {contract.done ? `已达成 (+${contract.coins}金)` : `${contract.desc} (${contract.progress}/${contract.target})`}</>
              ) : (
                <><b>防线</b> {run.wall.hp}/{run.wall.maxHp} · <b>大屋</b> {run.home.hp}/{run.home.maxHp}</>
              )}
            </span>
            <Btn kind="small" id="btn-cook-all" disabled={totalSellVal <= 0} onClick={sellAllMeats}>
              余肉换金 (+{totalSellVal}金)
            </Btn>
          </div>
        </>
      )}

      {tab === 'vip' && (
        <div class="cols2 vip-split">
          <div class="box">
            <div class="section-title"><span>15 位暮夜熟客 · 战场支援名录</span></div>
            <div class="vip-grid">
              {VIP_CUSTOMERS.map((v) => {
                const met = run.diner.metVips.includes(v.id);
                const unlocked = run.diner.fans >= v.unlockFans;
                const shortName = v.name.split('·').pop() ?? v.name;
                const sk = vipSupportKind(v.id);
                return (
                  <button key={v.id} id={`btn-vip-${v.id}`} class={`vip-cell ${met ? 'met' : unlocked ? 'open' : 'lock'}`}
                    disabled={!met && !unlocked}
                    onClick={() => game.enqueueStory(`${v.name} · 食客档案`, v.firstMeet, true)}>
                    <NpcPortrait avatar={v.sprite} initial={shortName[0]} cls="xs" />
                    <b>{shortName}</b>
                    <small>{met ? GUEST_SUPPORTS[sk].roleName : unlocked ? '待到访' : `${v.unlockFans}粉`}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div class="box">
            <div class="fans-box">
              <div class="card-top">
                <b>{fansRank.cur.grade}级 · {fansRank.cur.name}</b>
                <small>{fansRank.next ? `晋升 ${fansRank.next.grade}级 解锁高阶熟客` : '已达最高段位'}</small>
              </div>
              <Bar cls="fort" v={fansProgress} />
              {fansRank.next ? (
                <div class="rank-gates">
                  <span class={run.diner.fans >= fansRank.next.minFans ? 'gate ok' : 'gate'}>
                    口碑 {run.diner.fans}/{fansRank.next.minFans}
                  </span>
                  <span class={run.diner.bestTaste >= fansRank.next.minTaste ? 'gate ok' : 'gate'}>
                    美味 {run.diner.bestTaste}/{fansRank.next.minTaste}
                  </span>
                  <span class="gate ok">
                    战备菜 {MEAL_ORDER.length}/{MEAL_ORDER.length}
                  </span>
                </div>
              ) : (
                <small>全战备菜谱已贯通 · 最高美味 {run.diner.bestTaste}</small>
              )}
              {run.story.seenEvents.length > 0 && (
                <div class="milestone-pills">
                  {(run.story.seenEvents.filter((k): k is RestStoryKey => k in REST_STORY)).map((k) => (
                    <button key={k} class="mini-story-btn" onClick={() => game.enqueueStory(REST_STORY[k].title, REST_STORY[k].lines, true)}>
                      {REST_STORY[k].title.split('·')[1] ?? REST_STORY[k].title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div class="section-title"><span>熟客战地留言</span></div>
            <div class="review-list">
              {run.diner.reviews.length === 0 ? (
                <small class="lore-tip">招待食客后将在此记录战地口信与支援回馈</small>
              ) : run.diner.reviews.slice(0, 3).map((rv) => (
                <div class="review-item" key={rv.id}>
                  <div class="card-top">
                    <b>{rv.author} · {rv.dishName}</b>
                    <em>{QUALITY_META[rv.quality].label} +{rv.fansDelta}粉</em>
                  </div>
                  <small class="wrap">{rv.text}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

/** 拾取地面兵器：满槽时由玩家点选替换哪一槽（元气骑士式），也可原地拆金或放回地上 */
function WeaponSwapPanel() {
  const run = game.run, p = run.player;
  const c = game.pendingSwapCrateId != null
    ? run.crates.find((o) => o.id === game.pendingSwapCrateId && o.kind !== 'supply')
    : undefined;
  if (!c) {
    return (
      <Panel id="panel-weapon-swap" title="地上兵器已收起"
        head={<Btn id="btn-swap-cancel" kind="primary" onClick={() => game.close()}>继续战斗</Btn>}>
        <div class="swap-empty">这件兵器已被拾取或消失。</div>
      </Panel>
    );
  }
  const def = WEAPONS[c.weapon];
  const star = c.star ?? 1;
  const salvage = crateSalvageCoins(c);
  return (
    <Panel id="panel-weapon-swap" title="选择替换兵器槽位" sub="换下的旧兵器会完整掉回地面，可随时捡回或拆金">
      <div class="swap-panel">
        <div class="swap-ground" data-rarity={def.rarity}>
          <Icon k={def.icon} cls="x2" />
          <div class="swap-ground-info">
            <span class="swap-ground-head">
              <em class="rarity-pill" data-rarity={def.rarity}>{RARITY_TIER_COLOR[def.rarity]} · {RARITY_NAME[def.rarity]}</em>
              <strong>{def.name}{star > 1 ? ` ★${star}` : ''}</strong>
            </span>
            <small>{def.trait} · {def.desc}</small>
          </div>
        </div>

        <p class="swap-hint">携行已满（{p.weapons.length}/{MAX_CARRY}），点选要替换的武器槽位：</p>
        <div class="swap-slots">
          {[0, 1].map((idx) => {
            const w = p.weapons[idx];
            if (!w) return null;
            const wDef = WEAPONS[w.id];
            return (
              <button key={idx} type="button" class={`swap-slot ${idx === p.cur ? 'cur' : ''}`} id={`btn-swap-slot-${idx}`} data-rarity={wDef.rarity}
                onClick={() => { game.send({ t: 'pickupCrate', crateId: c.id, replaceIndex: idx }); game.close(); }}>
                <span class="swap-slot-idx">槽位 {idx + 1}{idx === p.cur ? ' · 手持' : ''}</span>
                <Icon k={wDef.icon} />
                <span class="swap-slot-meta">
                  <b>{wDef.name} ★{w.star}</b>
                  <small>{RARITY_TIER_COLOR[wDef.rarity]} · {RARITY_NAME[wDef.rarity]} · 点击替换</small>
                </span>
              </button>
            );
          })}
        </div>

        <div class="row">
          <Btn id="btn-swap-salvage" kind="ghost" onClick={() => { game.send({ t: 'salvageCrate', crateId: c.id }); game.close(); }}>
            原地拆金 +{salvage}金
          </Btn>
          <Btn id="btn-swap-cancel" kind="primary" onClick={() => game.close()}>
            暂不拾取（留地上）
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

/** 酒馆军械行商 */
function ShopPanel() {
  const run = game.run, p = run.player;
  const [swapPick, setSwapPick] = useState<WeaponId | null>(null);
  const activeSwapPick = swapPick && run.shop.includes(swapPick) && !p.weapons.some((w) => w.id === swapPick) && p.weapons.length >= MAX_CARRY
    ? swapPick
    : null;
  return (
    <Panel id="panel-shop" cls="wide" title="军械行商"
      head={<><Btn kind="small" id="btn-reroll" disabled={run.coins < SHOP_REROLL_COST} onClick={() => { setSwapPick(null); game.send({ t: 'rerollShop' }); }}>换一批 {SHOP_REROLL_COST}金</Btn><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>关门</Btn></>}>
      <div class="row">
        {run.shop.map((id) => {
          const def = WEAPONS[id], owned = p.weapons.find((w) => w.id === id);
          const isMax = !!owned && owned.star >= MAX_STAR;
          const cost = owned ? STAR_COST[owned.star] : def.price;
          const nextStar = owned ? Math.min(MAX_STAR, owned.star + 1) : 1;
          const dps = Math.round(sustainedDps(def, nextStar));
          const needSlotPick = !owned && !isMax && p.weapons.length >= MAX_CARRY;
          return (
            <button class={`card ${activeSwapPick === id ? 'picking' : ''}`} key={id} id={`btn-shop-${id}`} data-rarity={def.rarity} disabled={isMax || run.coins < cost}
              onClick={() => {
                if (needSlotPick) setSwapPick(activeSwapPick === id ? null : id);
                else { setSwapPick(null); game.send({ t: 'buyWeapon', weapon: id }); }
              }}>
              <Icon k={def.icon} cls="x2" />
              <strong>{def.name}</strong>
              <em>{RARITY_TIER_COLOR[def.rarity]}·{RARITY_NAME[def.rarity]} · {def.trait}</em>
              <span>{def.desc}</span>
              <small>秒伤 {dps} · 射程 {def.range}</small>
              <u>{isMax ? '满星' : owned ? `升 ★${owned.star + 1} (${cost}金)` : needSlotPick ? `选槽替换 (${cost}金)` : `购入 (${cost}金)`}</u>
            </button>
          );
        })}
      </div>

      {activeSwapPick && (
        <div class="shop-swap-box" id="shop-swap-box" data-rarity={WEAPONS[activeSwapPick].rarity}>
          <span class="shop-swap-title">将 <b>{WEAPONS[activeSwapPick].name}</b> 放入哪个槽位？（换下的旧兵器按折抵金退还）</span>
          <div class="shop-swap-btns">
            {p.weapons.map((w, idx) => {
              const oldDef = WEAPONS[w.id];
              return (
                <button key={idx} type="button" class="swap-slot mini" id={`btn-shop-replace-${idx}`} data-rarity={oldDef.rarity}
                  onClick={() => { game.send({ t: 'buyWeapon', weapon: activeSwapPick, replaceIndex: idx }); setSwapPick(null); }}>
                  <Icon k={oldDef.icon} />
                  <span>槽{idx + 1} · {oldDef.name} ★{w.star}</span>
                  <small>替换 (+{shopReplaceRefund(w.id, w.star)}金)</small>
                </button>
              );
            })}
            <Btn kind="small" id="btn-shop-replace-cancel" onClick={() => setSwapPick(null)}>取消</Btn>
          </div>
        </div>
      )}

      <div class="supply-row">
        <Btn kind="small" id="btn-buy-grenade" disabled={p.grenades >= MAX_GRENADES || run.coins < SHOP_GRENADE_COST} onClick={() => game.send({ t: 'buySupply', item: 'grenade' })}>
          <Icon k="ic_grenade" />爆炎弹 +2 ({SHOP_GRENADE_COST}金) · {p.grenades}/{MAX_GRENADES}
        </Btn>
        <Btn kind="small" id="btn-buy-armor" disabled={p.armor >= p.maxArmor || run.coins < SHOP_ARMOR_COST} onClick={() => game.send({ t: 'buySupply', item: 'armor' })}>
          <Icon k="ic_armor" />铁甲 +40 ({SHOP_ARMOR_COST}金) · {p.armor}/{p.maxArmor}
        </Btn>
        <Btn kind="small" id="btn-buy-medkit" disabled={p.hp >= p.maxHp || run.coins < SHOP_MEDKIT_COST} onClick={() => game.send({ t: 'buySupply', item: 'medkit' })}>
          <Icon k="ic_hp" />秘药 +45 ({SHOP_MEDKIT_COST}金) · {Math.ceil(p.hp)}/{p.maxHp}
        </Btn>
      </div>

      {p.weapons.length > 1 && (
        <div class="salvage-row">
          <small>拆解 ({p.weapons.length}/{MAX_CARRY})：</small>
          {p.weapons.map((w, idx) => (
            <Btn kind="small" key={w.id} id={`btn-salvage-${w.id}`} onClick={() => { setSwapPick(null); game.send({ t: 'salvageWeapon', index: idx }); }}>
              {WEAPONS[w.id].name} (+{45 + w.star * 20}金)
            </Btn>
          ))}
        </div>
      )}
    </Panel>
  );
}

const TURRET_SHORT: Record<TurretType, string> = { mg: '火铳', frost: '寒晶', tesla: '雷炮', cannon: '重炮' };
const TURRET_MODE_LABEL: Record<TurretTargetMode, string> = { near: '瞄:近敌', boss: '瞄:首领', air: '瞄:对空' };
const TURRET_MODE_DESC: Record<TurretTargetMode, string> = { near: '优先最近', boss: '集火首领', air: '优先打飞怪' };

/** 原木酒桶斟酒/泡茶小游戏条（#pour-hud）：在金色泡沫线处点「止沫停杯！」或再按一次 #key-act */
function PourHud() {
  const run = game.run;
  const pour = run.pourMinigame;
  const fast = hasTavernUpgrade(run, 'fast_tap');
  const fillRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!pour) return;
    let raf = 0;
    const tick = () => {
      const p = game.run.pourMinigame;
      if (p) {
        fillRef.current?.style.setProperty('--fill', Math.max(0, Math.min(1, p.fill)).toFixed(4));
        const q = pourQuality(p.fill, hasTavernUpgrade(game.run, 'fast_tap'));
        if (badgeRef.current) {
          badgeRef.current.setAttribute('data-q', q);
          badgeRef.current.textContent = QUALITY_META[q].label;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pour?.startedTick, pour?.drink]);

  if (!pour) return null;
  const def = DRINKS[pour.drink];
  const dest = pour.guestId ? run.guests.find((g) => g.id === pour.guestId) : null;
  const curQ = pourQuality(pour.fill, fast);

  return (
    <div class="pour-hud" id="pour-hud">
      <div class="qte-hud-top">
        <Icon k={def.icon} />
        <b>斟「{def.name}」</b>
        <span>→ {dest?.name ?? '备饮'}</span>
        <em class="qte-live-badge" ref={badgeRef} data-q={curQ}>{QUALITY_META[curQ].label}</em>
        <button id="btn-pour-cancel" class="qte-close" onClick={() => game.send({ t: 'cancelPour' })}>收手</button>
      </div>
      <div class="qte-hud-row">
        <div class="pour-track" data-fast={fast ? '1' : '0'}>
          <span class="pour-zone z-perf" />
          <span class="pour-zone z-leg" />
          <span class="pour-fill" ref={fillRef} />
        </div>
        <Btn id="btn-pour-hit" kind="primary" cls="small" onClick={() => game.send({ t: 'stopPour' })}>止沫停杯！</Btn>
      </div>
    </div>
  );
}

/** 堂食营业悬浮条（#shift-hud）：极简无冗余按钮，专注开张与上菜 */
function ShiftHud() {
  const run = game.run, s = run.dinerShift;
  const pInfo = partyForDay(run.day);
  const unserved = run.guests.filter((g) => !g.served).length;
  if (s.mode === 'prep') {
    return (
      <div class="shift-hud prep" id="shift-hud">
        <Icon k="ic_ledger" />
        <span>待援 <b>{unserved}</b> 客</span>
        {pInfo.active && <em class="shift-party">{pInfo.active.name}</em>}
        <Btn id="btn-shift-start" kind="primary" cls="small" onClick={() => game.send({ t: 'startShift' })}>开张营业</Btn>
      </div>
    );
  }
  const secLeft = Math.max(0, Math.ceil(s.timer / 60));
  const totalCoins = s.coinsEarned + s.tipsEarned;
  return (
    <div class="shift-hud open" id="shift-hud">
      <div class="shift-timer">
        <b>{secLeft}s</b>
        <Bar cls="wall" v={s.timer / Math.max(1, s.duration)} />
      </div>
      <span class="shift-stat"><b>{s.servedCount}</b> 客 · <b>+{totalCoins}金</b></span>
      {s.combo > 1 && <em class="shift-combo">{s.combo}连</em>}
      <Btn id="btn-shift-stop" kind="ghost" cls="small" onClick={() => game.send({ t: 'closeShift' })}>打烊</Btn>
    </div>
  );
}

/** 室外实地建塔/修墙/加固浮条（#field-build-hud）：走近屋顶或前院工事基座即现，不挡屏幕、当场落成 */
function FieldBuildHud() {
  const run = game.run;
  if (run.phase !== 'camp' || run.inside) return null;
  const ct = nearbyCampTarget(run);
  if (!ct) return null;
  const qiang = hasAlly(run, 'qiang');
  const smith = !!run.diner.smithDiscount;

  if (ct.kind === 'turretSlot') {
    const i = ct.slot;
    const sl = run.turrets[i];
    const meta = TURRET_SLOTS[i];
    if (!sl.type) {
      return (
        <div class="shift-hud field-build-hud" id="field-build-hud">
          <Icon k="ic_anvil" />
          <span><b>{meta.name}</b>{smith ? ' (85折)' : ''}</span>
          {(['mg', 'frost', 'tesla', 'cannon'] as TurretType[]).map((kind) => {
            const c = turretBuildCost(kind, run.cls, qiang, smith);
            return (
              <Btn key={kind} kind="small" id={`btn-field-build-${i}-${kind}`} disabled={run.coins < c}
                onClick={() => game.send({ t: 'buildTurret', slot: i, kind })}>
                {TURRET_SHORT[kind]} {c}金
              </Btn>
            );
          })}
        </div>
      );
    }
    const def = TURRETS[sl.type];
    const isMax = sl.level >= def.levels.length;
    const upCost = turretUpgradeCost(sl.type, sl.level, run.cls, qiang, smith);
    const refund = turretRefundCoins(sl.type, sl.level, run.cls, qiang);
    const mode: TurretTargetMode = sl.mode ?? 'near';
    return (
      <div class="shift-hud field-build-hud" id="field-build-hud">
        <Icon k={def.icon} />
        <span><b>{meta.name} · {def.name} Lv.{sl.level}</b></span>
        <Btn kind="small" id={`btn-field-mode-${i}`} onClick={() => game.send({ t: 'cycleTurretMode', slot: i })}>
          {TURRET_MODE_LABEL[mode]}
        </Btn>
        <Btn kind="primary" cls="small" id={`btn-field-up-${i}`} disabled={isMax || run.coins < upCost}
          onClick={() => game.send({ t: 'upgradeTurret', slot: i })}>
          {isMax ? '满级' : `升 ${upCost}金`}
        </Btn>
        <Btn kind="ghost" cls="small" id={`btn-field-del-${i}`} onClick={() => game.send({ t: 'sellTurret', slot: i })}>
          拆+{refund}
        </Btn>
      </div>
    );
  }

  if (ct.kind === 'wallSpot') {
    const wallMax = run.wall.level >= MAX_WALL_LEVEL;
    const nextWall = wallMax ? null : WALL_LEVELS[run.wall.level];
    return (
      <div class="shift-hud field-build-hud" id="field-build-hud">
        <Icon k="ic_wall" />
        <span><b>{WALL_LEVELS[run.wall.level - 1].name} Lv.{run.wall.level}</b> ({run.wall.hp}/{run.wall.maxHp})</span>
        <Btn kind="small" id="btn-field-wall-repair" disabled={run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST}
          onClick={() => game.send({ t: 'repairWall' })}>修 {WALL_REPAIR_COST}金</Btn>
        <Btn kind="primary" cls="small" id="btn-field-wall-up" disabled={!nextWall || run.coins < nextWall.coins}
          onClick={() => game.send({ t: 'upgradeWall' })}>{nextWall ? `升${nextWall.name} ${nextWall.coins}金` : '已满级'}</Btn>
      </div>
    );
  }

  if (ct.kind === 'fortSpot') {
    const fortMax = run.fort.level >= MAX_FORT_LEVEL;
    const nextFort = fortMax ? null : FORT_LEVELS[run.fort.level];
    return (
      <div class="shift-hud field-build-hud" id="field-build-hud">
        <Icon k="ic_fort" />
        <span><b>{FORT_LEVELS[run.fort.level - 1].name} Lv.{run.fort.level}</b> ({run.home.hp}/{run.home.maxHp})</span>
        <Btn kind="small" id="btn-field-fort-repair" disabled={run.home.hp >= run.home.maxHp || run.coins < FORT_REPAIR_COST}
          onClick={() => game.send({ t: 'repairFort' })}>修 {FORT_REPAIR_COST}金</Btn>
        <Btn kind="primary" cls="small" id="btn-field-fort-up" disabled={!nextFort || run.coins < nextFort.coins}
          onClick={() => game.send({ t: 'upgradeFort' })}>{nextFort ? `加固 ${nextFort.coins}金` : '已满级'}</Btn>
      </div>
    );
  }

  return null;
}

/** 今夜打烊小结（#panel-shift-summary）：只列真正生效的收获与明日战备，告别满屏 0 值表格 */
function ShiftSummaryPanel() {
  const run = game.run, s = run.dinerShift;
  if (run.phase !== 'camp' || !run.inside || s.mode !== 'summary') return null;
  const rep = s.report ?? {
    dishCoins: s.coinsEarned, drinkCoins: 0, tipsCoins: s.tipsEarned, partyBonusCoins: 0,
    spiceExpense: 0, staffWages: 0, upkeepCost: 0,
    ryePenaltyCount: s.ryeCount, angryCount: s.lostCount, dirtyLeftCount: s.dirtyTables.length,
    rating: 4.5, flameEarned: 4, netProfit: s.coinsEarned + s.tipsEarned,
  };
  const tBuff = computeTomorrowBattleBuff(run);
  const buffs: string[] = [];
  if (tBuff.dmgMul > 0) buffs.push(`枪伤+${Math.round(tBuff.dmgMul * 100)}%`);
  if (tBuff.haste > 0) buffs.push(`攻速+${Math.round(tBuff.haste * 100)}%`);
  if (tBuff.turretMul > 0) buffs.push(`炮塔+${Math.round(tBuff.turretMul * 100)}%`);
  if (tBuff.critBonus > 0) buffs.push(`暴击+${Math.round(tBuff.critBonus * 100)}%`);
  if (tBuff.frostRounds) buffs.push('寒霜弹');
  const supports: string[] = [];
  if (run.diner.smithDiscount) supports.push('造塔85折');
  if ((run.diner.extraCrates ?? 0) > 0) supports.push(`空投+${run.diner.extraCrates}箱`);
  if (run.diner.allyFuryNext) supports.push('战友狂飙+35%');

  return (
    <Panel id="panel-shift-summary" cls="summary-panel" title="今夜打烊小结">
      <div class="summary-head">
        <Icon k="ic_ledger" cls="x2" />
        <div class="summary-gold">净入 {rep.netProfit >= 0 ? `+${rep.netProfit}` : rep.netProfit} 金</div>
        <div class="summary-badges">
          <em class="sum-rate">{rep.rating.toFixed(1)}★</em>
          <em class="sum-flame">招待 {s.servedCount} 客</em>
        </div>
      </div>
      <div class="summary-list">
        <div class="item"><span>口碑增长</span><b>+{s.fansEarned} 粉</b></div>
        {buffs.length > 0 && <div class="item"><span>明日战备火力</span><b>{buffs.join(' · ')}</b></div>}
        {supports.length > 0 && <div class="item"><span>食客战场支援</span><b>{supports.join(' · ')}</b></div>}
      </div>
      <Btn id="btn-shift-summary-ok" kind="primary" onClick={() => game.send({ t: 'finishSummary' })}>收工迎战</Btn>
    </Panel>
  );
}

/** 防线工坊（战区沙盘俯瞰布局）：上排对应二楼屋顶+酒馆大屋，下排对应庭院+前线路障，底条随身兵器升星 */
function BuildPanel() {
  const run = game.run;
  const qiang = hasAlly(run, 'qiang');
  const smith = !!run.diner.smithDiscount;
  const wallMax = run.wall.level >= MAX_WALL_LEVEL, nextWall = wallMax ? null : WALL_LEVELS[run.wall.level];
  const fortMax = run.fort.level >= MAX_FORT_LEVEL, nextFort = fortMax ? null : FORT_LEVELS[run.fort.level];

  const renderSlot = (i: number) => {
    const sl = run.turrets[i];
    const slotMeta = TURRET_SLOTS[i];
    if (!sl.type) {
      return (
        <div class="item build-empty fort-slot empty" key={i}>
          <div class="slot-head">
            <b>{slotMeta.name}</b>
            <small>{slotMeta.roof ? '高地+55程' : '前院地面'}</small>
          </div>
          <div class="mini-btns">
            {(['mg', 'frost', 'tesla', 'cannon'] as TurretType[]).map((kind) => {
              const c = turretBuildCost(kind, run.cls, qiang, smith);
              return (
                <Btn kind="small" key={kind} id={`btn-build-${i}-${kind}`} disabled={run.coins < c} onClick={() => game.send({ t: 'buildTurret', slot: i, kind })}>
                  {TURRET_SHORT[kind]} {c}金
                </Btn>
              );
            })}
          </div>
        </div>
      );
    }
    const tDef = TURRETS[sl.type];
    const isMax = sl.level >= tDef.levels.length;
    const upCost = turretUpgradeCost(sl.type, sl.level, run.cls, qiang, smith);
    const refund = turretRefundCoins(sl.type, sl.level, run.cls, qiang);
    const mode: TurretTargetMode = sl.mode ?? 'near';
    return (
      <div class="item fort-slot built" key={i}>
        <div class="slot-head">
          <Icon k={tDef.icon} cls="x2" />
          <div class="grow">
            <b>{slotMeta.name} · {tDef.name} Lv.{sl.level}</b>
            <small>伤{tDef.levels[sl.level - 1].damage} · {TURRET_MODE_DESC[mode]}</small>
          </div>
        </div>
        <div class="slot-acts">
          <button id={`btn-turret-mode-${i}`} class={`btn small mode-btn mode-${mode}`} onClick={() => game.send({ t: 'cycleTurretMode', slot: i })}>
            {TURRET_MODE_LABEL[mode]}
          </button>
          <Btn kind="small" id={`btn-turret-up-${i}`} disabled={isMax || run.coins < upCost} onClick={() => game.send({ t: 'upgradeTurret', slot: i })}>
            {isMax ? '满级' : `升${upCost}金`}
          </Btn>
          <Btn kind="small" id={`btn-turret-del-${i}`} onClick={() => game.send({ t: 'sellTurret', slot: i })}>
            拆+{refund}
          </Btn>
        </div>
      </div>
    );
  };

  return (
    <Panel id="panel-build" cls="wide" title="防线工坊" head={<><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>好了</Btn></>}>
      <div class="fort-blueprint">
        <div class="blueprint-legend">
          <span>屋顶{qiang ? ' · 老强-10%' : ''}{smith ? ' · 匠师造塔85折' : ''}</span>
        </div>
        <div class="fort-tier tier-roof">
          {renderSlot(0)}
          <div class="item fort-slot core-card">
            <div class="slot-head">
              <Icon k="ic_fort" cls="x2" />
              <div class="grow">
                <b>{FORT_LEVELS[run.fort.level - 1].name} Lv.{run.fort.level}</b>
                <small>耐久 {run.home.hp}/{run.home.maxHp}{run.fort.level >= 3 ? ' · 双炮' : run.fort.level >= 2 ? ' · 守炮' : ''}</small>
              </div>
            </div>
            <Bar cls="fort" v={run.home.hp / Math.max(1, run.home.maxHp)} />
            <div class="slot-acts two">
              <Btn kind="small" id="btn-fort-repair" disabled={run.home.hp >= run.home.maxHp || run.coins < FORT_REPAIR_COST} onClick={() => game.send({ t: 'repairFort' })}>修 {FORT_REPAIR_COST}金</Btn>
              <Btn kind="small" id="btn-fort-up" disabled={!nextFort || run.coins < nextFort.coins} onClick={() => game.send({ t: 'upgradeFort' })}>{nextFort ? `加固 ${nextFort.coins}金` : '满级'}</Btn>
            </div>
          </div>
          {renderSlot(1)}
        </div>

        <div class="blueprint-legend">
          <span>庭院与防线</span>
        </div>
        <div class="fort-tier tier-ground">
          {renderSlot(2)}
          {renderSlot(3)}
          <div class="item fort-slot core-card wall-card">
            <div class="slot-head">
              <Icon k="ic_wall" cls="x2" />
              <div class="grow">
                <b>{WALL_LEVELS[run.wall.level - 1].name} Lv.{run.wall.level}</b>
                <small>耐久 {run.wall.hp}/{run.wall.maxHp}{nextWall ? ` · 反伤${nextWall.reflect}` : ' · 反伤10'}</small>
              </div>
            </div>
            <Bar cls="wall" v={run.wall.hp / Math.max(1, run.wall.maxHp)} />
            <div class="slot-acts two">
              <Btn kind="small" id="btn-repair" disabled={run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST} onClick={() => game.send({ t: 'repairWall' })}>修 {WALL_REPAIR_COST}金</Btn>
              <Btn kind="small" id="btn-wall-up" disabled={!nextWall || run.coins < nextWall.coins} onClick={() => game.send({ t: 'upgradeWall' })}>{nextWall ? `升级 ${nextWall.coins}金` : '满级'}</Btn>
            </div>
          </div>
        </div>
      </div>

      <div class="star-strip">
        <span class="star-strip-lbl">升星</span>
        <div class="star-strip-cards">
          {run.player.weapons.map((w) => {
            const def = WEAPONS[w.id], max = w.star >= MAX_STAR, cost = STAR_COST[w.star];
            return (
              <div class="item star-mini" key={w.id} data-rarity={def.rarity}>
                <Icon k={def.icon} cls="gun" />
                <div class="grow"><b>{def.name}</b><Stars n={w.star} /></div>
                <Btn kind="small" id={`btn-star-${w.id}`} disabled={max || run.coins < cost} onClick={() => game.send({ t: 'buyStar', weapon: w.id })}>
                  {max ? '满星' : `★+${cost}金`}
                </Btn>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Toasts(p: { layer?: 'shift' | 'bar' }) {
  const [items, setItems] = useState<{ id: number; text: string; big?: boolean }[]>([]);
  const [hurt, setHurt] = useState(0);
  useEffect(() => game.onEvent((e: GameEvent) => {
    const pushToast = (text: string, big = false) => {
      const id = Math.random();
      setItems((list) => [...list.slice(-2), { id, text, big }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2400);
    };
    if (e.t === 'dayStart') {
      const wShort = game.run.weather && game.run.weather !== 'clear' ? ` · ${WEATHERS[game.run.weather].short}` : '';
      pushToast(`第 ${e.day} 夜${wShort}`, true);
    }
    else if (e.t === 'bossAppear') pushToast(`首领 ${ZOMBIES[e.kind].name} 现身`, true);
    else if (e.t === 'bossDead') pushToast(`击溃 ${ZOMBIES[e.kind].name}`, true);
    else if (e.t === 'dayClear') pushToast('本夜清场');
    else if (e.t === 'contractDone') pushToast(`猎令达成「${e.title}」${e.rewardText}`, true);
    else if (e.t === 'pickup') {
      if (e.recycledCoins) pushToast(`${WEAPONS[e.weapon].name} 折金 +${e.recycledCoins}金`);
      else if (e.replaced) pushToast(`换装 ${WEAPONS[e.weapon].name}（${WEAPONS[e.replaced].name} 已落回地面）`, true);
      else if (e.isNew) pushToast(`获得 ${WEAPONS[e.weapon].name}`, true);
    }
    else if (e.t === 'supplyPickup') pushToast(`空投补给：${e.label}`);
    else if (e.t === 'star') pushToast(`${WEAPONS[e.weapon].name} ${'★'.repeat(e.star)}${STAR_PERKS[e.star] ? ' · ' + STAR_PERKS[e.star] : ''}`, true);
    else if (e.t === 'skill') pushToast(`${CLASSES[e.cls].skill}`, true);
    else if (e.t === 'allyJoin') pushToast(`${ALLIES[e.ally].name} 入伙`, true);
    else if (e.t === 'kitchenDone' && e.extraPlate) {
      pushToast(`余锅加出「${e.dishName}」`, false);
    }
    else if (e.t === 'partyStart') {
      pushToast(`今夜狂欢「${e.name}」`, true);
    }
    else if (e.t === 'endlessEnter') {
      pushToast('破晓已至 · 进入无尽经营', true);
    }
    else if (e.t === 'pourDone') {
      pushToast(`${DRINKS[e.drink].name} · ${QUALITY_META[e.quality].label}`, e.quality === 'legendary' || e.quality === 'perfect');
    }
    else if (e.t === 'tableClean') {
      pushToast(`收拾桌面 +${e.coins}金`);
    }
    else if (e.t === 'guestAngry') pushToast(`${e.name} 等久离席`, true);
    else if (e.t === 'serve') {
      if (e.isRye) pushToast(`${e.name} +1金`, false);
      else {
        const hotTxt = e.hotCrit ? ' · 趁热+30%' : '';
        const warTxt = e.warReward ? (e.warReward === 'barrel' ? ' · 赠明晚火油桶' : ' · 赠弹药箱') : '';
        const supTxt = !warTxt && e.supportTag ? ` · ${e.supportTag}` : '';
        pushToast(`${e.name} +${e.coins}金${hotTxt}${warTxt}${supTxt}`, true);
      }
      if (e.rankUp) pushToast(`酒馆晋升 ${e.rankUp} (+25金)`, true);
    }
    else if (e.t === 'cook') pushToast(`余肉换金 +${e.coins}金`);
    else if (e.t === 'dishLevelUp') pushToast(`「${MEALS[e.id].name}」练成 Lv.${e.level}！`, true);
    else if (e.t === 'meal') pushToast(`已备战：${MEALS[e.id].name} (${MEALS[e.id].battleTag})`, false);
    else if (e.t === 'hurt') setHurt((n) => n + 1);
  }), []);
  return (
    <>
      {hurt > 0 && <div class="hurt-flash" key={hurt} />}
      <div class="toasts" data-layer={p.layer ?? ''}>{items.map((t) => <div class={`toast ${t.big ? 'big' : ''}`} key={t.id}>{t.text}</div>)}</div>
    </>
  );
}

export function App() {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => game.subscribe(() => redraw(0)), []);
  const panel = game.panel(), run = game.run;
  const isCamp = run.phase === 'camp';
  const showSummary = panel === null && isCamp && run.inside && run.dinerShift.mode === 'summary';
  const toastLayer = panel === null && !showSummary && isCamp && run.inside
    ? (run.pourMinigame ? 'bar' : 'shift')
    : undefined;

  return (
    <>
      {panel !== 'title' && panel !== 'class' && <><Hud />{panel === null && !showSummary && <HouseBadge />}</>}
      {panel === null && !showSummary && (
        <>
          <Pad />
          {!run.inside && <><GroundLootTags /><PickupBar /></>}
          {isCamp && run.inside && run.pourMinigame && <PourHud />}
          {isCamp && run.inside && !run.pourMinigame && <ShiftHud />}
          {isCamp && !run.inside && <FieldBuildHud />}
          {!isCamp && !run.inside && <><WeaponChip /><Keys /></>}
          {isCamp && <><CampBar /><CampKeys /></>}
        </>
      )}
      <Toasts layer={toastLayer} />
      {panel === 'title' && (
        <Panel id="panel-title" cls="title" title="">
          <h1>暮夜酒馆：守夜人</h1>
          <Progress />
          <div class="row">
            <Btn id="btn-lore" kind="ghost" onClick={() => game.open('lore')}>前情提要</Btn>
            <Btn id="btn-start" kind="primary" onClick={() => game.chooseClass()}>开始守夜</Btn>
          </div>
        </Panel>
      )}
      {panel === 'class' && <ClassPanel />}
      {panel === 'story' && <StoryPanel />}
      {panel === 'lore' && <LorePanel />}
      {panel === 'perk' && <PerkPanel />}
      {showSummary && <ShiftSummaryPanel />}
      {panel === 'kitchen' && <KitchenPanel />}
      {panel === 'shop' && <ShopPanel />}
      {panel === 'build' && <BuildPanel />}
      {panel === 'weaponSwap' && <WeaponSwapPanel />}
      {panel === 'pause' && (
        <Panel id="panel-pause" title="暂停">
          <div class="row">
            <Btn id="btn-resume" kind="primary" onClick={() => game.close()}>继续</Btn>
            <Btn id="btn-lore" kind="ghost" onClick={() => game.open('lore')}>剧情与战友</Btn>
            <Btn id="btn-restart" kind="danger" onClick={() => game.restart()}>重新开始</Btn>
          </div>
        </Panel>
      )}
      {panel === 'dead' && (
        <Panel id="panel-dead" title="死局未改，反骨未折" sub={`${DIFFICULTIES[run.difficulty ?? 'normal'].name} · 逆夜死战至第 ${run.day} 夜 · 击杀 ${run.kills}`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>掀桌再战</Btn>
        </Panel>
      )}
      {panel === 'won' && (
        <Panel id="panel-won" title="撕碎死局，杀出重围！" sub={`${DIFFICULTIES[run.difficulty ?? 'normal'].name} · 杀穿 ${LAST_DAY} 夜重围 · 击杀 ${run.kills}`}>
          <Progress gain={game.lastGain} />
          <div class="row">
            <Btn id="btn-enter-endless" kind="primary" onClick={() => game.send({ t: 'enterEndless' })}>重返酒馆继续掀夜</Btn>
            <Btn id="btn-again" onClick={() => game.chooseClass()}>再战一局</Btn>
          </div>
        </Panel>
      )}
    </>
  );
}
