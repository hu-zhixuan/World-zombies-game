import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import {
  CLASSES, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, MEAL_ORDER, RARITY_NAME, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST, STAR_COST, STAR_PERKS,
  TURRETS, WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES, classUnlockStars, newZombieOn, nextUnlock, perkDef, sustainedDps, unlockName,
  type MealId, type TurretType,
} from '../content/data';
import {
  ALLIES, ALLY_ORDER, CHAPTER_CARDS, CINEMATIC_INTRO, COMPANION_JOIN_STORIES, QUALITY_META, REST_STORY, STORY_SCENES, VIP_CUSTOMERS, VIP_TIERS,
  getFansRank, getRepTier, type DishQuality, type RestStoryKey,
} from '../content/story';
import {
  MAX_CARRY, dayRemaining, hasAlly, houseBuff, meatPrice, turretBuildCost, turretRefundCoins, turretUpgradeCost,
} from '../sim/sim';
import { TURRET_SLOTS, type GameEvent } from '../sim/types';
import { CampDock, InteractHint, Keys, Pad, WeaponChip } from './controls';
import { Bar, Btn, Chip, Icon, NpcPortrait, Panel, Stars } from './parts';

function Hud() {
  const run = game.run, p = run.player;
  const boss = run.zombies.find((z) => ZOMBIES[z.kind].boss);
  const fresh = run.phase === 'camp' ? newZombieOn(run.day + 1) : null;
  const wallUp = run.wall.hp > 0;
  const defRatio = wallUp ? run.wall.hp / run.wall.maxHp : run.home.hp / run.home.maxHp;
  const defLabel = wallUp ? `防线 ${run.wall.hp}` : `大屋 ${run.home.hp}`;

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
        <Chip id="hud-day">{run.phase === 'camp' ? `第${run.day}夜·${run.inside ? '酒馆' : '外院'}` : `第${run.day}/${LAST_DAY}天`}</Chip>
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
    ? `${hb.name} · 伤+${Math.round((hb.dmgMul - 1) * 100)}% 程+${Math.round(hb.rangeBonus * 100)}% 暴+${Math.round(hb.critBonus * 100)}% 掩体-${Math.round(hb.rangedCover * 100)}%`
    : hb.zone === 'porch'
      ? `${hb.name} · 伤+12% 程+10% 掩体-20%`
      : `${hb.name} · 跃上酒馆屋顶获高地强效增益`;
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
      <Icon k="ic_star" />{p.gain !== undefined && <>本局 <b>+{p.gain}</b> · </>}星星 <b>{stars}</b>
      {next ? <> · 再攒 <b>{next.stars - stars}</b> 颗解锁 {unlockName(next)}</> : <> · 已全部解锁</>}
    </div>
  );
}

const Purse = () => (
  <div class="purse">
    <Chip icon="ic_coin">{game.run.coins}</Chip>
    <Chip icon="ic_meat">{game.run.meat}</Chip>
  </div>
);


/** 全屏沉浸剧情对话弹窗（支持逐句推进或一键跳过） */
function StoryPanel() {
  const q = game.storyQueue;
  if (!q.length) return null;
  const cur = q[0], total = q.length;
  return (
    <Panel id="panel-story" cls="wide story-panel" title={cur.title} head={<span class="story-step">待读 {total} 段</span>}>
      <div class="story-stage">
        <NpcPortrait avatar={cur.line.avatar} initial={cur.line.initial} cls="lg" />
        <div class="story-body">
          <div class="story-speaker">
            <strong>{cur.line.name}</strong>
            <em>{cur.line.role}</em>
          </div>
          <p class="story-text">{cur.line.text}</p>
        </div>
      </div>
      <div class="story-actions">
        <Btn id="btn-story-skip" kind="ghost" onClick={() => game.skipStory()}>跳过剧情</Btn>
        <Btn id="btn-story-next" kind="primary" onClick={() => game.nextStory()}>{total > 1 ? '下一句' : '进入战局'}</Btn>
      </div>
    </Panel>
  );
}

/** 废土档案馆：序章前情 / 四章总览 / 四位战友档案 */
function LorePanel() {
  const [tab, setTab] = useState<'intro' | 'chapters' | 'allies'>('intro');
  const [sceneIdx, setSceneIdx] = useState(0);
  const run = game.run;
  const scene = STORY_SCENES[sceneIdx] ?? STORY_SCENES[0];

  return (
    <Panel id="panel-lore" cls="wide" title="废土剧情档案" head={<Btn id="btn-close" kind="primary" onClick={() => game.close()}>返回</Btn>}>
      <div class="diner-tabs">
        <button id="tab-lore-intro" class={`tab-btn ${tab === 'intro' ? 'on' : ''}`} onClick={() => setTab('intro')}>序章前情</button>
        <button id="tab-lore-chapters" class={`tab-btn ${tab === 'chapters' ? 'on' : ''}`} onClick={() => setTab('chapters')}>章节脉络</button>
        <button id="tab-lore-allies" class={`tab-btn ${tab === 'allies' ? 'on' : ''}`} onClick={() => setTab('allies')}>并肩战友 ({run.story.allies.length}/4)</button>
        {tab === 'intro' && game.started && (
          <Btn id="btn-replay-intro" kind="small" cls="tab-right" onClick={() => { game.close(); game.enqueueStory('序幕 · 十五波围城', CINEMATIC_INTRO, true); }}>
            重温开场动画
          </Btn>
        )}
      </div>

      {tab === 'intro' && (
        <div class="lore-intro">
          <div class="scene-pills">
            {STORY_SCENES.map((sc, i) => (
              <button key={sc.chapter} id={`btn-scene-${i}`} class={`scene-pill ${sceneIdx === i ? 'on' : ''}`} onClick={() => setSceneIdx(i)}>
                {sc.chapter} · {sc.title}
              </button>
            ))}
          </div>
          <div class="lore-scene-box">
            <strong>{scene.chapter} · {scene.title}</strong>
            <p>{scene.text}</p>
          </div>
          {!game.started && <small class="lore-tip">点击「开始守城」选择职业出战后，将立即播放开场全剧情</small>}
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
                    <em>{active ? '当前战局' : cleared ? '已度过' : ch.sub}</em>
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
                    <b>{a.name} · {a.role}</b>
                    <em>{joined ? '已入驻' : `第${a.joinDay}天清场`}</em>
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
    <Panel id="panel-perk" title={`第 ${run.day} 天清场`} sub="选一个天赋，随后回酒馆小屋招待食客与整备">
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

/** 开局选职业：3 个职业均可体验 */
function ClassPanel() {
  const stars = game.meta.stars;
  return (
    <Panel id="panel-class" title="选择出战职业" sub="一位英雄守在酒馆屋顶，迎战十五波尸潮">
      <div class="row">
        {Object.values(CLASSES).map((c) => {
          const need = classUnlockStars(c.id) ?? 0;
          const lock = c.comingSoon ?? (stars < need ? `再攒 ${need - stars} 颗星解锁` : '');
          return (
            <button class="card" key={c.id} data-class={c.id} disabled={!!lock} onClick={() => game.restart(c.id)}>
              <Icon k={c.icon} cls="x3" /><strong>{c.name}</strong><em>{c.role}</em>
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

function qteQuality(pos: number): DishQuality {
  const d = Math.abs(pos - 0.5);
  if (d <= 0.045) return 'legendary';
  if (d <= 0.12) return 'perfect';
  if (d <= 0.28) return 'good';
  return 'poor';
}

/** 深夜小食堂：今日热搜 + 铁板火候 QTE + 15 位 VIP 图鉴/点评 + 6 道特餐 + 现炒卖钱 */
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

  const repTier = getRepTier(run.diner.rep);
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
            <strong>铁板猛火烹制：{cookTarget.dishName}</strong>
            <span>{cookTarget.kind === 'guest' ? `堂食招待：${cookTarget.name}` : '明日战前私房特餐'}</span>
          </div>
          <p class="qte-tip">看准火候指针停在中央金焰区！中心 ±4.5% 传说(×1.7金) · ±12% 完美(×1.38金) · ±28% 不错</p>
          <div class="qte-track" id="qte-track">
            <span class="qte-zone z-good" />
            <span class="qte-zone z-perf" />
            <span class="qte-zone z-leg" />
            <span class="qte-needle" ref={needleRef} />
          </div>
          <div class="qte-actions">
            <Btn id="btn-qte-cancel" kind="danger" onClick={() => setCookTarget(null)}>收火取消</Btn>
            <Btn id="btn-qte-quick" kind="ghost" onClick={() => finishCook('good')}>快手出菜 (不错)</Btn>
            <Btn id="btn-qte-hit" kind="primary" onClick={() => finishCook(qteQuality(posRef.current))}>火候出锅！</Btn>
          </div>
        </div>
      ) : (
        <>
          <div class="diner-ribbon">
            <span><b>{fansRank.cur.grade}级·{fansRank.cur.name}</b> ({run.diner.fans}粉 · {repTier.name})</span>
            <em class="ribbon-trend">今夜热门「{run.diner.trendTag}」+35%金 · ×2粉</em>
            <small class={run.meal ? 'meal-set' : ''}>{run.meal ? `明日特餐：${MEALS[run.meal].name}` : '未留明日特餐'}</small>
          </div>

          {tab === 'dine' && (
            <>
              <div class="cols3 diner-cols">
                {run.guests.map((g, i) => {
                  const vip = VIP_CUSTOMERS.find((v) => v.id === g.vipId);
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
                        <Icon k={MEALS[g.dish].icon} cls="dish" />
                        <b>{g.dishName}</b>
                        {g.trendMatch && <u class="trend-hit">热</u>}
                        <small>{g.meatCost}肉→{g.pay}金</small>
                      </div>
                      <small class="quote">「{g.served ? (g.reactionQuote ?? g.thanksQuote) : g.orderQuote}」</small>
                      <Btn kind="small" cls="full-btn" id={`btn-serve-${i}`} disabled={g.served || run.meat < g.meatCost}
                        onClick={() => startCook({ kind: 'guest', guestId: g.id, name: g.name, dishName: g.dishName })}>
                        {g.served ? `已招待·${QUALITY_META[g.qualityServed ?? 'good'].label}` : `铁板上菜 (${g.meatCost}肉)`}
                      </Btn>
                    </div>
                  );
                })}
              </div>
              <div class="item kitchen-footer">
                <Icon k="ic_meat" />
                <span class="grow">
                  <b>{allServed ? `今夜满堂尽兴！已赠打赏与 +15 生命` : `富余鲜肉现炒（+${price} 金币/肉${run.cls === 'chef' ? ' · 主厨加成' : ''}）`}</b>
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
                return (
                  <div class={`item meal-card ${locked ? 'locked' : ''}`} key={id}>
                    <div class="meal-head">
                      <Icon k={m.icon} cls="x2" />
                      <div class="grow">
                        <b>{m.name}</b>
                        <div class="tag-row">
                          {m.tags.slice(0, 3).map((t) => (
                            <em key={t} class={`dish-tag ${t === run.diner.trendTag ? 'hit' : ''}`}>{t}</em>
                          ))}
                        </div>
                      </div>
                    </div>
                    <small class="wrap">{m.desc}</small>
                    <Btn kind="small" cls="full-btn" id={`btn-meal-${id}`}
                      disabled={locked || picked || run.meal !== null || run.meat < m.meatCost}
                      onClick={() => startCook({ kind: 'meal', mealId: id, dishName: m.name })}>
                      {locked ? `第 ${m.unlockDay} 天解锁` : picked ? `已备好(${QUALITY_META[run.mealQuality].label})` : `留餐 (${m.meatCost}肉)`}
                    </Btn>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'vip' && (
            <div class="cols2 vip-split">
              <div class="box">
                <div class="section-title"><span>15 位废土熟客图鉴（点已初遇回看剧情）</span></div>
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
                    <small>{fansRank.next ? `距 ${fansRank.next.grade}级 差 ${fansRank.next.minFans - run.diner.fans} 粉` : '废土美食传说'}</small>
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
                <div class="section-title"><span>末世食评墙</span></div>
                <div class="review-list">
                  {run.diner.reviews.length === 0 ? (
                    <small class="lore-tip">招待今晚堂食客人后，废土热评与打赏将展示于此</small>
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

/** 酒馆军火商店：购买特色新枪 / 升星 / 购买手雷护甲医疗包 / 刷货 / 拆解旧枪 */
function ShopPanel() {
  const run = game.run, p = run.player;
  return (
    <Panel id="panel-shop" cls="wide" title="酒馆军火商店"
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
              <small>持续秒伤 {dps} · 射程 {def.range}</small>
              <u>{isMax ? '已满星' : owned ? `升 ★${owned.star + 1} (${cost}金)` : p.weapons.length >= MAX_CARRY ? `替换手中 (${cost}金)` : `购入 (${cost}金)`}</u>
            </button>
          );
        })}
      </div>

      <div class="supply-row">
        <Btn kind="small" id="btn-buy-grenade" disabled={p.grenades >= MAX_GRENADES || run.coins < SHOP_GRENADE_COST} onClick={() => game.send({ t: 'buySupply', item: 'grenade' })}>
          <Icon k="ic_grenade" />手雷 +2 ({SHOP_GRENADE_COST}金) · {p.grenades}/{MAX_GRENADES}
        </Btn>
        <Btn kind="small" id="btn-buy-armor" disabled={p.armor >= p.maxArmor || run.coins < SHOP_ARMOR_COST} onClick={() => game.send({ t: 'buySupply', item: 'armor' })}>
          <Icon k="ic_armor" />护甲 +40 ({SHOP_ARMOR_COST}金) · {p.armor}/{p.maxArmor}
        </Btn>
        <Btn kind="small" id="btn-buy-medkit" disabled={p.hp >= p.maxHp || run.coins < SHOP_MEDKIT_COST} onClick={() => game.send({ t: 'buySupply', item: 'medkit' })}>
          <Icon k="ic_hp" />急救 +45 ({SHOP_MEDKIT_COST}金) · {Math.ceil(p.hp)}/{p.maxHp}
        </Btn>
      </div>

      {p.weapons.length > 1 && (
        <div class="salvage-row">
          <small>随身武器（最多 {MAX_CARRY} 把）：</small>
          {p.weapons.map((w, idx) => (
            <Btn kind="small" key={w.id} id={`btn-salvage-${w.id}`} onClick={() => game.send({ t: 'salvageWeapon', index: idx })}>
              拆解 {WEAPONS[w.id].name} (+{45 + w.star * 20}金)
            </Btn>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** 防线工坊：4 个炮塔位建造/升级、3 级路障壁垒、3 级堡垒大屋与武器强化（统一仅消耗金币） */
function BuildPanel() {
  const run = game.run;
  const qiang = hasAlly(run, 'qiang');
  const wallMax = run.wall.level >= MAX_WALL_LEVEL, nextWall = wallMax ? null : WALL_LEVELS[run.wall.level];
  const fortMax = run.fort.level >= MAX_FORT_LEVEL, nextFort = fortMax ? null : FORT_LEVELS[run.fort.level];

  return (
    <Panel id="panel-build" cls="wide" title="防线工坊" head={<><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>好了</Btn></>}>
      <div class="cols2">
        <div class="box">
          <div class="section-title"><span>4 处自动炮塔（屋顶 2 + 庭院 2{qiang ? ' · 阿强-10%' : ''}）</span></div>
          {run.turrets.map((sl, i) => {
            const slotMeta = TURRET_SLOTS[i];
            if (!sl.type) {
              return (
                <div class="item" key={i}>
                  <span class="grow"><b>{slotMeta.name}</b><small>选塔安装（消耗金币）</small></span>
                  <div class="mini-btns">
                    {(['mg', 'frost', 'tesla', 'cannon'] as TurretType[]).map((kind) => {
                      const c = turretBuildCost(kind, run.cls, qiang);
                      return (
                        <Btn kind="small" key={kind} id={`btn-build-${i}-${kind}`} disabled={run.coins < c} onClick={() => game.send({ t: 'buildTurret', slot: i, kind })}>
                          {TURRETS[kind].name.replace('塔', '')} {c}金
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
            return (
              <div class="item" key={i}>
                <Icon k={tDef.icon} cls="x2" />
                <span class="grow"><b>{slotMeta.name} · {tDef.name} Lv.{sl.level}</b><small>{tDef.desc}（伤 {tDef.levels[sl.level - 1].damage}）</small></span>
                <Btn kind="small" id={`btn-turret-up-${i}`} disabled={isMax || run.coins < upCost} onClick={() => game.send({ t: 'upgradeTurret', slot: i })}>
                  {isMax ? '满级' : `升 ${upCost}金`}
                </Btn>
                <Btn kind="small" id={`btn-turret-del-${i}`} onClick={() => game.send({ t: 'sellTurret', slot: i })}>拆 +{refund}金</Btn>
              </div>
            );
          })}
        </div>

        <div class="box">
          <div class="section-title"><span>前线路障 · 屋顶守炮 · 随身武器升星</span></div>
          <div class="item">
            <Icon k="ic_wall" cls="x2" />
            <span class="grow">
              <b>{WALL_LEVELS[run.wall.level - 1].name} Lv.{run.wall.level}</b>
              <small>耐久 {run.wall.hp}/{run.wall.maxHp}{nextWall ? ` · 下级(${nextWall.name}+反伤)：${nextWall.coins}金` : ' · 高压电网反伤生效中'}</small>
            </span>
            <Btn kind="small" id="btn-repair" disabled={run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST} onClick={() => game.send({ t: 'repairWall' })}>修 {WALL_REPAIR_COST}金</Btn>
            <Btn kind="small" id="btn-wall-up" disabled={!nextWall || run.coins < nextWall.coins} onClick={() => game.send({ t: 'upgradeWall' })}>{nextWall ? `升 ${nextWall.coins}金` : '满级'}</Btn>
          </div>

          <div class="item">
            <Icon k="ic_fort" cls="x2" />
            <span class="grow">
              <b>{FORT_LEVELS[run.fort.level - 1].name} Lv.{run.fort.level}</b>
              <small>耐久 {run.home.hp}/{run.home.maxHp}{nextFort ? ` · 下级(${nextFort.desc.split(' · ')[0]})：${nextFort.coins}金` : ' · 屋顶双联火炮+每夜修墙'}</small>
            </span>
            <Btn kind="small" id="btn-fort-repair" disabled={run.home.hp >= run.home.maxHp || run.coins < FORT_REPAIR_COST} onClick={() => game.send({ t: 'repairFort' })}>修 {FORT_REPAIR_COST}金</Btn>
            <Btn kind="small" id="btn-fort-up" disabled={!nextFort || run.coins < nextFort.coins} onClick={() => game.send({ t: 'upgradeFort' })}>{nextFort ? `加固 ${nextFort.coins}金` : '满级'}</Btn>
          </div>

          {run.player.weapons.map((w) => {
            const def = WEAPONS[w.id], max = w.star >= MAX_STAR, cost = STAR_COST[w.star];
            return (
              <div class="item" key={w.id}>
                <Icon k={def.icon} cls="gun" />
                <span class="grow"><b>{def.name} · {def.trait}</b><Stars n={w.star} /></span>
                <Btn kind="small" id={`btn-star-${w.id}`} disabled={max || run.coins < cost} onClick={() => game.send({ t: 'buyStar', weapon: w.id })}>
                  {max ? '已满星' : <>升星 <Icon k="ic_coin" />{cost}</>}
                </Btn>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function Toasts() {
  const [items, setItems] = useState<{ id: number; text: string; big?: boolean }[]>([]);
  const [hurt, setHurt] = useState(0);
  useEffect(() => game.onEvent((e: GameEvent) => {
    const pushToast = (text: string, big = false) => {
      const id = Math.random();
      setItems((list) => [...list.slice(-2), { id, text, big }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2400);
    };
    if (e.t === 'dayStart') pushToast(`第 ${e.day} 天 · 跃上屋顶迎战尸潮！`, true);
    else if (e.t === 'bossAppear') pushToast(`警报！Boss ${ZOMBIES[e.kind].name} 现身！`, true);
    else if (e.t === 'bossDead') pushToast(`击溃首领 ${ZOMBIES[e.kind].name}！`, true);
    else if (e.t === 'dayClear') pushToast('本波清场！战利品已清点');
    else if (e.t === 'pickup' && e.isNew) pushToast(`获得新武器：${WEAPONS[e.weapon].name}（${WEAPONS[e.weapon].trait}）`, true);
    else if (e.t === 'star') pushToast(`${WEAPONS[e.weapon].name} 升至 ${'★'.repeat(e.star)}${STAR_PERKS[e.star] ? ' · ' + STAR_PERKS[e.star] : ''}`, true);
    else if (e.t === 'skill') pushToast(`${CLASSES[e.cls].skill}发动！${CLASSES[e.cls].skillDesc}`, true);
    else if (e.t === 'allyJoin') pushToast(`战友「${ALLIES[e.ally].name}」入伙！（${ALLIES[e.ally].buffDesc}）`, true);
    else if (e.t === 'serve') {
      pushToast(`${e.name}「${QUALITY_META[e.quality].label}」：${e.quote}（+${e.coins}金 +${e.fans}粉${e.allServed ? ' · 满堂打赏！' : ''}）`, !!e.allServed || e.quality === 'legendary');
      if (e.rankUp) pushToast(`深夜食堂晋升 ${e.rankUp}！`, true);
    }
    else if (e.t === 'cook') pushToast(`鲜肉现炒出锅 ×${e.meat}，入账 +${e.coins} 金币`);
    else if (e.t === 'meal') pushToast(`私房特餐「${MEALS[e.id].name}（${QUALITY_META[e.quality].label}）」已备妥，+8粉丝`);
    else if (e.t === 'hurt') setHurt((n) => n + 1);
  }), []);
  return (
    <>
      {hurt > 0 && <div class="hurt-flash" key={hurt} />}
      <div class="toasts">{items.map((t) => <div class={`toast ${t.big ? 'big' : ''}`} key={t.id}>{t.text}</div>)}</div>
    </>
  );
}

export function App() {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => game.subscribe(() => redraw(0)), []);
  const panel = game.panel(), run = game.run;
  const isCamp = run.phase === 'camp';
  const fansRank = getFansRank(run.diner.fans).cur;

  return (
    <>
      {panel !== 'title' && panel !== 'class' && <><Hud />{panel === null && <HouseBadge />}</>}
      {panel === null && (
        <>
          <Pad />
          <InteractHint />
          {!isCamp && !run.inside && <><WeaponChip /><Keys /></>}
          {isCamp && <CampDock />}
        </>
      )}
      <Toasts />
      {panel === 'title' && (
        <Panel id="panel-title" cls="title" title="">
          <h1>十五波围城</h1>
          <p>跃上黄昏酒馆二层屋顶迎战十五波尸潮，夜归温馨食堂做热饭招待十五路熟客、集结四位并肩战友！</p>
          <Progress />
          <div class="row">
            <Btn id="btn-lore" kind="ghost" onClick={() => game.open('lore')}>前情提要</Btn>
            <Btn id="btn-start" kind="primary" onClick={() => game.chooseClass()}>开始守城</Btn>
          </div>
        </Panel>
      )}
      {panel === 'class' && <ClassPanel />}
      {panel === 'story' && <StoryPanel />}
      {panel === 'lore' && <LorePanel />}
      {panel === 'perk' && <PerkPanel />}
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
        <Panel id="panel-dead" title="据点失守" sub={`坚持到了第 ${run.day} 天，消灭 ${run.kills} 只感染者 · 食堂 ${fansRank.grade}级 (${run.diner.servedTotal}客)`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>重返防线</Btn>
        </Panel>
      )}
      {panel === 'won' && (
        <Panel id="panel-won" title="守住了最后据点！" sub={`守住全部 ${LAST_DAY} 个日夜，击杀 ${run.kills} 只丧尸魔物 · 食堂达成 ${fansRank.grade}级·${fansRank.name}！`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>再战一局</Btn>
        </Panel>
      )}
    </>
  );
}
