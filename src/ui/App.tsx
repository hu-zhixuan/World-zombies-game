import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import {
  AD_TIERS, AD_TIER_ORDER, CLASSES, DIFFICULTIES, DIFFICULTY_ORDER, DRINKS, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_DISH_LV, MAX_FORT_LEVEL, MAX_GRENADES, MAX_RACK_LEVEL, MAX_STAFF_LV, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAL_ORDER, MEAT_ORDER, MEATS, RACK_LEVELS, RARITY_NAME, RYE_FALLBACK, SEAT_UPGRADE_ORDER, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST,
  SPICE_BUY_COST, STAFF_TRAIN_COST, STAR_COST, STAR_PERKS, TAVERN_UPGRADES, TAVERN_UPGRADE_ORDER, TURRETS, WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES,
  classUnlockStars, dishEnhanceMeatCost, dishUpgradeCost, newZombieOn, nextUnlock, partyForDay, perkDef, sustainedDps, unlockName,
  type MeatKind, type StaffRole, type TurretType,
} from '../content/data';
import {
  ALLIES, ALLY_ORDER, CHAPTER_CARDS, CINEMATIC_INTRO, COMPANION_JOIN_STORIES, QUALITY_META, REST_STORY, STORY_SCENES, VIP_CUSTOMERS, VIP_TIERS,
  type RestStoryKey, type StorySceneKey,
} from '../content/story';
import {
  MAX_CARRY, allyRole, dayRemaining, dinerRank, dishLevel, dishPrice, dishResearchCost, dishServings, dishTaste, formatRecipeCost, hasAlly, hasIngredients, hasTavernUpgrade, houseBuff,
  maxMenuSlots, maxSeats, maxStaffSlots, meatPrice, pourQuality, staffDef, tavernUpgradeCost, turretBuildCost, turretRefundCoins, turretUpgradeCost,
} from '../sim/sim';
import { TURRET_SLOTS, type GameEvent, type TurretTargetMode } from '../sim/types';
import { CampBar, CampKeys, Keys, Pad, WeaponChip } from './controls';
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
            ? `无尽·第${run.day}夜·${run.inside ? '酒馆' : '猎场'}`
            : `${diffName}·${run.phase === 'camp' ? `第${run.day}夜·${run.inside ? '酒馆' : '外院'}` : `第${run.day}/${LAST_DAY}天`}`}
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
          <Icon k="ic_spice" /><b>{run.spice}</b>
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
  const text = hb.zone === 'roof'
    ? `${hb.name} · 伤+${Math.round((hb.dmgMul - 1) * 100)}% 掩体-${Math.round(hb.rangedCover * 100)}%`
    : hb.zone === 'porch'
      ? `${hb.name} · 伤+12% 掩体-${Math.round(hb.rangedCover * 100)}%`
      : '前院地面';
  return (
    <div class="house-badge" id="hud-house" data-zone={hb.zone}>
      <Icon k="ic_rooftop" />
      <span>{text}</span>
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
    <Chip icon="ic_spice">{game.run.spice}</Chip>
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

/** 酒馆传闻录：前情 / 章节 / 战友 */
function LorePanel() {
  const [tab, setTab] = useState<'intro' | 'chapters' | 'allies'>('intro');
  const [sceneIdx, setSceneIdx] = useState(0);
  const run = game.run;
  const scene = STORY_SCENES[sceneIdx] ?? STORY_SCENES[0];

  return (
    <Panel id="panel-lore" cls="wide" title="酒馆传闻录" head={<Btn id="btn-close" kind="primary" onClick={() => game.close()}>返回</Btn>}>
      <div class="diner-tabs">
        <button id="tab-lore-intro" class={`tab-btn ${tab === 'intro' ? 'on' : ''}`} onClick={() => setTab('intro')}>序章前情</button>
        <button id="tab-lore-chapters" class={`tab-btn ${tab === 'chapters' ? 'on' : ''}`} onClick={() => setTab('chapters')}>章节脉络</button>
        <button id="tab-lore-allies" class={`tab-btn ${tab === 'allies' ? 'on' : ''}`} onClick={() => setTab('allies')}>并肩战友 ({run.story.allies.length}/4)</button>
        {tab === 'intro' && game.started && (
          <Btn id="btn-replay-intro" kind="small" cls="tab-right" onClick={() => { game.close(); game.enqueueStory('序幕 · 暮夜酒馆', CINEMATIC_INTRO, true); }}>
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

const ROLE_BTNS: { id: StaffRole; short: string; label: string }[] = [
  { id: 'kitchen',  short: '厨', label: '后厨' },
  { id: 'floor',    short: '堂', label: '大堂' },
  { id: 'dispatch', short: '派', label: '派遣' },
  { id: 'rest',     short: '休', label: '休息' },
];

/** 深夜小食堂：今夜备战 + 人手与贮肉架 + 12 道食谱研发 + 15 位熟客口碑图鉴 */
function KitchenPanel() {
  const run = game.run;
  const [tab, setTab] = useState<'dine' | 'staff' | 'menu' | 'vip'>('dine');

  const fansRank = dinerRank(run);
  const slotCap = maxMenuSlots(run);
  const staffCap = maxStaffSlots(run);
  const pInfo = partyForDay(run.day);
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

  const nextRack = run.diner.rackLevel < MAX_RACK_LEVEL ? RACK_LEVELS[run.diner.rackLevel] : null;
  const curRack = run.diner.rackLevel > 0 ? RACK_LEVELS[run.diner.rackLevel - 1] : null;

  return (
    <Panel id="panel-kitchen" cls="wide" title="深夜小食堂" head={
      <div class="diner-head-right">
        <div class="diner-tabs">
          <button id="tab-kitchen-dine" class={`tab-btn ${tab === 'dine' ? 'on' : ''}`} onClick={() => setTab('dine')}>今夜备战</button>
          <button id="tab-kitchen-staff" class={`tab-btn ${tab === 'staff' ? 'on' : ''}`} onClick={() => setTab('staff')}>人手 ({run.diner.hiredStaff.length}/{staffCap})</button>
          <button id="tab-kitchen-menu" class={`tab-btn ${tab === 'menu' ? 'on' : ''}`} onClick={() => setTab('menu')}>食谱 ({run.diner.researched.length}/12)</button>
          <button id="tab-kitchen-vip" class={`tab-btn ${tab === 'vip' ? 'on' : ''}`} onClick={() => setTab('vip')}>图鉴 ({run.diner.metVips.length}/15)</button>
        </div>
        <Btn id="btn-close" kind="primary" onClick={() => game.close()}>回堂内</Btn>
      </div>
    }>
      <div class="diner-ribbon">
        <span><b>{fansRank.cur.grade}级·{fansRank.cur.name}</b> ({run.diner.fans}粉·{maxSeats(run)}座)</span>
        <span class="ribbon-flame"><Icon k="ic_flame" /><b>{run.diner.flame}</b> 灵感</span>
        <em class="ribbon-trend">热门「{run.diner.trendTag}」</em>
        {pInfo.active ? (
          <em class="ribbon-party on">今夜·{pInfo.active.name}</em>
        ) : pInfo.upcoming ? (
          <em class="ribbon-party">{pInfo.daysAway === 1 ? '明晚' : '后天'}·{pInfo.upcoming.name}</em>
        ) : (
          <small class={run.meal ? 'meal-set' : ''}>{run.meal ? `特餐：${MEALS[run.meal].name}` : '未留特餐'}</small>
        )}
      </div>

      {tab === 'dine' && (
        <>
          <div class="tavern-strip">
            <Btn kind="primary" cls="small" id="btn-kitchen-shift"
              onClick={() => {
                if (run.dinerShift.mode === 'open') { game.send({ t: 'closeShift' }); game.close(); }
                else { game.send({ t: 'startShift' }); game.close(); }
              }}>
              {run.dinerShift.mode === 'open' ? '提前打烊' : '开张营业'}
            </Btn>
            <div class="tavern-upgs">
              {(() => {
                const seatUid = !hasTavernUpgrade(run, SEAT_UPGRADE_ORDER[0]) ? SEAT_UPGRADE_ORDER[0] : SEAT_UPGRADE_ORDER[1];
                const su = TAVERN_UPGRADES[seatUid], sOwn = hasTavernUpgrade(run, seatUid);
                const sCost = tavernUpgradeCost(run, seatUid);
                return (
                  <button key={seatUid} id="btn-tavern-seats" class={`tavern-btn ${sOwn ? 'own' : ''}`}
                    title={su.desc} disabled={sOwn || run.coins < sCost}
                    onClick={() => game.send({ t: 'buyTavernUpgrade', id: seatUid })}>
                    <Icon k={su.icon} />
                    <span>{su.name}</span>
                    <em>{sOwn ? '满8座' : `${sCost}金`}</em>
                  </button>
                );
              })()}
              {TAVERN_UPGRADE_ORDER.map((uid) => {
                const u = TAVERN_UPGRADES[uid], own = hasTavernUpgrade(run, uid);
                const cost = tavernUpgradeCost(run, uid);
                return (
                  <button key={uid} id={`btn-tavern-${uid}`} class={`tavern-btn ${own ? 'own' : ''}`}
                    title={u.desc} disabled={own || run.coins < cost}
                    onClick={() => game.send({ t: 'buyTavernUpgrade', id: uid })}>
                    <Icon k={u.icon} />
                    <span>{u.name}</span>
                    <em>{own ? '已装' : `${cost}金`}</em>
                  </button>
                );
              })}
            </div>
          </div>

          <div class="prep-grid">
            {run.diner.menu.map((id) => {
              const m = MEALS[id];
              const stock = run.diner.menuStock[id] ?? 0;
              const autoOn = !!run.diner.autoSupply[id];
              const servings = dishServings(run, id);
              const price = dishPrice(run, id);
              const canCook = hasIngredients(run, m.cost);
              const pickedMeal = run.meal === id;
              return (
                <div class="item prep-card" key={id}>
                  <div class="prep-top">
                    <Icon k={m.icon} />
                    <b>{m.name}</b>
                    {m.tags.includes(run.diner.trendTag) && <u class="trend-hit">热</u>}
                    <em class={`stock-pill ${stock === 0 && !autoOn ? 'empty' : ''}`}>存{stock}份</em>
                  </div>
                  <small>{formatRecipeCost(m.cost)}→{servings}份 · {price}金 · 味{dishTaste(run, id)}</small>
                  <div class="prep-acts">
                    <Btn kind="small" id={`btn-prep-${id}`} disabled={!canCook || stock >= 99}
                      onClick={() => game.send({ t: 'prepDish', id, batches: 1 })}>
                      备+{servings}份
                    </Btn>
                    <Btn kind="small" id={`btn-auto-${id}`} cls={autoOn ? 'menu-on' : ''}
                      onClick={() => game.send({ t: 'toggleAutoSupply', id })}>
                      {autoOn ? '自动:开' : '自动:关'}
                    </Btn>
                    <Btn kind="small" id={`btn-meal-prep-${id}`} disabled={run.meal !== null || (!canCook && stock <= 0)}
                      onClick={() => game.send({ t: 'pickMeal', id, quality: 'good' })}>
                      {pickedMeal ? '已留餐' : '留特餐'}
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>

          {run.guests.length > 0 && (
            <div class="cols3 guest-mini-row">
              {run.guests.slice(0, 3).map((g, i) => {
                const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId);
                const isDrink = g.orderKind === 'drink';
                const dishIcon = isDrink && g.drink ? DRINKS[g.drink].icon : (g.isRye ? RYE_FALLBACK.icon : MEALS[g.dish].icon);
                const canServe = isDrink || (run.diner.menuStock[g.dish] ?? 0) > 0 || hasIngredients(run, MEALS[g.dish].cost);
                return (
                  <div class={`item guest-mini ${g.served ? 'served' : ''}`} key={g.id}>
                    <NpcPortrait avatar={g.sprite} initial={g.name[0]} cls="xs" />
                    <div class="grow">
                      <div class="card-top">
                        <b>{g.name}</b>
                        {g.isVipRequest && <u class="vip-req-tag">点名</u>}
                        <small>{g.pay}金</small>
                      </div>
                      <small><Icon k={dishIcon} /> {g.dishName}</small>
                    </div>
                    <div class="guest-mini-acts">
                      {vip && vip.firstMeet.length > 0 && (
                        <button id={`btn-guest-story-${i}`} class="mini-story-btn" onClick={() => game.enqueueStory(`${g.name} · 初遇`, vip.firstMeet, true)}>初遇</button>
                      )}
                      {run.dinerShift.mode === 'prep' && (
                        <Btn kind="small" id={`btn-serve-${i}`} disabled={g.served || !canServe}
                          onClick={() => game.send({ t: 'serveGuest', guestId: g.id, quality: 'good' })}>
                          {g.served ? '已上' : '先上菜'}
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div class="item kitchen-footer">
            <Btn kind="small" id="btn-buy-spice" disabled={run.coins < SPICE_BUY_COST} onClick={() => game.send({ t: 'buySpice', count: 1 })}>
              <Icon k="ic_spice" /> 购秘酿香料 ({SPICE_BUY_COST}金) · 现有{run.spice}
            </Btn>
            <div class="sell-row">
              {MEAT_ORDER.map((k: MeatKind) => {
                const count = run.meats[k];
                const pEach = meatPrice(run.cls, k);
                return (
                  <Btn kind="small" key={k} id={`btn-sell-${k}`} disabled={count < 1}
                    onClick={() => game.send({ t: 'sellMeatKind', kind: k, count: 1 })}>
                    售{MEATS[k].short}({count})+{pEach}金
                  </Btn>
                );
              })}
              <Btn kind="small" id="btn-cook-all" disabled={totalSellVal <= 0} onClick={sellAllMeats}>
                全清肉 (+{totalSellVal}金)
              </Btn>
            </div>
          </div>
        </>
      )}

      {tab === 'staff' && (
        <div class="cols2 staff-split">
          <div class="box">
            <div class="section-title">
              <span>在编排班 ({run.diner.hiredStaff.length}/{staffCap}伙计)</span>
              <small>Lv.3/5 解锁自动绝技</small>
            </div>
            <div class="staff-list">
              {run.diner.hiredStaff.length === 0 && run.story.allies.length === 0 && (
                <small class="lore-tip">右栏可发榜招揽帮手，守夜战友入伙后亦在此调班。</small>
              )}
              {run.diner.hiredStaff.map((st) => {
                const def = staffDef(st.id);
                if (!def) return null;
                const isMax = st.level >= MAX_STAFF_LV;
                const trainCost = STAFF_TRAIN_COST[st.level] ?? 999;
                return (
                  <div class="item staff-card" key={st.id}>
                    <NpcPortrait avatar={def.sprite} initial={def.name[0]} cls="xs" />
                    <div class="grow">
                      <div class="card-top">
                        <b>{def.name} Lv.{st.level}</b>
                        <small>{st.role === 'rest' ? '休息·0金' : `${def.dailyWage}金/夜`}</small>
                      </div>
                      <div class="staff-skills">
                        <em class={st.level >= 3 ? 'sk on' : 'sk'}>3:{def.lv3Label}</em>
                        <em class={st.level >= 5 ? 'sk on' : 'sk'}>5:{def.lv5Label}</em>
                      </div>
                      <div class="staff-acts">
                        <div class="role-pills">
                          {ROLE_BTNS.map((rb) => (
                            <button key={rb.id} id={`btn-staff-role-${st.id}-${rb.id}`}
                              class={`role-btn ${st.role === rb.id ? 'on' : ''}`}
                              onClick={() => game.send({ t: 'setStaffRole', id: st.id, role: rb.id })}>
                              {rb.short}
                            </button>
                          ))}
                        </div>
                        <Btn kind="small" id={`btn-staff-train-${st.id}`} disabled={isMax || run.coins < trainCost}
                          onClick={() => game.send({ t: 'trainStaff', id: st.id })}>
                          {isMax ? '满级' : `培${trainCost}金`}
                        </Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
              {run.story.allies.map((allyId) => {
                const a = ALLIES[allyId];
                const curR = allyRole(run, allyId);
                return (
                  <div class="item staff-card ally-row" key={allyId}>
                    <NpcPortrait avatar={a.sprite} initial={a.initial} cls="xs" />
                    <div class="grow">
                      <div class="card-top">
                        <b>{a.name} · 战友</b>
                        <small>零日薪</small>
                      </div>
                      <small>{allyId === 'lin' ? '主后厨加速' : allyId === 'qiang' ? '主清陈盘' : allyId === 'zhang' ? '主救传菜' : '主稳客心'}</small>
                    </div>
                    <div class="role-pills">
                      {ROLE_BTNS.map((rb) => (
                        <button key={rb.id} id={`btn-ally-role-${allyId}-${rb.id}`}
                          class={`role-btn ${curR === rb.id ? 'on' : ''}`}
                          onClick={() => game.send({ t: 'setAllyRole', ally: allyId, role: rb.id })}>
                          {rb.short}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div class="box">
            <div class="section-title">
              <span>招工告示榜</span>
              <div class="ad-row">
                {AD_TIER_ORDER.map((tid) => {
                  const ad = AD_TIERS[tid];
                  return (
                    <Btn key={tid} kind="small" id={`btn-ad-${tid}`} disabled={run.coins < ad.cost}
                      onClick={() => game.send({ t: 'postRecruitment', tier: tid })}>
                      {ad.name}{ad.cost}金
                    </Btn>
                  );
                })}
              </div>
            </div>
            <div class="app-list">
              {run.diner.applicants.length === 0 ? (
                <small class="lore-tip">第 2 日开放自动招工，亦可随时张贴告示立即招揽。</small>
              ) : run.diner.applicants.slice(0, 3).map((app) => {
                const def = staffDef(app.id);
                if (!def) return null;
                const full = run.diner.hiredStaff.length >= staffCap;
                return (
                  <div class="item app-card" key={app.id}>
                    <NpcPortrait avatar={def.sprite} initial={def.name[0]} cls="xs" />
                    <div class="grow">
                      <div class="card-top">
                        <b>{def.name} · {def.title}</b>
                        <small>日薪{def.dailyWage}金</small>
                      </div>
                      <small>Lv.{app.startLevel} · {def.lv3Label}/{def.lv5Label}</small>
                    </div>
                    <Btn kind="small" id={`btn-hire-${def.id}`} disabled={full || run.coins < def.hireCost}
                      onClick={() => game.send({ t: 'hireStaff', id: def.id })}>
                      {full ? '满编' : `聘${def.hireCost}金`}
                    </Btn>
                  </div>
                );
              })}
            </div>

            <div class="rack-box">
              <div class="card-top">
                <b>后院贮肉架 {curRack ? `· Lv.${curRack.level} ${curRack.name}` : '· 未建'}</b>
                <Btn kind="small" id="btn-upgrade-rack" disabled={run.day < 4 || !nextRack || run.coins < nextRack.cost}
                  onClick={() => game.send({ t: 'upgradeRack' })}>
                  {run.day < 4 ? '第4日解锁' : !nextRack ? '已满级' : `${curRack ? '升级' : '搭建'} ${nextRack.cost}金`}
                </Btn>
              </div>
              <small>{curRack ? `每战自动产：+${curRack.tender}嫩 +${curRack.thick}厚${curRack.essence ? ` +${curRack.essence}髓` : ''}` : '第 4 日起可建架风干熟肉，稳住高阶硬菜原料。'}</small>
              {run.diner.lastDispatchLog && <small class="dispatch-note">{run.diner.lastDispatchLog}</small>}
            </div>
          </div>
        </div>
      )}

      {tab === 'menu' && (
        <>
          <div class="research-bar">
            <span>今日菜单位 <b>{run.diner.menu.length}/{slotCap}</b></span>
            <span>最高美味度 <b>{run.diner.bestTaste}</b></span>
            <span>研发消耗：夜战打烊获「炉火灵感」</span>
          </div>
          <div class="recipe-grid">
            {MEAL_ORDER.map((id) => {
              const m = MEALS[id], picked = run.meal === id;
              const researched = run.diner.researched.includes(id);
              const inMenu = run.diner.menu.includes(id);
              const lv = dishLevel(run, id);
              const isMaxLv = lv >= MAX_DISH_LV;
              const upCoin = dishUpgradeCost(id, lv);
              const upMeat = dishEnhanceMeatCost(id, lv);
              const canUp = researched && !isMaxLv && run.coins >= upCoin && hasIngredients(run, upMeat);
              const canMeal = researched && !picked && run.meal === null && ((run.diner.menuStock[id] ?? 0) > 0 || hasIngredients(run, m.cost));
              const hit = m.tags.includes(run.diner.trendTag);
              return (
                <div class={`item recipe-card ${!researched ? 'locked' : inMenu ? 'active' : ''}`} key={id}>
                  <div class="recipe-top">
                    <Icon k={m.icon} />
                    <b>{m.name}</b>
                    {hit && <u class="trend-hit">热</u>}
                    <em class="dish-lv">{researched ? `Lv.${lv}` : `${dishResearchCost(run, id)}灵感`}</em>
                  </div>
                  <small>{formatRecipeCost(m.cost)} · {dishServings(run, id)}份/{dishPrice(run, id)}金/味{dishTaste(run, id)}</small>
                  {!researched ? (
                    <Btn kind="small" cls="full-btn" id={`btn-dish-research-${id}`} disabled={run.diner.flame < dishResearchCost(run, id)}
                      onClick={() => game.send({ t: 'researchDish', id })}>
                      炉火研发 ({dishResearchCost(run, id)}灵感)
                    </Btn>
                  ) : (
                    <div class="meal-actions">
                      <Btn kind="small" id={`btn-menu-toggle-${id}`} cls={inMenu ? 'menu-on' : ''}
                        disabled={inMenu ? run.diner.menu.length <= 1 : run.diner.menu.length >= slotCap}
                        onClick={() => game.send({ t: 'toggleMenuDish', id })}>
                        {inMenu ? '在售' : '上架'}
                      </Btn>
                      <Btn kind="small" id={`btn-dish-up-${id}`} disabled={!canUp}
                        onClick={() => game.send({ t: 'upgradeDish', id })}>
                        {isMaxLv ? '满级' : `强${upCoin}金`}
                      </Btn>
                      <Btn kind="small" id={`btn-meal-${id}`} disabled={!canMeal}
                        onClick={() => game.send({ t: 'pickMeal', id, quality: 'good' })}>
                        {picked ? '已留' : '留特餐'}
                      </Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'vip' && (
        <div class="cols2 vip-split">
          <div class="box">
            <div class="section-title"><span>熟客图鉴</span></div>
            <div class="vip-grid">
              {VIP_CUSTOMERS.map((v) => {
                const met = run.diner.metVips.includes(v.id);
                const unlocked = run.diner.fans >= v.unlockFans;
                const shortName = v.name.split('·').pop() ?? v.name;
                return (
                  <button key={v.id} id={`btn-vip-${v.id}`} class={`vip-cell ${met ? 'met' : unlocked ? 'open' : 'lock'}`}
                    disabled={!met && !unlocked}
                    onClick={() => game.enqueueStory(`${v.name} · 食客档案`, v.firstMeet, true)}>
                    <NpcPortrait avatar={v.sprite} initial={shortName[0]} cls="xs" />
                    <b>{shortName}</b>
                    <small>{met ? VIP_TIERS[v.tier].name : unlocked ? '待初遇' : `${v.unlockFans}粉`}</small>
                  </button>
                );
              })}
            </div>
          </div>
          <div class="box">
            <div class="fans-box">
              <div class="card-top">
                <b>{fansRank.cur.grade}级 · {fansRank.cur.name}</b>
                <small>{fansRank.next ? `晋升 ${fansRank.next.grade}级 需达三项` : '已达最高段位'}</small>
              </div>
              <Bar cls="fort" v={fansProgress} />
              {fansRank.next ? (
                <div class="rank-gates">
                  <span class={run.diner.fans >= fansRank.next.minFans ? 'gate ok' : 'gate'}>
                    粉 {run.diner.fans}/{fansRank.next.minFans}
                  </span>
                  <span class={run.diner.bestTaste >= fansRank.next.minTaste ? 'gate ok' : 'gate'}>
                    味 {run.diner.bestTaste}/{fansRank.next.minTaste}
                  </span>
                  <span class={run.diner.researched.length >= fansRank.next.minResearched ? 'gate ok' : 'gate'}>
                    菜 {run.diner.researched.length}/{fansRank.next.minResearched}
                  </span>
                </div>
              ) : (
                <small>菜单位 {run.diner.menu.length}/{slotCap} · 最高美味 {run.diner.bestTaste} · 菜谱 {run.diner.researched.length}/12</small>
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
            <div class="section-title"><span>食评</span></div>
            <div class="review-list">
              {run.diner.reviews.length === 0 ? (
                <small class="lore-tip">暂无食评</small>
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

/** 酒馆军械行商 */
function ShopPanel() {
  const run = game.run, p = run.player;
  return (
    <Panel id="panel-shop" cls="wide" title="军械行商"
      head={<><Btn kind="small" id="btn-reroll" disabled={run.coins < SHOP_REROLL_COST} onClick={() => game.send({ t: 'rerollShop' })}>换一批 {SHOP_REROLL_COST}金</Btn><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>关门</Btn></>}>
      <div class="row">
        {run.shop.map((id) => {
          const def = WEAPONS[id], owned = p.weapons.find((w) => w.id === id);
          const isMax = !!owned && owned.star >= MAX_STAR;
          const cost = owned ? STAR_COST[owned.star] : def.price;
          const nextStar = owned ? Math.min(MAX_STAR, owned.star + 1) : 1;
          const dps = Math.round(sustainedDps(def, nextStar));
          return (
            <button class="card" key={id} id={`btn-shop-${id}`} data-rarity={def.rarity} disabled={isMax || run.coins < cost} onClick={() => game.send({ t: 'buyWeapon', weapon: id })}>
              <Icon k={def.icon} cls="x2" />
              <strong>{def.name}</strong>
              <em>{RARITY_NAME[def.rarity]} · {def.trait}</em>
              <span>{def.desc}</span>
              <small>秒伤 {dps} · 射程 {def.range}</small>
              <u>{isMax ? '满星' : owned ? `升 ★${owned.star + 1} (${cost}金)` : p.weapons.length >= MAX_CARRY ? `替换 (${cost}金)` : `购入 (${cost}金)`}</u>
            </button>
          );
        })}
      </div>

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
            <Btn kind="small" key={w.id} id={`btn-salvage-${w.id}`} onClick={() => game.send({ t: 'salvageWeapon', index: idx })}>
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

/** 堂食营业悬浮条（#shift-hud）：筹备态显示备菜与派对预告；营业态实时显示倒计时、辛香辣酱、菜数进账 */
function ShiftHud() {
  const run = game.run, s = run.dinerShift;
  const stockSum = run.diner.menu.reduce((sum, id) => sum + (run.diner.menuStock[id] ?? 0), 0);
  const pInfo = partyForDay(run.day);
  if (s.mode === 'prep') {
    return (
      <div class="shift-hud prep" id="shift-hud">
        <Icon k="ic_ledger" />
        <span>精选 <b>{run.diner.menu.length}/{maxMenuSlots(run)}</b> 菜 · 已备 <b>{stockSum}</b> 份</span>
        {pInfo.active && <em class="shift-party">{pInfo.active.name}</em>}
        {!pInfo.active && pInfo.upcoming && <em class="shift-party soon">{pInfo.daysAway === 1 ? '明晚' : '后天'}·{pInfo.upcoming.name}</em>}
        <Btn id="btn-shift-start" kind="primary" cls="small" onClick={() => game.send({ t: 'startShift' })}>开张营业</Btn>
      </div>
    );
  }
  const secLeft = Math.max(0, Math.ceil(s.timer / 60));
  const totalCoins = s.coinsEarned + s.tipsEarned;
  const saucePct = Math.round((s.sauce / Math.max(1, s.maxSauce)) * 100);
  const lowSauce = s.sauce <= 25 || s.sauceStalled;
  return (
    <div class="shift-hud open" id="shift-hud">
      <div class="shift-timer">
        <b>营业 {secLeft}s</b>
        <Bar cls="wall" v={s.timer / Math.max(1, s.duration)} />
      </div>
      <div class={`shift-sauce ${lowSauce ? 'stalled' : ''}`} id="hud-sauce">
        <Icon k="ic_sauce" />
        <Bar cls={lowSauce ? 'sauce-low' : 'sauce'} v={s.sauce / Math.max(1, s.maxSauce)} />
        <span>{s.sauceStalled ? '停摆!' : `${saucePct}%`}</span>
      </div>
      <span class="shift-stat">客 <b>{s.servedCount}</b> · <b>+{totalCoins}金</b></span>
      {pInfo.active && <em class="shift-party">{pInfo.active.name}</em>}
      {s.combo > 1 && <em class="shift-combo">{s.combo}连</em>}
      <Btn id="btn-shift-menu" kind="ghost" cls="small" onClick={() => game.open('kitchen')}>菜单</Btn>
      <Btn id="btn-shift-stop" kind="ghost" cls="small" onClick={() => game.send({ t: 'closeShift' })}>打烊</Btn>
    </div>
  );
}

/** 今夜经营日报（#panel-shift-summary）：★评分、炉火灵感产出、分项收入与日薪损耗净利 */
function ShiftSummaryPanel() {
  const run = game.run, s = run.dinerShift;
  if (run.phase !== 'camp' || !run.inside || s.mode !== 'summary') return null;
  const rep = s.report ?? {
    dishCoins: s.coinsEarned, drinkCoins: 0, tipsCoins: s.tipsEarned, partyBonusCoins: 0,
    spiceExpense: s.spiceSpentCoins, staffWages: 0, upkeepCost: 0,
    ryePenaltyCount: s.ryeCount, angryCount: s.lostCount, dirtyLeftCount: s.dirtyTables.length,
    rating: 3.0, flameEarned: 4, netProfit: s.coinsEarned + s.tipsEarned - s.spiceSpentCoins,
  };
  return (
    <Panel id="panel-shift-summary" cls="summary-panel" title="今夜经营日报">
      <div class="summary-head">
        <Icon k="ic_ledger" cls="x2" />
        <div class="summary-gold">净利 {rep.netProfit >= 0 ? `+${rep.netProfit}` : rep.netProfit} 金</div>
        <div class="summary-badges">
          <em class="sum-rate">{rep.rating.toFixed(1)}★</em>
          <em class="sum-flame"><Icon k="ic_flame" />+{rep.flameEarned} 灵感</em>
        </div>
      </div>
      <div class="cols2 summary-grid">
        <div class="box">
          <div class="item"><span>堂食菜金 / 派对</span><b>+{rep.dishCoins} / +{rep.partyBonusCoins} 金</b></div>
          <div class="item"><span>酒水饮品 ({s.drinkCount})</span><b>+{rep.drinkCoins} 金</b></div>
          <div class="item"><span>加急 / 委托 / 连击</span><b>+{rep.tipsCoins} 金</b></div>
          <div class="item"><span>满座与涨粉 ({s.servedCount}客)</span><b>+{s.fansEarned} 粉</b></div>
        </div>
        <div class="box">
          <div class="item"><span>香料进货</span><b>-{rep.spiceExpense} 金</b></div>
          <div class="item"><span>伙计日薪 / 店耗</span><b>-{rep.staffWages} / -{rep.upkeepCost} 金</b></div>
          <div class="item"><span>断货黑麦饼惩罚</span><b>{rep.ryePenaltyCount} 份</b></div>
          <div class="item"><span>生气离席 / 留脏碗</span><b>{rep.angryCount} 客 / {rep.dirtyLeftCount} 盘</b></div>
        </div>
      </div>
      <Btn id="btn-shift-summary-ok" kind="primary" onClick={() => game.send({ t: 'finishSummary' })}>收工归帐</Btn>
    </Panel>
  );
}

/** 防线工坊（战区沙盘俯瞰布局）：上排对应二楼屋顶+酒馆大屋，下排对应庭院+前线路障，底条随身兵器升星 */
function BuildPanel() {
  const run = game.run;
  const qiang = hasAlly(run, 'qiang');
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
              const c = turretBuildCost(kind, run.cls, qiang);
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
    const upCost = turretUpgradeCost(sl.type, sl.level, run.cls, qiang);
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
          <span>屋顶{qiang ? ' · 造塔-10%' : ''}</span>
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
              <div class="item star-mini" key={w.id}>
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
    if (e.t === 'dayStart') pushToast(`第 ${e.day} 夜`, true);
    else if (e.t === 'bossAppear') pushToast(`首领 ${ZOMBIES[e.kind].name} 现身`, true);
    else if (e.t === 'bossDead') pushToast(`击溃 ${ZOMBIES[e.kind].name}`, true);
    else if (e.t === 'dayClear') pushToast('本夜清场');
    else if (e.t === 'pickup' && e.isNew) pushToast(`获得 ${WEAPONS[e.weapon].name}`, true);
    else if (e.t === 'star') pushToast(`${WEAPONS[e.weapon].name} ${'★'.repeat(e.star)}${STAR_PERKS[e.star] ? ' · ' + STAR_PERKS[e.star] : ''}`, true);
    else if (e.t === 'skill') pushToast(`${CLASSES[e.cls].skill}`, true);
    else if (e.t === 'allyJoin') pushToast(`${ALLIES[e.ally].name} 入伙`, true);
    else if (e.t === 'kitchenDone') {
      pushToast(e.extraPlate ? `余锅顺手加出 1 盘「${e.dishName}」！` : `后厨出锅：${e.dishName}`, !e.isRye);
    }
    else if (e.t === 'sauceEmpty') {
      pushToast('辣酱耗尽！去石臼研磨补酱', true);
    }
    else if (e.t === 'grindSauce') {
      pushToast(`${e.byStaff ? `${e.byStaff}磨出` : ''}辛香辣酱恢复至 ${e.sauce}%`);
    }
    else if (e.t === 'research') {
      pushToast(`研发成功「${MEALS[e.id].name}」`, true);
    }
    else if (e.t === 'prepDish') {
      pushToast(`已备好「${MEALS[e.id].name}」×${e.servingsAdded} 份`);
    }
    else if (e.t === 'dispatchReturn') {
      pushToast(e.log, true);
    }
    else if (e.t === 'rackHarvest') {
      pushToast(`贮肉架熟成：+${e.tender}嫩肉 +${e.thick}厚肉${e.essence ? ` +${e.essence}魔髓` : ''}`);
    }
    else if (e.t === 'partyStart') {
      pushToast(`今夜主题狂欢「${e.name}」开宴！`, true);
    }
    else if (e.t === 'endlessEnter') {
      pushToast('破晓已至！暮夜酒馆进入无尽长夜经营', true);
    }
    else if (e.t === 'pourDone') {
      pushToast(`${DRINKS[e.drink].name}·${QUALITY_META[e.quality].label}`, e.quality === 'legendary' || e.quality === 'perfect');
    }
    else if (e.t === 'tableClean') {
      const who = e.byAlly ? `${ALLIES[e.byAlly].name}收拾桌面` : e.byStaff ? `${e.byStaff}收拾桌面` : '收拾桌面';
      pushToast(`${who} +${e.coins}金`);
    }
    else if (e.t === 'guestAngry') pushToast(`${e.name} 等久离席 (口碑-1)`, true);
    else if (e.t === 'shiftOpen') pushToast('暮夜堂食开张营业！', true);
    else if (e.t === 'shiftEnd') pushToast(`打烊 ${e.rating.toFixed(1)}★ · 净入 ${e.coins + e.tips}金 · +${e.flameEarned}灵感`, true);
    else if (e.t === 'serve') {
      if (e.isRye) pushToast(`${e.name} 被迫啃「${RYE_FALLBACK.name}」+1金 口碑下滑`, false);
      else if (e.vipRequestClear) pushToast(`点名委托完成！${e.name} +${e.coins}金 +2灵感`, true);
      else pushToast(`${e.name}「${QUALITY_META[e.quality].label}」+${e.coins}金 +${e.fans}粉`, !!e.allServed || e.quality === 'legendary' || !!e.partyMatch);
      if (e.rankUp) pushToast(`食堂晋升 ${e.rankUp} (+25金/+2香料)`, true);
    }
    else if (e.t === 'cook') pushToast(`食材变现 ×${e.meat} +${e.coins}金`);
    else if (e.t === 'meal') pushToast(`特餐「${MEALS[e.id].name}」已备`, false);
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
          {isCamp && run.inside && run.pourMinigame && <PourHud />}
          {isCamp && run.inside && !run.pourMinigame && <ShiftHud />}
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
        <Panel id="panel-dead" title="酒馆失守" sub={`${DIFFICULTIES[run.difficulty ?? 'normal'].name} · 第 ${run.day} 天 · 击杀 ${run.kills}`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>重返防线</Btn>
        </Panel>
      )}
      {panel === 'won' && (
        <Panel id="panel-won" title="守住了暮夜酒馆！" sub={`${DIFFICULTIES[run.difficulty ?? 'normal'].name} · ${LAST_DAY} 天通关 · 击杀 ${run.kills}`}>
          <Progress gain={game.lastGain} />
          <div class="row">
            <Btn id="btn-enter-endless" kind="primary" onClick={() => game.send({ t: 'enterEndless' })}>留在酒馆继续营业</Btn>
            <Btn id="btn-again" onClick={() => game.chooseClass()}>再战一局</Btn>
          </div>
        </Panel>
      )}
    </>
  );
}
