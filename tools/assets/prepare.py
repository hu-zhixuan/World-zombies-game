#!/usr/bin/env python3
"""把选用的开源素材整理成游戏用的图（src/assets/）。只在换素材时手动跑，CI 不跑。

用法：python3 tools/assets/prepare.py [缓存目录]   （需要 Pillow；缓存目录默认 .asset_cache/）
来源全部是 OpenGameArt 上的公开素材包，出处和许可见 assets/CREDITS.md。
这个脚本只做裁切和拼条，不改像素。
"""
import io, json, os, re, struct, sys, urllib.request, zipfile, zlib
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

def load_ase_cels(ase_path):
    """解析 ansimuz 源文件 player.ase 的分层帧图像（Layer 0 Cape, Layer 1 body, Layer 2 Arm）。"""
    data = open(ase_path, 'rb').read()
    w, h = struct.unpack_from('<HH', data, 8)
    frames_n = struct.unpack_from('<H', data, 6)[0]
    pos = 128
    cels = {}
    for fi in range(frames_n):
        fbytes = struct.unpack_from('<I', data, pos)[0]
        chunks = struct.unpack_from('<H', data, pos + 6)[0]
        chunks2 = struct.unpack_from('<I', data, pos + 12)[0]
        cpos = pos + 16
        for _ in range(chunks2 or chunks):
            csize, ctype = struct.unpack_from('<IH', data, cpos)
            body = data[cpos + 6:cpos + csize]
            if ctype == 0x2005:
                li, cx, cy, _, ct = struct.unpack_from('<HhhBH', body, 0)
                if ct == 2:
                    cw, ch = struct.unpack_from('<HH', body, 16)
                    cels[(fi, li)] = (cx, cy, Image.frombytes('RGBA', (cw, ch), zlib.decompress(body[20:])))
            cpos += csize
        pos += fbytes
    return w, h, cels

def extract_hero_layers(ase_path):
    """把原版持枪猎人的身体披风（去枪手层）与独立活动手臂剥离，解决双枪重叠与浮空枪模问题。"""
    w, h, cels = load_ase_cels(ase_path)
    cape_cols = {(0x1c, 0x33, 0xb1), (0xe5, 0xb9, 0x1b), (0x2c, 0x12, 0x75)}

    def body_frame(fi):
        cv = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        for li in (0, 1):
            if (fi, li) in cels:
                cx, cy, cim = cels[(fi, li)]
                cv.alpha_composite(cim, (cx, cy))
        # 还原画师放在 Arm 层上的披风肩领及受击完整披风（只取披风蓝金色，不带枪身，避免胸前渗出碎点）
        if (fi, 2) in cels:
            cx, cy, aim = cels[(fi, 2)]
            for y in range(aim.height):
                for x in range(aim.width):
                    if cx + x >= 31: continue
                    px = aim.getpixel((x, y))
                    if px[3] > 0 and px[:3] in cape_cols:
                        cv.putpixel((cx + x, cy + y), px)
        # 清理 Idle 帧里残留在身体前方的零散枪口/手部残像素
        if 1 <= fi <= 6:
            for y in range(16, 35):
                for x in range(32, w):
                    cv.putpixel((x, y), (0, 0, 0, 0))
        return cv

    tags = [
        ('idle', range(1, 7)),
        ('run', range(7, 21)),
        ('shoot', range(21, 24)),
        ('crouch', range(24, 27)),
        ('jump', range(30, 32)),
        ('fall', range(32, 34)),
        ('hurt', range(34, 36)),
    ]
    bodies = {name: [body_frame(fi) for fi in rng] for name, rng in tags}

    # 从 Shoot 第 21 帧的 Arm 层单独裁出夹克袖管 + 握把右拳（15x8，去除披风领与长步枪管）
    cx, cy, arm21 = cels[(21, 2)]
    arm_canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    arm_canvas.alpha_composite(arm21, (cx, cy))
    arm_crop = arm_canvas.crop((18, 17, 33, 25))
    hero_arm = Image.new('RGBA', (15, 8), (0, 0, 0, 0))
    for y in range(8):
        for x in range(15):
            px = arm_crop.getpixel((x, y))
            if px[3] == 0 or px[:3] in cape_cols: continue
            if y == 0 and x >= 6: continue
            if y == 1 and x >= 7: continue
            if x >= 13 and px[:3] in ((0x32, 0x22, 0x2e), (0x4f, 0x2b, 0x22)): continue
            if y >= 6 and x >= 11: continue
            hero_arm.putpixel((x, y), px)

    # 室内脱枪闲逛用的自然下垂袖管（沿用同色卡原画夹克+手掌）
    pal = {
        'B': (0x8c, 0x4c, 0x35, 255), 'C': (0xb3, 0x80, 0x4a, 255), 'E': (0x4f, 0x2b, 0x22, 255),
        'G': (0xe1, 0x92, 0x4d, 255), 'H': (0xa4, 0x49, 0x3e, 255), '.': (0, 0, 0, 0),
    }
    rest_art = [
        '.BCCB.', 'BCCCCB', 'BCCCCE', 'BCBBCE', '.BCCBE', '.BCCBE',
        '.BBCCE', '.BEEEE', '..EE..', '..GG..', '.GGH..', '.GH...',
    ]
    hero_arm_rest = Image.new('RGBA', (6, 12), (0, 0, 0, 0))
    for y, row in enumerate(rest_art):
        for x, ch in enumerate(row):
            hero_arm_rest.putpixel((x, y), pal[ch])

    return bodies, hero_arm, hero_arm_rest

def build_tavern_interior(house, house_b, wall_a, wall_b, left_roof, roof_t, right_roof,
                          top_l, top_m, top_r, g_legs, barrel, sign, lamp, mi):
    """用 Gothicvania Town + Bridge + Medieval Interior 拼出干净温馨的深夜食堂剖面（560x220）。
    左区：砖窑烤炉、香料架与料理台；中区：暖窗与空洁原木双人餐桌；右区：整备铁砧柜台与木门。"""
    W, H = 560, 220
    FLOOR_Y = 196
    room = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # 1. 哥特瓦片屋顶与左侧厨房砖烟囱
    room.paste(left_roof, (16, 4), left_roof)
    for x in range(80, 512, 16):
        room.paste(roof_t, (x, 4), roof_t)
    room.paste(right_roof, (512, 4), right_roof)
    chimney = house_b.crop((56, 0, 82, 54))
    room.paste(chimney, (58, 0), chimney)

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
    for px in [32, 184, 386, 518]:
        room.paste(v_pillar, (px, 82), v_pillar)
        room.paste(v_pillar, (px, 134), v_pillar)

    # 3. 暖光拱窗与均匀分布的吊灯
    warm_win = house.crop((134, 86, 178, 134))
    for wx in [212, 316]:
        room.paste(warm_win, (wx, 104), warm_win)

    lamp_head = lamp.crop((0, 0, lamp.width, 32))
    for lx in [120, 224, 328, 444]:
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

    # ── 左区：红砖烟道 + 发光石头烤炉 + 香料架与干净料理备餐台 ──
    brick_col = house_b.crop((56, 6, 82, 54))
    room.paste(brick_col, (58, 84), brick_col)
    room.paste(brick_col, (58, 132), brick_col)
    oven = mi.crop((96, 288, 144, 320))
    room.paste(oven, (47, FLOOR_Y - oven.height), oven)
    shelf = mi.crop((192, 128, 224, 176))
    room.paste(shelf, (112, 112), shelf)
    herbs = mi.crop((224, 128, 240, 140))
    berries = mi.crop((224, 140, 240, 150))
    room.paste(herbs, (115, 118), herbs)
    room.paste(berries, (127, 134), berries)
    draw_oak_table(100, 0)
    room.paste(barrel, (160, FLOOR_Y - barrel.height), barrel)

    # ── 中区：两张干净清爽的堂食木桌与木椅（桌面留白，待点餐上菜后呈现热菜）──
    chair_l = mi.crop((176, 176, 192, 208))
    chair_r = mi.crop((192, 176, 208, 208))
    draw_oak_table(206, 1)  # 1号大餐桌 (坐席 0、1 左右对坐)
    room.paste(chair_l, (194, FLOOR_Y - chair_l.height), chair_l)
    room.paste(chair_r, (282, FLOOR_Y - chair_r.height), chair_r)
    draw_oak_table(312, 0)  # 2号餐桌 (坐席 2 右侧落座)
    room.paste(chair_l, (300, FLOOR_Y - chair_l.height), chair_l)
    room.paste(chair_r, (372, FLOOR_Y - chair_r.height), chair_r)

    # ── 右区：防线铁砧工作台、酒馆招牌与出击木门 ──
    room.paste(sign, (414, 96), sign)
    draw_oak_table(402, 0)
    anvil = mi.crop((192, 240, 208, 256))
    room.paste(anvil, (416, FLOOR_Y - 46), anvil)
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

    # ── 主角：分层剥离后的持枪猎人躯干 + 独立瞄准握把手臂（解决手模浮空/双枪穿模）──
    bodies, hero_arm, hero_arm_rest = extract_hero_layers(find('gotthicvania-swamp', 'Player', 'player.ase'))
    for anim, frames in bodies.items():
        strip('hero_' + anim, frames)
    save('hero_arm', hero_arm)
    save('hero_arm_rest', hero_arm_rest)

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

    def center16(crop_im):
        c = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        box = crop_im.getbbox()
        if box:
            sub = crop_im.crop(box)
            c.paste(sub, ((16 - sub.width) // 2, (16 - sub.height) // 2), sub)
        return c

    save('ic_meat', mi.crop((224, 224, 240, 240)))
    save('ic_kitchen', mi.crop((192, 208, 208, 224)))
    save('ic_dish_skewer', center16(mi.crop((240, 224, 256, 240))))   # 炭烤香辣肉串
    save('ic_dish_stew', center16(mi.crop((208, 224, 224, 240))))     # 末世暖胃肉汤
    save('ic_dish_steak', center16(mi.crop((192, 208, 208, 224))))    # 铁板滋滋厚排
    save('ic_dish_grill', center16(mi.crop((225, 136, 239, 144))))    # 碳火三拼盛宴
    save('ic_dish_hotpot', center16(mi.crop((225, 151, 239, 161))))   # 地狱异变火锅
    save('ic_dish_feast', center16(mi.crop((192, 224, 208, 240))))    # 终章末日大餐
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
