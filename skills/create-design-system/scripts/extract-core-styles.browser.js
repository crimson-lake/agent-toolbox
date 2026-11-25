// ============================================================================
// extract-core-styles.browser.js  (Call A, for `playwright-cli eval`)
// ----------------------------------------------------------------------------
// Typography and layout of the main page regions. Only VISIBLE elements are
// used: hidden consent banners, mobile menus and off-screen clones otherwise
// win `querySelector` and produce wrong tokens. Component-library sites (MUI,
// Chakra, Vuetify) often have no <header>/<nav>/<h1>/<h2> at all and use
// h3/h4 or styled divs, so every heading level is sampled.
//
// All values are JSON-safe (null instead of undefined): a result containing
// `undefined` is written by the CLI as a JS literal, not as parseable JSON.
// ============================================================================
() => {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const first = sel => [...document.querySelectorAll(sel)].find(visible) ?? null;
  const g = el => { if (!el) return null; const s = getComputedStyle(el);
    return { tag: el.tagName, cls: (el.className?.toString() ?? '').slice(0, 60), text: (el.innerText ?? '').trim().slice(0, 40),
      color: s.color, backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage.slice(0, 120),
      fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing, textTransform: s.textTransform, padding: s.padding, margin: s.margin,
      borderRadius: s.borderRadius }; };
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*="Typography-h"]')]
    .filter(visible).slice(0, 16).map(g);
  return {
    viewport: { width: innerWidth, height: innerHeight },
    pageHeight: document.documentElement.scrollHeight,
    body: g(document.body),
    header: g(first('header') ?? first('[class*="header" i]') ?? first('[class*="navbar" i]')),
    nav: g(first('nav') ?? first('[class*="nav" i]')),
    navLink: g(first('nav a') ?? first('header a') ?? first('[class*="header" i] a')),
    headings,
    paragraph: g(first('main p') ?? first('p')),
    link: g(first('main a') ?? first('a')),
    footer: g(first('footer') ?? first('[class*="footer" i]')),
    input: g(first('input:not([type=hidden]), textarea, select')),
  };
}
