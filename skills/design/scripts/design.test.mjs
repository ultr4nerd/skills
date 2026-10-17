// Run: node --test skills/design/scripts/design.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  run, contrastRatio, parseCssColor, parseHex, toHex, colorFromObject, suggestForeground,
  globToRegExp, expandBraces, prettyJson, normalizeRaw,
} from './design.mjs';

// ---------------------------------------------------------------------------
// Helpers

const EXT = 'io.github.ultr4nerd.design';

const DESIGN_MD = [
  '---',
  'title: Test design system',
  'description: Entry point',
  'read_when: Before any UI work',
  '---',
  '',
  '# Test design system',
  '',
  'Use `color.primary` for actions.',
  '',
  '## Components',
  '',
  '<!-- design:components:start -->',
  '<!-- design:components:end -->',
  '',
].join('\n');

// A small, valid system written in shorthand (fmt turns it into 2025.10 objects).
function baseTokens() {
  return {
    primitive: {
      color: {
        $type: 'color',
        white: { $value: '#ffffff' },
        ink: { $value: '#1f1a16' },
        blue: { $value: '#1e4ed8' },
        tomato: { $value: '#e5452d' },
      },
      font: { $type: 'fontFamily', sans: { $value: ['Inter Tight', 'system-ui', 'sans-serif'] } },
    },
    color: {
      $type: 'color',
      surface: { $value: '{primitive.color.white}', $description: 'Page background' },
      'on-surface': { $value: '{primitive.color.ink}', $description: 'Body text' },
      primary: { $value: '{primitive.color.blue}', $description: 'Primary actions' },
      'on-primary': { $value: '{primitive.color.white}', $description: 'Text on primary' },
    },
    font: { $type: 'fontFamily', body: { $value: '{primitive.font.sans}', $description: 'Body text' } },
    spacing: { $type: 'dimension', md: { $value: '16px', $description: 'Default gap' } },
    radius: { $type: 'dimension', card: { $value: '12px', $description: 'Cards' } },
    type: {
      $type: 'typography',
      body: { $value: { fontFamily: '{font.body}', fontSize: '16px', fontWeight: 400, lineHeight: 1.5 }, $description: 'Body copy' },
    },
  };
}

function project({ tokens = baseTokens(), config, files = {}, designMd = DESIGN_MD } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-'));
  fs.writeFileSync(path.join(dir, 'design.json'), JSON.stringify(config || {}));
  fs.mkdirSync(path.join(dir, 'design'), { recursive: true });
  if (tokens) fs.writeFileSync(path.join(dir, 'design/tokens.json'), JSON.stringify(tokens, null, 2));
  if (designMd) fs.writeFileSync(path.join(dir, 'design/DESIGN.md'), designMd);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return dir;
}

function cli(dir, ...args) {
  const out = [];
  const err = [];
  const code = run(args, { cwd: dir, io: { out: (s) => out.push(s), err: (s) => err.push(s) } });
  return { code, out: out.join('\n'), err: err.join('\n'), all: [...out, ...err].join('\n') };
}

function ok(dir, ...args) {
  const r = cli(dir, ...args);
  assert.equal(r.code, 0, `expected exit 0 for ${args.join(' ')}\n${r.all}`);
  return r;
}

function fails(dir, code, pattern, ...args) {
  const r = cli(dir, ...args);
  assert.equal(r.code, code, `expected exit ${code} for ${args.join(' ')}\n${r.all}`);
  if (pattern) assert.match(r.all, pattern);
  return r;
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const write = (dir, rel, content) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
};

function built(opts) {
  const dir = project(opts);
  ok(dir, 'build');
  return dir;
}

// ---------------------------------------------------------------------------
// Color math

describe('color', () => {
  test('parses hex in every length and formats back', () => {
    assert.deepEqual(parseHex('#fff'), { r: 1, g: 1, b: 1, a: 1 });
    assert.equal(toHex(parseHex('#E5452D')), '#e5452d');
    assert.equal(toHex(parseHex('#00000080')), '#00000080');
    assert.equal(parseHex('#12345'), null);
  });

  test('parses rgb() and hsl() strings', () => {
    assert.equal(toHex(parseCssColor('rgb(229, 69, 45)')), '#e5452d');
    assert.equal(toHex(parseCssColor('rgb(229 69 45 / 50%)')), '#e5452d80');
    assert.equal(toHex(parseCssColor('hsl(0, 100%, 50%)')), '#ff0000');
    assert.equal(parseCssColor('tomato'), null);
  });

  test('WCAG contrast ratios match known values', () => {
    assert.equal(contrastRatio(parseHex('#000'), parseHex('#fff')).toFixed(2), '21.00');
    assert.equal(contrastRatio(parseHex('#777'), parseHex('#fff')).toFixed(2), '4.48');
    // alpha foreground is composited over the background first
    assert.ok(contrastRatio(parseHex('#00000080'), parseHex('#fff')) < 5);
  });

  test('DTCG color objects in several color spaces', () => {
    assert.equal(toHex(colorFromObject({ colorSpace: 'srgb', components: [1, 0, 0] }).color), '#ff0000');
    assert.equal(toHex(colorFromObject({ colorSpace: 'hsl', components: [120, 100, 25] }).color), '#008000');
    assert.equal(toHex(colorFromObject({ colorSpace: 'oklch', components: [0.62796, 0.25768, 29.234] }).color), '#ff0000');
    assert.equal(toHex(colorFromObject({ colorSpace: 'display-p3', components: [1, 1, 1] }).color), '#ffffff');
    assert.equal(toHex(colorFromObject({ colorSpace: 'srgb', components: [0, 0, 0], alpha: 0.5 }).color), '#00000080');
    assert.match(colorFromObject({ colorSpace: 'lab', components: [50, 0, 0] }).error, /hex/);
    assert.equal(toHex(colorFromObject({ colorSpace: 'lab', components: [50, 0, 0], hex: '#777777' }).color), '#777777');
    assert.match(colorFromObject({ colorSpace: 'srgb', components: [1, 0, 0], hex: '#00ff00' }).warning, /does not match/);
    assert.match(colorFromObject({ colorSpace: 'cmyk', components: [0, 0, 0] }).error, /unknown colorSpace/);
  });

  test('suggestForeground finds the nearest passing color with the same hue', () => {
    const fg = parseHex('#e5452d');
    const bg = parseHex('#f8f2e8');
    const fix = suggestForeground(fg, bg, 4.5);
    assert.ok(contrastRatio(fix, bg) >= 4.5);
    assert.ok(contrastRatio(fix, bg) < 5, 'should be the nearest, not black');
    assert.equal(suggestForeground(parseHex('#000'), parseHex('#fff'), 4.5), null);
  });
});

describe('utilities', () => {
  test('globs with braces and double stars', () => {
    assert.deepEqual(expandBraces('src/**/*.{ts,tsx}'), ['src/**/*.ts', 'src/**/*.tsx']);
    assert.ok(globToRegExp('src/**/*.ts').test('src/a/b/c.ts'));
    assert.ok(globToRegExp('src/**/*.ts').test('src/c.ts'));
    assert.ok(!globToRegExp('src/*.ts').test('src/a/c.ts'));
  });

  test('normalizeRaw converts shorthand to DTCG 2025.10 and leaves aliases alone', () => {
    assert.deepEqual(normalizeRaw('#ff0000', 'color'), { colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000' });
    assert.deepEqual(normalizeRaw('#00000080', 'color').alpha, 0.502);
    assert.deepEqual(normalizeRaw('1.5rem', 'dimension'), { value: 1.5, unit: 'rem' });
    assert.deepEqual(normalizeRaw('200ms', 'duration'), { value: 200, unit: 'ms' });
    assert.equal(normalizeRaw('{a.b}', 'color'), '{a.b}');
    const t = normalizeRaw({ fontFamily: '{font.body}', fontSize: '16px', lineHeight: '1.5' }, 'typography');
    assert.deepEqual(t, { fontFamily: '{font.body}', fontSize: { value: 16, unit: 'px' }, lineHeight: 1.5 });
    const s = normalizeRaw([{ color: '#000', offsetX: '0px', offsetY: '1px', blur: '2px' }, '{shadow.x}'], 'shadow');
    assert.equal(s[0].color.hex, '#000000');
    assert.equal(s[1], '{shadow.x}');
  });

  test('prettyJson keeps tokens expanded and short values inline', () => {
    const text = prettyJson({ a: { $type: 'color', b: { $value: { colorSpace: 'srgb', components: [1, 0, 0] } } } });
    assert.match(text, /"\$value": \{ "colorSpace": "srgb", "components": \[1, 0, 0\] \}/);
    assert.match(text, /^\{\n {2}"a": \{\n/);
  });
});

// ---------------------------------------------------------------------------
// init, build, check

describe('init and build', () => {
  test('init scaffolds a project that passes check, and never overwrites', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-init-'));
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"@acme/shop"}');
    const r = ok(dir, 'init');
    assert.match(r.out, /created: design\/DESIGN.md/);
    assert.match(read(dir, 'design/DESIGN.md'), /^title: shop design system$/m);
    for (const f of ['design/tokens.json', 'design/tokens.css', 'design/tokens.ts', 'design/TOKENS.md']) assert.ok(fs.existsSync(path.join(dir, f)), f);
    const check = ok(dir, 'check');
    assert.match(check.out, /design check: OK \(47 tokens, 47 provisional/);
    assert.doesNotMatch(check.out, /shorthand/, 'the starter is already in 2025.10 form');
    const again = ok(dir, 'init');
    assert.match(again.out, /exists: design\/DESIGN.md/);
  });

  test('init --tailwind writes design.json and a Tailwind @theme build', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-init-'));
    ok(dir, 'init', '--tailwind', '--name', 'Acme');
    assert.equal(JSON.parse(read(dir, 'design.json')).css.tailwind, true);
    const css = read(dir, 'design/tokens.css');
    assert.match(css, /@theme \{\n {2}--color-\*: initial;\n/);
    assert.match(css, /@utility type-body \{/);
  });

  test('build writes CSS with references, TS, TOKENS.md and the inventory; second build is a no-op', () => {
    const dir = project();
    const first = ok(dir, 'build');
    assert.match(first.out, /wrote: design\/tokens.css/);
    const css = read(dir, 'design/tokens.css');
    assert.match(css, /--primitive-color-blue: #1e4ed8;/);
    assert.match(css, /--color-primary: var\(--primitive-color-blue\);/);
    assert.match(css, /--primitive-font-sans: "Inter Tight", system-ui, sans-serif;/);
    assert.match(css, /--type-body-font-family: var\(--font-body\);/);
    assert.match(css, /--type-body: var\(--type-body-font-weight\) var\(--type-body-font-size\)\/var\(--type-body-line-height\) var\(--type-body-font-family\);/);
    assert.match(css, /\.type-body \{\n {2}font-family: var\(--type-body-font-family\);/);
    const ts = read(dir, 'design/tokens.ts');
    assert.match(ts, /'color.primary': '#1e4ed8',/);
    assert.doesNotMatch(ts, /primitive\./, 'primitives are not exported to code');
    assert.match(ts, /'type.body': \{\n {4}fontFamily: '"Inter Tight", system-ui, sans-serif',\n {4}fontSize: '16px',\n {4}fontWeight: 400,\n {4}lineHeight: 1.5,/);
    assert.match(ts, /export type TokenName = keyof typeof tokens;/);
    const md = read(dir, 'design/TOKENS.md');
    assert.match(md, /^- `color.on-primary` #ffffff — Text on primary\. on: primary \d\.\d$/m);
    assert.match(md, /^- `type.body` 400 16px\/1.5 font.body — Body copy\. class type-body$/m);
    assert.match(md, /^- `primitive.color`: white, ink, blue, tomato$/m);
    assert.match(read(dir, 'design/DESIGN.md'), /_No component specs yet/);
    const second = ok(dir, 'build');
    assert.match(second.out, /up to date/);
    ok(dir, 'build', '--check');
  });

  test('build --check and check report stale outputs', () => {
    const dir = built();
    const tokens = baseTokens();
    tokens.spacing.lg = { $value: '24px', $description: 'Between groups' };
    write(dir, 'design/tokens.json', tokens);
    fails(dir, 1, /stale: design\/tokens.css/, 'build', '--check');
    fails(dir, 1, /design\/TOKENS.md: generated output is stale/, 'check');
    ok(dir, 'build');
    ok(dir, 'check');
  });

  test('json output and js output follow config', () => {
    const dir = built({ config: { outputs: { css: 'src/tokens.css', ts: 'src/tokens.js', json: 'dist/tokens.json', md: 'design/TOKENS.md' } } });
    const json = JSON.parse(read(dir, 'dist/tokens.json'));
    assert.equal(json.tokens['color.surface'], '#ffffff');
    const js = read(dir, 'src/tokens.js');
    assert.doesNotMatch(js, /as const|export type/);
    assert.ok(fs.existsSync(path.join(dir, 'src/tokens.css')));
  });

  test('build refuses to write when tokens have errors', () => {
    const tokens = baseTokens();
    tokens.color.primary.$value = '{primitive.color.nope}';
    const dir = project({ tokens });
    fails(dir, 1, /references unknown token \{primitive.color.nope\}[\s\S]*nothing written/, 'build');
    assert.ok(!fs.existsSync(path.join(dir, 'design/tokens.css')));
  });
});

// ---------------------------------------------------------------------------
// Token validation

describe('token validation', () => {
  const broken = (mutate, pattern) => {
    const tokens = baseTokens();
    mutate(tokens);
    const dir = project({ tokens });
    return fails(dir, 1, pattern, 'check');
  };

  test('unknown reference, with a hint when it names a group', () => {
    broken((t) => { t.color.primary.$value = '{primitive.color}'; }, /references unknown token \{primitive.color\} \(that is a group/);
  });

  test('circular references', () => {
    broken((t) => {
      t.color.primary.$value = '{color.accent}';
      t.color.accent = { $value: '{color.primary}' };
    }, /circular reference: color\.(primary|accent) -> color\.(accent|primary) -> color\.(primary|accent)/);
  });

  test('alias type mismatch and missing type', () => {
    broken((t) => { t.color.primary.$value = '{spacing.md}'; }, /\{spacing.md\} is a dimension, expected color/);
    broken((t) => { t.misc = { thing: { $value: 3 } }; }, /misc.thing: no \$type/);
  });

  test('invalid values and units', () => {
    broken((t) => { t.spacing.md.$value = '50%'; }, /invalid dimension "50%"/);
    broken((t) => { t.spacing.md.$value = { value: 1, unit: 'vh' }; }, /unit "vh" is not allowed/);
    broken((t) => { t.color.surface.$value = 'white'; }, /invalid color "white"/);
    broken((t) => { t.misc = { $type: 'gradientish', a: { $value: 1 } }; }, /unknown \$type "gradientish"/);
    broken((t) => { t.type.body.$value.fontSize = undefined; delete t.type.body.$value.fontSize; }, /type.body: missing "fontSize"/);
  });

  test('invalid names', () => {
    broken((t) => { t.color['a.b'] = { $value: '#000000' }; }, /color.a.b: invalid name/);
  });

  test('tier rule: references point down only', () => {
    broken((t) => { t.primitive.color.alias = { $value: '{color.surface}' }; }, /a primitive token must not reference the semantic token \{color.surface\}/);
  });

  test('CSS name collisions', () => {
    broken((t) => {
      t.spacing.fontSize = { $value: '1px' };
      t.spacing['font-size'] = { $value: '2px' };
    }, /CSS name --spacing-font-size collides/);
  });

  test('$extends, $root and $ref resolve', () => {
    const tokens = baseTokens();
    tokens.button = { $type: 'color', bg: { $value: '{color.primary}' }, fg: { $value: '{color.on-primary}' } };
    tokens['button-danger'] = { $extends: '{button}', bg: { $value: '{primitive.color.tomato}' } };
    tokens.color.accent = { $root: { $value: '{primitive.color.blue}' }, soft: { $value: '#dbe4fb' } };
    tokens.spacing.lg = { $value: { value: { $ref: '#/spacing/md/$value/value' }, unit: 'rem' } };
    const dir = built({ tokens: JSON.parse(JSON.stringify(tokens).replace(/"16px"/, '{"value":16,"unit":"px"}')) });
    const css = read(dir, 'design/tokens.css');
    assert.match(css, /--button-danger-fg: var\(--color-on-primary\);/);
    assert.match(css, /--button-danger-bg: var\(--primitive-color-tomato\);/);
    assert.match(css, /--color-accent: var\(--primitive-color-blue\);/);
    assert.match(css, /--spacing-lg: 16rem;/);
    ok(dir, 'show', 'color.accent.$root');
  });

  test('provisional status is inherited from groups and propagates through references', () => {
    const tokens = baseTokens();
    tokens.primitive.color.$extensions = { [EXT]: { status: 'provisional' } };
    const dir = built({ tokens });
    const md = read(dir, 'design/TOKENS.md');
    assert.match(md, /^## color \(provisional\)$/m);
    assert.match(md, /^## spacing$/m);
    assert.match(md, /^- `font.body` .* — Body text$/m, 'font.body aliases a stable primitive');
    assert.match(ok(dir, 'show', 'color.primary').out, /\(semantic color, provisional\)/);
    assert.match(ok(dir, 'check').out, /13 tokens, 8 provisional/);
  });

  test('$deprecated tokens are flagged where used', () => {
    const tokens = baseTokens();
    tokens.color.brand = { $value: '{primitive.color.blue}', $deprecated: 'use {color.primary}' };
    const dir = built({
      tokens,
      config: { scan: { include: ['src/**/*.css'] } },
      files: { 'src/a.css': '.a { color: var(--color-brand); }\n' },
    });
    const r = ok(dir, 'check');
    assert.match(r.out, /warning: src\/a.css:1: deprecated token color.brand: use \{color.primary\}/);
    assert.match(read(dir, 'design/TOKENS.md'), /`color.brand` #1e4ed8 \(deprecated: use \{color.primary\}\)/);
  });
});

// ---------------------------------------------------------------------------
// Contrast

describe('contrast', () => {
  test('implicit on-X pairs fail with a suggested fix', () => {
    const tokens = baseTokens();
    tokens.color['on-primary'].$value = '#8fa8ef';
    const dir = project({ tokens });
    fails(dir, 1, /contrast color.on-primary on color.primary: \d\.\d\d:1, needs 4.5:1 \(AA\); nearest passing foreground #[0-9a-f]{6}/, 'check');
  });

  test('declared pairs with levels, and unknown levels', () => {
    const tokens = baseTokens();
    tokens.color.accent = { $value: '{primitive.color.tomato}', $extensions: { [EXT]: { on: { 'color.surface': 'AA-large' } } } };
    const dir = built({ tokens });
    ok(dir, 'check');
    tokens.color.accent.$extensions[EXT].on = { 'color.surface': 'AA' };
    write(dir, 'design/tokens.json', tokens);
    fails(dir, 1, /contrast color.accent on color.surface: 4\.0\d:1, needs 4.5:1/, 'check');
    tokens.color.accent.$extensions[EXT].on = { 'color.surface': 'AAAA' };
    write(dir, 'design/tokens.json', tokens);
    fails(dir, 1, /unknown contrast level "AAAA"/, 'check');
    tokens.color.accent.$extensions[EXT].on = ['color.nope'];
    write(dir, 'design/tokens.json', tokens);
    fails(dir, 1, /background \{color.nope\} is not a color token/, 'check');
  });

  test('a color that passes as hex still passes after fmt (components are rounded)', () => {
    const tokens = baseTokens();
    tokens.primitive.color.paper = { $value: '#fbf7f0' };
    tokens.color.surface.$value = '{primitive.color.paper}';
    tokens.color.accent = { $value: '#b85600', $extensions: { [EXT]: { on: ['color.surface'] } } };
    const dir = built({ tokens });
    ok(dir, 'check');
    ok(dir, 'fmt');
    ok(dir, 'check', '--strict');
  });

  test('contrast command with literals, tokens, --min and --json', () => {
    const dir = built();
    const lit = ok(dir, 'contrast', '#e5452d', '#f8f2e8');
    assert.match(lit.out, /3\.61:1/);
    assert.match(lit.out, /AA {9}4\.5  FAIL/);
    assert.match(lit.out, /suggest: {3}#[0-9a-f]{6} \(4\.5\d:1/);
    const tok = ok(dir, 'contrast', 'color.on-primary', 'color.primary', '--json');
    const data = JSON.parse(tok.out);
    assert.ok(data.ratio > 4.5);
    fails(dir, 1, null, 'contrast', '#777', '#fff', '--min', 'AA');
    fails(dir, 1, /neither a CSS color nor a token/, 'contrast', 'color.nope', '#fff');
    fails(dir, 1, /is a dimension token/, 'contrast', 'spacing.md', '#fff');
  });
});

// ---------------------------------------------------------------------------
// Themes

describe('themes', () => {
  const darkTheme = { color: { surface: { $value: '{primitive.color.ink}' }, 'on-surface': { $value: '{primitive.color.white}' } } };

  test('theme blocks contain overrides and their dependents; contrast is checked per theme', () => {
    const tokens = baseTokens();
    tokens.component = { card: { $type: 'color', bg: { $value: '{color.surface}' } } };
    const dir = built({ tokens, config: { themes: { dark: 'design/themes/dark.json' } }, files: { 'design/themes/dark.json': darkTheme } });
    const css = read(dir, 'design/tokens.css');
    assert.match(css, /\[data-theme="dark"\] \{\n {2}--color-surface: var\(--primitive-color-ink\);\n {2}--color-on-surface: var\(--primitive-color-white\);\n {2}--component-card-bg: var\(--color-surface\);\n\}/);
    const ts = read(dir, 'design/tokens.ts');
    assert.match(ts, /dark: \{\n {4}'color.surface': '#1f1a16',/);
    assert.match(read(dir, 'design/TOKENS.md'), /`color.surface` #ffffff — Page background\. dark #1f1a16/);
    ok(dir, 'check');
    write(dir, 'design/themes/dark.json', { color: { surface: { $value: '{primitive.color.ink}' } } });
    ok(dir, 'build');
    fails(dir, 1, /contrast color.on-surface on color.surface \[theme dark\]: 1\.00:1/, 'check');
  });

  test('a theme may only override existing tokens', () => {
    const dir = project({ config: { themes: { dark: 'design/themes/dark.json' } }, files: { 'design/themes/dark.json': { color: { brandnew: { $value: '#000000' } } } } });
    fails(dir, 1, /color.brandnew: theme overrides a token that does not exist/, 'check');
  });

  test('custom theme selector', () => {
    const dir = built({ config: { themes: { dark: 'design/themes/dark.json' }, themeSelector: '.theme-{name}' }, files: { 'design/themes/dark.json': darkTheme } });
    assert.match(read(dir, 'design/tokens.css'), /^\.theme-dark \{$/m);
  });
});

// ---------------------------------------------------------------------------
// Tailwind

describe('tailwind', () => {
  test('semantic tokens in Tailwind namespaces go in @theme, primitives and others in :root', () => {
    const tokens = baseTokens();
    tokens.motion = { duration: { $type: 'duration', fast: { $value: '120ms' } } };
    const dir = built({ tokens, config: { css: { tailwind: true } } });
    const css = read(dir, 'design/tokens.css');
    const theme = /@theme \{([\s\S]*?)\n\}/.exec(css)[1];
    const root = /:root \{([\s\S]*?)\n\}/.exec(css)[1];
    assert.match(theme, /--color-\*: initial;/);
    assert.match(theme, /--color-primary: var\(--primitive-color-blue\);/);
    assert.match(theme, /--spacing-md: 16px;/);
    assert.match(theme, /--radius-card: 12px;/);
    assert.match(theme, /--font-body: var\(--primitive-font-sans\);/);
    assert.match(root, /--primitive-color-blue: #1e4ed8;/);
    assert.match(root, /--motion-duration-fast: 120ms;/);
    assert.match(root, /--type-body-font-size: 16px;/);
    assert.doesNotMatch(theme, /primitive-color-blue:/);
    assert.match(css, /@utility type-body \{/);
  });

  test('prefix and tailwind cannot be combined', () => {
    const dir = project({ config: { css: { tailwind: true, prefix: 'ds' } } });
    fails(dir, 1, /"css.prefix" cannot be combined/, 'check');
  });

  test('a prefix applies to every variable', () => {
    const dir = built({ config: { css: { prefix: 'ds' } } });
    assert.match(read(dir, 'design/tokens.css'), /--ds-color-primary: var\(--ds-primitive-color-blue\);/);
  });
});

// ---------------------------------------------------------------------------
// Docs

describe('design docs', () => {
  test('DESIGN.md budget, frontmatter, broken links and unknown token names', () => {
    const long = `${DESIGN_MD}${'line\n'.repeat(150)}`;
    let dir = built({ designMd: long });
    fails(dir, 1, /design\/DESIGN.md: 1\d\d lines, budget is 150/, 'check');

    dir = built({ designMd: DESIGN_MD.replace('read_when: Before any UI work\n', '') });
    fails(dir, 1, /frontmatter: missing "read_when"/, 'check');

    dir = built({ designMd: `${DESIGN_MD}See [missing](components/missing.md).\n` });
    fails(dir, 1, /DESIGN.md:16: broken link: components\/missing.md/, 'check');

    dir = built({ designMd: `${DESIGN_MD}Use \`color.primry\` and \`var(--color-surfce)\`.\n` });
    const r = fails(dir, 1, /unknown token `color.primry` \(did you mean `color.primary`\?\)/, 'check');
    assert.match(r.out, /unknown CSS variable `--color-surfce`/);

    dir = built({ designMd: `${DESIGN_MD}<!-- \`color.nope\` and [x](nope.md)\n still a comment [y](nope2.md) -->\nUse \`type.body\`, \`--type-body-font-size\` and \`color\` group, \`package.json\`.\n` });
    ok(dir, 'check');
  });

  test('new component fills the inventory; new target uses presets; new reference keeps the source', () => {
    const dir = built();
    const r = ok(dir, 'new', 'component', 'Stamp card', '--description', 'Progress card with stamps', '--read-when', 'Building the loyalty progress UI');
    assert.equal(r.out.split('\n')[0], 'design/components/stamp-card.md');
    assert.match(read(dir, 'design/DESIGN.md'), /\| \[Stamp card\]\(components\/stamp-card.md\) \(draft\) \| Building the loyalty progress UI \|/);
    fails(dir, 1, /refusing to overwrite/, 'new', 'component', 'Stamp card');

    const t = ok(dir, 'new', 'target', 'wallet-pass');
    assert.match(t.out, /link it from the Surfaces table/);
    assert.doesNotMatch(t.out, /fill in/);
    assert.match(read(dir, 'design/targets/wallet-pass.md'), /backgroundColor/);
    const warn = ok(dir, 'check');
    assert.match(warn.out, /target design\/targets\/wallet-pass.md is not linked/);

    const g = ok(dir, 'new', 'target', 'Kiosk screen');
    assert.match(g.out, /fill in description and read_when/);

    ok(dir, 'new', 'reference', 'Brand book v1', '--source', 'references/assets/brand.pdf', '--description', 'First brand book', '--read-when', 'Changing color or type');
    assert.match(read(dir, 'design/references/brand-book-v1.md'), /^source: references\/assets\/brand.pdf$/m);
    fails(dir, 2, /usage/, 'new', 'widget', 'x');
  });

  test('component specs: unknown tokens are errors, primitives warn, oversize warns', () => {
    const spec = (body) => `---\ntitle: Card\ndescription: Card\nread_when: Cards\n---\n\n# Card\n\n${body}\n`;
    let dir = built({ files: { 'design/components/card.md': spec('Background `color.surfac`.') } });
    ok(dir, 'build');
    fails(dir, 1, /components\/card.md:9: unknown token `color.surfac`/, 'check');
    dir = built({ files: { 'design/components/card.md': spec(`Background \`primitive.color.white\`.\n${'x\n'.repeat(90)}`) } });
    ok(dir, 'build');
    const r = ok(dir, 'check');
    assert.match(r.out, /warning: design\/components\/card.md:9: primitive token `primitive.color.white`/);
    assert.match(r.out, /warning: design\/components\/card.md: \d+ lines, budget is 80/);
  });
});

// ---------------------------------------------------------------------------
// Scan

describe('scan', () => {
  const files = {
    'src/app.css': [
      '.a { color: #1E4ED8; }',
      '.b { background: rgb(255, 255, 255); }',
      '.c { color: var(--primitive-color-ink); }',
      '.d { color: #123456; } /* design-allow */',
      '.e { padding: 13px; border: 1px solid var(--color-surface); }',
      '.f { color: rgb(var(--x)); } a[href="#main"] {}',
    ].join('\n'),
    'src/app.tsx': "const c = tokens['primitive.color.tomato'];\nconst ok = tokens['color.primary'];\n",
    'node_modules/x/y.css': '.z { color: #ff0000; }',
  };

  test('finds hard-coded colors and primitive use, with token hints', () => {
    const dir = built({ files });
    const r = fails(dir, 1, null, 'scan', 'src');
    assert.match(r.out, /src\/app.css:1: hard-coded color #1E4ED8 \(use color.primary = var\(--color-primary\)\)/);
    assert.match(r.out, /src\/app.css:2: hard-coded color rgb\(255, 255, 255\) \(use color.surface = var\(--color-surface\) or color.on-primary/);
    assert.match(r.out, /src\/app.css:3: primitive token --primitive-color-ink used in code/);
    assert.match(r.out, /src\/app.tsx:1: primitive token 'primitive.color.tomato'/);
    assert.doesNotMatch(r.out, /#123456|13px|#main|node_modules|rgb\(var/);
    assert.match(r.out, /design scan: 4 finding\(s\) in 2 file\(s\)/);
  });

  test('sizes are opt-in; allow list; summary', () => {
    const dir = built({ files, config: { scan: { include: ['src/**/*.{css,tsx}'], sizes: true, allow: ['#1e4ed8'] } } });
    const r = fails(dir, 1, null, 'scan');
    assert.match(r.out, /hard-coded size 13px/);
    assert.doesNotMatch(r.out, /#1E4ED8|1px/);
    const s = ok(dir, 'scan', '--summary');
    assert.match(s.out, /1 {2}#ffffff {4}color/);
  });

  test('check runs the scan when scan.include is set, with configurable severity', () => {
    let dir = built({ files, config: { scan: { include: ['src/**/*.css'] } } });
    fails(dir, 1, /error: src\/app.css:1: hard-coded color/, 'check');
    dir = built({ files, config: { scan: { include: ['src/**/*.css'], severity: 'warn' } } });
    const r = ok(dir, 'check');
    assert.match(r.out, /warning: src\/app.css:1: hard-coded color/);
    assert.match(r.out, /1 source file\(s\) scanned/);
  });

  test('scan without paths or config is a usage error', () => {
    fails(built(), 2, /no paths given/, 'scan');
  });
});

// ---------------------------------------------------------------------------
// show, find, fmt, CLI

describe('show and find', () => {
  test('show a token, a group, a component; unknown names exit 1 with a suggestion', () => {
    const dir = built({ files: { 'design/components/button.md': '---\ntitle: Button\ndescription: Buttons\nread_when: Actions\n---\n\n# Button\n' } });
    const t = ok(dir, 'show', 'color.primary');
    assert.match(t.out, /^color.primary {2}\(semantic color\)$/m);
    assert.match(t.out, /value: {4}#1e4ed8 {3}rgb\(30, 78, 216\)/);
    assert.match(t.out, /alias: {4}color.primary -> primitive.color.blue/);
    assert.match(t.out, /contrast: color.on-primary on color.primary \d+\.\d\d:1 pass AA/);
    const p = ok(dir, 'show', 'primitive.color.white');
    assert.match(p.out, /used by: {2}color.surface, color.on-primary/);
    const j = JSON.parse(ok(dir, 'show', 'type.body', '--json').out);
    assert.equal(j.value.fontSize, '16px');
    assert.match(ok(dir, 'show', 'color').out, /^color.surface {2}#ffffff — Page background$/m);
    assert.match(ok(dir, 'show', 'button').out, /^# Button$/m);
    fails(dir, 1, /nothing named "color.primay" \(did you mean color.primary\?\)/, 'show', 'color.primay');
  });

  test('find ranks tokens and docs; a hex finds tokens with that value', () => {
    const dir = built();
    const r = ok(dir, 'find', 'primary');
    assert.match(r.out.split('\n')[0], /^token {5}color.primary/);
    const hex = ok(dir, 'find', '#1E4ED8');
    assert.match(hex.out, /color.primary/);
    assert.match(hex.out, /primitive.color.blue/);
    fails(dir, 1, null, 'find', 'zebra');
    const json = JSON.parse(ok(dir, 'find', 'body', '--json').out);
    assert.ok(json.some((h) => h.path === 'type.body'));
  });
});

describe('fmt', () => {
  test('rewrites shorthand into 2025.10 objects; --check; check warns before, strict fails', () => {
    const dir = built();
    const before = ok(dir, 'check');
    assert.match(before.out, /token\(s\) use shorthand values .*run "design fmt"/);
    fails(dir, 1, /shorthand values/, 'check', '--strict');
    fails(dir, 1, /would change: design\/tokens.json/, 'fmt', '--check');
    ok(dir, 'fmt');
    ok(dir, 'fmt', '--check');
    const tokens = JSON.parse(read(dir, 'design/tokens.json'));
    assert.deepEqual(tokens.primitive.color.blue.$value, { colorSpace: 'srgb', components: [0.1176, 0.3059, 0.8471], hex: '#1e4ed8' });
    assert.deepEqual(tokens.spacing.md.$value, { value: 16, unit: 'px' });
    assert.deepEqual(tokens.type.body.$value.fontSize, { value: 16, unit: 'px' });
    assert.equal(tokens.color.primary.$value, '{primitive.color.blue}');
    ok(dir, 'build', '--check'); // same values, same outputs
    const after = ok(dir, 'check', '--strict');
    assert.doesNotMatch(after.out, /shorthand/);
  });
});

describe('cli', () => {
  test('usage, version, unknown command and option', () => {
    const dir = built();
    assert.match(ok(dir, '--version').out, /^design \d+\.\d+\.\d+$/);
    assert.match(ok(dir, 'help', 'check').out, /design check \[--strict\] \[--json\]/);
    assert.match(ok(dir, 'check', '--help').out, /--strict/);
    fails(dir, 2, /unknown command "nope"/, 'nope');
    fails(dir, 2, /unknown option --bogus/, 'check', '--bogus');
    fails(dir, 2, null);
  });

  test('project root is found from a subdirectory; config errors are reported', () => {
    const dir = built();
    fs.mkdirSync(path.join(dir, 'src/deep'), { recursive: true });
    ok(path.join(dir, 'src/deep'), 'build', '--check');
    fs.writeFileSync(path.join(dir, 'design.json'), '{ nope');
    fails(dir, 1, /design.json: invalid JSON/, 'check');
  });

  test('check --json', () => {
    const dir = built();
    const data = JSON.parse(ok(dir, 'check', '--json').out);
    assert.equal(data.ok, true);
    assert.equal(data.stats.tokens, 13);
    assert.ok(data.problems.some((p) => /shorthand/.test(p.message)));
  });

  test('missing token file and DESIGN.md are errors', () => {
    const dir = project({ tokens: null, designMd: null });
    const r = fails(dir, 1, /design\/tokens.json: token file not found/, 'check');
    assert.match(r.out, /design\/DESIGN.md: missing entry point/);
  });
});
