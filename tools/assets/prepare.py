#!/usr/bin/env python3
"""把选用的开源素材整理成游戏用的图（src/assets/）。只在换素材时手动跑，CI 不跑。

用法：python3 tools/assets/prepare.py [缓存目录]   （需要 Pillow；缓存目录默认 .asset_cache/）
来源全部是 OpenGameArt 上的公开素材包，出处和许可见 assets/CREDITS.md。
这个脚本只做裁切和拼条，不改像素。
"""
import io, json, os, re, sys, urllib.request, zipfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.asset_cache')
OUT = os.path.join(ROOT, 'src', 'assets')

ZIP_PACKS = {  # 缓存子目录 -> OpenGameArt 页面
    'gotthicvania-swamp': 'gotthicvania-swamp',
    'cemetery': 'gothicvania-cemetery-pack',
    'gothicvania-town': 'gothicvania-town',
    'warped-city': 'warped-city',
    'kenneyui': 'ui-pack-pixel-adventure',
    'kyrise': 'kyrises-free-16x16-rpg-icon-pack',
    'guns': 'tiny-gun-icons-16x16',
    'bridge': 'gothicvania-bridge-expansion-pack-1',
    'church': 'gothicvania-church-pack',
    'patreons': 'gothicvania-patreons-collection',
    'warped2': 'warped-city-2',
}

FILE_PACKS = {  # 单图下载 -> OpenGameArt 页面
    'cannon_wire.png': 'cannon-and-barbed-wire',
    'turret_body.png': 'pixel-turret-animation',
    'medieval_interior.png': 'medieval-tileset',
}

UA = {'User-Agent': 'Mozilla/5.0'}

def fetch_zip(pack, slug):
    d = os.path.join(CACHE, pack)
    if os.path.isdir(d) and os.listdir(d): return
    page = urllib.request.urlopen(urllib.request.Request('https://opengameart.org/content/' + slug, headers=UA), timeout=60).read().decode('utf8', 'ignore')
    zips = re.findall(r'https://opengameart\.org/sites/default/files/[^"]+\.zip', page)
    if not zips: raise SystemExit('no zip found for ' + slug)
    url = zips[0]
    print('download', url)
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
    os.makedirs(d, exist_ok=True)
    zipfile.ZipFile(io.BytesIO(data)).extractall(d)

def fetch_file(fname, slug):
    extras = os.path.join(CACHE, 'extras')
    dst = os.path.join(extras, fname)
    if os.path.isfile(dst): return
    page = urllib.request.urlopen(urllib.request.Request('https://opengameart.org/content/' + slug, headers=UA), timeout=60).read().decode('utf8', 'ignore')
    imgs = re.findall(r'https://opengameart\.org/sites/default/files/[^"]+\.png', page)
    if not imgs: raise SystemExit('no png found for ' + slug)
    print('download', imgs[0])
    os.makedirs(extras, exist_ok=True)
    open(dst, 'wb').write(urllib.request.urlopen(urllib.request.Request(imgs[0], headers=UA), timeout=120).read())

def find(pack, *parts):
    """在包里按路径片段找文件，不依赖压缩包顶层目录名。"""
    hits = []
    for base, _, files in os.walk(os.path.join(CACHE, pack)):
        if '__MACOSX' in base: continue
        for f in files:
            p = os.path.join(base, f)
            if p.replace('\\', '/').endswith('/'.join(parts)): hits.append(p)
    if not hits: raise SystemExit('missing ' + pack + ': ' + '/'.join(parts))
    return sorted(hits)[0]

def img(pack, *parts): return Image.open(find(pack, *parts)).convert('RGBA')

manifest = {}
def save(key, im, frames=1):
    im.save(os.path.join(OUT, key + '.png'), optimize=True)
    manifest[key] = {'fw': im.width // frames, 'fh': im.height, 'frames': frames}

def strip(key, frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    save(key, s, len(frames))

def slice_grid(im, count, fw, offset_x=0, out_w=None, flip=False):
    """把定宽条带拆帧，按每帧最下方中心对齐到统一画框（不缩放像素）。"""
    out_w = out_w or fw
    out_h = im.height
    frames = []
    for i in range(count):
        cell = im.crop((offset_x + i * fw, 0, offset_x + (i + 1) * fw, out_h))
        if flip: cell = cell.transpose(Image.FLIP_LEFT_RIGHT)
        box = cell.getbbox()
        canvas = Image.new('RGBA', (out_w, out_h))
        if box:
            cw = box[2] - box[0]
            ch = box[3] - box[1]
            dx = (out_w - cw) // 2
            dy = out_h - ch
            canvas.paste(cell.crop(box), (dx, dy))
        frames.append(canvas)
    return frames

def build_roof_deck(top_l, top_m, top_r):
    """用 Gothicvania Town 原生木栈台图块拼出 216x32 的二楼屋顶平台。"""
    roof_deck = Image.new('RGBA', (216, 32))
    roof_deck.paste(top_l, (0, 0), top_l)
    for i in range(10):
        roof_deck.paste(top_m, (32 + i * 16, 0), top_m)
    roof_deck.paste(top_r, (184, 0), top_r)
    return roof_deck

def build_porch_deck(top_l, top_r, legs, g_legs):
    """用 Gothicvania Town 原生木栈桥与立柱拼出 64x48 的院子跳台台阶。"""
    porch = Image.new('RGBA', (64, 48))
    porch.paste(top_l, (0, 0), top_l)
    porch.paste(top_r, (32, 0), top_r)
    porch.paste(legs, (0, 24), legs)
    porch.paste(legs, (32, 24), legs)
    porch.paste(g_legs, (0, 32), g_legs)
    porch.paste(g_legs, (32, 32), g_legs)
    return porch

def build_tavern_interior(house, house_b, wall_a, wall_b, left_roof, roof_t, right_roof,
                          top_l, top_m, top_r, g_legs, barrel, sign, lamp, mi):
    """用 Gothicvania Town + Bridge 原版建筑图块拼出温馨统一的剖面深夜小食堂（560x220）。
    左区：砖砌烟囱与铁板烧灶台；中区：暖窗与双人堂食木桌；右区：整备柜台与出击木门。"""
    W, H = 560, 220
    FLOOR_Y = 196
    room = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # 1. 哥特瓦片屋顶与左侧厨房砖烟囱
    room.paste(left_roof, (16, 4), left_roof)
    for x in range(80, 512, 16):
        room.paste(roof_t, (x, 4), roof_t)
    room.paste(right_roof, (512, 4), right_roof)
    chimney = house_b.crop((56, 0, 82, 54))
    room.paste(chimney, (68, 0), chimney)

    # 2. 暖色砖木内墙与横竖橡木梁
    for y in range(76, FLOOR_Y, 16):
        for x in range(32, 528, 16):
            tile = wall_b if ((x * 3 + y) // 16) % 7 == 0 else wall_a
            room.paste(tile, (x, y), tile)

    h_beam = house.crop((24, 144, 216, 154))
    for x in range(28, 532, 192):
        w = min(192, 532 - x)
        b = h_beam.crop((0, 0, w, 10))
        room.paste(b, (x, 74), b)

    v_pillar = house.crop((33, 82, 43, 144))
    for px in [32, 188, 396, 518]:
        room.paste(v_pillar, (px, 82), v_pillar)
        room.paste(v_pillar, (px, 134), v_pillar)

    # 3. 暖光拱窗与吊灯
    warm_win = house.crop((134, 86, 178, 134))
    for wx in [124, 220, 320]:
        room.paste(warm_win, (wx, 106), warm_win)

    lamp_head = lamp.crop((0, 0, lamp.width, 32))
    for lx in [88, 250, 348, 452]:
        room.paste(lamp_head, (lx, 78), lamp_head)

    def draw_oak_table(x, w_mid_count):
        y_top = FLOOR_Y - 34
        room.paste(top_l, (x, y_top), top_l)
        room.paste(g_legs, (x, FLOOR_Y - 16), g_legs)
        cx = x + 32
        for _ in range(w_mid_count):
            room.paste(top_m, (cx, y_top), top_m)
            cx += 16
        room.paste(top_r, (cx, y_top), top_r)
        room.paste(g_legs, (cx, FLOOR_Y - 16), g_legs)

    # ── 左区（x = 44..184）：深夜食堂红砖灶台与料理长案 ──
    brick_col = house_b.crop((56, 6, 82, 54))
    room.paste(brick_col, (56, 84), brick_col)
    room.paste(brick_col, (56, 130), brick_col)
    draw_oak_table(48, 2)  # 96px 料理灶台
    platter = mi.crop((192, 208, 208, 224))
    steak = mi.crop((208, 208, 224, 224))
    mug = mi.crop((176, 224, 192, 240))
    room.paste(platter, (94, FLOOR_Y - 44), platter)
    room.paste(steak, (116, FLOOR_Y - 44), steak)
    room.paste(barrel, (152, FLOOR_Y - barrel.height), barrel)

    # ── 中区（x = 200..392）：两张堂食木桌，供夜晚幸存者食客落座点餐 ──
    draw_oak_table(204, 1)  # 1号餐桌
    draw_oak_table(304, 1)  # 2号餐桌
    room.paste(platter, (224, FLOOR_Y - 44), platter)
    room.paste(mug, (248, FLOOR_Y - 46), mug)
    room.paste(steak, (324, FLOOR_Y - 44), steak)
    room.paste(mug, (348, FLOOR_Y - 46), mug)

    # ── 右区（x = 404..518）：整备工坊吧台与出击木门 ──
    room.paste(sign, (412, 96), sign)
    draw_oak_table(406, 0)
    room.paste(mug, (428, FLOOR_Y - 46), mug)
    door = house_b.crop((66, 178, 104, 244))
    room.paste(door, (476, FLOOR_Y - door.height), door)

    # 底部整条厚橡木地板横梁
    for x in range(20, 540, 192):
        w = min(192, 540 - x)
        room.paste(h_beam.crop((0, 0, w, 10)), (x, FLOOR_Y - 2), h_beam.crop((0, 0, w, 10)))
    return room

def main():
    for pack, slug in ZIP_PACKS.items(): fetch_zip(pack, slug)
    for fname, slug in FILE_PACKS.items(): fetch_file(fname, slug)
    os.makedirs(OUT, exist_ok=True)

    # 清理废弃的异风格僵尸贴图，确保包体干净且画风 100% 统一为 ansimuz 哥特像素风
    for old in ['z_hat', 'z_bearded', 'z_oldman', 'z_woman', 'z_roamer',
                'z_roamer_a', 'z_roamer_b', 'z_roamer_c', 'z_crawler', 'z_bruiser', 'z_collapse']:
        p = os.path.join(OUT, old + '.png')
        if os.path.exists(p): os.remove(p)

    # ── 主角：持枪猎人（Gothicvania Swamp, ansimuz）──
    for anim, stem, n in [('idle', 'idle', 6), ('run', 'run', 14), ('shoot', 'shoot', 3), ('jump', 'jump', 2),
                          ('fall', 'fall', 2), ('hurt', 'Hurt', 2), ('crouch', 'crouch', 3)]:
        strip('hero_' + anim, [img('gotthicvania-swamp', 'Player', anim, f'{stem}{i}.png') for i in range(1, n + 1)])

    # ── 统一画风的僵尸与魔物大军（全部出自 ansimuz 的 Gothicvania 系列，天然朝左迎战）──
    strip('z_swamp', [img('gotthicvania-swamp', 'walk thing', f'thing{i}.png') for i in range(1, 5)])
    strip('z_clothed', [img('cemetery', 'Sprites', 'skeleton-clothed', f'skeleton-clothed-{i}.png') for i in range(1, 9)])
    strip('z_skeleton', [img('cemetery', 'Sprites', 'skeleton', f'skeleton-{i}.png') for i in range(1, 9)])
    strip('z_gato', [img('cemetery', 'Sprites', 'hell-gato', f'hell-gato-{i}.png') for i in range(1, 5)])
    strip('z_hound', slice_grid(img('patreons', 'Hell-Hound-Files', 'PNG', 'hell-hound-run.png'), 5, 67, 0, 56, flip=False))
    strip('z_ghoul', [img('church', 'burning-ghoul', 'sprites', 'v1', f'burning-ghoul-{i}.png') for i in range(1, 9)])
    strip('z_wraith', [img('cemetery', 'Sprites', 'ghost-halo', f'ghost-halo-{i}.png') for i in range(1, 5)])
    strip('boss_beast', slice_grid(img('patreons', 'Hell-Beast-Files', 'PNG', 'with-stroke', 'hell-beast-idle.png'), 6, 55, 0, 58, flip=False))
    strip('boss_demon', slice_grid(img('patreons', 'demon-Files', 'PNG', 'demon-idle.png'), 6, 160, 0, 150, flip=False))
    strip('z_death', [img('cemetery', 'Sprites', 'enemy-death', f'enemy-death-{i}.png') for i in range(1, 6)])

    # ── 深夜小食堂的幸存者食客 NPC（Gothicvania Town, ansimuz）──
    for key, d, n in [('npc_hat', 'hat-man-idle', 4), ('npc_woman', 'woman-idle', 7),
                      ('npc_bearded', 'bearded-idle', 5), ('npc_oldman', 'oldman-idle', 8)]:
        strip(key, [img('gothicvania-town', 'sprites', d, f'{d}-{i}.png') for i in range(1, n + 1)])

    # ── 特效：火球、爆炸、灶台炉火 ──
    strip('fx_fireball', [img('church', 'fx', 'fireball', 'fireball-sprites', f'fireball{i}.png') for i in range(1, 4)])
    strip('fx_boom', [img('warped2', 'Sprites', 'explosion-a', f'explosion-a{i}.png') for i in range(1, 9)])
    strip('fx_stove', [img('church', 'fx', 'fireball', 'fireball-sprites', f'fireball{i}.png').transpose(Image.ROTATE_270) for i in range(1, 4)])

    # ── 炮塔、铁丝网、子弹、命中 ──
    strip('turret', [img('warped-city', 'misc', 'turret', f'turret-{i}.png') for i in range(1, 7)])
    save('ic_turret', img('warped-city', 'misc', 'turret', 'turret-1.png'))
    tb = img('extras', 'turret_body.png')
    strip('turret_tesla', [tb.crop((8, 12, 44, 42)), tb.crop((62, 12, 98, 42))])
    save('ic_turret_tesla', tb.crop((8, 12, 44, 42)))
    strip('turret_frost', [img('warped2', 'egg turret', 'Shoot', f'shoot{i}.png') for i in range(1, 5)])
    save('ic_turret_frost', img('warped2', 'egg turret', 'Idle', 'idle1.png'))
    cw = img('extras', 'cannon_wire.png')
    cannon_im = cw.crop((0, 4, 34, 32)).transpose(Image.FLIP_LEFT_RIGHT)
    save('turret_cannon', cannon_im)
    save('ic_turret_cannon', cannon_im)
    save('barbed_wire', cw.crop((24, 30, 74, 64)))

    strip('shot', [img('warped-city', 'misc', 'shot', f'shot-{i}.png') for i in range(1, 4)])
    strip('shot_hit', [img('warped-city', 'misc', 'shot-hit', f'shot-hit-{i}.png') for i in range(1, 4)])

    # ── 场景与立体堡垒酒馆（Gothicvania Town + Bridge Expansion）──
    save('bg_sky', img('gothicvania-town', 'PNG', 'environment', 'layers', 'background.png'))
    save('bg_town', img('gothicvania-town', 'PNG', 'environment', 'layers', 'middleground.png'))
    for key, f in [('house_a', 'house-a'), ('house_b', 'house-b'), ('house_c', 'house-c'), ('crate_stack', 'crate-stack'),
                   ('crate', 'crate'), ('barrel', 'barrel'), ('wagon', 'wagon'), ('lamp', 'street-lamp'), ('well', 'well'), ('sign', 'sign')]:
        save(key, img('gothicvania-town', 'props-sliced', f + '.png'))
    for key, f in [('ground', 'ground'), ('ground_b', 'ground-b'), ('ground_wall', 'ground-wall'), ('wall', 'wall')]:
        save(key, img('gothicvania-town', 'sliced-tileset', f + '.png'))

    house_full = img('bridge', 'Props', 'house.png').crop((0, 0, 256, 203))
    save('fort_house', house_full)
    castle_full = img('bridge', 'Props', 'castle.png')
    save('fort_keep', castle_full.crop((176, 60, 272, 266)))
    save('castle_banner', castle_full.crop((386, 12, 434, 82)))

    top_l = img('gothicvania-town', 'sliced-tileset', 'top-left-wood.png')
    top_m = img('gothicvania-town', 'sliced-tileset', 'top-wood.png')
    top_r = img('gothicvania-town', 'sliced-tileset', 'top-right-wood.png')
    legs = img('gothicvania-town', 'sliced-tileset', 'wood-legs.png')
    g_legs = img('gothicvania-town', 'sliced-tileset', 'ground-wood-legs.png')
    wall_a = img('gothicvania-town', 'sliced-tileset', 'wall.png')
    wall_b = img('gothicvania-town', 'sliced-tileset', 'wall-b.png')
    left_roof = img('gothicvania-town', 'sliced-tileset', 'left-roof.png')
    roof_t = img('gothicvania-town', 'sliced-tileset', 'roof.png')
    right_roof = img('gothicvania-town', 'sliced-tileset', 'right-roof.png')
    house_b = img('gothicvania-town', 'props-sliced', 'house-b.png')
    barrel = img('gothicvania-town', 'props-sliced', 'barrel.png')
    sign = img('gothicvania-town', 'props-sliced', 'sign.png')
    lamp = img('gothicvania-town', 'props-sliced', 'street-lamp.png')
    mi = img('extras', 'medieval_interior.png')

    save('roof_deck', build_roof_deck(top_l, top_m, top_r))
    save('porch_deck', build_porch_deck(top_l, top_r, legs, g_legs))
    save('prop_ladder', mi.crop((208, 0, 224, 64)))
    save('tavern_interior', build_tavern_interior(
        house_full, house_b, wall_a, wall_b, left_roof, roof_t, right_roof,
        top_l, top_m, top_r, g_legs, barrel, sign, lamp, mi
    ))

    # ── 界面：Kenney UI Pack - Pixel Adventure ──
    ui = img('kenneyui', 'Large tiles', 'Thick outline', 'tilemap_packed.png')
    cell = lambda c, r, w=1: ui.crop((c * 32, r * 32, (c + w) * 32, (r + 1) * 32))
    for key, c, r, w in [('ui_card', 0, 0, 1), ('ui_panel', 1, 0, 1), ('ui_slot', 3, 0, 1), ('ui_btn', 4, 0, 1),
                         ('ui_round', 1, 3, 1), ('ui_round_lit', 0, 3, 1), ('ui_banner', 4, 3, 3)]:
        save(key, cell(c, r, w))

    # ── 图标：Kyrise V1.2 16x16 + 食堂菜品小图标 ──
    ic = img('kyrise', 'spritesheet', 'spritesheet_16x16.png')
    for key, c, r in [('ic_coin', 8, 6), ('ic_scrap', 0, 10), ('ic_hp', 1, 13), ('ic_wall', 6, 15), ('ic_zombie', 8, 9),
                      ('ic_crate', 14, 8), ('ic_pierce', 8, 0), ('ic_ricochet', 13, 11), ('ic_overkill', 1, 8),
                      ('ic_lifesteal', 9, 12), ('ic_incendiary', 4, 8), ('ic_overclock', 0, 12),
                      ('ic_frostbite', 0, 8), ('ic_chainkill', 1, 11), ('ic_vanguard', 9, 15), ('ic_bloodfrenzy', 8, 12),
                      ('ic_glasscannon', 1, 7), ('ic_secondwind', 11, 12), ('ic_star', 15, 7), ('ic_chef', 9, 7),
                      ('ic_armor', 7, 15), ('ic_fort', 10, 15), ('ic_grenade', 14, 11),
                      ('ic_rooftop', 11, 0), ('ic_shrapnel', 12, 11), ('ic_fortify', 13, 15), ('ic_shock', 2, 7)]:
        save(key, ic.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)))

    save('ic_meat', mi.crop((224, 224, 240, 240)))
    save('ic_kitchen', mi.crop((192, 208, 208, 224)))
    save('ic_dish_skewer', mi.crop((192, 208, 208, 224)))
    save('ic_dish_stew', mi.crop((176, 224, 192, 240)))
    save('ic_dish_steak', mi.crop((208, 208, 224, 224)))
    save('ic_shop', mi.crop((176, 288, 192, 304)))
    save('ic_anvil', mi.crop((192, 240, 208, 256)))

    # ── 枪械图标（Sogomn Tiny Gun Icons, CC0）──
    for k, fname in [('wp_pistol', 'desert_hawk.png'), ('wp_revolver', 'jb007.png'), ('wp_smg', 'md5.png'),
                     ('wp_shotgun', 'sg1.png'), ('wp_assault', 'poshlinov.png'), ('wp_rifle', 'hitpro.png'),
                     ('wp_tesla', 'gh55b.png'), ('wp_rocket', 'mg6000.png')]:
        save(k, img('guns', fname))

    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1, sort_keys=True)
    print('wrote', len(manifest), 'images to', os.path.relpath(OUT, ROOT))

if __name__ == '__main__': main()
