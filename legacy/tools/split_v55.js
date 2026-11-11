// 一次性拆分脚本：archive/zombie-game-v55.html -> src/
// 纯机械切分（按字符偏移），之后 build.js 把它们原样拼回，产物与 v55 逐字节一致。
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'archive', 'zombie-game-v55.html');
const html = fs.readFileSync(SRC, 'utf8');

function findBlock(open, close, from) {
  const s = html.indexOf(open, from);
  if (s < 0) throw new Error('missing ' + open);
  const cs = s + open.length;
  const e = html.indexOf(close, cs);
  if (e < 0) throw new Error('missing ' + close);
  return { cs, e };
}

// 1) 两个 <style> 与一个 <script>
const st1 = findBlock('<style>\n', '</style>', 0);
const st2 = findBlock('<style>\n', '</style>', st1.e + 8);
const sc = findBlock('<script>\n', '</script>', st2.e + 8);
if (!(st1.e < st2.cs && st2.e < sc.cs)) throw new Error('unexpected order');

const css1 = html.slice(st1.cs, st1.e);
const css2 = html.slice(st2.cs, st2.e);
const js = html.slice(sc.cs, sc.e);
const template =
  html.slice(0, st1.cs) + '/*@@STYLE1@@*/' +
  html.slice(st1.e, st2.cs) + '/*@@STYLE2@@*/' +
  html.slice(st2.e, sc.cs) + '/*@@SCRIPT@@*/' +
  html.slice(sc.e);

// 2) JS 切块：[文件名, 起始行(1 基，绝对行号)]；起始行若紧跟在分节横幅下方，会自动上移到横幅
const SCRIPT_FIRST_LINE = html.slice(0, sc.cs).split('\n').length; // <script> 之后第一行的绝对行号
const CUTS = [
  ['01a_runtime_weapons.js', 2619],
  ['01b_weapon_growth.js', 2822],
  ['01c_game_state.js', 3082],
  ['01d_story_dialogue.js', 3162],
  ['01e_entity_state.js', 3588],
  ['01f_towers_config.js', 3623],
  ['01g_zombie_registry.js', 3673],
  ['01h_start_classes.js', 3765],
  ['01i_cabin_recipes.js', 3841],
  ['02a_audio.js', 3967],
  ['02b_input.js', 5091],
  ['02c_overwhelming_horde.js', 5168],
  ['02d_transitions.js', 5316],
  ['02e_dreamland.js', 5375],
  ['02f_mobile_controls.js', 5965],
  ['02g_gameloop.js', 6360],
  ['03a_player_rendering.js', 7497],
  ['03b_fx_particles.js', 10384],
  ['03c_towers_walls.js', 10748],
  ['03d_perks_classes.js', 12399],
  ['03e_vehicle_fortress.js', 13024],
  ['03f_companions.js', 14954],
  ['03g_dodge_melee.js', 15722],
  ['03h_zombies_and_firing.js', 16126],
  ['03i_reload_combat.js', 16856],
  ['03j_wave_system.js', 18263],
  ['04a_hub.js', 18694],
  ['04b_workshop_expedition.js', 19708],
  ['04c_oldtown.js', 21105],
  ['05a_restaurant_menu.js', 21459],
  ['05b_vip_customers.js', 21604],
  ['05c_daily_trend.js', 22046],
  ['05d_vip_ui_sprites.js', 22521],
  ['05e_customer_models.js', 23396],
  ['05f_social_rep.js', 23768],
  ['05g_restaurant_engine.js', 24046],
  ['05h_cooking_serving.js', 25209],
  ['05i_rest_transitions.js', 27556],
  ['06a_ui_hud.js', 28300],
  ['06b_save_boot.js', 29827],
];

const lines = js.split('\n'); // 末元素是最后一行之后的空串（js 以 \n 结尾）
function snap(absLine) {
  let i = absLine - SCRIPT_FIRST_LINE; // 0 基索引
  // 向上吸附到最近的分节横幅（至多回看 3 行，中间只能是空行）
  for (let k = 1; k <= 3 && i - k >= 0; k++) {
    const t = lines[i - k];
    if (/^\/\/ ═{8,}|^\/\* ═{8,}/.test(t)) return i - k;
    if (t.trim() !== '') break;
  }
  return i;
}
const starts = CUTS.map(c => snap(c[1]));
for (let i = 1; i < starts.length; i++) if (starts[i] <= starts[i - 1]) throw new Error('cut order @' + CUTS[i][0]);
starts[0] = 0;

fs.mkdirSync(path.join(ROOT, 'src', 'js'), { recursive: true });
const order = [];
CUTS.forEach((c, idx) => {
  const a = starts[idx];
  const b = idx + 1 < starts.length ? starts[idx + 1] : lines.length - 1;
  let text = lines.slice(a, b).join('\n') + '\n';
  if (idx + 1 === starts.length) { /* 最后一块：lines 末元素为空串，已含结尾换行 */ }
  fs.writeFileSync(path.join(ROOT, 'src', 'js', c[0]), text);
  order.push(c[0]);
});
fs.writeFileSync(path.join(ROOT, 'src', 'js', '_order.json'), JSON.stringify(order, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'src', 'style1.css'), css1);
fs.writeFileSync(path.join(ROOT, 'src', 'style2.css'), css2);
fs.writeFileSync(path.join(ROOT, 'src', 'index.template.html'), template);
console.log('chunks:', order.length, ' css1:', css1.length, ' css2:', css2.length, ' template:', template.length);
