import math
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
NO_SHORELINE = "--no-shoreline" in sys.argv[3:]
W, H = 2048, 1152
OW, OH = 1920, 1080
FPS, N = 30, 150

source = Image.open(SRC).convert("RGBA")

def polygon_layer(points, feather=3):
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    layer = source.copy()
    layer.putalpha(mask)
    return layer

car = polygon_layer([(748,745),(764,706),(809,669),(913,659),(976,688),(997,729),(985,775),(940,801),(823,810),(774,790)], 2.2)
boat = polygon_layer([(1730,888),(1770,856),(1818,839),(1835,572),(1872,520),(1902,573),(1934,694),(1969,844),(2048,862),(2048,1055),(1910,1040),(1806,992)], 2.0)
airplane = polygon_layer([(230,168),(259,151),(264,112),(283,110),(320,145),(401,146),(449,158),(439,176),(399,183),(386,220),(364,238),(344,236),(342,194),(290,190),(270,218),(243,232),(234,222),(253,185)], 1.8)

flags = [
    polygon_layer([(1579,447),(1628,460),(1628,488),(1580,477)], 1.2),
    polygon_layer([(1777,404),(1830,420),(1830,449),(1778,436)], 1.2),
    polygon_layer([(1867,542),(1911,558),(1911,587),(1868,572)], 1.2),
    polygon_layer([(468,102),(511,113),(511,131),(469,120)], 1.0),
]
flag_boxes = [(1575,440,1634,494),(1773,397,1836,455),(1863,535,1917,593),(464,97,517,136)]

# Extract only painted foliage/flower colors inside broad vegetation zones.
rgb = np.asarray(source.convert("RGB"))
r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]
green = (g > r * 1.04) & (g > b * 1.10) & (g > 55)
colorful = ((rgb.max(axis=2).astype(int) - rgb.min(axis=2).astype(int)) > 60) & (rgb.max(axis=2) > 105)
zone = Image.new("L", (W,H), 0)
zd = ImageDraw.Draw(zone)
zd.polygon([(0,0),(2048,0),(2048,300),(1700,330),(1450,300),(1300,225),(1000,235),(770,330),(530,300),(0,420)], fill=255)
zd.polygon([(0,560),(410,560),(570,700),(730,760),(880,870),(1100,850),(1240,1120),(1120,1152),(0,1152)], fill=255)
zd.polygon([(930,390),(1450,350),(1640,520),(1540,770),(1320,890),(1080,760)], fill=255)
zone_np = np.asarray(zone) > 0
plant_mask_np = ((green | colorful) & zone_np).astype(np.uint8) * 255
plant_mask = Image.fromarray(plant_mask_np, mode="L").filter(ImageFilter.GaussianBlur(1.1))
plants = source.copy()
plants.putalpha(plant_mask)

# Large canopy groups get their own slow, readable wind motion.
tree_specs = [
    ([(0,15),(205,0),(225,160),(165,255),(45,275),(0,225)], (105,120), 0.0),
    ([(520,0),(855,0),(850,150),(760,235),(600,210),(530,125)], (690,95), 0.8),
    ([(1280,0),(1710,0),(1725,170),(1620,255),(1430,235),(1290,135)], (1490,90), 1.7),
    ([(1260,175),(1515,125),(1585,285),(1520,440),(1325,455),(1240,330)], (1405,285), 2.4),
    ([(0,285),(175,250),(235,405),(180,540),(25,560),(0,505)], (90,395), 3.0),
]
tree_layers = []
for points, center, phase in tree_specs:
    margin = 14
    xs, ys = [p[0] for p in points], [p[1] for p in points]
    bbox = (max(0,min(xs)-margin), max(0,min(ys)-margin), min(W,max(xs)+margin), min(H,max(ys)+margin))
    tree_layers.append((polygon_layer(points, 8.0).crop(bbox), bbox, phase))

def place_rotated(base, layer, angle, center, shift=(0,0)):
    rotated = layer.rotate(angle, resample=Image.Resampling.BICUBIC, center=center, translate=shift)
    base.alpha_composite(rotated)

def smoke_layer(t):
    layer = Image.new("RGBA", (W, H), (0,0,0,0))
    # Main-house smoke: two slow, staggered streams with hand-painted softness.
    for origin, phase in [((1174,72),0.0), ((1220,95),0.46)]:
        for j in range(6):
            age = (t * 0.42 + phase + j / 6.0) % 1.0
            x = origin[0] - 22*age + 4*math.sin(2*math.pi*(age+t*0.18+j*.13))
            y = origin[1] - 78*age
            r = 5 + 15*age
            alpha = int(105 * math.sin(math.pi*age) ** 1.3)
            ImageDraw.Draw(layer).ellipse((x-r*1.3,y-r,x+r*1.3,y+r), fill=(193,193,174,alpha))
    # Exhaust from the car's rear, drifting right and slightly upward.
    for j in range(5):
        age = (t * 1.25 + j/5.0) % 1.0
        x = 982 + 45*age
        y = 761 - 15*age + 2*math.sin(2*math.pi*(age+t))
        r = 2.5 + 7*age
        alpha = int(78 * math.sin(math.pi*age) ** 1.5)
        ImageDraw.Draw(layer).ellipse((x-r,y-r*.7,x+r,y+r*.7), fill=(143,145,130,alpha))
    return layer.filter(ImageFilter.GaussianBlur(2.3))

def shoreline_layer(t):
    layer = Image.new("RGBA", (W,H), (0,0,0,0))
    draw = ImageDraw.Draw(layer)
    shores = [
        [(2048,302),(2023,355),(1998,425),(1975,500),(1954,585),(1938,655)],
        [(1600,830),(1535,864),(1470,900),(1390,940),(1300,979),(1200,1022),(1090,1070),(970,1122),(900,1152)],
    ]
    for shore_i, shore in enumerate(shores):
        # A visible waterline pulse hugs the sand and advances only a few pixels.
        edge_phase = (t*0.34 + shore_i*.31) % 1.0
        edge_offset = 2 + 7*(1-edge_phase)
        edge_alpha = int(125 * math.sin(math.pi*edge_phase)**0.7)
        edge_pts = []
        for i,(x,y) in enumerate(shore):
            wobble = 2.0*math.sin(i*1.55 + t*1.8)
            if shore_i == 0:
                edge_pts.append((x-edge_offset+wobble, y))
            else:
                edge_pts.append((x+edge_offset*.48+wobble, y+edge_offset*.78))
        draw.line(edge_pts, fill=(239,247,224,edge_alpha), width=3)
        # Translucent blue immediately behind the foam makes the water edge breathe.
        if shore_i == 0:
            blue_pts = [(x-10+wobble,y) for (x,y),wobble in zip(shore,[2*math.sin(i*1.55+t*1.8) for i in range(len(shore))])]
        else:
            blue_pts = [(x+5+wobble,y+8) for (x,y),wobble in zip(shore,[2*math.sin(i*1.55+t*1.8) for i in range(len(shore))])]
        draw.line(blue_pts, fill=(76,184,205,62), width=5)
        for band in range(3):
            phase = (t*0.30 + band/3 + shore_i*.19) % 1.0
            # Foam advances gently toward land, fades, then reforms offshore.
            offset = 11 + 20*(1-phase)
            alpha = int(72 * math.sin(math.pi*phase)**1.4)
            pts = []
            for i,(x,y) in enumerate(shore):
                wobble = 2.2*math.sin(i*1.8 + t*1.4 + band)
                if shore_i == 0:
                    pts.append((x-offset+wobble, y))
                else:
                    pts.append((x+offset*.48+wobble, y+offset*.78))
            # Broken painted foam rather than a continuous graphic line.
            for i in range(len(pts)-1):
                if (i+band) % 3 != 1:
                    draw.line([pts[i],pts[i+1]], fill=(239,244,220,alpha), width=2)
    return layer.filter(ImageFilter.GaussianBlur(0.65))

cmd = [
    "/opt/homebrew/bin/ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", OUT,
]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

for frame in range(N):
    t = frame / FPS
    u = frame / (N - 1)
    eased = u*u*(3-2*u)
    canvas = source.copy()

    # Gentle wind: foliage and flower colors drift by fractions of a pixel.
    wind_x = 0.62*math.sin(2*math.pi*0.18*t) + 0.20*math.sin(2*math.pi*0.41*t+0.5)
    wind_y = 0.16*math.sin(2*math.pi*0.22*t+1.1)
    wind_layer = plants.transform((W,H), Image.Transform.AFFINE, (1,0,-wind_x,0,1,-wind_y), Image.Resampling.BICUBIC)
    canvas.alpha_composite(wind_layer)

    # Individual canopy sway: 1–3 px at the crowns, staggered by tree group.
    for tree, bbox, phase in tree_layers:
        sway = 1.7*math.sin(2*math.pi*0.16*t + phase) + 0.45*math.sin(2*math.pi*0.31*t + phase*.6)
        tilt = 0.045*math.sin(2*math.pi*0.16*t + phase)
        moved = tree.rotate(tilt, Image.Resampling.BICUBIC, expand=True)
        px = int(round(bbox[0] - (moved.width-tree.width)/2 + sway))
        py = int(round(bbox[1] - (moved.height-tree.height)/2))
        canvas.alpha_composite(moved, (px,py))

    # Engine vibration: less than one pixel, high-frequency and deliberately irregular.
    car_y = 0.42*math.sin(2*math.pi*6.2*t) + 0.16*math.sin(2*math.pi*9.1*t+0.7)
    place_rotated(canvas, car, 0.025*math.sin(2*math.pi*6.2*t), (875,744), (0,car_y))

    # Airplane engine vibration, intentionally a little softer than the car.
    plane_y = 0.32*math.sin(2*math.pi*5.4*t+0.3) + 0.10*math.sin(2*math.pi*8.0*t)
    place_rotated(canvas, airplane, 0.018*math.sin(2*math.pi*5.4*t), (335,174), (0,plane_y))

    # Boat: a slow 0.22-degree roll with a tiny vertical buoyancy component.
    rock = 0.22*math.sin(2*math.pi*0.34*t)
    bob = 0.55*math.sin(2*math.pi*0.34*t + 0.8)
    place_rotated(canvas, boat, rock, (1885,900), (0,bob))

    # Slow flag movement, each offset so they do not flap in lockstep.
    for idx, (flag, box) in enumerate(zip(flags, flag_boxes)):
        phase = idx*0.73
        wave = math.sin(2*math.pi*0.38*t + phase)
        x0,y0,x1,y1 = box
        crop = flag.crop(box)
        width = crop.width
        crop = crop.resize((max(2,int(width*(1 + 0.025*wave))), crop.height), Image.Resampling.BICUBIC)
        crop = crop.rotate(0.75*wave, Image.Resampling.BICUBIC, expand=True)
        canvas.alpha_composite(crop, (x0, y0 + int(0.8*wave)))

    if not NO_SHORELINE:
        canvas.alpha_composite(shoreline_layer(t))
    canvas.alpha_composite(smoke_layer(t))

    # Locked camera: no push or zoom.
    frame_img = canvas.convert("RGB").resize((OW,OH), Image.Resampling.LANCZOS)
    proc.stdin.write(frame_img.tobytes())

proc.stdin.close()
if proc.wait() != 0:
    raise SystemExit("ffmpeg encoding failed")
