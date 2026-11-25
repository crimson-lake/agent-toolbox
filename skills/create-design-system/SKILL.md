---
name: create-design-system
description: Extract a design system from any website URL by driving a real browser with the Playwright CLI. Produces design tokens (JSON), brand assets (logo and favicon when available), desktop and mobile homepage screenshots, and a design-guidelines.md document. Use when the user wants to clone, match, or stay consistent with an external brand.
argument-hint: <website URL>
---

# Create Design System from Website

Extract design tokens and brand assets from any website and save them as structured files for use by agents building UIs consistent with that brand.

---

## Inputs

The only required input is the **website URL**, normally passed as the skill argument (`/create-design-system https://example.com`). If no URL was given, ask for it in **one plain-text question** and stop until the user replies. Do not use a multiple-choice menu whose options cannot carry the URL, because it costs an extra round-trip.

## Prerequisites

This skill needs Node.js, Playwright CLI, and a configured browser. Check them **in parallel with asking for the URL**: `node --version` and `playwright-cli --version`. If anything is missing, briefly inform the user, then follow [the one-time setup guide](references/setup.md) and install them through the permitted package manager. Ask for approval only if the environment requires it. If a global npm install fails with `EACCES`, use the user-prefix install from the setup guide and do not use `sudo`.

The examples use `playwright-cli` with named sessions (`-s=design` for desktop, `-s=mobile` for mobile). If the project uses a local CLI, use its runner in each command. Shell variables and aliases do **not** persist between tool calls, so set them at the start of each command that uses them.

**Script folder.** Helper scripts live in `scripts/` next to this `SKILL.md`. Locate it once. It is usually `.agents/skills/create-design-system`, `.claude/skills/create-design-system` (often a symlink to the former), or the same paths under `$HOME`. Start each command that uses a helper with `SK=<that folder>/scripts` (PowerShell: `$SK = '<that folder>\scripts'`). In PowerShell, replace `"$(cat "$SK/x.js")"` with `(Get-Content -Raw "$SK\x.js")`.

**Temporary files** (token JSON, binary-asset JSON, previews) go to the agent's scratchpad or temp directory as `$TMP`, **never the project root**, so nothing has to be cleaned out of the repository afterwards.

---

## Process

### Step 1 — Prepare output directories

On Bash, use `mkdir -p assets docs`. On Windows PowerShell, use `New-Item -ItemType Directory -Force assets, docs | Out-Null`. If `assets/` already holds files from a previous run, list them first and tell the user what will be overwritten.

### Step 2 — Navigate and dismiss overlays

> ⚠️ **MUST DO — dismiss every cookie banner / modal / overlay covering the page BEFORE you screenshot or extract styles.** This is the single most common failure of this skill. An overlay both skews computed styles and ruins the screenshot.

```bash
playwright-cli -s=design open <URL>
```

If the page returns HTTP 403 or displays a blocked/challenge page, **do not extract styles or screenshot that page**. Wait briefly and retry navigation once or twice in the same session; a temporary block can clear. A configured alternative browser may be tried, but do not assume Chrome is installed or bypass a site's access controls. If the real page remains unavailable, stop and report the block instead of inventing a design system.

**Cookie/consent banners frequently load on a DELAY and are NOT present in the first snapshot.** So:

1. Wait for a delayed banner to mount. There is no `wait` command; use `run-code`:
   ```bash
   playwright-cli -s=design run-code "async page => await page.waitForTimeout(3000)"
   ```
2. Search for the banner instead of reading a whole snapshot. `find` returns only matching nodes:
   ```bash
   playwright-cli -s=design find --regex "/cookie|consent|accept|akceptuj|zgadzam|zgod|rozumiem/i"
   ```
3. Click the accept button by its ref. Refs can carry a frame prefix (`e605`, `f1e573`), so copy them exactly. Common labels include "Accept", "Accept all", "Accept cookies", "OK", "I agree", "Allow all", and in Polish "Akceptuj", "Akceptuj wszystkie", "Zgadzam się" and "Rozumiem". Note that the visible label can be "OK" while the accessible name is "Accept cookies".
   ```bash
   playwright-cli -s=design click e605
   ```
4. **Confirm it is gone.** Re-run `find` for the button name and the banner text and expect no matches.
5. Also dismiss any tooltip, onboarding or newsletter popups that appear after consent.

Every command prints a snapshot link (`.playwright-cli/page-<timestamp>.yml`) rather than the snapshot itself. Read or grep that file only if `find` was not enough.

### Step 3 — Load lazy content, then take the screenshots (desktop + mobile)

Modern sites lazy-load images and reveal sections only on scroll. Without scrolling, a full-page screenshot shows **blank sections and blurred `data:` placeholder images**, and extraction misses those sections. Before every screenshot, and before token extraction, scroll the whole page:

```bash
SK=<skill>/scripts; playwright-cli -s=design run-code "$(cat "$SK/scroll-lazy-content.js")"
```

The script scrolls down in steps, returns to the top and waits 4 s so hero animations settle. It reports `imagesStillLoadingOrPlaceholder`. A few are normal (off-screen carousels or marquees), but many means you should run it again.

> 🛑 **STOP — re-check for overlays first (yes, again).** Run `find` for the banner once more right before each screenshot. If anything is covering the page, dismiss it (Step 2).

Take **three screenshots by default**:

| File | Viewport | Mode |
|---|---|---|
| `assets/homepage.png` | desktop, the session default (check it is ≥1280px wide with `run-code "async page => page.viewportSize()"`) | full page |
| `assets/homepage-mobile.png` | 390×844 (iPhone 14 size) | first screen only |
| `assets/homepage-mobile-full.png` | 390×844 | full page |

**Desktop:**
```bash
playwright-cli -s=design screenshot --filename=assets/homepage.png --full-page
```

**Mobile.** Use a separate session so the desktop session stays intact for extraction. Resize, then **reload**, because many sites choose their layout at load time. The cookie banner usually comes back after the reload, so dismiss it again (Step 2) and scroll again:
```bash
playwright-cli -s=mobile open <URL>
playwright-cli -s=mobile run-code "async page => { await page.setViewportSize({ width: 390, height: 844 }); await page.reload(); await page.waitForTimeout(3000); }"
# Step 2 again: find + click the banner in -s=mobile, confirm it is gone
SK=<skill>/scripts; playwright-cli -s=mobile run-code "$(cat "$SK/scroll-lazy-content.js")"
playwright-cli -s=mobile screenshot --filename=assets/homepage-mobile.png
playwright-cli -s=mobile screenshot --filename=assets/homepage-mobile-full.png --full-page
playwright-cli -s=mobile close
```

**Visually verify every screenshot** by opening it with the image viewer. Check for:
- no banner or overlay strip,
- no large blank sections or blurred images (if you see them, run the scroll script again and retake),
- text animations caught mid-way, e.g. a hero word with repeated letters. If so, wait 2–3 s and retake, or report it.

A very tall full-page image is shown heavily downscaled, so look for blank bands rather than reading text. While viewing the mobile screenshots, note the responsive behavior for Step 7: hamburger menu, stacked grids, heading sizes, and any layout bugs on the reference site that should **not** be copied.

### Step 4 — Extract design tokens (four small eval calls, results to files)

Run each extraction script from the desktop session with `--filename`, so the output never floods the context:

```bash
SK=<skill>/scripts; TMP=<scratchpad>
for s in core-styles palette brand-assets components; do
  playwright-cli -s=design eval "$(cat "$SK/extract-$s.browser.js")" --filename="$TMP/$s.json"
done
```

| Script | Returns |
|---|---|
| `extract-core-styles.browser.js` (A) | Viewport and page height, body, header, nav and nav link, **all visible heading levels** (component libraries such as MUI often have no `h1`/`h2`), paragraph, link, footer, input |
| `extract-palette.browser.js` (B) | **Frequency-ranked** backgrounds, text colors, radii, font families, `size / weight` pairs, shadows and borders of visible elements, plus up to 16 buttons including transparent text buttons |
| `extract-brand-assets.browser.js` (C) | Logo SVG and image candidates (with `placeholder: true` flagged), favicons, `@font-face` rules, font `<link>`s, **blocked cross-origin stylesheets** (e.g. Google Fonts), `:root` CSS variables, detected UI framework |
| `extract-components.browser.js` (D) | Cards (shadow or border), chips and tags, tabs, inputs, section paddings, frequent `max-width` values (content width) |

All scripts use only **visible** elements and return JSON-safe values. Parse each file once, and only if the parse yields a string, parse that string a second time. If a file is not valid JSON (e.g. a hand-written eval returned `undefined`, which the CLI writes as a JS literal), fix the eval to return `?? null` instead of parsing by hand. Print compact summaries instead of whole files.

If Call C reports a `framework` (MUI, Chakra, Vuetify, Ant Design), record it, because tokens can then be mapped straight onto that library's theme.

### Step 5 — Save brand assets (logo, favicon, self-hosted fonts)

Use the in-page fetch helper on every platform. **Do not** use `curl`, `wget` or `Invoke-WebRequest`. Shell downloaders bypass the site's same-origin context and may be denied by the agent environment. Respect the site's asset rights.

1. **Inline SVG logo:** if Call C returned `logoSVG`, save that markup to `assets/logo.svg`. Never put raster bytes or HTML in `logo.svg`.
2. **Everything binary in one call:** the favicon, the header logo `<img>` (it skips `data:` placeholders and picks the first visible header or logo image) and self-hosted fonts:
   ```bash
   SK=<skill>/scripts; TMP=<scratchpad>
   playwright-cli -s=design eval "$(cat "$SK/fetch-binary-assets.browser.js")" --filename="$TMP/binary-assets.json"
   node "$SK/decode-binary-assets.cjs" "$TMP/binary-assets.json" assets
   ```
   If the helper picked the wrong image (a flag or product photo), set the right URL from Call C's candidates and run it again: `run-code "async page => page.evaluate(u => window.__logoUrl = u, '<url>')"`. Every value in the asset JSON must be a base64 string or `ERR:…`. The decoder aborts on anything else, so never add metadata keys.
3. **Verify the logo visually.** Image viewers often cannot display WebP or ICO, and a white logo on transparency looks empty on white. Render it on a dark and a light background:
   ```bash
   SK=<skill>/scripts; TMP=<scratchpad>
   node "$SK/make-logo-preview.cjs" assets/logo.webp "#0D244C" > "$TMP/logo-preview.js"   # use the brand header color
   playwright-cli -s=preview open about:blank
   playwright-cli -s=preview run-code "$(cat "$TMP/logo-preview.js")"
   playwright-cli -s=preview screenshot --filename="$TMP/logo-preview.png"
   playwright-cli -s=preview close
   ```
   Then view `logo-preview.png` and record which background the logo is for (light, dark or both) and its native size. Do **not** open it via `file://`, which renders blank. Run `file assets/logo.*` to confirm the format and dimensions.

**Fonts — only when the site self-hosts them.** The helper downloads `@font-face` files from the site's own origin into `assets/fonts/<family>/`. If Call C shows the fonts come from a third-party CDN (`fonts.googleapis.com` / `fonts.gstatic.com`, Adobe Typekit), they are CORS-blocked and are not the site's assets to redistribute. Download nothing; record the CDN URL and the weights the page actually renders (from Call B's `size / weight` pairs, which can include weights missing from the CDN URL) and suggest a self-hosting package such as `@fontsource/<family>`.

After decoding, inspect `assets/` **and** `assets/fonts/` including the parent directory. Font files must have plausible nonzero sizes and no unexpected files may appear at the top level.

> 🧨 **Learn from this incident — read before writing your own decode loop.** If the in-page code returns a *string* (e.g. `JSON.stringify(obj)`), the saved file can end up **double-encoded** (a JSON string of JSON). A naive `JSON.parse(file)` then yields a *string*, and `Object.entries(string)` iterates **one entry per character**. A previous run wrote **~600,000 zero-byte files** named `0`,`1`,`2`,… into `assets/fonts/`. The provided helpers prevent this: the fetch script returns an **object**, and the decoder re-parses strings and **refuses to write** on >200 entries, numeric keys, non-string values or values too short to be an asset. **Always prefer the helpers. If you must hand-roll, replicate those guards, and never run the decoder in the background.**

> 📜 **Tell the user about asset rights (REQUIRED).** Custom fonts and logos may be licensed. In your final response, identify the downloaded fonts and logos and ask the user to verify usage rights before using or redistributing them.

### Step 6 — Build design-tokens.json

Map the extracted values into a structured JSON, and cross-check every component against the screenshots. After dismissing consent, its elements may remain hidden in the DOM, and a link's computed color can be the browser default (`#0000EE`) while its visible child span is the brand color. Trust what is **visible**.

**Mark anything not observed on the site** (e.g. error and success colors, overlay) as assumed in a `$notes` object. Do not present library defaults as brand values.

```json
{
  "$source": { "url": "https://...", "extractedAt": "YYYY-MM-DD", "method": "...", "framework": "MUI | null" },
  "colors": {
    "brand": { "primary": "#...", "accent": "#...", "error": "#...", "success": "#..." },
    "background": { "default": "#fff", "light": "#...", "overlay": "rgba(...)" },
    "text": { "primary": "#...", "secondary": "#...", "muted": "#...", "onDark": "#fff" },
    "border": { "default": "#..." },
    "$notes": { "error": "Not observed on the site; library default." }
  },
  "typography": {
    "fontFamily": { "primary": "\"Font Name\", Arial, sans-serif" },
    "fontSource": "self-hosted assets/fonts/... | CDN URL",
    "fontWeights": { "regular": 400, "medium": 500, "semibold": 600, "bold": 700 },
    "fontSize": { "sm": "12px", "base": "14px", "md": "16px", "lg": "20px", "xl": "24px" },
    "lineHeight": { "tight": "1.2", "base": "1.4", "relaxed": "1.6" },
    "styles": { "h1": { "fontSize": "...", "fontWeight": 600, "lineHeight": "...", "color": "#..." } }
  },
  "spacing": { "unit": "8px", "1": "4px", "2": "8px", "3": "12px", "4": "16px", "6": "24px", "8": "32px" },
  "layout": { "contentMaxWidth": "...px (from Call D containerMaxWidths)", "sectionPaddingY": "..." },
  "breakpoints": { "mobile": "390px reference screenshot", "desktop": "1280px reference screenshot" },
  "borderRadius": { "none": "0px", "sm": "4px", "md": "8px", "lg": "16px", "full": "999px", "circle": "50%" },
  "shadows": { "card": "..." },
  "components": {
    "button": { "primary": { "backgroundColor": "#...", "color": "#...", "padding": "...", "borderRadius": "...", "height": "..." } },
    "header": { "backgroundColor": "#...", "padding": "...", "fontSize": "..." },
    "nav": { "color": "#...", "activeColor": "#...", "fontSize": "...", "fontWeight": "..." },
    "card": { "backgroundColor": "#...", "borderRadius": "...", "boxShadow": "..." },
    "chip": { "border": "...", "borderRadius": "...", "fontSize": "..." },
    "footer": { "backgroundColor": "#...", "color": "#..." }
  }
}
```

Save as `assets/design-tokens.json` and validate it: `node -e "JSON.parse(require('fs').readFileSync('assets/design-tokens.json','utf8'))"`.

### Step 7 — Write docs/design-guidelines.md

The guidelines document must include:

1. **Source line**: URL, extraction date, viewport, detected framework
2. **Assets table**: links to all saved files relative to `docs/`, including **all three screenshots** with their dimensions
3. **Colors section**: token name, hex and usage, with assumed values clearly marked
4. **Typography section**: font family, source (self-hosted files under `assets/fonts/…` or CDN URL), weight scale and size scale. If fonts were downloaded, list each file and add a one-line license note.
5. **Spacing and layout section**: base unit, common values, content max-width, section padding
6. **Border radius and shadows section**: all radii with usage context
7. **Components section**: header, nav, buttons, cards, chips, tabs, inputs, footer
8. **Responsive behavior section**: from the mobile screenshots, covering navigation pattern, grid stacking, heading and body sizes, CTA placement, and reference-site layout bugs **not** to copy
9. **Logo usage**: which background the saved logo is for (as verified in Step 5), native size, whether upscaling blurs it, and whether a variant for the other background is missing
10. **Visual style summary**: 3–5 sentences describing the brand personality

Save as `docs/design-guidelines.md`. If the repository already has an `assets/README.md` or `docs/README.md` that lists these files, keep it consistent.

### Step 8 — Verify and hand off

1. Close **every** session you opened: `playwright-cli -s=design close`, plus `-s=mobile` and `-s=preview` if they are still open.
2. Temporary files are in `$TMP`, not the repo. Confirm `assets/` contains only expected files.
3. In a Git repository, run `git status --short`. Point out a `.gitignore` change made by `playwright-cli install` (it adds `.playwright-cli/`) and any unrelated untracked folders, and never stage those blindly.
4. Review the generated files with the user, list known limitations (assumed tokens, low-resolution logo, missing logo variant, animation caught mid-way) and the asset-rights notice. Commit or open a PR only when the user asks. When a PR is requested, embed the screenshots in its description (e.g. `https://github.com/<owner>/<repo>/blob/<commit-sha>/assets/homepage-mobile.png?raw=true`).

---

## Common Pitfalls and Fixes

| Issue | Fix |
|---|---|
| No URL given | Ask in one plain-text question; do not offer a menu option like "I'll give the URL" that cannot carry it |
| `npm install -g` fails with `EACCES` | `npm install -g --prefix "$HOME/.local" @playwright/cli@latest`; never `sudo` |
| `eval` result floods the context | Add `--filename="$TMP/<file>.json"` and print a compact summary |
| Full-page screenshot has blank sections or blurred photos | Lazy loading. Run `scripts/scroll-lazy-content.js` and retake |
| Hero text captured mid-animation (e.g. "EEEAM") | Wait 2–3 s at the top and retake, or note it as a known limitation |
| Mobile screenshot shows desktop layout or the banner again | Resize **and reload**, then dismiss the banner again in the mobile session |
| `header`/`nav`/`h1` come back `null` | Component libraries use styled divs and h3/h4. The core-styles script samples all visible headings and class-based fallbacks |
| Tokens taken from hidden elements | Use the provided scripts, which filter for visible elements; cross-check with the screenshot |
| Logo candidate is a tiny `data:` image | It is a lazy-load blur placeholder (`placeholder: true`). Use the real URL next to it |
| Cannot see the saved WebP or ICO logo, or it looks empty | Render it with `scripts/make-logo-preview.cjs` on dark and light backgrounds; `file://` renders blank |
| Decoder aborts with "value … is not a string" | A metadata key (e.g. content type) was added to the asset JSON. Return base64 strings only |
| Hand-written eval output is not valid JSON | The result contained `undefined`. Use `?? null` for every optional value |
| Fonts come from Google Fonts or Typekit | Do not download. Record the CDN URL and the rendered weights, and suggest `@fontsource/<family>` |
| Site opens to a 403 or blocked page | Retry briefly in the same session; if still blocked, report it and do not extract the block page |
| No `wait` command in the CLI | `playwright-cli -s=design run-code "async page => await page.waitForTimeout(3000)"` |
| `eval` fails with `SyntaxError: Unexpected token ';'` | The argument must be an *expression*. Scripts end in `}` with no semicolon |
| Decoder dies with `require is not defined in ES module scope` | Run the provided `.cjs` helper rather than changing its extension |
| Snapshot too large to read | `playwright-cli -s=design find --regex "/pattern/i"` returns only matching nodes |
| Cookie banner ends up in the screenshot | It loads on a **delay**. Wait 3 s, `find`, dismiss, `find` again and expect no matches, then screenshot and inspect the PNG |
| Decode created hundreds of thousands of 0-byte files | String return was double-encoded. Return an **object**; use the provided helpers; never `run_in_background` the decoder |
| Verifying only the subfolders you expected | Inspect the **parent** `assets/fonts/` directory too |
| Computed background is `rgba(0, 0, 0, 0)` | Transparent. Skip it in the palette |
| Link color is `#0000EE` but looks orange | The browser default sits on the `<a>` while a child span carries the brand color. Check the visible text element |
| Fonts show as `Arial` instead of the brand font | Check `@font-face` rules and font `<link>`s; the brand font may load under an alias |

---

## Output Files

All files are saved to the project root:

```
assets/
  homepage.png               # Desktop full-page screenshot (no overlays, lazy content loaded)
  homepage-mobile.png        # Mobile 390×844 first screen
  homepage-mobile-full.png   # Mobile 390px full page
  logo.<source-format>       # Brand wordmark, e.g. logo.svg / logo.webp / logo.png (only when obtainable)
  favicon.<ico|png|svg>      # Favicon binary
  design-tokens.json         # Structured design tokens
  fonts/                     # Self-hosted custom fonts (only if the site provides them)
    <family>/*.woff2|*.ttf
docs/
  design-guidelines.md       # Human-readable design system reference
```
