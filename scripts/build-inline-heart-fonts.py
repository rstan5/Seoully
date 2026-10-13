"""Rebuild with fonttools (build tool only; no runtime dependency).

Use Noto Sans KR's existing U+2661 outline, uniformly scaled to the actual
uppercase H ink bounds of the surrounding Seoully font/weight. No raster,
emoji, vertical offset, or line-height adjustment. Retain target line metrics.
Sources are the OFL fonts already installed by the mobile app.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
import json
import sys
from io import BytesIO
CHECK = "--check" in sys.argv

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/fonts/inline-heart'
OUT.mkdir(parents=True, exist_ok=True)
manifest = []
for family, prefix, weights in [('baloo-2', 'Baloo2', [(400,'Regular'),(500,'Medium'),(600,'SemiBold'),(700,'Bold'),(800,'ExtraBold')]), ('noto-sans-kr', 'NotoSansKR', [(400,'Regular'),(600,'SemiBold'),(700,'Bold')])]:
    for weight, label in weights:
        base = ROOT / 'apps/mobile/node_modules/@expo-google-fonts'
        target = TTFont(base / family / f'{weight}{label}/{prefix}_{weight}{label}.ttf')
        source = TTFont(base / 'noto-sans-kr' / f'{weight}{label}/NotoSansKR_{weight}{label}.ttf')
        target_glyphs, source_glyphs = target.getGlyphSet(), source.getGlyphSet()
        bounds = BoundsPen(target_glyphs)
        target_glyphs[target.getBestCmap()[ord('H')]].draw(bounds)
        _, bottom, _, top = bounds.bounds
        glyph = source_glyphs[source.getBestCmap()[0x2661]]
        bounds = BoundsPen(source_glyphs)
        glyph.draw(bounds)
        x0, y0, x1, y1 = bounds.bounds
        scale = (top-bottom)/(y1-y0)
        side = 40
        pen = TTGlyphPen(None)
        glyph.draw(TransformPen(pen, (scale,0,0,scale,side-x0*scale,bottom-y0*scale)))
        heart = pen.glyph()
        name = f'SeoullyHeart{prefix}{weight}'
        fb = FontBuilder(target['head'].unitsPerEm, isTTF=True)
        fb.setupGlyphOrder(['.notdef','heart'])
        fb.setupCharacterMap({0x2661:'heart'})
        fb.setupGlyf({'.notdef':TTGlyphPen(None).glyph(),'heart':heart})
        fb.setupHorizontalMetrics({'.notdef':(0,0),'heart':(round((x1-x0)*scale+2*side),side)})
        fb.setupHorizontalHeader(ascent=target['hhea'].ascent,descent=target['hhea'].descent,lineGap=target['hhea'].lineGap)
        os2 = target['OS/2']
        fb.setupOS2(version=4,sTypoAscender=os2.sTypoAscender,sTypoDescender=os2.sTypoDescender,sTypoLineGap=os2.sTypoLineGap,usWinAscent=os2.usWinAscent,usWinDescent=os2.usWinDescent,sCapHeight=os2.sCapHeight,usWeightClass=weight,fsSelection=os2.fsSelection)
        fb.setupNameTable({'familyName':name,'styleName':'Regular','uniqueFontIdentifier':name,'fullName':name,'psName':name,'copyright':source['name'].getDebugName(0),'licenseDescription':source['name'].getDebugName(13),'licenseInfoURL':source['name'].getDebugName(14)})
        fb.setupPost()
        fb.font['head'].macStyle = 1 if weight >= 700 else 0
        fb.font['head'].created = fb.font['head'].modified = 2082844800
        fb.font.recalcTimestamp = False
        dest = OUT / f'{name}.ttf'
        buffer = BytesIO()
        fb.font.save(buffer)
        if CHECK:
            assert dest.read_bytes() == buffer.getvalue(), f"Stale glyph asset: {dest}"
        else:
            dest.write_bytes(buffer.getvalue())
        rendered = TTFont(dest)
        actual = BoundsPen(rendered.getGlyphSet())
        rendered.getGlyphSet()['heart'].draw(actual)
        assert abs(actual.bounds[1]-bottom) <= 1 and abs(actual.bounds[3]-top) <= 1
        assert rendered['hhea'].ascent == target['hhea'].ascent
        assert rendered['hhea'].descent == target['hhea'].descent
        assert rendered['hhea'].lineGap == target['hhea'].lineGap
        assert 0 <= actual.bounds[0] < actual.bounds[2] <= rendered['hmtx']['heart'][0]
        for size in [11, 14, 18, 24, 42, 64]:
            assert abs(actual.bounds[1]-bottom)*size/1000 <= 0.064
            assert abs(actual.bounds[3]-top)*size/1000 <= 0.064
        manifest.append({'font':name,'family':prefix,'weight':weight,'unitsPerEm':target['head'].unitsPerEm,'bottom':bottom,'top':top,'advance':rendered['hmtx']['heart'][0]})
if CHECK:
    assert json.loads((OUT / 'metrics.json').read_text()) == manifest
else:
    (OUT / 'metrics.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Generated and verified {len(manifest)} cap-aligned glyph fonts')
