// ============================================================================
// extract-brand-assets.browser.js  (Call C, for `playwright-cli eval`)
// ----------------------------------------------------------------------------
// Logo candidates, favicons, font sources and CSS custom properties.
// - Lazy-loading sites put a tiny `data:` blur placeholder <img> next to the
//   real logo; those are flagged `placeholder: true` and must not be saved.
// - Cross-origin stylesheets (Google Fonts, Typekit) cannot be read; they are
//   listed in `blockedStylesheets` so the font SOURCE is still reported.
// ============================================================================
() => {
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const logoEl = document.querySelector('header .logo, [class*="header" i] [class*="logo" i], a[class*="logo" i], [class*="logo" i]');
  const svgEl = logoEl ? (logoEl.matches('svg') ? logoEl : logoEl.querySelector('svg')) : null;
  const imgs = [...document.querySelectorAll('header img, [class*="header" i] img, [class*="logo" i] img, img[alt*="logo" i], img[src*="logo" i], footer img')]
    .filter(visible).slice(0, 10).map(i => {
      const src = i.currentSrc || i.src || '';
      const r = i.getBoundingClientRect();
      return { alt: i.alt ?? '', src: src.startsWith('data:') ? src.slice(0, 40) + '…' : src, placeholder: src.startsWith('data:'),
        w: Math.round(r.width), h: Math.round(r.height), naturalW: i.naturalWidth, naturalH: i.naturalHeight,
        inHeader: !!i.closest('header, [class*="header" i]'), inFooter: !!i.closest('footer, [class*="footer" i]') };
    });
  const fontFaces = [], blockedStylesheets = [], cssVars = {};
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { blockedStylesheets.push(sheet.href ?? 'inline'); continue; }
    for (const rule of rules) {
      if (rule.type === CSSRule.FONT_FACE_RULE) fontFaces.push(rule.cssText.slice(0, 300));
      if (rule.selectorText === ':root') for (const p of rule.style) if (p.startsWith('--')) cssVars[p] = rule.style.getPropertyValue(p).trim();
    }
  }
  const fontLinks = [...document.querySelectorAll('link[href*="font" i]')].map(l => l.href);
  return {
    logoSelectorMatch: logoEl ? (logoEl.className?.toString() ?? logoEl.tagName) : null,
    logoSVG: svgEl ? svgEl.outerHTML.trim() : null,
    logoImageCandidates: imgs,
    favicons: [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({ rel: l.rel, href: l.href, sizes: l.sizes?.value ?? '' })),
    fontFaces: fontFaces.slice(0, 20),
    fontLinks,
    blockedStylesheets,
    cssVars: Object.fromEntries(Object.entries(cssVars).slice(0, 80)),
    framework: document.querySelector('[class*="Mui"]') ? 'MUI' : document.querySelector('[class*="chakra-"]') ? 'Chakra UI'
      : document.querySelector('[class*="v-application"]') ? 'Vuetify' : document.querySelector('[class*="ant-"]') ? 'Ant Design' : null,
  };
}
