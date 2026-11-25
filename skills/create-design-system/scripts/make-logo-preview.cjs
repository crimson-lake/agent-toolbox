#!/usr/bin/env node
// ============================================================================
// make-logo-preview.cjs
// ----------------------------------------------------------------------------
// Prints a `playwright-cli run-code` expression that renders a logo on a DARK
// and a LIGHT background (4x upscaled) so you can SEE it in a screenshot.
// Why: image viewers available to agents often cannot display WebP/ICO, and
// a white logo on a transparent background looks "empty" on white. Opening the
// file via file:// in playwright-cli renders a blank page, so setContent() with
// a data: URI is used instead.
//
// Usage:
//   node <skill>/scripts/make-logo-preview.cjs assets/logo.webp "#0D244C" > "$TMP/logo-preview.js"
//   playwright-cli -s=preview open about:blank
//   playwright-cli -s=preview run-code "$(cat "$TMP/logo-preview.js")"
//   playwright-cli -s=preview screenshot --filename="$TMP/logo-preview.png"
//   playwright-cli -s=preview close
// The second argument (dark background color) is optional; use the brand's
// header color when known.
// ============================================================================
const fs = require("fs");
const path = require("path");

const [file, dark = "#1a1a1a"] = process.argv.slice(2);
if (!file) { console.error("Usage: make-logo-preview.cjs <logo-file> [dark-bg-color]"); process.exit(1); }
if (!/^#[0-9a-f]{3,8}$/i.test(dark)) { console.error("dark-bg-color must be a hex color like #0D244C"); process.exit(1); }
const types = { ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon", ".gif": "image/gif" };
const mime = types[path.extname(file).toLowerCase()];
if (!mime) { console.error("Unsupported image type: " + file); process.exit(1); }
const b64 = fs.readFileSync(file).toString("base64");
const img = `<img src='data:${mime};base64,${b64}' style='height:180px;width:auto;image-rendering:auto'>`;
const html = `<body style='margin:0;font:14px sans-serif'>`
  + `<div style='background:${dark};padding:24px;color:#fff'>on dark ${dark}<br>${img}</div>`
  + `<div style='background:#fff;padding:24px;color:#000'>on white<br>${img}</div></body>`;
process.stdout.write(`async page => { await page.setContent(${JSON.stringify(html)}); await page.waitForTimeout(300); }`);
