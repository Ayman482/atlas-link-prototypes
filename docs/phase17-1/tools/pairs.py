# Phase 17.1 — يركّب لقطة «قبل» و«بعد» جنباً إلى جنب مع عنوان، لكل عيب مؤكد.
# الاستخدام: python3 pairs.py pairs.json outdir   (كل عنصر: {"id","title","before","after","crop":ارتفاع اختياري})
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
spec = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
font = None
for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
    if os.path.exists(f): font = ImageFont.truetype(f, 22)
def load(p, crop):
    im = Image.open(p).convert('RGB')
    if crop and im.height > crop: im = im.crop((0, 0, im.width, crop))
    return im
for s in spec:
    a, b = load(s['before'], s.get('crop')), load(s['after'], s.get('crop'))
    h = max(a.height, b.height); W = a.width + b.width + 30
    c = Image.new('RGB', (W, h + 56), '#ffffff'); d = ImageDraw.Draw(c)
    d.rectangle([0, 0, a.width, 46], fill='#B3261E'); d.text((14, 11), 'BEFORE  ' + s['id'], fill='white', font=font)
    d.rectangle([a.width + 30, 0, W, 46], fill='#087F70'); d.text((a.width + 44, 11), 'AFTER  ' + s['id'], fill='white', font=font)
    c.paste(a, (0, 56)); c.paste(b, (a.width + 30, 56))
    if c.width > 2400: c = c.resize((2400, int(c.height * 2400 / c.width)))
    c.save(f"{out}/{s['id']}.png", optimize=True); print(s['id'], c.size)
