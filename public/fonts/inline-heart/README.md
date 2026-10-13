# Seoully inline text heart

These small OFL fonts contain only U+2661 (`♡`). They reuse Noto Sans KR's
existing outline, uniformly scaled and translated in **font units** to the
actual uppercase H ink bounds of each surrounding Seoully face/weight.
Baloo 2 has no U+2661; relying on device fallback previously gave unpredictable
size/baseline. Noto's original heart extends below the baseline and above caps.
No other glyph, illustrated mascot, or functional icon is replaced.

Native: `SeoullyText` splits decorative literal/localized hearts into nested
`InlineHeart` text runs. Each inherits size, line height, color, scaling and
opacity. The matching regular/semibold/bold font is bundled by `FontProvider`.
Web: Unicode-range font faces precede Baloo in the existing typography tokens.
Web Latin capitals use Baloo in both locales; native Korean uses Noto's metrics.
Composer's independent avatar/object heart icons explicitly retain their font.

The target face's original ascent/descent/line gap are retained. Ink bounds fit
within the same cap region as H, so no line-box expansion or margin hack is
needed. Font-unit rounding has at most one unit (0.064pt at 64pt) of error.
Deliberately undersized containers can still clip whole text; do not constrain
text below its font's cap height. User-entered TextInput text is not rewritten.

To reproduce/verify (build tool only; no app dependency):

```sh
python3 -m venv .tmp/heart-font-tools
.tmp/heart-font-tools/bin/pip install fonttools==4.60.2
.tmp/heart-font-tools/bin/python scripts/build-inline-heart-fonts.py --check
node --test scripts/check-inline-heart.cjs
```

Omit `--check` to rebuild after intentionally changing source fonts. The generator
asserts exact ink-bound agreement within font-unit rounding and deterministic
asset equality when checking. See OFL.txt for source copyright/license; derived
fonts have distinct Seoully family names and retain source attribution.
