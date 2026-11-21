#!/usr/bin/env python3
"""把选用的开源素材整理成游戏用的图（src/assets/）。只在换素材时手动跑，CI 不跑。

用法：python3 tools/assets/prepare.py [缓存目录]   （需要 Pillow；缓存目录默认 .asset_cache/）
来源全部是 OpenGameArt 上的公开素材包，出处和许可见 assets/CREDITS.md。
这个脚本只做裁切和拼条，不改像素。
"""
import io, json, os, re, struct, sys, urllib.request, zipfile, zlib
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.asset_cache')
OUT = os.path.join(ROOT, 'src', 'assets')
ANDROID_RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

ZIP_PACKS = {  # 缓存子目录 -> OpenGameArt 页面
    'gotthicvania-swamp': 'gotthicvania-swamp',
    'cemetery': 'gothicvania-cemetery-pack',
    'gothicvania-town': 'gothicvania-town',
    'warped-city': 'warped-city',
    'kenneyui': 'ui-pack-pixel-adventure',
    'kyrise': 'kyrises-free-16x16-rpg-icon-pack',
    'ghostbyte': 'ghostbyte-dev-weapons-pack-v10-32x32',
    'snoops': 'bows-and-guns-cc0',
    'bat': 'bat-rework',
    'foodicons': 'pixel-food-icons',
    'bridge': 'gothicvania-bridge-expansion-pack-1',
    'church': 'gothicvania-church-pack',
    'patreons': 'gothicvania-patreons-collection',
    'artillery': 'pixel-art-cannon-and-artillery-lpc',
    'magic9': 'gothicvania-magic-pack-9',
}

FILE_PACKS = {  # 单图下载 -> OpenGameArt 页面（或 (页面, 文件名片段)）
    'cannon_wire.png': 'cannon-and-barbed-wire',
    'medieval_interior.png': ('medieval-tileset', 'interior'),
    'crystal_sheet.png': ('ancient-crystal-2d-pixel-art', 'spritesheet_32.png'),
    'aqua_staff.png': ('16x16-pixel-art-staff', 'Aqua%20Staff.png'),
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

def fetch_file(fname, spec):
    extras = os.path.join(CACHE, 'extras')
    dst = os.path.join(extras, fname)
    if os.path.isfile(dst): return
    slug, match = spec if isinstance(spec, tuple) else (spec, None)
    page = urllib.request.urlopen(urllib.request.Request('https://opengameart.org/content/' + slug, headers=UA), timeout=60).read().decode('utf8', 'ignore')
    imgs = re.findall(r'https://opengameart\.org/sites/default/files/[^"]+\.png', page)
    if match:
        imgs = [u for u in imgs if match in u]
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
    """用 Gothicvania Town + Bridge + Medieval Interior 拼出宽敞温馨的深夜酒馆剖面（720x220）。
    左区：砖窑烤炉、石臼料台与吧台；中区：3面暖窗与扩建餐区（基础2桌4座 + 可扩建至4桌8座）；右区：行商、铁砧与大门。"""
    W, H = 720, 220
    FLOOR_Y = 196
    room = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    # 1. 哥特瓦片屋顶与左侧厨房砖烟囱
    room.paste(left_roof, (16, 4), left_roof)
    for x in range(80, W - 48, 16):
        room.paste(roof_t, (x, 4), roof_t)
    room.paste(right_roof, (W - 48, 4), right_roof)
    chimney = house_b.crop((56, 0, 82, 54))
    room.paste(chimney, (58, 0), chimney)

    # 2. 暖色砖木内墙与横竖橡木梁
    for y in range(76, FLOOR_Y, 16):
        for x in range(32, W - 32, 16):
            tile = wall_b if ((x * 3 + y) // 16) % 7 == 0 else wall_a
            room.paste(tile, (x, y), tile)

    h_beam = house.crop((24, 144, 216, 154))
    for x in range(28, W - 28, 192):
        w = min(192, (W - 28) - x)
        b = h_beam.crop((0, 0, w, 10))
        room.paste(b, (x, 74), b)

    v_pillar = house.crop((33, 82, 43, 144))
    for px in [32, 184, 386, 566, W - 42]:
        room.paste(v_pillar, (px, 82), v_pillar)
        room.paste(v_pillar, (px, 134), v_pillar)

    # 3. 暖光拱窗与均匀分布的吊灯
    warm_win = house.crop((134, 86, 178, 134))
    for wx in [212, 348, 484]:
        room.paste(warm_win, (wx, 104), warm_win)

    lamp_head = lamp.crop((0, 0, lamp.width, 32))
    for lx in [120, 224, 360, 496]:
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

    # ── 左区（维持精确动线）：红砖烟道 + 发光石头烤炉 + 香料架与传菜台 + 酒桶吧台 ──
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

    # ── 中区：基础 2 桌（4 座），右侧留出空旷地板供「客席扩建」实景摆出第 3、4 桌（6/8 座） ──
    chair_l = mi.crop((176, 176, 192, 208))
    chair_r = mi.crop((192, 176, 208, 208))
    draw_oak_table(198, 0)  # 1号餐桌 (坐席 0、1)
    room.paste(chair_l, (186, FLOOR_Y - chair_l.height), chair_l)
    room.paste(chair_r, (262, FLOOR_Y - chair_r.height), chair_r)
    draw_oak_table(296, 0)  # 2号餐桌 (坐席 2、3)
    room.paste(chair_l, (284, FLOOR_Y - chair_l.height), chair_l)
    room.paste(chair_r, (360, FLOOR_Y - chair_r.height), chair_r)

    # ── 右区：军械账簿（行商 x~698）、防线铁砧（工坊 x~736）、酒馆招牌与出击木门（x~776） ──
    room.paste(sign, (588, 96), sign)
    draw_oak_table(578, 0)
    ledger = mi.crop((176, 240, 192, 256))
    room.paste(ledger, (582, FLOOR_Y - 46), ledger)
    anvil = mi.crop((192, 240, 208, 256))
    room.paste(anvil, (614, FLOOR_Y - 46), anvil)
    door = house_b.crop((66, 178, 104, 244))
    room.paste(door, (644, FLOOR_Y - door.height), door)

    # 底部整条厚橡木地板横梁
    for x in range(20, W - 20, 192):
        w = min(192, (W - 20) - x)
        room.paste(h_beam.crop((0, 0, w, 10)), (x, FLOOR_Y - 2), h_beam.crop((0, 0, w, 10)))
    return room

def build_tavern_upgrade_props(top_l, top_r, g_legs, barrel, lamp, mi):
    """用开源像素散件无缩放拼出 4 件酒馆大件装修实景道具。"""
    # 1. 客席扩建橡木双人餐桌组 (90x34)
    tbl = Image.new('RGBA', (90, 34), (0, 0, 0, 0))
    chair_l = mi.crop((176, 176, 192, 208))
    chair_r = mi.crop((192, 176, 208, 208))
    tbl.paste(top_l, (13, 0), top_l)
    tbl.paste(g_legs, (13, 18), g_legs)
    tbl.paste(top_r, (45, 0), top_r)
    tbl.paste(g_legs, (45, 18), g_legs)
    tbl.paste(chair_l, (1, 2), chair_l)
    tbl.paste(chair_r, (73, 2), chair_r)

    # 2. 双层传菜木架 + 摆盘瓷具 (34x48)
    pass_rack = Image.new('RGBA', (34, 48), (0, 0, 0, 0))
    shelf = mi.crop((192, 128, 224, 176))
    plate = mi.crop((176, 208, 192, 224))
    pass_rack.paste(shelf, (1, 0), shelf)
    pass_rack.paste(plate, (3, 10), plate)
    pass_rack.paste(plate, (17, 10), plate)

    # 3. 精铜酒栓吧台 + 黄铜酒杯 (36x34，酒杯稳稳放在橡木角桌面上)
    tap_bar = Image.new('RGBA', (44, 34), (0, 0, 0, 0))
    tap_bar.paste(barrel, (0, 34 - barrel.height), barrel)
    tap_bar.paste(top_l.crop((0, 0, 20, 16)), (22, 10), top_l.crop((0, 0, 20, 16)))
    tap_bar.paste(g_legs.crop((0, 0, 16, 16)), (24, 18), g_legs.crop((0, 0, 16, 16)))
    mug = mi.crop((176, 224, 192, 240))
    tap_bar.paste(mug, (24, 0), mug)

    # 4. 暖琥珀壁灯华盖 (24x32)
    chand = lamp.crop((0, 0, lamp.width, 32))
    return tbl, pass_rack, tap_bar, chand

def build_android_icons(sky, town, ground_wall, fort_house, roof_deck, hero_idle, hero_arm, rifle, flash, lamp):
    """全部选用人画开源 Gothicvania 原图整数倍合成 432x432 安卓自适应图标与全密度圆/方图标。"""
    if not os.path.isdir(ANDROID_RES):
        return
    # 1. 背景层（144x144 整数 3x -> 432x432）：暮紫夜空 + 哥特城镇暗影剪影 + 底层石砖墙
    bg_1x = Image.new('RGBA', (144, 144))
    bg_1x.paste(sky.crop((80, 0, 224, 144)), (0, 0))
    bg_1x.alpha_composite(town.crop((32, 108, 176, 252)), (0, 0))
    for x in range(0, 144, ground_wall.width):
        bg_1x.paste(ground_wall, (x, 122))
    bg = bg_1x.resize((432, 432), Image.NEAREST)

    # 2. 前景层（144x144 整数 3x -> 432x432）：满幅温暖拱窗酒馆正立面 + 二层木屋顶平台 + 屋顶开火猎人 + 路灯（主角与亮窗均居于自适应安全圈内）
    fg_1x = Image.new('RGBA', (144, 144), (0, 0, 0, 0))
    tavern_facade = fort_house.crop((62, 56, 206, 152))  # 144x96: 满幅瓦檐 + 木门 + 暖橙大拱窗
    fg_1x.alpha_composite(tavern_facade, (0, 52))
    fg_1x.alpha_composite(roof_deck.crop((0, 0, 64, 12)), (26, 62))
    fg_1x.alpha_composite(hero_idle, (20, 16))
    fg_1x.alpha_composite(hero_arm, (42, 33))
    fg_1x.alpha_composite(rifle, (52, 34))
    fb = flash.getbbox()
    muzzle = (flash.crop(fb) if fb else flash).resize((16, 16), Image.NEAREST)
    fg_1x.alpha_composite(muzzle, (68, 27))
    fg_1x.alpha_composite(lamp.crop((0, 0, lamp.width, 48)), (98, 74))
    fg = fg_1x.resize((432, 432), Image.NEAREST)

    nodpi = os.path.join(ANDROID_RES, 'drawable-nodpi')
    os.makedirs(nodpi, exist_ok=True)
    bg.save(os.path.join(nodpi, 'ic_launcher_bg.png'), optimize=True)
    fg.save(os.path.join(nodpi, 'ic_launcher_fg.png'), optimize=True)

    full = Image.alpha_composite(bg, fg)
    for bucket, sz in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        d = os.path.join(ANDROID_RES, 'mipmap-' + bucket)
        os.makedirs(d, exist_ok=True)
        sq = full.resize((sz, sz), Image.NEAREST)
        sq.save(os.path.join(d, 'ic_launcher.png'), optimize=True)
        mask = Image.new('L', (sz, sz), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, sz - 1, sz - 1), fill=255)
        rd = Image.new('RGBA', (sz, sz), (0, 0, 0, 0))
        rd.paste(sq, (0, 0), mask)
        rd.save(os.path.join(d, 'ic_launcher_round.png'), optimize=True)

def main():
    for pack, slug in ZIP_PACKS.items(): fetch_zip(pack, slug)
    for fname, spec in FILE_PACKS.items(): fetch_file(fname, spec)
    os.makedirs(OUT, exist_ok=True)

    # 清理废弃或异画风旧贴图，确保包体干净且画风 100% 统一
    for old in ['z_hat', 'z_bearded', 'z_oldman', 'z_woman', 'z_roamer',
                'z_roamer_a', 'z_roamer_b', 'z_roamer_c', 'z_crawler', 'z_bruiser', 'z_collapse', 'z_wraith', 'ic_scrap']:
        p = os.path.join(OUT, old + '.png')
        if os.path.exists(p): os.remove(p)

    # ── 主角：分层剥离后的持枪猎人躯干 + 独立瞄准握把手臂（解决手模浮空/双枪穿模）──
    bodies, hero_arm, hero_arm_rest = extract_hero_layers(find('gotthicvania-swamp', 'Player', 'player.ase'))
    for anim, frames in bodies.items():
        strip('hero_' + anim, frames)
    save('hero_arm', hero_arm)
    save('hero_arm_rest', hero_arm_rest)

    # ── 统一画风的僵尸与魔物大军（全部出自 ansimuz 的 Gothicvania 系列 + AntumDeluge 蝙蝠，天然朝左迎战）──
    strip('z_swamp', [img('gotthicvania-swamp', 'walk thing', f'thing{i}.png') for i in range(1, 5)])
    strip('z_clothed', [img('cemetery', 'Sprites', 'skeleton-clothed', f'skeleton-clothed-{i}.png') for i in range(1, 9)])
    strip('z_skeleton', [img('cemetery', 'Sprites', 'skeleton', f'skeleton-{i}.png') for i in range(1, 9)])
    strip('z_gato', [img('cemetery', 'Sprites', 'hell-gato', f'hell-gato-{i}.png') for i in range(1, 5)])
    strip('z_hound', slice_grid(img('patreons', 'Hell-Hound-Files', 'PNG', 'hell-hound-run.png'), 5, 67, 0, 56, flip=False))
    strip('z_ghoul', [img('church', 'burning-ghoul', 'sprites', 'v1', f'burning-ghoul-{i}.png') for i in range(1, 9)])
    bat_sheet = img('bat', 'PNG', '48x64', 'bat-NESW.png')
    strip('z_bat', slice_grid(bat_sheet.crop((0, 192 + 18, 144, 192 + 45)), 3, 48, 0, 26, flip=False))
    strip('z_ghost', [img('gotthicvania-swamp', 'Sprites', 'Ghost', 'Flying', f'Ghost{i}.png') for i in range(1, 5)])
    strip('boss_beast', slice_grid(img('patreons', 'Hell-Beast-Files', 'PNG', 'with-stroke', 'hell-beast-idle.png'), 6, 55, 0, 58, flip=False))
    strip('boss_demon', slice_grid(img('patreons', 'demon-Files', 'PNG', 'demon-idle.png'), 6, 160, 0, 150, flip=False))
    strip('z_death', [img('cemetery', 'Sprites', 'enemy-death', f'enemy-death-{i}.png') for i in range(1, 6)])

    # ── 4 位并肩作战战友（全部重建为 Gothicvania 独立战斗角色：待机 + 巡逻奔跑 + 完整攻击三态，脊柱中心 0.5 严格对齐绝不瞬移，全员朝右）──
    def crop_anchor_frame(src, top_y, out_w, anchor_x):
        sub = src.crop((0, top_y, src.width, src.height))
        out_h = sub.height
        cv = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
        dx = out_w // 2 - round(anchor_x)
        sx0 = max(0, -dx)
        sx1 = min(sub.width, out_w - dx)
        if sx1 > sx0:
            cv.alpha_composite(sub.crop((sx0, 0, sx1, out_h)), (max(0, dx), 0))
        return cv

    def sheet_anchor_frames(im, fw, count, out_w, anchor_x, flip=False):
        out_h = im.height
        frames = []
        for i in range(count):
            cell = im.crop((i * fw, 0, (i + 1) * fw, out_h))
            if flip:
                cell = cell.transpose(Image.FLIP_LEFT_RIGHT)
            frames.append(crop_anchor_frame(cell, 0, out_w, anchor_x))
        return frames

    # 老兵张（银枪穿刺）：idle 朝左故先水平翻转（中心 x=46）；run/atk 原生朝右（中心 x=50 / x=43）
    strip('ally_zhang', [
        crop_anchor_frame(img('cemetery', 'Sprites', 'hero', 'hero-idle', f'hero-idle-{i}.png').transpose(Image.FLIP_LEFT_RIGHT), 12, 96, 46)
        for i in range(1, 5)
    ])
    strip('ally_zhang_run', [
        crop_anchor_frame(img('cemetery', 'Sprites', 'hero', 'hero-run', f'hero-run-{i}.png'), 12, 96, 50)
        for i in range(1, 7)
    ])
    strip('ally_zhang_atk', [
        crop_anchor_frame(img('cemetery', 'Sprites', 'hero', 'hero-attack', f'hero-attack-{i}.png'), 12, 114, 43)
        for i in range(1, 6)
    ])

    # 炼金师小林（圣火炼金）：原版 wizard 朝左，全部翻转朝右并在中心 x=41 对齐施法 10 帧
    strip('ally_lin', [
        crop_anchor_frame(img('church', 'wizard', 'idle-sprites', f'wizard-idle-{i}.png').transpose(Image.FLIP_LEFT_RIGHT), 13, 64, 41)
        for i in range(1, 6)
    ])
    strip('ally_lin_atk', [
        crop_anchor_frame(img('church', 'wizard', 'fire-sprites', f'fire{i}.png').transpose(Image.FLIP_LEFT_RIGHT), 13, 84, 41)
        for i in range(1, 11)
    ])

    # 铁匠阿强（重铠剑卫）：idle(38px, 中心18)/run(66px, 中心38)/attack(96px, 中心43) 全员按脊柱对齐，彻底消除攻击瞬移
    strip('ally_qiang', sheet_anchor_frames(img('patreons', 'Gothic-hero-Files', 'PNG', 'gothic-hero-idle.png'), 38, 4, 52, 18))
    strip('ally_qiang_run', sheet_anchor_frames(img('patreons', 'Gothic-hero-Files', 'PNG', 'gothic-hero-run.png'), 66, 12, 72, 38))
    strip('ally_qiang_atk', sheet_anchor_frames(img('patreons', 'Gothic-hero-Files', 'PNG', 'gothic-hero-attack.png'), 96, 6, 116, 43))

    # 武僧小赵（苍蓝气劲）：punch 第1帧姿态靠左、第2~6帧前探出拳，逐帧校准锚点 [32,35,35,35,35,35] 确保出拳不横移
    strip('ally_zhao', [crop_anchor_frame(img('church', 'player', 'sprites', f'idle{i}.png'), 12, 54, 40) for i in range(1, 5)])
    strip('ally_zhao_run', [crop_anchor_frame(img('church', 'player', 'sprites', f'walk{i}.png'), 12, 54, 38.5) for i in range(1, 7)])
    strip('ally_zhao_atk', [
        crop_anchor_frame(img('church', 'player', 'sprites', f'punch{i}.png'), 12, 104, ax)
        for i, ax in enumerate([32, 35, 35, 35, 35, 35], 1)
    ])


    # ── 深夜小食堂的幸存者食客 NPC（含待机与进门步行帧，Gothicvania Town, ansimuz）──
    for key, d, n in [
        ('npc_hat', 'hat-man-idle', 4), ('npc_hat_walk', 'hat-man-walk', 6),
        ('npc_woman', 'woman-idle', 7), ('npc_woman_walk', 'woman-walk', 6),
        ('npc_bearded', 'bearded-idle', 5), ('npc_bearded_walk', 'bearded-walk', 6),
        ('npc_oldman', 'oldman-idle', 8), ('npc_oldman_walk', 'oldman-walk', 12),
    ]:
        strip(key, [img('gothicvania-town', 'sprites', d, f'{d}-{i}.png') for i in range(1, n + 1)])

    # ── 特效：火球、暗黑奇幻火焰爆炸（Magic Pack 9 FireBomb）、灶台炉火 ──
    strip('fx_fireball', [img('church', 'fx', 'fireball', 'fireball-sprites', f'fireball{i}.png') for i in range(1, 4)])
    strip('fx_boom', [img('magic9', 'sprites', 'FireBomb', f'Fire-bomb{i}.png') for i in range(8, 15)])
    strip('fx_stove', [img('church', 'fx', 'fireball', 'fireball-sprites', f'fireball{i}.png').transpose(Image.ROTATE_270) for i in range(1, 4)])

    # ── 炮塔、铁丝网、子弹、命中（全部统一暗黑冷兵器/铁铳/秘晶/重炮像素风格，且全员天然朝右！） ──
    mg_raw = img('artillery', 'ShotGun.png')
    mg_turret = mg_raw.crop((3, 3, 52, 41))
    save('turret', mg_turret)
    save('ic_turret', mg_turret)

    crystal_sheet = img('extras', 'crystal_sheet.png')
    crystal_frames = [crystal_sheet.crop((i * 64 + 1, 12, i * 64 + 62, 112)) for i in range(7)]
    strip('turret_frost', crystal_frames)
    save('ic_turret_frost', crystal_sheet.crop((12, 11, 52, 74)))

    thunder_raw = img('artillery', 'ThunderMortar.png')
    thunder_turret = thunder_raw.crop((2, 2, 46, 50))
    save('turret_tesla', thunder_turret)
    save('ic_turret_tesla', thunder_turret)

    cw = img('extras', 'cannon_wire.png')
    cannon_im = cw.crop((0, 4, 34, 32))
    save('turret_cannon', cannon_im)
    save('ic_turret_cannon', cannon_im)
    save('barbed_wire', cw.crop((24, 30, 74, 64)))

    strip('shot', [img('warped-city', 'misc', 'shot', f'shot-{i}.png') for i in range(1, 4)])
    strip('shot_hit', [img('warped-city', 'misc', 'shot-hit', f'shot-hit-{i}.png') for i in range(1, 4)])

    # ── 场景与立体堡垒酒馆（Gothicvania Town + Bridge Expansion）──
    bg_sky = img('gothicvania-town', 'PNG', 'environment', 'layers', 'background.png')
    bg_town = img('gothicvania-town', 'PNG', 'environment', 'layers', 'middleground.png')
    save('bg_sky', bg_sky)
    save('bg_town', bg_town)
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
    ground_wall = img('gothicvania-town', 'sliced-tileset', 'ground-wall.png')
    mi = img('extras', 'medieval_interior.png')

    roof_deck = build_roof_deck(top_l, top_m, top_r)
    save('roof_deck', roof_deck)
    save('porch_deck', build_porch_deck(top_l, top_r, legs, g_legs))
    save('prop_ladder', mi.crop((208, 0, 224, 64)))
    save('tavern_interior', build_tavern_interior(
        house_full, house_b, wall_a, wall_b, left_roof, roof_t, right_roof,
        top_l, top_m, top_r, g_legs, barrel, sign, lamp, mi
    ))
    prop_table, prop_pass, prop_tap, prop_chand = build_tavern_upgrade_props(top_l, top_r, g_legs, barrel, lamp, mi)
    save('tavern_prop_table', prop_table)
    save('tavern_prop_pass', prop_pass)
    save('tavern_prop_tap', prop_tap)
    save('tavern_prop_chandelier', prop_chand)

    # ── 界面：Kenney UI Pack - Pixel Adventure ──
    ui = img('kenneyui', 'Large tiles', 'Thick outline', 'tilemap_packed.png')
    cell = lambda c, r, w=1: ui.crop((c * 32, r * 32, (c + w) * 32, (r + 1) * 32))
    for key, c, r, w in [('ui_card', 0, 0, 1), ('ui_panel', 1, 0, 1), ('ui_slot', 3, 0, 1), ('ui_btn', 4, 0, 1),
                         ('ui_round', 1, 3, 1), ('ui_round_lit', 0, 3, 1), ('ui_banner', 4, 3, 3)]:
        save(key, cell(c, r, w))

    # ── 图标：Kyrise V1.2 16x16 + Pixel Food Icons + Medieval Tileset 清晰菜肴 ──
    ic = img('kyrise', 'spritesheet', 'spritesheet_16x16.png')
    for key, c, r in [('ic_coin', 8, 6), ('ic_hp', 1, 13), ('ic_wall', 6, 15), ('ic_zombie', 8, 9),
                      ('ic_crate', 14, 8), ('ic_pierce', 8, 0), ('ic_ricochet', 13, 11), ('ic_overkill', 1, 8),
                      ('ic_lifesteal', 9, 12), ('ic_incendiary', 4, 8), ('ic_overclock', 0, 12),
                      ('ic_frostbite', 0, 8), ('ic_chainkill', 1, 11), ('ic_vanguard', 9, 15), ('ic_bloodfrenzy', 8, 12),
                      ('ic_glasscannon', 1, 7), ('ic_secondwind', 11, 12), ('ic_star', 15, 7),
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

    def tight(im):
        b = im.getbbox()
        return im.crop(b) if b else im

    save('ic_meat', mi.crop((224, 224, 240, 240)))
    save('ic_meat_thick', center16(mi.crop((240, 224, 256, 240))))
    save('ic_meat_essence', ic.crop((5 * 16, 13 * 16, 6 * 16, 14 * 16)))
    save('ic_spice', center16(mi.crop((208, 288, 224, 304))))
    save('ic_mortar', center16(mi.crop((208, 256, 224, 272))))
    save('ic_sauce', ic.crop((9 * 16, 12 * 16, 10 * 16, 13 * 16)))
    save('ic_flame', ic.crop((4 * 16, 8 * 16, 5 * 16, 9 * 16)))
    save('ic_rye', center16(mi.crop((224, 150, 240, 160))))
    save('ic_chef', mi.crop((224, 208, 240, 224)))
    save('ic_kitchen', mi.crop((176, 224, 192, 240)))
    save('ic_beer', center16(mi.crop((176, 224, 192, 240))))
    save('ic_tea', center16(img('foodicons', '1x', 'morning-tea-cup.png')))
    save('ic_clean_plate', center16(mi.crop((176, 208, 192, 224))))
    save('ic_dirty_plate', center16(mi.crop((208, 208, 224, 224))))
    save('ic_ledger', center16(mi.crop((176, 240, 192, 256))))
    save('ic_dish_skewer', center16(img('foodicons', '1x', 'roasted-chicken-drumstick.png')))
    save('ic_dish_stew', center16(mi.crop((224, 208, 240, 224))))
    save('ic_dish_coldcut', center16(img('foodicons', '1x', 'raw-chicken-breast.png')))
    save('ic_dish_steak', center16(mi.crop((192, 208, 208, 224))))
    save('ic_dish_egg', center16(img('foodicons', '1x', 'sunny-side-up.png')))
    save('ic_dish_corn', center16(img('foodicons', '1x', 'fresh-corn-cob.png')))
    save('ic_dish_turnip', center16(img('foodicons', '1x', 'turnip.png')))
    save('ic_dish_cheese', center16(img('foodicons', '1x', 'wedge-of-cheese.png')))
    save('ic_dish_carrot', center16(img('foodicons', '1x', 'fresh-carrot.png')))
    save('ic_dish_tart', center16(img('foodicons', '1x', 'strawberry-tart.png')))
    save('ic_dish_hotpot', center16(mi.crop((208, 224, 224, 240))))
    save('ic_dish_feast', center16(img('foodicons', '1x', 'cheeseburger.png')))
    save('ic_shop', mi.crop((176, 288, 192, 304)))
    save('ic_anvil', mi.crop((192, 240, 208, 256)))

    # ── 8 把外观与属性高度契合的开源火铳与法杖（Ghostbyte_dev CC-BY 3.0 + SnoopethDuckDuck CC0 + deving100 CC-BY 3.0）──

    rifle_im = tight(img('snoops', 'Extra + Unfinished', 'Extra 3.png').crop((72, 96, 99, 113)))
    staff_im = tight(img('extras', 'aqua_staff.png').rotate(-90, expand=True))
    weapons_map = {
        'wp_pistol': tight(img('ghostbyte', 'weapon_05.png')),
        'wp_revolver': tight(img('ghostbyte', 'weapon_07.png')),
        'wp_smg': tight(img('snoops', '1px', '43.png')),
        'wp_shotgun': tight(img('snoops', '1px', '60.png')),
        'wp_assault': tight(img('snoops', '1px', '30.png')),
        'wp_rifle': rifle_im,
        'wp_tesla': staff_im,
        'wp_rocket': tight(img('snoops', '1px', '51.png')),
    }
    for k, wim in weapons_map.items():
        save(k, wim)

    # ── 安卓发射器图标（严格使用上述开源人画哥特像素素材拼成，零手绘代码像素）──
    flash_im = img('magic9', 'sprites', 'FireBomb', 'Fire-bomb10.png')
    build_android_icons(bg_sky, bg_town, ground_wall, house_full, roof_deck, bodies['idle'][0], hero_arm, rifle_im, flash_im, lamp)

    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1, sort_keys=True)
    print('wrote', len(manifest), 'images to', os.path.relpath(OUT, ROOT))

if __name__ == '__main__': main()

