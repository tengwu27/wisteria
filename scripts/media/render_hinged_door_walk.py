import math
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

CLOSED, INTERIOR, OUT = sys.argv[1:4]
closed = Image.open(CLOSED).convert("RGBA")
interior = Image.open(INTERIOR).convert("RGBA")
W, H = closed.size
OW, OH, FPS, N = 1920, 1080, 30, 90

# Door and doorway coordinates in the 1672x941 master artwork.
x0, y0, x1, y1 = 760, 452, 914, 713
door_mask = Image.new("L", (W,H), 0)
dm = ImageDraw.Draw(door_mask)
dm.pieslice((766,457,908,565), 180, 360, fill=255)
dm.rectangle((766,510,908,708), fill=255)
door_mask = door_mask.filter(ImageFilter.GaussianBlur(1.25))
door_full = closed.copy()
door_full.putalpha(door_mask)
door_crop = door_full.crop((x0,y0,x1,y1))

# Replace the closed doorway with the generated interior, but nowhere else.
opening_mask = Image.new("L", (W,H), 0)
om = ImageDraw.Draw(opening_mask)
om.pieslice((762,449,912,571), 180, 360, fill=255)
om.rectangle((762,509,912,713), fill=255)
opening_mask = opening_mask.filter(ImageFilter.GaussianBlur(2.0))
background = Image.composite(interior, closed, opening_mask)

def homography(src, dst):
    # Solve source -> destination, then invert for Pillow's destination -> source sampler.
    A, b = [], []
    for (x,y),(u,v) in zip(src,dst):
        A.append([x,y,1,0,0,0,-u*x,-u*y]); b.append(u)
        A.append([0,0,0,x,y,1,-v*x,-v*y]); b.append(v)
    h = np.linalg.solve(np.asarray(A,float), np.asarray(b,float))
    Hm = np.array([[h[0],h[1],h[2]],[h[3],h[4],h[5]],[h[6],h[7],1.0]])
    inv = np.linalg.inv(Hm)
    inv /= inv[2,2]
    return tuple(inv.flatten()[:8])

src_quad = [(0,0),(door_crop.width,0),(door_crop.width,door_crop.height),(0,door_crop.height)]

cmd = [
    "/opt/homebrew/bin/ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", OUT,
]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

for frame in range(N):
    u = frame/(N-1)
    travel = u*u*(3-2*u)

    # Door opens from 0.35s through 2.65s, easing at both ends.
    du = max(0.0, min(1.0, (u-0.115)/0.77))
    open_ease = du*du*(3-2*du)
    angle = math.radians(82.0*open_ease)
    projected_w = door_crop.width*math.cos(angle)
    inset = 2.5*math.sin(angle)

    # Right edge is the fixed hinge. The left/free edge recedes into the doorway.
    dst_quad = [
        (x1-projected_w, y0+8*math.sin(angle)),
        (x1, y0),
        (x1, y1),
        (x1-projected_w, y1-5*math.sin(angle)),
    ]
    coeffs = homography(src_quad, dst_quad)
    shade = 1.0 - 0.28*math.sin(angle)
    shaded = ImageEnhance.Brightness(door_crop).enhance(shade)
    moving_door = shaded.transform(
        (W,H), Image.Transform.PERSPECTIVE, coeffs,
        resample=Image.Resampling.BICUBIC, fillcolor=(0,0,0,0)
    )

    scene = background.copy()
    # Soft contact shadow follows the receding door edge inside the entrance.
    shadow = Image.new("RGBA", (W,H), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sx = x1-projected_w
    sd.polygon([(sx,y0+14),(x1,y0+9),(x1,y1),(sx,y1-8)], fill=(32,19,9,int(42*math.sin(angle))))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    scene.alpha_composite(shadow)
    scene.alpha_composite(moving_door)

    # Slow human-height approach with a restrained walking cadence.
    zoom = 1.0 + 0.235*travel
    crop_w, crop_h = W/zoom, H/zoom
    door_x, door_y = 838.0, 575.0
    initial_x, initial_y = door_x/W, door_y/H
    screen_x = initial_x*(1-travel) + 0.5*travel
    screen_y = initial_y*(1-travel) + 0.53*travel
    bob = 1.45*math.sin(2*math.pi*1.1*(frame/FPS))*math.sin(math.pi*u)
    left = door_x-screen_x*crop_w
    top = door_y-screen_y*crop_h+bob
    out = scene.convert("RGB").transform(
        (OW,OH), Image.Transform.EXTENT,
        (left,top,left+crop_w,top+crop_h),
        resample=Image.Resampling.BICUBIC
    )
    proc.stdin.write(out.tobytes())

proc.stdin.close()
if proc.wait() != 0:
    raise SystemExit("Encoding failed")
