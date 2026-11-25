const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const scripts = path.resolve(__dirname, '../skills/create-design-system/scripts');
const skill = fs.readFileSync(path.resolve(scripts, '../SKILL.md'), 'utf8');

// playwright-cli `eval` and `run-code` take ONE expression. A trailing `;` or a
// second statement fails with "SyntaxError: Unexpected token ';'" at run time.
const expressionScripts = [
  'extract-core-styles.browser.js',
  'extract-palette.browser.js',
  'extract-brand-assets.browser.js',
  'extract-components.browser.js',
  'fetch-binary-assets.browser.js',
  'scroll-lazy-content.js',
];

function parseExpression(source) {
  // Wrapping in parentheses rejects statements, trailing semicolons and a
  // second expression, exactly like the CLI does.
  return new Function(`return (\n${source}\n);`)();
}

for (const name of expressionScripts) {
  test(`${name} is a single function expression usable by playwright-cli`, () => {
    const source = fs.readFileSync(path.join(scripts, name), 'utf8');
    assert.equal(typeof parseExpression(source), 'function');
    assert.doesNotMatch(source.trimEnd(), /;$/, 'must not end with a semicolon');
  });

  test(`${name} is referenced from SKILL.md`, () => {
    assert.ok(skill.includes(name), `${name} is not referenced in SKILL.md`);
  });
}

test('extraction scripts return JSON-safe values (no bare undefined from optional chaining)', () => {
  for (const name of expressionScripts.filter(n => n.startsWith('extract-'))) {
    const source = fs.readFileSync(path.join(scripts, name), 'utf8');
    // `a?.b` alone yields undefined, which the CLI writes as a JS literal, not JSON.
    for (const match of source.matchAll(/:\s*[\w.]+\?\.[\w.()]+\s*[,}]/g)) {
      assert.fail(`${name}: optional chain without "?? null" fallback: ${match[0]}`);
    }
  }
});

const logoPreview = path.join(scripts, 'make-logo-preview.cjs');

function tempLogo(t, ext, bytes) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'agent-toolbox-logo-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, `logo${ext}`);
  fs.writeFileSync(file, bytes);
  return file;
}

test('make-logo-preview prints a run-code expression with dark and light previews', t => {
  const file = tempLogo(t, '.webp', Buffer.from('RIFF....WEBPVP8L fake'));
  const result = spawnSync(process.execPath, [logoPreview, file, '#0D244C'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(typeof parseExpression(result.stdout), 'function');
  assert.match(result.stdout, /data:image\/webp;base64,/);
  assert.match(result.stdout, /background:#0D244C/);
  assert.match(result.stdout, /background:#fff/);
  assert.doesNotMatch(result.stdout, /file:\/\//);
});

test('make-logo-preview rejects a non-hex background (no HTML/JS injection)', t => {
  const file = tempLogo(t, '.png', Buffer.alloc(16));
  const result = spawnSync(process.execPath, [logoPreview, file, "red'><script>"], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hex color/);
});

test('make-logo-preview rejects unsupported file types', t => {
  const file = tempLogo(t, '.html', Buffer.from('<html>'));
  const result = spawnSync(process.execPath, [logoPreview, file], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported image type/);
});

test('decoder refuses metadata keys mixed into the asset map (regression)', t => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'agent-toolbox-meta-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const input = path.join(dir, 'input.json');
  const output = path.join(dir, 'assets');
  fs.writeFileSync(input, JSON.stringify({
    'logo.webp': Buffer.alloc(128, 65).toString('base64'),
    _contentTypes: { 'logo.webp': 'image/webp' },
  }));
  const result = spawnSync(process.execPath, [path.join(scripts, 'decode-binary-assets.cjs'), input, output], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a string/);
  assert.equal(fs.existsSync(path.join(output, 'logo.webp')), false);
});
