import math
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFilter

CLOSED, OPEN, OUT = sys.argv[1:4]
closed = Image.open(CLOSED).convert("RGBA")
opened = Image.open(OPEN).convert("RGBA")
W, H = closed.size
OW, OH, FPS, N = 1920, 1080, 30, 90

# Only the entrance and its immediate light spill transition to the open artwork.
region = Image.new("L", (W,H), 0)
ImageDraw.Draw(region).polygon([
    (730,397),(945,397),(972,470),(972,728),(916,760),
    (735,748),(704,674),(704,475)
], fill=255)
region = region.filter(ImageFilter.GaussianBlur(8))

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

    # The door starts shortly after the first step and opens throughout the approach.
    du = max(0.0, min(1.0, (u-0.12)/0.76))
    door = du*du*(3-2*du)

    # A softly feathered left-to-right reveal reads as a right-hinged door opening.
    reveal = Image.new("L", (W,H), 0)
    cutoff = int(704 + (972-704)*door)
    rd = ImageDraw.Draw(reveal)
    rd.rectangle((704,397,cutoff,760), fill=255)
    reveal = reveal.filter(ImageFilter.GaussianBlur(10))
    reveal = Image.composite(region, Image.new("L",(W,H),0), reveal)
    scene = Image.composite(opened, closed, reveal)

    # Human-height forward walk: modest push plus restrained vertical cadence.
    zoom = 1.0 + 0.24*travel
    crop_w, crop_h = W/zoom, H/zoom
    door_x, door_y = 838.0, 575.0
    start_x, start_y = door_x/W, door_y/H
    desired_x = start_x*(1-travel) + 0.5*travel
    desired_y = start_y*(1-travel) + 0.53*travel
    bob = 1.8*math.sin(2*math.pi*1.15*(frame/FPS)) * math.sin(math.pi*u)
    left = door_x - desired_x*crop_w
    top = door_y - desired_y*crop_h + bob
    frame_img = scene.convert("RGB").transform(
        (OW,OH), Image.Transform.EXTENT,
        (left,top,left+crop_w,top+crop_h),
        resample=Image.Resampling.BICUBIC
    )
    proc.stdin.write(frame_img.tobytes())

proc.stdin.close()
if proc.wait() != 0:
    raise SystemExit("Encoding failed")
