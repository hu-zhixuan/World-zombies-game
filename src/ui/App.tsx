import { useEffect, useReducer, useState } from 'preact/hooks';
import { audio } from '../app/audio';
import { game } from '../app/game';
import {
  CLASSES, FORT_LEVELS, FORT_REPAIR_COST, LAST_DAY, MAX_FORT_LEVEL, MAX_GRENADES, MAX_STAR, MAX_WALL_LEVEL,
  MEALS, RARITY_NAME, SHOP_ARMOR_COST, SHOP_GRENADE_COST, SHOP_MEDKIT_COST, SHOP_REROLL_COST, STAR_COST, STAR_PERKS,
  TURRETS, WALL_LEVELS, WALL_REPAIR_COST, WEAPONS, ZOMBIES, classUnlockStars, newZombieOn, nextUnlock, perkDef, sustainedDps, unlockName,
  type MealId, type TurretType,
} from '../content/data';
import { MAX_CARRY, dayRemaining, meatPrice, turretBuildCost, turretRefundScrap, turretUpgradeCost } from '../sim/sim';
import { TURRET_SLOTS, type GameEvent } from '../sim/types';
import { CampDock, InteractHint, Keys, Pad, WeaponChip } from './controls';
import { Bar, Btn, Chip, Icon, Panel, Stars } from './parts';

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
        <Chip icon="ic_scrap" id="hud-scrap">{run.scrap}</Chip>
        <Chip icon="ic_meat" id="hud-meat">{run.meat}</Chip>
        <button class={`btn-icon ${audio.muted ? 'muted' : ''}`} id="btn-mute" onClick={() => game.toggleMute()}>{audio.muted ? '静音' : '音效'}</button>
        <button class="btn-icon" id="btn-pause" onClick={() => game.open('pause')}>暂停</button>
      </div>
    </header>
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
    <Chip icon="ic_scrap">{game.run.scrap}</Chip>
    <Chip icon="ic_meat">{game.run.meat}</Chip>
  </div>
);

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

/** 深夜小食堂：招待幸存者熟客点单赚赏金 + 留一份明早私房特餐 + 富余鲜肉现炒 */
function KitchenPanel() {
  const run = game.run, price = meatPrice(run.cls);
  const allServed = run.guests.length > 0 && run.guests.every((g) => g.served);
  return (
    <Panel id="panel-kitchen" cls="wide" title="深夜小食堂" head={<><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>回堂内</Btn></>}>
      <p class="section-title">
        <span>今晚堂食熟客（招待满 3 位额外赠 +{run.cls === 'chef' ? 24 : 16} 金币与 +15 生命）</span>
        <span>{allServed ? '满堂食客皆已尽兴！' : `库存鲜肉 ${run.meat} 块`}</span>
      </p>
      <div class="cols3">
        {run.guests.map((g, i) => (
          <div class={`item diner-card ${g.served ? 'served' : ''}`} key={g.id}>
            <Icon k={MEALS[g.dish].icon} cls="x2" />
            <span class="grow">
              <b>{g.name} · {g.role}</b>
              <small class="quote">「{g.served ? g.thanksQuote : g.orderQuote}」</small>
              <Btn kind="small" id={`btn-serve-${i}`} disabled={g.served || run.meat < g.meatCost}
                onClick={() => game.send({ t: 'serveGuest', guestId: g.id })}>
                {g.served ? `已招待 (+${g.pay}金)` : `上菜：${g.dishName} (${g.meatCost}肉→+${g.pay}金)`}
              </Btn>
            </span>
          </div>
        ))}
      </div>

      <p class="section-title">
        <span>留一份明日战前私房特餐（每晚选 1 道，天亮开战生效）</span>
        <span>{run.meal ? `已备好：${MEALS[run.meal].name}` : '待下锅'}</span>
      </p>
      <div class="cols3">
        {(Object.keys(MEALS) as MealId[]).map((id) => {
          const m = MEALS[id], picked = run.meal === id;
          return (
            <div class="item" key={id}>
              <Icon k={m.icon} cls="x2" />
              <span class="grow">
                <b>{m.name}</b>
                <small>{m.desc}</small>
                <Btn kind="small" id={`btn-meal-${id}`} disabled={picked || run.meal !== null || run.meat < m.meatCost} onClick={() => game.send({ t: 'pickMeal', id })}>
                  {picked ? '已备好' : <>留餐 ({m.meatCost} 肉)</>}
                </Btn>
              </span>
            </div>
          );
        })}
      </div>

      <div class="item kitchen-footer">
        <Icon k="ic_meat" />
        <span class="grow">
          <b>富余鲜肉现炒外卖（每块肉 +{price} 金币{run.cls === 'chef' ? ' · 主厨加成' : ''}）</b>
        </span>
        <Btn kind="small" id="btn-cook-one" disabled={run.meat < 1} onClick={() => game.send({ t: 'cookSell', count: 1 })}>现炒 1 份 (+{price}金)</Btn>
        <Btn kind="small" id="btn-cook-all" disabled={run.meat < 1} onClick={() => game.send({ t: 'cookSell', count: run.meat })}>全部现炒 (+{run.meat * price}金)</Btn>
      </div>
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
              拆解 {WEAPONS[w.id].name} (+{25 + w.star * 15}金 3铁)
            </Btn>
          ))}
        </div>
      )}
    </Panel>
  );
}

/** 防线工坊：4 个炮塔位建造/升级、3 级路障壁垒、3 级堡垒大屋与武器强化 */
function BuildPanel() {
  const run = game.run;
  const wallMax = run.wall.level >= MAX_WALL_LEVEL, nextWall = wallMax ? null : WALL_LEVELS[run.wall.level];
  const fortMax = run.fort.level >= MAX_FORT_LEVEL, nextFort = fortMax ? null : FORT_LEVELS[run.fort.level];

  return (
    <Panel id="panel-build" cls="wide" title="防线工坊" head={<><Purse /><Btn id="btn-close" kind="primary" onClick={() => game.close()}>好了</Btn></>}>
      <div class="cols2">
        <div class="box">
          <div class="section-title"><span>4 处自动炮塔（屋顶 2 + 庭院 2，用废铁建造）</span></div>
          {run.turrets.map((sl, i) => {
            const slotMeta = TURRET_SLOTS[i];
            if (!sl.type) {
              return (
                <div class="item" key={i}>
                  <span class="grow"><b>{slotMeta.name}</b><small>选择塔种安装</small></span>
                  <div class="mini-btns">
                    {(['mg', 'frost', 'tesla', 'cannon'] as TurretType[]).map((kind) => {
                      const c = turretBuildCost(kind, run.cls);
                      return (
                        <Btn kind="small" key={kind} id={`btn-build-${i}-${kind}`} disabled={run.scrap < c} onClick={() => game.send({ t: 'buildTurret', slot: i, kind })}>
                          {TURRETS[kind].name.replace('塔', '')} {c}铁
                        </Btn>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const tDef = TURRETS[sl.type];
            const isMax = sl.level >= tDef.levels.length;
            const upCost = turretUpgradeCost(sl.type, sl.level, run.cls);
            const refund = turretRefundScrap(sl.type, sl.level, run.cls);
            return (
              <div class="item" key={i}>
                <Icon k={tDef.icon} cls="x2" />
                <span class="grow"><b>{slotMeta.name} · {tDef.name} Lv.{sl.level}</b><small>{tDef.desc}（伤 {tDef.levels[sl.level - 1].damage}）</small></span>
                <Btn kind="small" id={`btn-turret-up-${i}`} disabled={isMax || run.scrap < upCost} onClick={() => game.send({ t: 'upgradeTurret', slot: i })}>
                  {isMax ? '满级' : `升 ${upCost}铁`}
                </Btn>
                <Btn kind="small" id={`btn-turret-del-${i}`} onClick={() => game.send({ t: 'scrapTurret', slot: i })}>拆 +{refund}</Btn>
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
              <small>耐久 {run.wall.hp}/{run.wall.maxHp}{nextWall ? ` · 升下级(${nextWall.name}+反伤)：${nextWall.coins}金${nextWall.scrap}铁` : ' · 高压电网反伤生效中'}</small>
            </span>
            <Btn kind="small" id="btn-repair" disabled={run.wall.hp >= run.wall.maxHp || run.coins < WALL_REPAIR_COST} onClick={() => game.send({ t: 'repairWall' })}>修 {WALL_REPAIR_COST}金</Btn>
            <Btn kind="small" id="btn-wall-up" disabled={!nextWall || run.coins < nextWall.coins || run.scrap < nextWall.scrap} onClick={() => game.send({ t: 'upgradeWall' })}>{nextWall ? '升级' : '满级'}</Btn>
          </div>

          <div class="item">
            <Icon k="ic_fort" cls="x2" />
            <span class="grow">
              <b>{FORT_LEVELS[run.fort.level - 1].name} Lv.{run.fort.level}</b>
              <small>耐久 {run.home.hp}/{run.home.maxHp}{nextFort ? ` · 升下级(${nextFort.desc.split(' · ')[0]})：${nextFort.coins}金${nextFort.scrap}铁` : ' · 屋顶双联火炮+每夜修墙'}</small>
            </span>
            <Btn kind="small" id="btn-fort-repair" disabled={run.home.hp >= run.home.maxHp || run.coins < FORT_REPAIR_COST} onClick={() => game.send({ t: 'repairFort' })}>修 {FORT_REPAIR_COST}金</Btn>
            <Btn kind="small" id="btn-fort-up" disabled={!nextFort || run.coins < nextFort.coins || run.scrap < nextFort.scrap} onClick={() => game.send({ t: 'upgradeFort' })}>{nextFort ? '加固' : '满级'}</Btn>
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
    let text = '', big = false;
    if (e.t === 'dayStart') { text = `第 ${e.day} 天 · 跃上屋顶迎战尸潮！`; big = true; }
    else if (e.t === 'bossAppear') { text = `警报！Boss ${ZOMBIES[e.kind].name} 现身！`; big = true; }
    else if (e.t === 'dayClear') text = '本波清场！战利品已清点';
    else if (e.t === 'pickup' && e.isNew) { text = `获得新武器：${WEAPONS[e.weapon].name}（${WEAPONS[e.weapon].trait}）`; big = true; }
    else if (e.t === 'star') { text = `${WEAPONS[e.weapon].name} 升至 ${'★'.repeat(e.star)}${STAR_PERKS[e.star] ? ' · ' + STAR_PERKS[e.star] : ''}`; big = true; }
    else if (e.t === 'skill') { text = `${CLASSES[e.cls].skill}发动！${CLASSES[e.cls].skillDesc}`; big = true; }
    else if (e.t === 'serve') { text = `${e.name}：「${e.quote}」（+${e.coins}金${e.allServed ? ' · 满堂打赏！' : ''}）`; big = !!e.allServed; }
    else if (e.t === 'cook') text = `鲜肉现炒出锅 ×${e.meat}，入账 +${e.coins} 金币`;
    else if (e.t === 'meal') text = `明日私房特餐「${MEALS[e.id].name}」已备妥`;
    else if (e.t === 'hurt') setHurt((n) => n + 1);
    if (!text) return;
    const id = Math.random();
    setItems((list) => [...list.slice(-2), { id, text, big }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2400);
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

  return (
    <>
      {panel !== 'title' && panel !== 'class' && <Hud />}
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
          <p>跃上黄昏酒馆二层屋顶迎战尸潮（按住攻击自动锁敌、拖拽手雷控抛物线），夜归温馨食堂招待熟客、打造四座防线炮塔！（完整 {LAST_DAY} 天 + Boss 战）</p>
          <Progress />
          <Btn id="btn-start" kind="primary" onClick={() => game.chooseClass()}>开始守城</Btn>
        </Panel>
      )}
      {panel === 'class' && <ClassPanel />}
      {panel === 'perk' && <PerkPanel />}
      {panel === 'kitchen' && <KitchenPanel />}
      {panel === 'shop' && <ShopPanel />}
      {panel === 'build' && <BuildPanel />}
      {panel === 'pause' && (
        <Panel id="panel-pause" title="暂停">
          <div class="row">
            <Btn id="btn-resume" kind="primary" onClick={() => game.close()}>继续</Btn>
            <Btn id="btn-restart" kind="danger" onClick={() => game.restart()}>重新开始</Btn>
          </div>
        </Panel>
      )}
      {panel === 'dead' && (
        <Panel id="panel-dead" title="据点失守" sub={`坚持到了第 ${run.day} 天，共消灭 ${run.kills} 只感染者`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>重返防线</Btn>
        </Panel>
      )}
      {panel === 'won' && (
        <Panel id="panel-won" title="守住了最后据点！" sub={`圆满守住全部 ${LAST_DAY} 个日夜，共击杀 ${run.kills} 只丧尸与魔物！`}>
          <Progress gain={game.lastGain} />
          <Btn id="btn-again" kind="primary" onClick={() => game.chooseClass()}>再战一局</Btn>
        </Panel>
      )}
    </>
  );
}
