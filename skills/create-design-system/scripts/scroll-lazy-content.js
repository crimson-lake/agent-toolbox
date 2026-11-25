// ============================================================================
// scroll-lazy-content.js  (for `playwright-cli run-code`, NOT `eval`)
// ----------------------------------------------------------------------------
// Scrolls the whole page in small steps so lazy-loaded images, scroll-reveal
// sections and blurred placeholders (data: URI "blur-up" images) load before
// the screenshot and style extraction. Then returns to the top and waits for
// hero animations to settle. Without this step a full-page screenshot can show
// large blank sections and blurred photos (real incident).
//
// Usage:  playwright-cli -s=design run-code "$(cat <skill>/scripts/scroll-lazy-content.js)"
// The file must stay a single expression ending in `}` with no semicolon.
// ============================================================================
async page => {
  const step = Math.max(300, Math.floor((page.viewportSize()?.height || 800) * 0.5));
  let height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += step) {
    await page.evaluate(v => window.scrollTo(0, v), y);
    await page.waitForTimeout(250);
    // infinite/expanding pages: re-read height, but cap at 40k px
    height = Math.min(40000, await page.evaluate(() => document.documentElement.scrollHeight));
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  // let hero text animations / carousels settle before a screenshot
  await page.waitForTimeout(4000);
  const pending = await page.evaluate(() =>
    // blur-up frameworks (Gatsby, Next) keep the data: placeholder in the DOM at
    // opacity 0 after the real image loads — count only VISIBLE placeholders
    [...document.images].filter(i => i.getBoundingClientRect().width > 100 && getComputedStyle(i).opacity !== '0'
      && (!i.complete || (i.currentSrc || i.src).startsWith('data:'))).length);
  return { scrolledTo: height, imagesStillLoadingOrPlaceholder: pending };
}
