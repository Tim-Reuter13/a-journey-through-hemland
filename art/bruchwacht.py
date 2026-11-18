"""Original pixel paintings for the Westzoll. Run with Python and Pillow."""
from pathlib import Path
from random import Random
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public/textures/bruchwacht"
OUT.mkdir(exist_ok=True)
rng = Random(4189)

# The toll hall fresco depicts the intact bridge and the two goods once weighed here.
im = Image.new("RGB", (160, 64), "#373b40")
d = ImageDraw.Draw(im)
def poly(points, colour):
    d.polygon(points, fill=colour)

for top, bottom, colour in [(3, 10, "#657477"), (11, 19, "#89938b"),
                            (20, 29, "#b7a584"), (30, 44, "#cfab7b")]:
    d.rectangle((3, top, 156, bottom), fill=colour)
d.ellipse((102, 9, 119, 26), fill="#dfc391")
poly([(3,33),(24,18),(35,24),(53,12),(63,21),(75,15),(93,30),(113,19),(135,29),(156,16),(156,48),(3,48)], "#666e71")
poly([(21,21),(24,18),(35,24),(31,24),(25,21),(22,22)], "#a7a89b")
poly([(43,22),(53,12),(64,22),(59,20),(53,16),(49,20)], "#b2b0a1")
poly([(3,31),(17,30),(26,34),(39,30),(53,32),(69,22),(81,28),(93,26),(109,34),(128,27),(140,29),(156,24),(156,52),(3,52)], "#59635e")
for x in [3,6,11,17,23,29,34,40,55,60,70,74,87,97,105,130,139,146,153]:
    y = rng.randrange(27, 37)
    poly([(x,y-5),(x-3,y+2),(x-1,y+1),(x-4,y+6),(x+4,y+6),(x+1,y+1),(x+3,y+2)], "#3d514c")
poly([(3,42),(25,38),(46,41),(65,45),(81,46),(97,42),(112,37),(130,38),(156,33),(156,60),(3,60)], "#807251")
poly([(40,61),(58,49),(76,46),(94,45),(114,41),(128,40),(128,42),(111,45),(89,49),(72,54),(65,61)], "#829292")
for x, y, w, h in [(106,28,9,11),(114,24,8,14),(121,30,14,8),(134,21,8,16),(143,29,8,7)]:
    d.rectangle((x,y,x+w,y+h),fill="#464b4c")
    d.rectangle((x+1,y,x+3,y+h-1),fill="#969281")
    for xx in range(x,x+w,4):
        d.rectangle((xx,y-2,xx+1,y),fill="#55595a")
    d.line((x+w-3,y+2,x+w-3,y+4),fill="#242f34")
d.line((136,19,136,10),fill="#463b35")
poly([(137,10),(146,12),(137,14)], "#a65841")
# The ochre masonry crosses three arches. The missing stones are painted later.
d.rectangle((42,36,105,39),fill="#514a42")
d.line((42,36,105,36),fill="#ccad79")
for x in (44,62,80,98):
    poly([(x,38),(x+6,38),(x+5,48),(x+2,50)], "#756855")
    d.line((x+1,39,x+3,47),fill="#bca47b")
for x in (51,69,87):
    d.line([(x-2,43),(x,40),(x+3,38),(x+6,38),(x+9,40),(x+11,44)],fill="#c0a579",width=2)
for x in (54,62):
    d.ellipse((x-2,32,x+2,36),fill="#342f2c")
    d.point((x,34),fill="#bd9d67")
poly([(51,28),(65,29),(63,32),(53,32)], "#a56943")
for x in (54,57,60):
    d.ellipse((x,25,x+3,29),fill="#d2af64")
d.line((65,30,73,31),fill="#3c3531")
poly([(68,29),(74,29),(76,27),(78,28),(77,31),(74,32),(69,32)], "#403d35")
for x in (69,73,75): d.line((x,32,x-1,35),fill="#332f2a")
# Saffron and iron-oxide border, grain ears, iron bars, and tally cuts.
d.rectangle((0,0,159,63),outline="#423b36",width=2)
d.rectangle((2,2,157,61),outline="#b9935e")
d.rectangle((3,51,156,60),fill="#624c40")
for x in range(5,155,7): d.point((x,59),fill="#b99768")
for x in (20,26):
    d.line((x,57,x+3,52),fill="#d8b56a")
    for y in (0,2): d.line((x+y,55-y,x+y-1,53-y),fill="#cf9f56")
for x in (36,40,116,120,124): d.line((x,53,x-1,57),fill="#ddc49a")
for x in (95,101,107): poly([(x,56),(x+2,53),(x+5,53),(x+4,56)], "#a9b3ae")
for start in [(7,2),(82,4),(148,33),(32,59)]:
    x,y=start
    for i in range(rng.randint(6,14)):
        d.point((x,y),fill="#6d6257")
        x+=rng.choice([-1,0,1]); y+=1
for _ in range(330):
    x,y=rng.randrange(3,157),rng.randrange(3,60)
    r,g,b=im.getpixel((x,y)); delta=rng.choice([-11,10])
    d.point((x,y),fill=tuple(max(0,min(255,v+delta)) for v in (r,g,b)))
im.save(OUT / "zollfresko.png")

# Swallowtail livery. The original bridge seal has been mended with mismatched thread.
im=Image.new("RGBA",(32,64)); d=ImageDraw.Draw(im)
poly([(1,0),(30,0),(30,54),(26,52),(24,61),(15,51),(6,63),(5,56),(1,59)],"#773c37")
for x in range(2,30):
    for y in range(1,62):
        if im.getpixel((x,y))[3]:
            v=[-9,-4,0,3,5,3,0,-3][x%8]+rng.choice([-2,0,1,3])
            d.point((x,y),fill=(116+v,56+v,49+v,255))
for x in (3,27): d.line((x,2,x,54),fill="#ab8757")
d.rectangle((6,12,25,14), fill="#d0aa6c")
for x in (7,14,22): poly([(x,14),(x+3,14),(x+2,29),(x,31)],"#d0aa6c")
d.line([(7,22),(11,17),(14,21),(18,16),(23,22)],fill="#d0aa6c",width=2)
poly([(8,37),(15,34),(19,45),(11,48)],"#626251")
for x,y in [(8,38),(9,41),(10,44),(15,35),(16,38),(18,42)]:
    d.line((x-1,y,x+1,y-1),fill="#b7a88a")
im.save(OUT / "brueckenbanner.png")

# Two wheel tracks, painted as translucent earth, so the local ground shows
# through. Damp highlights and the little banks of swept leaves follow the ruts.
import math
im=Image.new("RGBA",(64,128)); d=ImageDraw.Draw(im)
for y in range(128):
    for side in (-1,1):
        x=round(31+side*14+1.4*math.sin(y*math.tau/128)+.8*math.sin(y*math.tau/32))
        d.line((x-2,y,x+2,y),fill=(67,49,35,rng.randrange(62,115)))
        if rng.random()<.82: d.line((x-1,y,x,y),fill=(58,43,34,rng.randrange(75,142)))
        if rng.random()<.63: d.point((x+3,y),fill=(182,154,112,115))
for _ in range(145):
    x=rng.choice([rng.randrange(3,16),rng.randrange(47,61),rng.randrange(24,38)])
    y=rng.randrange(128)
    a=rng.choice([(123,70,41,160),(151,98,49,180),(176,130,69,168),(114,108,81,138)])
    d.line((x,y,x+1,y+1),fill=a)
    if rng.random()<.4: d.point((x+1,y),fill=(191,145,86,160))
for x,y in [(16,18),(17,22),(44,65),(45,70),(15,90),(16,93)]:
    d.line((x,y,x,y+2),fill=(151,152,136,118))
im.save(OUT / "karrenweg.png")
