import math
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter

SRC, OPEN, OUT = sys.argv[1:4]
W, H, OW, OH = 2048, 1152, 1920, 1080
FPS, N = 30, 90

base = Image.open(SRC).convert("RGBA")
open_state = Image.open(OPEN).convert("RGBA")

# Align the regenerated open doorway to the established daytime house.
aligned_open = Image.new("RGBA", (W,H), (0,0,0,0))
aligned_open.alpha_composite(open_state, (52,0))

# Restrict the transition tightly to the entrance, door leaf, arch, and threshold.
door_mask = Image.new("L", (W,H), 0)
ImageDraw.Draw(door_mask).polygon([
    (1028,336),(1118,330),(1130,401),(1118,478),(1082,496),
    (1032,473),(1018,410)
], fill=255)
door_mask = door_mask.filter(ImageFilter.GaussianBlur(6.5))

cmd = [
    "/opt/homebrew/bin/ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-", "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", OUT,
]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

for frame in range(N):
    u = frame/(N-1)
    # Quintic easing gives a gentle launch and arrival despite the large move.
    move = 6*u**5 - 15*u**4 + 10*u**3

    # Door begins after the camera is moving and finishes before arrival.
    door_u = max(0.0, min(1.0, (u-0.24)/0.58))
    door_ease = door_u*door_u*(3-2*door_u)
    mask = door_mask.point(lambda p: int(p*door_ease))
    scene = Image.composite(aligned_open, base, mask)

    # Smooth push toward the exact main entrance; slight downward drift follows the path.
    zoom = 1.0 + 2.35*move
    crop_w, crop_h = W/zoom, H/zoom
    source_x = 1074.0
    source_y = 420.0
    initial_screen_x = source_x/W
    initial_screen_y = source_y/H
    screen_x = initial_screen_x*(1-move) + 0.5*move
    screen_y = initial_screen_y*(1-move) + 0.5*move
    left = source_x - screen_x*crop_w
    top = source_y - screen_y*crop_h
    frame_img = scene.convert("RGB").transform(
        (OW,OH), Image.Transform.EXTENT,
        (left,top,left+crop_w,top+crop_h),
        resample=Image.Resampling.BICUBIC
    )
    proc.stdin.write(frame_img.tobytes())

proc.stdin.close()
if proc.wait() != 0:
    raise SystemExit("Encoding failed")
