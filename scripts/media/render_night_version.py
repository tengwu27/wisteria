import subprocess
import sys
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
W, H, FPS, N = 1920, 1080, 30, 150

decoder = subprocess.Popen([
    "/opt/homebrew/bin/ffmpeg", "-v", "error", "-i", SRC,
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"
], stdout=subprocess.PIPE)
encoder = subprocess.Popen([
    "/opt/homebrew/bin/ffmpeg", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", OUT
], stdin=subprocess.PIPE)

def ellipse(mask, box, fill=255):
    ImageDraw.Draw(mask).ellipse(box, fill=fill)

def polygon(mask, points, fill=255):
    ImageDraw.Draw(mask).polygon(points, fill=fill)

window_mask = Image.new("L", (W,H), 0)
wd = ImageDraw.Draw(window_mask)
# Main house and annex windows.
wd.ellipse((979,214,1006,244), fill=225)
for box in [(987,270,1017,326),(994,378,1013,418),
            (1092,225,1116,278),(1115,354,1136,395),(906,346,929,388)]:
    wd.rounded_rectangle(box, radius=6, fill=225)
# Cafe, workshops and harbor cottage windows.
for box in [(274,520,305,562),(337,523,357,579),(595,508,616,543),
            (1582,438,1608,492),(1636,446,1658,492)]:
    wd.rounded_rectangle(box, radius=5, fill=205)

# Open workshops receive dim interior spill without becoming solid yellow panels.
interior_mask = Image.new("L", (W,H), 0)
idraw = ImageDraw.Draw(interior_mask)
idraw.rounded_rectangle((685,484,730,550), radius=5, fill=120)
idraw.rounded_rectangle((551,221,607,264), radius=5, fill=105)
interior_glow = interior_mask.filter(ImageFilter.GaussianBlur(12))

# Fixed warm halo and a tighter interior-light core.
window_glow = window_mask.filter(ImageFilter.GaussianBlur(18))
window_soft = window_mask.filter(ImageFilter.GaussianBlur(2.2))

lighthouse_core = Image.new("L", (W,H), 0)
ImageDraw.Draw(lighthouse_core).rounded_rectangle((1377,326,1429,371), radius=12, fill=190)
lighthouse_glow = lighthouse_core.filter(ImageFilter.GaussianBlur(28))

boat_core = Image.new("L", (W,H), 0)
bd = ImageDraw.Draw(boat_core)
bd.ellipse((1763,504,1781,522), fill=255)              # mast/deck lantern
bd.rounded_rectangle((1844,858,1868,894), radius=5, fill=205)
bd.rounded_rectangle((1874,858,1892,897), radius=5, fill=195)
boat_glow = boat_core.filter(ImageFilter.GaussianBlur(22))

car_core = Image.new("L", (W,H), 0)
cd = ImageDraw.Draw(car_core)
cd.ellipse((720,710,735,726), fill=255)
cd.ellipse((744,719,758,734), fill=245)
car_glow = car_core.filter(ImageFilter.GaussianBlur(18))
car_beam = Image.new("L", (W,H), 0)
polygon(car_beam, [(725,715),(744,727),(610,760),(620,716)], 68)
car_beam = car_beam.filter(ImageFilter.GaussianBlur(16))

# A few existing village lamps receive restrained warm pools.
lamp_points = [(39,563),(506,421),(820,344),(850,508),(1152,671),(1514,257),(644,807)]
lamp_core = Image.new("L", (W,H), 0)
for x,y in lamp_points:
    ellipse(lamp_core, (x-5,y-6,x+5,y+6), 190)
lamp_glow = lamp_core.filter(ImageFilter.GaussianBlur(20))

def colored_layer(color, mask, opacity=255):
    if opacity != 255:
        mask = mask.point(lambda p: p*opacity//255)
    layer = Image.new("RGBA", (W,H), color + (0,))
    layer.putalpha(mask)
    return layer

frame_bytes = W*H*3
for i in range(N):
    raw = decoder.stdout.read(frame_bytes)
    if len(raw) != frame_bytes:
        raise SystemExit(f"Unexpected end of video at frame {i}")
    original = Image.frombytes("RGB", (W,H), raw)
    arr = np.asarray(original).astype(np.float32)

    # Deep blue moonlight grade while retaining painted texture and water color.
    luma = arr[:,:,0]*0.21 + arr[:,:,1]*0.72 + arr[:,:,2]*0.07
    night = arr * np.array([0.25,0.31,0.43], dtype=np.float32)
    night += luma[:,:,None] * np.array([0.015,0.025,0.055], dtype=np.float32)
    night += np.array([3.0,7.0,17.0], dtype=np.float32)
    base = Image.fromarray(np.clip(night,0,255).astype(np.uint8), "RGB").convert("RGBA")

    # Barely perceptible organic intensity variation; no flashing.
    t = i/FPS
    warm = 0.96 + 0.04*math.sin(2*math.pi*0.23*t+0.4)
    base.alpha_composite(colored_layer((255,168,69), window_glow, int(100*warm)))
    base.alpha_composite(colored_layer((255,194,83), window_soft, int(184*warm)))
    base.alpha_composite(colored_layer((255,150,55), interior_glow, int(80*warm)))
    base.alpha_composite(colored_layer((255,177,70), interior_mask, int(92*warm)))

    # Lighthouse lantern is the strongest fixed light in the scene.
    base.alpha_composite(colored_layer((255,211,112), lighthouse_glow, 140))
    base.alpha_composite(colored_layer((255,231,150), lighthouse_core, 180))

    # Boat cabin/deck light and car headlights with a soft ground beam.
    base.alpha_composite(colored_layer((255,177,61), boat_glow, 150))
    base.alpha_composite(colored_layer((255,218,125), boat_core, 220))
    base.alpha_composite(colored_layer((255,205,106), car_beam, 120))
    base.alpha_composite(colored_layer((255,215,125), car_glow, 170))
    base.alpha_composite(colored_layer((255,240,185), car_core, 245))

    base.alpha_composite(colored_layer((255,172,70), lamp_glow, 90))
    base.alpha_composite(colored_layer((255,211,123), lamp_core, 180))

    encoder.stdin.write(base.convert("RGB").tobytes())

decoder.stdout.close()
decoder.wait()
encoder.stdin.close()
if encoder.wait() != 0:
    raise SystemExit("Night video encoding failed")
