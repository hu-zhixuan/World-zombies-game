import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import {
  CLASSES, DIFFICULTIES, DIFFICULTY_ORDER, DRINKS, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_DISH_LV, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAL_ORDER, RARITY_NAME, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST, STAR_COST, STAR_PERKS,
  TAVERN_UPGRADES, TAVERN_UPGRADE_ORDER, TURRETS, WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES, classUnlockStars,
  dishLevelPayMul, dishUpgradeCost, newZombieOn, nextUnlock, perkDef, sustainedDps, unlockName,
  type MealId, type TurretType,
} from '../content/data';
import {
  ALLIES, ALLY_ORDER, CHAPTER_CARDS, CINEMATIC_INTRO, COMPANION_JOIN_STORIES, QUALITY_META, REST_STORY, STORY_SCENES, VIP_CUSTOMERS, VIP_TIERS,
  getFansRank, type DishQuality, type RestStoryKey, type StorySceneKey,
} from '../content/story';
import {
  MAX_CARRY, dayRemaining, dishLevel, hasAlly, hasTavernUpgrade, houseBuff, meatPrice, pourQuality, qteQuality,
  turretBuildCost, turretRefundCoins, turretUpgradeCost,
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
        <Chip id="hud-day">{diffName}·{run.phase === 'camp' ? `第${run.day}夜·${run.inside ? '酒馆' : '外院'}` : `第${run.day}/${LAST_DAY}天`}</Chip>
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
        <Chip icon="ic_meat" id="hud-meat">{run.meat}</Chip>
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

/** 局外成长：星星和下一个解锁 */
function Progress(p: { gain?: number }) {
  const stars = game.meta.stars, next = nextUnlock(stars);
  return (
    <div class="note" id="meta-progress">
      <Icon k="ic_star" />{p.gain !== undefined && <><b>+{p.gain}</b> · </>}星星 <b>{stars}</b>
      {next ? <> · {next.stars}★解锁 {unlockName(next)}</> : <> · 全部解锁</>}
    </div>
  );
}

const Purse = () => (
  <div class="purse">
    <Chip icon="ic_coin">{game.run.coins}</Chip>
    <Chip icon="ic_meat">{game.run.meat}</Chip>
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

type CookTarget =
  | { kind: 'guest'; guestId: string; name: string; dishName: string }
  | { kind: 'meal'; mealId: MealId; dishName: string };

/** 深夜小食堂：今夜热门 + 铁板火候 QTE + 15 位熟客图鉴/食评 + 6 道特餐 + 现炒赚金 */
function KitchenPanel() {
  const run = game.run, price = meatPrice(run.cls);
  const [tab, setTab] = useState<'dine' | 'menu' | 'vip'>('dine');
  const [cookTarget, setCookTarget] = useState<CookTarget | null>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const posRef = useRef(0.5);

  useEffect(() => {
    if (!cookTarget) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const sec = (now - t0) / 1000;
      const pos = 0.5 - 0.5 * Math.cos(sec * 3.15);
      posRef.current = pos;
      needleRef.current?.style.setProperty('--needle', pos.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cookTarget]);

  const startCook = (target: CookTarget) => {
    audio.unlock();
    audio.cookSizzle();
    posRef.current = 0.5;
    setCookTarget(target);
  };

  const finishCook = (quality: DishQuality) => {
    if (!cookTarget) return;
    if (cookTarget.kind === 'guest') {
      game.send({ t: 'serveGuest', guestId: cookTarget.guestId, quality });
    } else {
      audio.cookResult(quality);
      game.send({ t: 'pickMeal', id: cookTarget.mealId, quality });
    }
    setCookTarget(null);
  };

  const fansRank = getFansRank(run.diner.fans);
  const allServed = run.guests.length > 0 && run.guests.every((g) => g.served);
  const unlockedCount = MEAL_ORDER.filter((id) => MEALS[id].unlockDay <= Math.max(1, run.day)).length;
  const fansProgress = fansRank.next
    ? Math.max(0, run.diner.fans - fansRank.cur.minFans) / Math.max(1, fansRank.next.minFans - fansRank.cur.minFans)
    : 1;

  return (
    <Panel id="panel-kitchen" cls="wide" title="深夜小食堂" head={
      <div class="diner-head-right">
        {!cookTarget && (
          <div class="diner-tabs">
            <button id="tab-kitchen-dine" class={`tab-btn ${tab === 'dine' ? 'on' : ''}`} onClick={() => setTab('dine')}>今夜堂食</button>
            <button id="tab-kitchen-menu" class={`tab-btn ${tab === 'menu' ? 'on' : ''}`} onClick={() => setTab('menu')}>特餐 ({unlockedCount}/6)</button>
            <button id="tab-kitchen-vip" class={`tab-btn ${tab === 'vip' ? 'on' : ''}`} onClick={() => setTab('vip')}>图鉴 ({run.diner.metVips.length}/15)</button>
          </div>
        )}
        <Btn id="btn-close" kind="primary" onClick={() => game.close()}>回堂内</Btn>
      </div>
    }>
      {cookTarget ? (
        <div class="cook-qte" id="cook-qte-box">
          <div class="qte-head">
            <strong>铁板：{cookTarget.dishName}</strong>
            <span>{cookTarget.kind === 'guest' ? cookTarget.name : '明日特餐'}</span>
          </div>
          <div class="qte-track" id="qte-track">
            <span class="qte-zone z-good" />
            <span class="qte-zone z-perf" />
            <span class="qte-zone z-leg" />
            <span class="qte-needle" ref={needleRef} />
          </div>
          <div class="qte-actions">
            <Btn id="btn-qte-cancel" kind="danger" onClick={() => setCookTarget(null)}>取消</Btn>
            <Btn id="btn-qte-quick" kind="ghost" onClick={() => finishCook('good')}>快手出菜</Btn>
            <Btn id="btn-qte-hit" kind="primary" onClick={() => finishCook(qteQuality(posRef.current))}>火候出锅</Btn>
          </div>
        </div>
      ) : (
        <>
          <div class="diner-ribbon">
            <span><b>{fansRank.cur.grade}级·{fansRank.cur.name}</b> ({run.diner.fans}粉)</span>
            <em class="ribbon-trend">热门「{run.diner.trendTag}」</em>
            <small class={run.meal ? 'meal-set' : ''}>{run.meal ? `特餐：${MEALS[run.meal].name}` : '未留特餐'}</small>
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
                  {TAVERN_UPGRADE_ORDER.map((uid) => {
                    const u = TAVERN_UPGRADES[uid], own = hasTavernUpgrade(run, uid);
                    return (
                      <button key={uid} id={`btn-tavern-${uid}`} class={`tavern-btn ${own ? 'own' : ''}`}
                        title={u.desc} disabled={own || run.coins < u.cost}
                        onClick={() => game.send({ t: 'buyTavernUpgrade', id: uid })}>
                        <Icon k={u.icon} />
                        <span>{u.name}</span>
                        <em>{own ? '已装' : `${u.cost}金`}</em>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div class="cols3 diner-cols">
                {run.guests.slice(0, 3).map((g, i) => {
                  const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId);
                  const isDrink = g.orderKind === 'drink';
                  const dishIcon = isDrink && g.drink ? DRINKS[g.drink].icon : MEALS[g.dish].icon;
                  return (
                    <div class={`item diner-card ${g.served ? 'served' : ''}`} key={g.id}>
                      <div class="guest-top">
                        <NpcPortrait avatar={g.sprite} initial={g.name[0]} cls="sm" />
                        <div class="grow">
                          <div class="card-top">
                            <b>{g.name}</b>
                            <em class="tier-badge" data-tier={g.tier}>{VIP_TIERS[g.tier].name}</em>
                          </div>
                          <small>{g.role}</small>
                        </div>
                        {vip && vip.firstMeet.length > 0 && (
                          <button id={`btn-guest-story-${i}`} class="mini-story-btn" onClick={() => game.enqueueStory(`${g.name} · 初遇`, vip.firstMeet, true)}>初遇</button>
                        )}
                      </div>
                      <div class="guest-dish">
                        <Icon k={dishIcon} cls="dish" />
                        <b>{g.dishName}</b>
                        {g.trendMatch && <u class="trend-hit">热</u>}
                        <small>{isDrink ? `0肉→${g.pay}金` : `${g.meatCost}肉→${g.pay}金`}</small>
                      </div>
                      <small class="quote">「{g.served ? (g.reactionQuote ?? g.thanksQuote) : g.orderQuote}」</small>
                      <Btn kind="small" cls="full-btn" id={`btn-serve-${i}`} disabled={g.served || (!isDrink && run.meat < g.meatCost)}
                        onClick={() => isDrink
                          ? game.send({ t: 'serveGuest', guestId: g.id, quality: 'good' })
                          : startCook({ kind: 'guest', guestId: g.id, name: g.name, dishName: g.dishName })}>
                        {g.served ? `已招待·${QUALITY_META[g.qualityServed ?? 'good'].label}` : isDrink ? '现打饮品' : `铁板上菜 (${g.meatCost}肉)`}
                      </Btn>
                    </div>
                  );
                })}
              </div>
              <div class="item kitchen-footer">
                <Icon k="ic_meat" />
                <span class="grow">
                  <b>{allServed ? '今夜满堂尽兴' : `鲜肉现炒 (+${price}金/份)`}</b>
                </span>
                <Btn kind="small" id="btn-cook-one" disabled={run.meat < 1} onClick={() => game.send({ t: 'cookSell', count: 1 })}>现炒 1 份 (+{price}金)</Btn>
                <Btn kind="small" id="btn-cook-all" disabled={run.meat < 1} onClick={() => game.send({ t: 'cookSell', count: run.meat })}>全部现炒 (+{run.meat * price}金)</Btn>
              </div>
            </>
          )}

          {tab === 'menu' && (
            <div class="cols3 meal-grid">
              {MEAL_ORDER.map((id) => {
                const m = MEALS[id], picked = run.meal === id, locked = m.unlockDay > Math.max(1, run.day);
                const inMenu = run.diner.menu.includes(id);
                const lv = dishLevel(run, id);
                const isMaxLv = lv >= MAX_DISH_LV;
                const upCost = dishUpgradeCost(id, lv);
                const bonusPct = Math.round((dishLevelPayMul(lv) - 1) * 100);
                return (
                  <div class={`item meal-card ${locked ? 'locked' : ''}`} key={id}>
                    <div class="meal-head">
                      <Icon k={m.icon} cls="x2" />
                      <div class="grow">
                        <div class="meal-title-row">
                          <b>{m.name}</b>
                          <em class="dish-lv">Lv.{lv}{bonusPct > 0 ? `+${bonusPct}%` : ''}</em>
                        </div>
                        <div class="tag-row">
                          {m.tags.slice(0, 3).map((t) => (
                            <em key={t} class={`dish-tag ${t === run.diner.trendTag ? 'hit' : ''}`}>{t}</em>
                          ))}
                        </div>
                      </div>
                    </div>
                    <small class="wrap">{m.desc}</small>
                    <div class="meal-actions">
                      <Btn kind="small" id={`btn-menu-toggle-${id}`} cls={inMenu && !locked ? 'menu-on' : ''}
                        disabled={locked || (inMenu && run.diner.menu.length <= 1)}
                        onClick={() => game.send({ t: 'toggleMenuDish', id })}>
                        {locked ? '未解' : inMenu ? '在售' : '停售'}
                      </Btn>
                      <Btn kind="small" id={`btn-dish-up-${id}`}
                        disabled={locked || isMaxLv || run.coins < upCost}
                        onClick={() => game.send({ t: 'upgradeDish', id })}>
                        {locked ? `第${m.unlockDay}天` : isMaxLv ? '满级' : `强${upCost}金`}
                      </Btn>
                      <Btn kind="small" id={`btn-meal-${id}`}
                        disabled={locked || picked || run.meal !== null || run.meat < m.meatCost}
                        onClick={() => startCook({ kind: 'meal', mealId: id, dishName: m.name })}>
                        {locked ? '锁定' : picked ? `已留` : `留餐(${m.meatCost}肉)`}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
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
                    <small>{fansRank.next ? `还差 ${fansRank.next.minFans - run.diner.fans} 粉` : '最高等级'}</small>
                  </div>
                  <Bar cls="fort" v={fansProgress} />
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
        </>
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

/** 屋顶与灶台实时铁板 QTE 浮条（#qte-hud）：同步规则层摆针位置，可点“火候出锅！”或直接按右下 #key-act 出锅 */
function CookQteHud() {
  const run = game.run;
  const cook = run.dinerCook;
  const needleRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!cook) return;
    let raf = 0;
    const tick = () => {
      const c = game.run.dinerCook;
      if (c) {
        needleRef.current?.style.setProperty('--needle', c.pos.toFixed(4));
        const q = qteQuality(c.pos);
        if (badgeRef.current) {
          badgeRef.current.setAttribute('data-q', q);
          badgeRef.current.textContent = QUALITY_META[q].label;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cook?.guestId, cook?.startedTick]);

  if (!cook) return null;
  const dest = run.guests.find((g) => g.id === cook.guestId);
  const curQ = qteQuality(cook.pos);

  return (
    <div class="qte-hud" id="qte-hud">
      <div class="qte-hud-top">
        <Icon k={MEALS[cook.dish].icon} />
        <b>铁板炒「{cook.dishName}」</b>
        <span>→ {dest?.name ?? '食客'}</span>
        <em class="qte-live-badge" ref={badgeRef} data-q={curQ}>{QUALITY_META[curQ].label}</em>
        <button id="btn-world-qte-cancel" class="qte-close" onClick={() => game.send({ t: 'cancelCook' })}>收火</button>
      </div>
      <div class="qte-hud-row">
        <div class="qte-track compact">
          <span class="qte-zone z-good" />
          <span class="qte-zone z-perf" />
          <span class="qte-zone z-leg" />
          <span class="qte-needle" ref={needleRef} />
        </div>
        <Btn id="btn-world-qte-hit" kind="primary" cls="small" onClick={() => game.send({ t: 'finishCook' })}>火候出锅！</Btn>
      </div>
    </div>
  );
}

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

/** 堂食营业悬浮条（#shift-hud）：筹备态点开张营业；营业态实时显示倒计时、接单数、进账与连击 */
function ShiftHud() {
  const run = game.run, s = run.dinerShift;
  if (s.mode === 'prep') {
    return (
      <div class="shift-hud prep" id="shift-hud">
        <Icon k="ic_ledger" />
        <span>菜单 <b>{run.diner.menu.length}</b> 品 · 鲜肉 <b>{run.meat}</b></span>
        <Btn id="btn-shift-start" kind="primary" cls="small" onClick={() => game.send({ t: 'startShift' })}>开张营业</Btn>
      </div>
    );
  }
  const secLeft = Math.max(0, Math.ceil(s.timer / 60));
  const totalCoins = s.coinsEarned + s.tipsEarned;
  return (
    <div class="shift-hud open" id="shift-hud">
      <div class="shift-timer">
        <b>营业 {secLeft}s</b>
        <Bar cls="wall" v={s.timer / Math.max(1, s.duration)} />
      </div>
      <span class="shift-stat">客 <b>{s.servedCount}</b></span>
      <span class="shift-stat">收 <b>+{totalCoins}金</b></span>
      {s.combo > 1 && <em class="shift-combo">{s.combo}连</em>}
      <Btn id="btn-shift-stop" kind="ghost" cls="small" onClick={() => game.send({ t: 'closeShift' })}>打烊</Btn>
    </div>
  );
}

/** 今夜打烊账本结算面板（#panel-shift-summary） */
function ShiftSummaryPanel() {
  const run = game.run, s = run.dinerShift;
  if (run.phase !== 'camp' || !run.inside || s.mode !== 'summary') return null;
  const totalGold = s.coinsEarned + s.tipsEarned;
  return (
    <Panel id="panel-shift-summary" cls="summary-panel" title="今夜打烊结算">
      <div class="summary-head">
        <Icon k="ic_ledger" cls="x2" />
        <div class="summary-gold">+{totalGold} 金</div>
        <small>口碑 {run.diner.rep} · {run.diner.fans} 粉</small>
      </div>
      <div class="cols2 summary-grid">
        <div class="item"><span>接待食客</span><b>{s.servedCount} 客（饮 {s.drinkCount}）</b></div>
        <div class="item"><span>菜金 + 连击小费</span><b>{s.coinsEarned} + {s.tipsEarned} 金</b></div>
        <div class="item"><span>最高连击 · 收碗</span><b>{s.bestCombo} 连 · {s.cleanedCount} 盘</b></div>
        <div class="item"><span>涨粉 · 离席</span><b>+{s.fansEarned} 粉 · {s.lostCount} 客</b></div>
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
    else if (e.t === 'cookDone') {
      const dest = game.run.guests.find((g) => g.id === e.guestId);
      pushToast(`${e.dishName}·${QUALITY_META[e.quality].label} → ${dest?.name ?? '餐桌'}`, e.quality === 'legendary' || e.quality === 'perfect');
    }
    else if (e.t === 'pourDone') {
      pushToast(`${DRINKS[e.drink].name}·${QUALITY_META[e.quality].label}`, e.quality === 'legendary' || e.quality === 'perfect');
    }
    else if (e.t === 'tableClean') {
      const who = e.byAlly ? `${ALLIES[e.byAlly].name}收拾桌面` : '收拾桌面';
      pushToast(`${who} +${e.coins}金`);
    }
    else if (e.t === 'guestAngry') pushToast(`${e.name} 等久离席 (口碑-1)`, true);
    else if (e.t === 'shiftOpen') pushToast('暮夜堂食开张营业！', true);
    else if (e.t === 'shiftEnd') pushToast(`今夜打烊 · 收 ${e.coins + e.tips} 金`, true);
    else if (e.t === 'serve') {
      pushToast(`${e.name}「${QUALITY_META[e.quality].label}」+${e.coins}金 +${e.fans}粉`, !!e.allServed || e.quality === 'legendary');
      if (e.rankUp) pushToast(`食堂晋升 ${e.rankUp}`, true);
    }
    else if (e.t === 'cook') pushToast(`现炒 ×${e.meat} +${e.coins}金`);
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
    ? (run.dinerCook || run.pourMinigame ? 'bar' : 'shift')
    : undefined;

  return (
    <>
      {panel !== 'title' && panel !== 'class' && <><Hud />{panel === null && !showSummary && <HouseBadge />}</>}
      {panel === null && !showSummary && (
        <>
          <Pad />
          {isCamp && run.inside && run.dinerCook && <CookQteHud />}
          {isCamp && run.inside && run.pourMinigame && <PourHud />}
          {isCamp && run.inside && !run.dinerCook && !run.pourMinigame && <ShiftHud />}
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
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>再战一局</Btn>
        </Panel>
      )}
    </>
  );
}
