"""Adds U+20BF (₿) to the Poppins weights the app uses, so the symbol renders in
the same font file (and weight) as the surrounding text instead of a system
fallback. The glyph is Poppins' own "B" plus two thin strokes (sized from the
width of "I"), with satsymbol.org's proportions, so every weight matches by
construction. Re-runnable.

Run with a fonttools-enabled python (brew's lives at
/opt/homebrew/opt/fonttools/libexec/bin/python):
  python scripts/add-btc-glyph.py
"""
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen

WEIGHTS = ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold']
DIRS = ['app/assets/fonts', 'android/app/src/main/assets/fonts']
NAME = 'uni20BF'
# Proportions measured from satsymbol.org's ₿ (Inter): the first bar starts
# exactly at the stem's inner edge, the gap is wider than a bar, and both bars
# sit over the flat top/bottom of the B rather than its curved shoulder.
BAR_EXT = 0.12  # bar protrusion above/below the B, as a fraction of cap height
BAR_WIDTH = 0.44  # bar width as a fraction of the stem...
BAR_MAX = 0.079  # ...capped at this fraction of cap height, so heavy weights keep thin bars
BAR_MIN = 32  # ...and never thinner than this (font units), so Light stays visible
BAR_GAP = 1.3  # gap between the bars, as a multiple of bar width
BAR_OVERLAP = 0.4  # fraction of stem width sunk into the B so the union is solid
ADV_PAD = 0.06  # extra right side bearing in em so digits don't crowd the symbol


def build(src, dsts):
    f = TTFont(src)
    gs, cmap = f.getGlyphSet(), f.getBestCmap()
    upm = f['head'].unitsPerEm

    def bounds(ch):
        bp = BoundsPen(gs)
        gs[cmap[ord(ch)]].draw(bp)
        return bp.bounds

    bx0, by0, bx1, by1 = bounds('B')
    ix0, _, ix1, _ = bounds('I')
    stem = ix1 - ix0
    cap = by1 - by0
    ext = round(BAR_EXT * cap)
    sink = round(BAR_OVERLAP * stem)
    bar = max(round(min(BAR_WIDTH * stem, BAR_MAX * cap)), BAR_MIN)
    lefts = (bx0 + stem, bx0 + stem + bar + round(BAR_GAP * bar))

    pen = TTGlyphPen(gs)
    gs[cmap[ord('B')]].draw(Cu2QuPen(pen, 1.0))  # also flattens composites
    for x0 in lefts:
        x1 = x0 + bar
        # TrueType outer contours are clockwise
        for y0, y1 in ((by1 - sink, by1 + ext), (by0 - ext, by0 + sink)):
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    glyph = pen.glyph()

    if NAME not in f.getGlyphOrder():
        f.setGlyphOrder(f.getGlyphOrder() + [NAME])
    f['glyf'].glyphs[NAME] = glyph
    f['glyf'].glyphOrder = f.getGlyphOrder()
    glyph.recalcBounds(f['glyf'])
    f['hmtx'][NAME] = (f['hmtx'][cmap[ord('B')]][0] + round(ADV_PAD * upm), glyph.xMin)
    for t in f['cmap'].tables:
        if t.isUnicode():
            t.cmap[0x20BF] = NAME
    for d in dsts:
        f.save(d)


for w in WEIGHTS:
    build(f'app/assets/fonts/Poppins-{w}.ttf', [f'{d}/Poppins-{w}.ttf' for d in DIRS])
    print('ok', w)
