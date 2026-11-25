// ============================================================================
// extract-palette.browser.js  (Call B, for `playwright-cli eval`)
// ----------------------------------------------------------------------------
// Frequency-ranked colors, radii, font sizes, shadows and borders of VISIBLE
// elements across the whole page (not just the first 500 DOM nodes, which are
// mostly the header). Text colors/sizes are counted on leaf text nodes only.
// Buttons include transparent "text" buttons too, so nav and link styles show.
// ============================================================================
() => {
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const els = [...document.querySelectorAll('body *')].filter(visible).slice(0, 4000);
  const inc = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
  const bg = new Map(), text = new Map(), radius = new Map(), font = new Map(), size = new Map(), shadow = new Map(), border = new Map();
  for (const el of els) {
    const s = getComputedStyle(el);
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') inc(bg, s.backgroundColor);
    if (el.children.length === 0 && (el.innerText ?? '').trim()) { inc(text, s.color); inc(size, `${s.fontSize} / ${s.fontWeight}`); }
    if (s.borderRadius !== '0px') inc(radius, s.borderRadius);
    inc(font, s.fontFamily);
    if (s.boxShadow !== 'none') inc(shadow, s.boxShadow);
    if (s.borderTopStyle !== 'none' && s.borderTopWidth !== '0px') inc(border, `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`);
  }
  const top = (m, n = 25) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  const buttons = [];
  for (const b of document.querySelectorAll('button, [role=button], a[class*="btn" i], [class*="button" i]')) {
    if (!visible(b)) continue;
    const s = getComputedStyle(b), r = b.getBoundingClientRect();
    buttons.push({ text: (b.innerText ?? '').trim().slice(0, 30), cls: (b.className?.toString() ?? '').slice(0, 60),
      bg: s.backgroundColor, color: s.color, border: s.border, borderRadius: s.borderRadius, padding: s.padding,
      fontSize: s.fontSize, fontWeight: s.fontWeight, textTransform: s.textTransform, height: Math.round(r.height) });
    if (buttons.length >= 16) break;
  }
  return { backgrounds: top(bg), textColors: top(text), radii: top(radius), fontFamilies: top(font, 8),
    fontSizes: top(size), shadows: top(shadow, 8), borders: top(border, 10), buttons };
}
