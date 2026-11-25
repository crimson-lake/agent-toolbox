// ============================================================================
// extract-components.browser.js  (Call D, for `playwright-cli eval`)
// ----------------------------------------------------------------------------
// Reusable components that Calls A-C miss: cards (elements with a shadow or
// border and some content), chips/tags/badges, tabs, inputs, section wrappers
// (vertical rhythm) and the main content width. Pick representative entries;
// verify them against the screenshot before turning them into tokens.
// ============================================================================
() => {
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const g = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { cls: (el.className?.toString() ?? '').slice(0, 60), text: (el.innerText ?? '').trim().slice(0, 30),
      w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, color: s.color, border: s.border,
      borderRadius: s.borderRadius, boxShadow: s.boxShadow, padding: s.padding, fontSize: s.fontSize, fontWeight: s.fontWeight }; };
  const all = [...document.querySelectorAll('body *')].filter(visible);
  const cards = all.filter(el => { const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return (s.boxShadow !== 'none' || (s.borderTopStyle !== 'none' && s.borderTopWidth !== '0px'))
      && r.width >= 200 && r.width < innerWidth * 0.9 && r.height >= 120; }).slice(0, 6).map(g);
  const chips = [...document.querySelectorAll('[class*="chip" i], [class*="tag" i], [class*="badge" i], [class*="pill" i]')]
    .filter(visible).filter(el => { const r = el.getBoundingClientRect(); return r.height <= 40 && r.width <= 240 && el.children.length <= 2; })
    .slice(0, 6).map(g);
  const tabs = [...document.querySelectorAll('[role=tab]')].filter(visible).slice(0, 4).map(el => ({ ...g(el), selected: el.getAttribute('aria-selected') }));
  const inputs = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(visible).slice(0, 4).map(g);
  const sections = all.filter(el => { const r = el.getBoundingClientRect(); return r.width >= innerWidth - 20 && r.height >= 200 && el.parentElement && el.parentElement.getBoundingClientRect().width >= innerWidth - 20; })
    .filter(el => { const s = getComputedStyle(el); return s.paddingTop !== '0px' || s.backgroundColor !== 'rgba(0, 0, 0, 0)'; })
    .slice(0, 12).map(el => { const s = getComputedStyle(el); return { cls: (el.className?.toString() ?? '').slice(0, 50), bg: s.backgroundColor, paddingTop: s.paddingTop, paddingBottom: s.paddingBottom, h: Math.round(el.getBoundingClientRect().height) }; });
  const widths = new Map();
  for (const el of all) { const s = getComputedStyle(el); if (s.maxWidth !== 'none' && s.maxWidth.endsWith('px')) widths.set(s.maxWidth, (widths.get(s.maxWidth) ?? 0) + 1); }
  return { cards, chips, tabs, inputs, sections, containerMaxWidths: [...widths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) };
}
