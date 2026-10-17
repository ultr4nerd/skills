#!/usr/bin/env node
// design: a project's design system as files. W3C DTCG tokens are the single source of truth;
// the CLI generates CSS / TS / a token cheat sheet and checks references, contrast, drift and
// hard-coded values. Zero dependencies. Node >= 20. See ../SKILL.md and ../README.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const VERSION = '0.1.0';
const CONFIG_FILE = 'design.json';
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = 'io.github.ultr4nerd.design'; // our $extensions key (reverse domain, per the spec)
const PRIMITIVE = 'primitive';
const COMPONENT = 'component';
const REQUIRED_KEYS = ['title', 'description', 'read_when'];
const DOC_DIRS = { components: 'component', targets: 'target', references: 'reference' };
const NEW_KINDS = ['component', 'target', 'reference'];
const MARK_START = '<!-- design:components:start -->';
const MARK_END = '<!-- design:components:end -->';

const TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number',
  'strokeStyle', 'border', 'transition', 'shadow', 'gradient', 'typography'];
const TOKEN_PROPS = new Set(['$value', '$type', '$description', '$extensions', '$deprecated']);
const GROUP_PROPS = new Set(['$type', '$description', '$extensions', '$deprecated', '$extends', '$root', '$schema']);
const FONT_WEIGHTS = {
  thin: 100, hairline: 100, 'extra-light': 200, 'ultra-light': 200, light: 300, normal: 400, regular: 400,
  book: 400, medium: 500, 'semi-bold': 600, 'demi-bold': 600, bold: 700, 'extra-bold': 800, 'ultra-bold': 800,
  black: 900, heavy: 900, 'extra-black': 950, 'ultra-black': 950,
};
const STROKE_STYLES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset'];
const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong']);
// WCAG 2.2 thresholds. "large" = 24px regular or 18.66px bold; "ui" = non-text contrast (1.4.11).
const LEVELS = { AA: 4.5, 'AA-large': 3, AAA: 7, 'AAA-large': 4.5, ui: 3 };
const TAILWIND_NAMESPACES = ['color', 'font', 'text', 'font-weight', 'tracking', 'leading', 'tab-size',
  'breakpoint', 'container', 'spacing', 'radius', 'shadow', 'inset-shadow', 'drop-shadow', 'blur',
  'perspective', 'zoom', 'aspect', 'ease', 'animate'];
const SCAN_DIR_EXTENSIONS = new Set(['.css', '.scss', '.sass', '.less', '.js', '.jsx', '.mjs', '.cjs', '.ts',
  '.tsx', '.vue', '.svelte', '.astro', '.html', '.mdx']);
const ALWAYS_SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage']); // dot-dirs (.git, .next) are skipped too

const DEFAULT_CONFIG = {
  dir: 'design',
  tokens: 'design/tokens.json',
  themes: {},
  themeSelector: '[data-theme="{name}"]',
  outputs: { css: 'design/tokens.css', ts: 'design/tokens.ts', json: null, md: 'design/TOKENS.md' },
  css: { prefix: '', tailwind: false, tailwindReset: ['color'] },
  budgets: { design: 150, component: 80, tokens: 300 },
  scan: { include: [], exclude: [], allow: [], sizes: false, severity: 'error' },
};

// Errors meant for the user: printed as one line, never as a stack trace.
class UserError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// Small utilities

const toPosix = (p) => p.split(path.sep).join('/');
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // code-unit order, locale independent

function relToRoot(ctx, abs) {
  return toPosix(path.relative(ctx.root, abs));
}

function normalizeText(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function words(text) {
  return normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function slugify(text) {
  return normalizeText(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Short, stable number formatting: 0.5, 16, 1.25 (no float noise).
function fmtNum(n) {
  return String(Number(Number(n).toFixed(4)));
}

function kebab(segment) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

// "src/**/*.{ts,tsx}" -> ["src/**/*.ts", "src/**/*.tsx"]
function expandBraces(glob) {
  const m = /\{([^{}]*)\}/.exec(glob);
  if (!m) return [glob];
  return m[1].split(',').flatMap((alt) => expandBraces(glob.slice(0, m.index) + alt + glob.slice(m.index + m[0].length)));
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        re += '(?:.*/)?';
      } else {
        re += '.*';
      }
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

function globMatchers(globs) {
  return asArray(globs).flatMap(expandBraces).map(globToRegExp);
}

function readLines(abs) {
  return fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').split('\n');
}

// ---------------------------------------------------------------------------
// Project root and config

function findUp(startDir, marker) {
  let dir = startDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, marker))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function findProjectRoot(cwd) {
  return findUp(cwd, CONFIG_FILE) || findUp(cwd, '.git') || cwd;
}

function loadConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  const config = structuredClone(DEFAULT_CONFIG);
  if (!fs.existsSync(file)) return config;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new UserError(`${CONFIG_FILE}: invalid JSON (${err.message})`);
  }
  if (!isObject(raw)) throw new UserError(`${CONFIG_FILE}: must be a JSON object`);
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (raw[key] === undefined) continue;
    if (isObject(DEFAULT_CONFIG[key]) && key !== 'themes') {
      if (!isObject(raw[key])) throw new UserError(`${CONFIG_FILE}: "${key}" must be an object`);
      Object.assign(config[key], raw[key]);
    } else {
      config[key] = raw[key];
    }
  }
  if (typeof config.dir !== 'string' || !config.dir) throw new UserError(`${CONFIG_FILE}: "dir" must be a non-empty string`);
  if (!asArray(config.tokens).length || !asArray(config.tokens).every((t) => typeof t === 'string')) {
    throw new UserError(`${CONFIG_FILE}: "tokens" must be a path or a list of paths`);
  }
  if (!isObject(config.themes) || !Object.values(config.themes).every((t) => typeof t === 'string')) {
    throw new UserError(`${CONFIG_FILE}: "themes" must map a theme name to a token file path`);
  }
  for (const key of ['include', 'exclude', 'allow']) {
    if (!Array.isArray(config.scan[key])) throw new UserError(`${CONFIG_FILE}: "scan.${key}" must be an array`);
  }
  if (!['error', 'warn'].includes(config.scan.severity)) throw new UserError(`${CONFIG_FILE}: "scan.severity" must be "error" or "warn"`);
  if (config.css.tailwind && config.css.prefix) throw new UserError(`${CONFIG_FILE}: "css.prefix" cannot be combined with "css.tailwind" (Tailwind namespaces need unprefixed names)`);
  if (config.css.prefix && !/^[a-z][a-z0-9-]*$/.test(config.css.prefix)) throw new UserError(`${CONFIG_FILE}: "css.prefix" must be lowercase letters, digits and hyphens`);
  for (const [k, v] of Object.entries(config.budgets)) {
    if (!Number.isInteger(v) || v < 1) throw new UserError(`${CONFIG_FILE}: "budgets.${k}" must be a positive integer`);
  }
  return config;
}

function createContext(cwd) {
  const root = findProjectRoot(cwd);
  const config = loadConfig(root);
  return { cwd, root, config, dirAbs: path.resolve(root, config.dir), dirRel: toPosix(config.dir).replace(/\/+$/, '') };
}

function resolveUserPath(ctx, p) {
  const fromCwd = path.resolve(ctx.cwd, p);
  if (fs.existsSync(fromCwd)) return fromCwd;
  return path.resolve(ctx.root, p);
}

// ---------------------------------------------------------------------------
// Frontmatter (the same YAML subset as docmap: scalars, quoted strings, inline and block lists)

const PENDING = Symbol('pending');

function parseScalar(raw) {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return s.slice(1, -1).replace(/\\(["\\])/g, '$1');
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('[') && s.endsWith(']')) {
    return s.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean).map(parseScalar);
  }
  return s.replace(/\s+#.*$/, '').trim();
}

function parseFrontmatter(lines) {
  const result = { present: false, data: {}, errors: [], bodyStart: 0 };
  if ((lines[0] || '').trim() !== '---') return result;
  result.present = true;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) {
    result.errors.push({ line: 1, message: 'frontmatter is not closed (no second "---")' });
    result.bodyStart = lines.length;
    return result;
  }
  result.bodyStart = end + 1;
  const data = result.data;
  let listKey = null;
  const settle = () => {
    if (listKey && data[listKey] === PENDING) data[listKey] = '';
    listKey = null;
  };
  for (let i = 1; i < end; i++) {
    const text = lines[i].trim();
    if (!text || text.startsWith('#')) continue;
    if (text === '-' || text.startsWith('- ')) {
      if (!listKey) {
        result.errors.push({ line: i + 1, message: 'list item without a key' });
        continue;
      }
      if (data[listKey] === PENDING) data[listKey] = [];
      data[listKey].push(parseScalar(text.slice(1)));
      continue;
    }
    const m = /^([A-Za-z_][\w.-]*):(?:\s+(.*))?$/.exec(text);
    settle();
    if (!m) {
      result.errors.push({ line: i + 1, message: `expected "key: value", got "${text}"` });
      continue;
    }
    const [, key, value] = m;
    if (Object.hasOwn(data, key)) {
      result.errors.push({ line: i + 1, message: `duplicate key "${key}"` });
    } else if (value === undefined || value === '') {
      data[key] = PENDING;
      listKey = key;
    } else {
      data[key] = parseScalar(value);
    }
  }
  settle();
  return result;
}

function parseHeadings(lines, bodyStart) {
  const headings = [];
  let inFence = false;
  for (let i = bodyStart; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    const m = !inFence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (m) headings.push({ level: m[1].length, text: m[2], line: i + 1 });
  }
  return headings;
}

// ---------------------------------------------------------------------------
// Color: parse DTCG color objects and CSS strings into gamma-encoded sRGB {r, g, b, a} in 0..1.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toLinear = (c) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (Math.abs(c) <= 0.0031308 ? 12.92 * c : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055));
const mul3 = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

const P3_TO_SRGB_LINEAR = [[1.2249401, -0.2249404, 0], [-0.0420569, 1.0420571, 0], [-0.0196376, -0.0786361, 1.0982735]];
const XYZ65_TO_SRGB_LINEAR = [[3.2409699419, -1.5373831776, -0.4986107603], [-0.9692436363, 1.8759675015, 0.0415550574], [0.0556300797, -0.2039769589, 1.0569715142]];

function oklabToLinearSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function linearSrgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hslToRgb(h, s, l) {
  const sat = s / 100;
  const light = l / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return light - sat * Math.min(light, 1 - light) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function hwbToRgb(h, w, b) {
  const white = w / 100;
  const black = b / 100;
  if (white + black >= 1) return [white / (white + black), white / (white + black), white / (white + black)];
  return hslToRgb(h, 100, 50).map((c) => c * (1 - white - black) + white);
}

function oklchToRgb([L, C, H]) {
  const rad = (H * Math.PI) / 180;
  return oklabToLinearSrgb([L, C * Math.cos(rad), C * Math.sin(rad)]).map(fromLinear);
}

function rgbToOklch({ r, g, b }) {
  const [L, a, bb] = linearSrgbToOklab([r, g, b].map(toLinear));
  const C = Math.hypot(a, bb);
  const H = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

function parseHex(s) {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(s).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
}

function toHex(c, { alpha = true } = {}) {
  const h = (x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, '0');
  const a = alpha && c.a < 1 ? h(c.a) : '';
  return `#${h(c.r)}${h(c.g)}${h(c.b)}${a}`;
}

function toRgbString(c) {
  const ch = (x) => Math.round(clamp01(x) * 255);
  return c.a < 1 ? `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${fmtNum(c.a)})` : `rgb(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)})`;
}

// CSS color strings used on the command line and in source scans: hex, rgb(), hsl().
function parseCssColor(input) {
  const s = String(input).trim().toLowerCase();
  const hex = parseHex(s);
  if (hex) return hex;
  const m = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(s);
  if (!m) return null;
  const parts = m[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (p, scale) => (p.endsWith('%') ? (parseFloat(p) / 100) * scale : parseFloat(p));
  const alpha = parts[3] !== undefined ? num(parts[3], 1) : 1;
  let rgb;
  if (m[1].startsWith('rgb')) rgb = parts.slice(0, 3).map((p) => num(p, 255) / 255);
  else rgb = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
  if ([...rgb, alpha].some((x) => Number.isNaN(x))) return null;
  return { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha };
}

// DTCG 2025.10 color object -> {r,g,b,a}. Returns { color } or { error }.
function colorFromObject(v) {
  const { colorSpace, components, alpha = 1, hex } = v;
  if (typeof colorSpace !== 'string') return { error: 'color object needs "colorSpace"' };
  if (!Array.isArray(components) || components.length !== 3) return { error: 'color "components" must be an array of 3 numbers' };
  if (!components.every((c) => c === 'none' || typeof c === 'number')) return { error: 'color components must be numbers or "none"' };
  if (typeof alpha !== 'number' || alpha < 0 || alpha > 1) return { error: 'color "alpha" must be a number from 0 to 1' };
  if (hex !== undefined && !/^#[0-9a-fA-F]{6}$/.test(hex)) return { error: 'color "hex" must be 6-digit CSS hex (#rrggbb)' };
  const c = components.map((x) => (x === 'none' ? 0 : x));
  let rgb;
  switch (colorSpace) {
    case 'srgb': rgb = c; break;
    case 'srgb-linear': rgb = c.map(fromLinear); break;
    case 'hsl': rgb = hslToRgb(c[0], c[1], c[2]); break;
    case 'hwb': rgb = hwbToRgb(c[0], c[1], c[2]); break;
    case 'oklab': rgb = oklabToLinearSrgb(c).map(fromLinear); break;
    case 'oklch': rgb = oklchToRgb(c); break;
    case 'display-p3': rgb = mul3(P3_TO_SRGB_LINEAR, c.map(toLinear)).map(fromLinear); break;
    case 'xyz-d65': rgb = mul3(XYZ65_TO_SRGB_LINEAR, c).map(fromLinear); break;
    default:
      if (!['lab', 'lch', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d50'].includes(colorSpace)) {
        return { error: `unknown colorSpace "${colorSpace}"` };
      }
      if (!hex) return { error: `colorSpace "${colorSpace}" needs a "hex" fallback for this tool` };
      return { color: { ...parseHex(hex), a: alpha } };
  }
  const color = { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha };
  if (hex && colorSpace === 'srgb') {
    if (toHex(color, { alpha: false }) !== hex.toLowerCase()) {
      return { color, warning: `"hex" ${hex} does not match components (${toHex(color, { alpha: false })})` };
    }
    // Components are a rounded rendering of the same 8-bit color: use the exact value, so a color
    // that passes contrast as "#b85600" still passes after `design fmt`.
    return { color: { ...parseHex(hex), a: alpha } };
  }
  return { color };
}

function hexToObject(hexString) {
  const c = parseHex(hexString);
  const obj = { colorSpace: 'srgb', components: [c.r, c.g, c.b].map((x) => Number(x.toFixed(4))) };
  if (c.a < 1) obj.alpha = Number(c.a.toFixed(4));
  obj.hex = toHex(c, { alpha: false });
  return obj;
}

function blend(top, bottom) {
  const a = top.a;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

function luminance(c) {
  const [r, g, b] = [c.r, c.g, c.b].map((x) => toLinear(clamp01(x)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function contrastRatio(fg, bg) {
  const base = bg.a < 1 ? blend(bg, WHITE) : bg;
  const top = fg.a < 1 ? blend(fg, base) : fg;
  const l1 = luminance(top);
  const l2 = luminance(base);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// Smallest OKLCH lightness change (hue and chroma kept) that makes fg reach `target` on bg.
// Aims 0.02 above the threshold so the suggestion survives rounding in other tools.
function suggestForeground(fg, bg, minimum) {
  if (contrastRatio(fg, bg) >= minimum) return null;
  const target = minimum + 0.02;
  const [L, C, H] = rgbToOklch(fg);
  const at = (l) => {
    const [r, g, b] = oklchToRgb([l, C, H]);
    return parseHex(toHex({ r, g, b, a: 1 }));
  };
  const options = [];
  for (const end of [0, 1]) {
    if (contrastRatio(at(end), bg) < target) continue;
    let lo = L;
    let hi = end;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(at(mid), bg) >= target) hi = mid;
      else lo = mid;
    }
    let color = at(hi);
    for (let i = 0; i < 50 && contrastRatio(color, bg) < target; i++) {
      hi += end === 0 ? -0.002 : 0.002;
      color = at(clamp01(hi));
    }
    if (contrastRatio(color, bg) >= target) options.push({ color: { ...color, a: fg.a }, delta: Math.abs(hi - L) });
  }
  if (!options.length) return null;
  options.sort((a, b) => a.delta - b.delta);
  return options[0].color;
}

function levelThreshold(level) {
  if (typeof level === 'number') return level;
  return LEVELS[level];
}

// ---------------------------------------------------------------------------
// Tokens: load, merge, expand $extends, collect, infer types, resolve aliases

const ALIAS_RE = /^\{([^{}]+)\}$/;
const aliasOf = (raw) => (typeof raw === 'string' && ALIAS_RE.test(raw) ? ALIAS_RE.exec(raw)[1] : null);
const isRef = (raw) => isObject(raw) && typeof raw.$ref === 'string' && Object.keys(raw).length === 1;
const isToken = (node) => isObject(node) && Object.hasOwn(node, '$value');
const extOf = (node) => (isObject(node?.$extensions) && isObject(node.$extensions[EXT]) ? node.$extensions[EXT] : {});

function readJsonFile(ctx, rel, problems) {
  const abs = path.resolve(ctx.root, rel);
  if (!fs.existsSync(abs)) {
    problems.push({ level: 'error', file: rel, message: 'token file not found (run "design init" or fix design.json "tokens")' });
    return null;
  }
  try {
    const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
    if (!isObject(doc)) throw new Error('top level must be an object');
    return doc;
  } catch (err) {
    problems.push({ level: 'error', file: rel, message: `invalid JSON (${err.message})` });
    return null;
  }
}

function tokenPathsOf(node, segs = [], out = []) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') && key !== '$root') continue;
    if (isToken(child)) out.push([...segs, key].join('.'));
    else if (isObject(child)) tokenPathsOf(child, [...segs, key], out);
  }
  return out;
}

function mergeDocs(target, source, file, segs, problems) {
  for (const [key, child] of Object.entries(source)) {
    if (!Object.hasOwn(target, key)) {
      target[key] = child;
    } else if (isObject(target[key]) && isObject(child) && !isToken(target[key]) && !isToken(child)) {
      mergeDocs(target[key], child, file, [...segs, key], problems);
    } else if (!key.startsWith('$') || key === '$root') {
      problems.push({ level: 'error', file, message: `${[...segs, key].join('.')}: defined in more than one token file` });
    }
  }
}

function getGroup(doc, dotted) {
  let node = doc;
  for (const seg of dotted.split('.')) {
    if (!isObject(node) || !Object.hasOwn(node, seg)) return null;
    node = node[seg];
  }
  return node;
}

// $extends (2025.10): a group inherits the tokens of another group; local entries win.
function expandExtends(doc, file, problems) {
  const done = new Set();
  const visit = (node, segs, stack) => {
    if (!isObject(node) || isToken(node) || done.has(node)) return;
    if (typeof node.$extends === 'string') {
      const target = aliasOf(node.$extends);
      const base = target ? getGroup(doc, target) : null;
      const here = segs.join('.');
      if (!base || isToken(base)) {
        problems.push({ level: 'error', file, message: `${here}: $extends ${node.$extends} does not point to a group` });
      } else if (stack.includes(target)) {
        problems.push({ level: 'error', file, message: `${here}: circular $extends (${[...stack, target].join(' -> ')})` });
      } else {
        visit(base, target.split('.'), [...stack, here]);
        inherit(node, base);
      }
      delete node.$extends;
    }
    done.add(node);
    for (const [key, child] of Object.entries(node)) {
      if (!key.startsWith('$')) visit(child, [...segs, key], [...stack, segs.join('.')]);
    }
  };
  const inherit = (node, base) => {
    for (const [key, child] of Object.entries(base)) {
      if (key === '$extends') continue;
      if (!Object.hasOwn(node, key)) node[key] = structuredClone(child);
      else if (isObject(node[key]) && isObject(child) && !isToken(node[key]) && !isToken(child) && !key.startsWith('$')) inherit(node[key], child);
    }
  };
  visit(doc, [], []);
}

function validName(name) {
  return name.length > 0 && !name.startsWith('$') && !/[{}.]/.test(name);
}

// Walk a (merged) document into token records.
function collectTokens(doc, fileOf, defaultFile, problems) {
  const records = [];
  const walk = (node, segs, inherited) => {
    for (const [key, child] of Object.entries(node)) {
      const here = [...segs, key].join('.');
      if (key.startsWith('$')) {
        if (key === '$root') {
          if (isToken(child)) addToken(child, [...segs, key], inherited);
          else problems.push({ level: 'error', file: fileOf.get(here) || defaultFile, message: `${here}: $root must be a token (object with $value)` });
        } else if (!GROUP_PROPS.has(key)) {
          problems.push({ level: 'warn', file: defaultFile, message: `${segs.join('.') || '(root)'}: unknown property "${key}"` });
        }
        continue;
      }
      const file = fileOf.get(here) || defaultFile;
      if (!validName(key)) {
        problems.push({ level: 'error', file, message: `${here}: invalid name (must not start with "$" or contain "{", "}" or ".")` });
        continue;
      }
      if (!isObject(child)) {
        problems.push({ level: 'error', file, message: `${here}: expected a token (object with $value) or a group` });
        continue;
      }
      if (isToken(child)) {
        addToken(child, [...segs, key], inherited);
      } else {
        const ext = extOf(child);
        walk(child, [...segs, key], {
          type: typeof child.$type === 'string' ? child.$type : inherited.type,
          status: typeof ext.status === 'string' ? ext.status : inherited.status,
          deprecated: child.$deprecated !== undefined ? child.$deprecated : inherited.deprecated,
        });
      }
    }
  };
  const addToken = (node, segs, inherited) => {
    const tokenPath = segs.join('.');
    const file = fileOf.get(tokenPath) || defaultFile;
    for (const key of Object.keys(node)) {
      if (key.startsWith('$') && !TOKEN_PROPS.has(key)) problems.push({ level: 'warn', file, message: `${tokenPath}: unknown property "${key}"` });
    }
    const ext = extOf(node);
    const explicitType = typeof node.$type === 'string' ? node.$type : null;
    records.push({
      path: tokenPath,
      segs,
      node,
      file,
      raw: node.$value,
      type: explicitType || inherited.type || null,
      description: typeof node.$description === 'string' ? node.$description : '',
      deprecated: node.$deprecated !== undefined ? node.$deprecated : inherited.deprecated || false,
      ext,
      status: typeof ext.status === 'string' ? ext.status : inherited.status || 'stable',
      tier: segs[0] === PRIMITIVE ? 'primitive' : segs[0] === COMPONENT ? 'component' : 'semantic',
    });
  };
  const rootExt = extOf(doc);
  walk(doc, [], { type: typeof doc.$type === 'string' ? doc.$type : null, status: rootExt.status, deprecated: false });
  return records;
}

function resolvePointer(doc, pointer) {
  if (!pointer.startsWith('#/')) return { error: `$ref "${pointer}" must be a local JSON pointer (#/...)` };
  let node = doc;
  for (const raw of pointer.slice(2).split('/')) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object' || !Object.hasOwn(node, seg)) return { error: `$ref "${pointer}" does not resolve` };
    node = node[seg];
  }
  return { value: node };
}

// A resolvable set of token records (the base system, or the base with a theme applied).
function createTokenSet(records, doc, problems) {
  const byPath = new Map(records.map((r) => [r.path, r]));
  const cache = new Map();
  const FAILED = Symbol('failed');
  const set = { records, byPath, doc, shorthand: [], nonstandard: [] };

  const fail = (rec, message) => {
    problems.push({ level: 'error', file: rec.file, message: `${rec.path}: ${message}` });
    return FAILED;
  };

  const groupExists = (target) => records.some((r) => r.path.startsWith(`${target}.`));

  set.typeOf = (rec, seen = []) => {
    if (rec.type) return rec.type;
    const target = aliasOf(rec.raw);
    if (!target) return null;
    const next = byPath.get(target);
    if (!next || seen.includes(target)) return null;
    return set.typeOf(next, [...seen, rec.path]);
  };

  // Resolve a raw value of a known type. Returns the parsed value or FAILED.
  const resolveRaw = (rec, raw, type, stack, where) => {
    const target = aliasOf(raw);
    if (target) {
      const ref = byPath.get(target);
      if (!ref) {
        const hint = groupExists(target) ? ' (that is a group; reference a token, e.g. {' + target + '.$root})' : '';
        return fail(rec, `${where}references unknown token {${target}}${hint}`);
      }
      const refType = set.typeOf(ref);
      if (refType && type && refType !== type) return fail(rec, `${where}{${target}} is a ${refType}, expected ${type}`);
      if (stack.includes(target)) return fail(rec, `circular reference: ${[...stack, target].join(' -> ')}`);
      const value = resolveToken(ref, [...stack]);
      return value === FAILED ? FAILED : value;
    }
    if (isRef(raw)) {
      const r = resolvePointer(doc, raw.$ref);
      if (r.error) return fail(rec, `${where}${r.error}`);
      if (stack.includes(raw.$ref)) return fail(rec, `circular $ref: ${[...stack, raw.$ref].join(' -> ')}`);
      return resolveRaw(rec, r.value, type, [...stack, raw.$ref], where);
    }
    const deref = derefDeep(raw, stack);
    if (deref.error) return fail(rec, `${where}${deref.error}`);
    const parsed = parseLiteral(rec, deref.value, type, stack, where);
    if (parsed && parsed.error) return fail(rec, parsed.error);
    return parsed;
  };

  // Replace nested {"$ref": "#/..."} objects (e.g. a dimension's "value") with what they point to.
  const derefDeep = (raw, stack) => {
    if (isRef(raw)) {
      if (stack.includes(raw.$ref)) return { error: `circular $ref: ${[...stack, raw.$ref].join(' -> ')}` };
      const r = resolvePointer(doc, raw.$ref);
      return r.error ? r : derefDeep(r.value, [...stack, raw.$ref]);
    }
    if (Array.isArray(raw)) {
      const out = [];
      for (const x of raw) {
        const r = derefDeep(x, stack);
        if (r.error) return r;
        out.push(r.value);
      }
      return { value: out };
    }
    if (isObject(raw)) {
      const out = {};
      for (const [k, x] of Object.entries(raw)) {
        const r = derefDeep(x, stack);
        if (r.error) return r;
        out[k] = r.value;
      }
      return { value: out };
    }
    return { value: raw };
  };

  const sub = (rec, obj, key, type, stack, where, optional) => {
    if (obj[key] === undefined) {
      if (optional) return undefined;
      return { error: `${where}missing "${key}"` };
    }
    const v = resolveRaw(rec, obj[key], type, stack, `${where}${key}: `);
    return v === FAILED ? { failed: true } : v;
  };

  const parseLiteral = (rec, raw, type, stack, where) => {
    const err = (m) => ({ error: `${where}${m}` });
    switch (type) {
      case 'color': {
        if (typeof raw === 'string') {
          const c = parseHex(raw);
          if (!c) return err(`invalid color "${raw}" (use a DTCG color object or #rrggbb)`);
          set.shorthand.push(rec.path);
          return c;
        }
        if (!isObject(raw)) return err('color must be an object {colorSpace, components, alpha?, hex?}');
        const r = colorFromObject(raw);
        if (r.error) return err(r.error);
        if (r.warning) problems.push({ level: 'warn', file: rec.file, message: `${rec.path}: ${where}${r.warning}` });
        return r.color;
      }
      case 'dimension': {
        let value;
        let unit;
        if (typeof raw === 'string' || raw === 0) {
          const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(String(raw).trim());
          if (!m || (!m[2] && Number(m[1]) !== 0)) return err(`invalid dimension "${raw}" (use {"value": 16, "unit": "px"})`);
          value = Number(m[1]);
          unit = m[2] || 'px';
          set.shorthand.push(rec.path);
        } else if (isObject(raw) && typeof raw.value === 'number' && typeof raw.unit === 'string') {
          ({ value, unit } = raw);
        } else {
          return err('dimension must be {"value": number, "unit": "px" | "rem"}');
        }
        if (unit === 'em') set.nonstandard.push(`${rec.path} (em)`);
        else if (unit !== 'px' && unit !== 'rem') return err(`unit "${unit}" is not allowed (DTCG 2025.10 dimensions use px or rem)`);
        return { value, unit };
      }
      case 'duration': {
        if (typeof raw === 'string') {
          const m = /^(\d*\.?\d+)(ms|s)$/.exec(raw.trim());
          if (!m) return err(`invalid duration "${raw}" (use {"value": 200, "unit": "ms"})`);
          set.shorthand.push(rec.path);
          return { value: Number(m[1]), unit: m[2] };
        }
        if (isObject(raw) && typeof raw.value === 'number' && (raw.unit === 'ms' || raw.unit === 's')) return { value: raw.value, unit: raw.unit };
        return err('duration must be {"value": number, "unit": "ms" | "s"}');
      }
      case 'fontFamily': {
        const list = asArray(raw);
        if (!list.length || !list.every((f) => typeof f === 'string' && f.trim())) return err('fontFamily must be a string or a list of strings');
        return list.map((f) => f.trim());
      }
      case 'fontWeight': {
        if (typeof raw === 'number' && raw >= 1 && raw <= 1000) return raw;
        if (typeof raw === 'string' && FONT_WEIGHTS[raw]) return FONT_WEIGHTS[raw];
        return err(`invalid fontWeight ${JSON.stringify(raw)} (number 1-1000 or a keyword such as "bold")`);
      }
      case 'cubicBezier': {
        if (Array.isArray(raw) && raw.length === 4 && raw.every((n) => typeof n === 'number') && raw[0] >= 0 && raw[0] <= 1 && raw[2] >= 0 && raw[2] <= 1) return raw;
        return err('cubicBezier must be [x1, y1, x2, y2] with x1 and x2 in 0..1');
      }
      case 'number':
        return typeof raw === 'number' ? raw : err('number token needs a JSON number');
      case 'strokeStyle':
        if (STROKE_STYLES.includes(raw)) return raw;
        if (isObject(raw) && Array.isArray(raw.dashArray)) return 'dashed';
        return err(`invalid strokeStyle ${JSON.stringify(raw)}`);
      case 'border': {
        if (!isObject(raw)) return err('border must be an object {color, width, style}');
        const out = { color: sub(rec, raw, 'color', 'color', stack, where), width: sub(rec, raw, 'width', 'dimension', stack, where), style: sub(rec, raw, 'style', 'strokeStyle', stack, where) };
        return composite(out);
      }
      case 'transition': {
        if (!isObject(raw)) return err('transition must be an object {duration, delay, timingFunction}');
        const out = {
          duration: sub(rec, raw, 'duration', 'duration', stack, where),
          delay: sub(rec, raw, 'delay', 'duration', stack, where, true) ?? { value: 0, unit: 'ms' },
          timingFunction: sub(rec, raw, 'timingFunction', 'cubicBezier', stack, where),
        };
        return composite(out);
      }
      case 'shadow': {
        const items = Array.isArray(raw) ? raw : [raw];
        const out = [];
        for (const [i, item] of items.entries()) {
          const w = Array.isArray(raw) ? `${where}[${i}] ` : where;
          if (aliasOf(item) || isRef(item)) {
            const v = resolveRaw(rec, item, 'shadow', stack, w);
            if (v === FAILED) return { error: null, failed: true };
            out.push(...v);
            continue;
          }
          if (!isObject(item)) return err('shadow must be an object {color, offsetX, offsetY, blur, spread} or a list of them');
          const s = composite({
            color: sub(rec, item, 'color', 'color', stack, w),
            offsetX: sub(rec, item, 'offsetX', 'dimension', stack, w),
            offsetY: sub(rec, item, 'offsetY', 'dimension', stack, w),
            blur: sub(rec, item, 'blur', 'dimension', stack, w),
            spread: sub(rec, item, 'spread', 'dimension', stack, w, true) ?? { value: 0, unit: 'px' },
            inset: item.inset === true,
          });
          if (s.error !== undefined || s.failed) return s;
          out.push(s);
        }
        return out;
      }
      case 'gradient': {
        if (!Array.isArray(raw)) return err('gradient must be a list of stops {color, position}');
        const out = [];
        for (const [i, stop] of raw.entries()) {
          const w = `${where}[${i}] `;
          if (aliasOf(stop) || isRef(stop)) {
            const v = resolveRaw(rec, stop, 'gradient', stack, w);
            if (v === FAILED) return { failed: true };
            out.push(...v);
            continue;
          }
          if (!isObject(stop)) return err('gradient stop must be {color, position}');
          const s = composite({ color: sub(rec, stop, 'color', 'color', stack, w), position: sub(rec, stop, 'position', 'number', stack, w) });
          if (s.error !== undefined || s.failed) return s;
          out.push(s);
        }
        return out;
      }
      case 'typography': {
        if (!isObject(raw)) return err('typography must be an object {fontFamily, fontSize, fontWeight, lineHeight, letterSpacing}');
        const lineHeight = raw.lineHeight === undefined ? undefined
          : typeof raw.lineHeight === 'number' || aliasOf(raw.lineHeight) || isRef(raw.lineHeight)
            ? sub(rec, raw, 'lineHeight', 'number', stack, where)
            : sub(rec, raw, 'lineHeight', 'dimension', stack, where);
        return composite({
          fontFamily: sub(rec, raw, 'fontFamily', 'fontFamily', stack, where),
          fontSize: sub(rec, raw, 'fontSize', 'dimension', stack, where),
          fontWeight: sub(rec, raw, 'fontWeight', 'fontWeight', stack, where, true) ?? 400,
          lineHeight,
          letterSpacing: sub(rec, raw, 'letterSpacing', 'dimension', stack, where, true),
        });
      }
      default:
        return err(`unknown $type "${type}" (expected one of: ${TYPES.join(', ')})`);
    }
  };

  // Composite helper: propagate the first sub-error or failure.
  const composite = (out) => {
    for (const v of Object.values(out)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (v.failed) return { failed: true };
        if (typeof v.error === 'string') return { error: v.error };
      }
    }
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  };

  const resolveToken = (rec, stack) => {
    if (cache.has(rec.path)) return cache.get(rec.path);
    if (stack.includes(rec.path)) return fail(rec, `circular reference: ${[...stack, rec.path].join(' -> ')}`);
    const type = set.typeOf(rec);
    let value;
    if (!type) {
      value = fail(rec, 'no $type (set it on the token or a parent group)');
    } else if (!TYPES.includes(type)) {
      value = fail(rec, `unknown $type "${type}" (expected one of: ${TYPES.join(', ')})`);
    } else {
      value = resolveRaw(rec, rec.raw, type, [...stack, rec.path], '');
      if (value && typeof value === 'object' && value.failed) value = FAILED;
      if (value && typeof value === 'object' && typeof value.error === 'string') value = fail(rec, value.error);
    }
    cache.set(rec.path, value);
    return value;
  };

  // A token is provisional when it, or anything it references, is provisional.
  const statusCache = new Map();
  set.statusOf = (rec, seen = new Set()) => {
    if (statusCache.has(rec.path)) return statusCache.get(rec.path);
    let status = rec.status;
    if (status === 'stable' && !seen.has(rec.path)) {
      seen.add(rec.path);
      for (const target of aliasesIn(rec.raw)) {
        const ref = byPath.get(target);
        if (ref && set.statusOf(ref, seen) !== 'stable') {
          status = set.statusOf(ref, seen);
          break;
        }
      }
    }
    statusCache.set(rec.path, status);
    return status;
  };

  set.resolve = (tokenPath) => {
    const rec = byPath.get(tokenPath);
    if (!rec) return null;
    const v = resolveToken(rec, []);
    return v === FAILED ? null : v;
  };
  set.resolveAll = () => {
    for (const rec of records) {
      set.resolve(rec.path);
    }
    return set;
  };
  return set;
}

function loadSystem(ctx) {
  const problems = [];
  const files = asArray(ctx.config.tokens).map(toPosix);
  const doc = {};
  const fileOf = new Map();
  const docs = [];
  for (const rel of files) {
    const d = readJsonFile(ctx, rel, problems);
    if (!d) continue;
    docs.push({ rel, doc: d });
    for (const p of tokenPathsOf(d)) fileOf.set(p, rel);
    mergeDocs(doc, d, rel, [], problems);
  }
  expandExtends(doc, files[0], problems);
  const records = collectTokens(doc, fileOf, files[0], problems);
  const base = createTokenSet(records, doc, problems).resolveAll();

  // Tier rule: dependencies point down (component -> semantic -> primitive), never up.
  const rank = { primitive: 0, semantic: 1, component: 2 };
  for (const rec of records) {
    for (const target of aliasesIn(rec.raw)) {
      const ref = base.byPath.get(target);
      if (ref && rank[ref.tier] > rank[rec.tier]) {
        problems.push({ level: 'error', file: rec.file, message: `${rec.path}: a ${rec.tier} token must not reference the ${ref.tier} token {${target}}` });
      }
    }
  }

  const themes = new Map();
  for (const [name, fileRel] of Object.entries(ctx.config.themes)) {
    const rel = toPosix(fileRel);
    const tdoc = readJsonFile(ctx, rel, problems);
    if (!tdoc) continue;
    const overrides = collectTokens(tdoc, new Map(), rel, problems);
    const themed = records.map((r) => ({ ...r }));
    const byPath = new Map(themed.map((r) => [r.path, r]));
    for (const o of overrides) {
      const rec = byPath.get(o.path);
      if (!rec) {
        problems.push({ level: 'error', file: rel, message: `${o.path}: theme overrides a token that does not exist in the base tokens` });
        continue;
      }
      if (o.type && o.type !== base.typeOf(rec)) {
        problems.push({ level: 'error', file: rel, message: `${o.path}: theme $type ${o.type} differs from base type ${base.typeOf(rec)}` });
        continue;
      }
      Object.assign(rec, { raw: o.raw, node: o.node, file: rel, type: base.typeOf(rec), themed: true });
    }
    themes.set(name, { name, file: rel, set: createTokenSet(themed, doc, problems).resolveAll(), overrides: overrides.map((o) => o.path) });
  }
  // A broken base token is re-reported by every theme set; keep one copy of each message.
  const seen = new Set();
  const unique = problems.filter((p) => {
    const key = `${p.level}|${p.file}|${p.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { files, docs, doc, base, themes, problems: unique };
}

function aliasesIn(raw, out = []) {
  const a = aliasOf(raw);
  if (a) out.push(a);
  else if (Array.isArray(raw)) raw.forEach((x) => aliasesIn(x, out));
  else if (isObject(raw)) Object.values(raw).forEach((x) => aliasesIn(x, out));
  return out;
}

function tokenErrors(system) {
  return system.problems.filter((p) => p.level === 'error');
}

// ---------------------------------------------------------------------------
// Value formatting

function cssName(ctx, tokenPath) {
  const name = tokenPath.split('.').filter((s) => s !== '$root').map(kebab).filter(Boolean).join('-');
  return `--${ctx.config.css.prefix ? `${ctx.config.css.prefix}-` : ''}${name}`;
}

const cssDim = (d) => `${fmtNum(d.value)}${d.unit}`;
const cssDur = (d) => `${fmtNum(d.value)}${d.unit}`;
const cssBezier = (b) => `cubic-bezier(${b.map(fmtNum).join(', ')})`;

function cssFamily(list) {
  return list.map((f) => (GENERIC_FAMILIES.has(f) || /^-?[A-Za-z_][\w-]*$/.test(f) ? f : `"${f.replace(/"/g, '\\"')}"`)).join(', ');
}

// Format a resolved value as CSS. With `raw` + `refs`, aliased parts become var(--...).
function cssValue(ctx, type, value, raw, refs) {
  const ref = refs ? aliasOf(raw) : null;
  if (ref) return `var(${cssName(ctx, ref)})`;
  const part = (key, fmt) => {
    const r = isObject(raw) ? raw[key] : undefined;
    if (refs && aliasOf(r)) return `var(${cssName(ctx, aliasOf(r))})`;
    return fmt(value[key]);
  };
  switch (type) {
    case 'color': return toHex(value);
    case 'dimension': return cssDim(value);
    case 'duration': return cssDur(value);
    case 'fontFamily': return cssFamily(value);
    case 'fontWeight': return String(value);
    case 'cubicBezier': return cssBezier(value);
    case 'number': return fmtNum(value);
    case 'strokeStyle': return value;
    case 'border': return `${part('width', cssDim)} ${part('style', String)} ${part('color', toHex)}`;
    case 'transition': return `${part('duration', cssDur)} ${part('timingFunction', cssBezier)} ${part('delay', cssDur)}`;
    case 'shadow': {
      const rawItems = Array.isArray(raw) ? raw : [raw];
      if (refs && rawItems.length === value.length && rawItems.every((x) => isObject(x))) {
        return value.map((s, i) => shadowCss(ctx, s, rawItems[i], refs)).join(', ');
      }
      return value.map((s) => shadowCss(ctx, s)).join(', ');
    }
    case 'gradient': return value.map((s) => `${toHex(s.color)} ${fmtNum(s.position * 100)}%`).join(', ');
    case 'typography': return fontShorthand(value);
    default: return String(value);
  }
}

function shadowCss(ctx, s, raw, refs) {
  const p = (key, fmt) => (refs && raw && aliasOf(raw[key]) ? `var(${cssName(ctx, aliasOf(raw[key]))})` : fmt(s[key]));
  return `${s.inset ? 'inset ' : ''}${p('offsetX', cssDim)} ${p('offsetY', cssDim)} ${p('blur', cssDim)} ${p('spread', cssDim)} ${p('color', toHex)}`;
}

function lineHeightCss(v) {
  return typeof v === 'number' ? fmtNum(v) : cssDim(v);
}

function fontShorthand(t) {
  const lh = t.lineHeight !== undefined ? `/${lineHeightCss(t.lineHeight)}` : '';
  return `${t.fontWeight} ${cssDim(t.fontSize)}${lh} ${cssFamily(t.fontFamily)}`;
}

// Plain JS value for the TS/JSON outputs: CSS strings, numbers, and an object for typography.
function plainValue(ctx, type, value) {
  if (type === 'typography') {
    const out = { fontFamily: cssFamily(value.fontFamily), fontSize: cssDim(value.fontSize), fontWeight: value.fontWeight };
    if (value.lineHeight !== undefined) out.lineHeight = typeof value.lineHeight === 'number' ? value.lineHeight : cssDim(value.lineHeight);
    if (value.letterSpacing !== undefined) out.letterSpacing = cssDim(value.letterSpacing);
    return out;
  }
  if (type === 'fontWeight' || type === 'number') return value;
  return cssValue(ctx, type, value, null, false);
}

function displayValue(ctx, type, value) {
  if (type === 'typography') {
    const ls = value.letterSpacing && value.letterSpacing.value !== 0 ? ` ls ${cssDim(value.letterSpacing)}` : '';
    return `${fontShorthand(value)}${ls}`;
  }
  return cssValue(ctx, type, value, null, false);
}

const TYPO_PARTS = [['fontFamily', 'font-family'], ['fontSize', 'font-size'], ['fontWeight', 'font-weight'], ['lineHeight', 'line-height'], ['letterSpacing', 'letter-spacing']];

// CSS declarations [name, value] for one token (typography expands into sub-properties).
function cssDeclarations(ctx, set, rec, refs = true) {
  const value = set.resolve(rec.path);
  const type = set.typeOf(rec);
  if (value === null) return [];
  const name = cssName(ctx, rec.path);
  if (type !== 'typography') return [[name, cssValue(ctx, type, value, rec.raw, refs)]];
  const target = refs ? aliasOf(rec.raw) : null;
  const decls = [];
  for (const [key, prop] of TYPO_PARTS) {
    if (value[key] === undefined) continue;
    let v;
    if (target) v = `var(${cssName(ctx, target)}-${prop})`;
    else if (refs && isObject(rec.raw) && aliasOf(rec.raw[key])) v = `var(${cssName(ctx, aliasOf(rec.raw[key]))})`;
    else if (key === 'fontFamily') v = cssFamily(value[key]);
    else if (key === 'fontWeight') v = String(value[key]);
    else if (key === 'lineHeight') v = lineHeightCss(value[key]);
    else v = cssDim(value[key]);
    decls.push([`${name}-${prop}`, v]);
  }
  const lh = value.lineHeight !== undefined ? `/var(${name}-line-height)` : '';
  decls.push([name, `var(${name}-font-weight) var(${name}-font-size)${lh} var(${name}-font-family)`]);
  return decls;
}

// ---------------------------------------------------------------------------
// Contrast pairs: implicit (color.on-x on color.x) and declared ($extensions on.<bg>: level)

function contrastPairs(set) {
  const pairs = [];
  const seen = new Set();
  const add = (fg, bg, level, declared) => {
    const key = `${fg}|${bg}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ fg, bg, level, declared });
  };
  for (const rec of set.records) {
    if (set.typeOf(rec) !== 'color') continue;
    const on = rec.ext.on;
    if (typeof on === 'string') add(rec.path, on, 'AA', true);
    else if (Array.isArray(on)) on.forEach((bg) => add(rec.path, bg, 'AA', true));
    else if (isObject(on)) Object.entries(on).forEach(([bg, level]) => add(rec.path, bg, level, true));
  }
  for (const rec of set.records) {
    const last = rec.segs[rec.segs.length - 1];
    if (rec.tier === 'primitive' || set.typeOf(rec) !== 'color' || !last.startsWith('on-')) continue;
    const bg = [...rec.segs.slice(0, -1), last.slice(3)].join('.');
    if (set.byPath.has(bg)) add(rec.path, bg, 'AA', false);
  }
  return pairs;
}

// `only`: for themes, check just the pairs whose colors differ from the base.
function evaluatePairs(set, problems, label, file, only = null) {
  const results = [];
  for (const pair of contrastPairs(set)) {
    if (only && !only.has(pair.fg) && !only.has(pair.bg)) continue;
    const fgRec = set.byPath.get(pair.fg);
    const where = fgRec ? fgRec.file : file;
    const threshold = levelThreshold(pair.level);
    if (threshold === undefined) {
      problems.push({ level: 'error', file: where, message: `${pair.fg}: unknown contrast level "${pair.level}" (use ${Object.keys(LEVELS).join(', ')} or a number)` });
      continue;
    }
    const bgRec = set.byPath.get(pair.bg);
    if (!bgRec || set.typeOf(bgRec) !== 'color') {
      problems.push({ level: 'error', file: where, message: `${pair.fg}: contrast pair background {${pair.bg}} is not a color token` });
      continue;
    }
    const fg = set.resolve(pair.fg);
    const bg = set.resolve(pair.bg);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    const ok = ratio >= threshold;
    results.push({ ...pair, ratio, threshold, ok, theme: label });
    if (!ok) {
      const fix = suggestForeground(fg, bg, threshold);
      const hint = fix ? `; nearest passing foreground ${toHex(fix)} (${contrastRatio(fix, bg).toFixed(2)}:1)` : '';
      const themeNote = label ? ` [theme ${label}]` : '';
      problems.push({ level: 'error', file: where, message: `contrast ${pair.fg} on ${pair.bg}${themeNote}: ${ratio.toFixed(2)}:1, needs ${threshold}:1 (${pair.level})${hint}` });
    }
  }
  if (bgAlphaWarned(set, results)) {
    problems.push({ level: 'warn', file, message: 'a contrast background has transparency; ratios assume it sits on white' });
  }
  return results;
}

function bgAlphaWarned(set, results) {
  return results.some((r) => (set.resolve(r.bg)?.a ?? 1) < 1);
}

// ---------------------------------------------------------------------------
// Outputs

function generatedHeader(system, comment) {
  const src = system.files.join(', ');
  return comment === 'md'
    ? `_Generated by \`design build\` from \`${src}\`. Do not edit by hand._`
    : `/* Generated by \`design build\` from ${src}. Do not edit by hand. */`;
}

function themeSelector(ctx, name) {
  return ctx.config.themeSelector.replace(/\{name\}/g, name);
}

// Tokens whose resolved value differs in a theme (overrides and everything that depends on them).
function themeChanges(ctx, system, theme) {
  const changed = [];
  for (const rec of theme.set.records) {
    const a = system.base.resolve(rec.path);
    const b = theme.set.resolve(rec.path);
    if (b !== null && JSON.stringify(a) !== JSON.stringify(b)) changed.push(rec);
  }
  return changed;
}

function renderCss(ctx, system) {
  const { base } = system;
  const tailwind = ctx.config.css.tailwind;
  const lines = [generatedHeader(system, 'css')];
  if (tailwind) lines.push('/* Import after `@import "tailwindcss";`. Utilities exist for semantic tokens only. */');
  lines.push('');
  // Tailwind: semantic/component tokens named after a Tailwind namespace go in @theme (they get
  // utilities); primitives and everything else stay in :root (no utilities, so no bg-primitive-*).
  const inTheme = (rec) => tailwind && rec.tier !== 'primitive' && base.typeOf(rec) !== 'typography' && namespaceOf(ctx, rec) !== null;
  const rootRecs = base.records.filter((r) => !inTheme(r));
  const themeRecs = base.records.filter(inTheme);
  const block = (selector, recs, set, indent = '  ') => {
    const out = [`${selector} {`];
    let tier = null;
    for (const rec of recs) {
      if (selector === ':root' && rec.tier !== tier) {
        tier = rec.tier;
        out.push(`${indent}/* ${tier} */`);
      }
      for (const [n, v] of cssDeclarations(ctx, set, rec)) out.push(`${indent}${n}: ${v};`);
    }
    out.push('}');
    return out;
  };
  if (rootRecs.length) lines.push(...block(':root', rootRecs, base), '');
  if (tailwind) {
    const reset = asArray(ctx.config.css.tailwindReset).map((ns) => `  --${ns}-*: initial;`);
    const body = block('@theme', themeRecs, base);
    lines.push(body[0], ...reset, ...body.slice(1), '');
  }
  for (const theme of system.themes.values()) {
    const changed = themeChanges(ctx, system, theme);
    if (changed.length) lines.push(...block(themeSelector(ctx, theme.name), changed, theme.set), '');
  }
  const typo = base.records.filter((r) => r.tier !== 'primitive' && base.typeOf(r) === 'typography' && base.resolve(r.path));
  for (const rec of typo) {
    const name = cssName(ctx, rec.path);
    const value = base.resolve(rec.path);
    lines.push(tailwind ? `@utility ${name.slice(2)} {` : `.${name.slice(2)} {`);
    for (const [key, prop] of TYPO_PARTS) if (value[key] !== undefined) lines.push(`  ${prop}: var(${name}-${prop});`);
    lines.push('}', '');
  }
  while (lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

function namespaceOf(ctx, rec) {
  const name = cssName(ctx, rec.path).slice(2);
  return TAILWIND_NAMESPACES.filter((ns) => name.startsWith(`${ns}-`)).sort((a, b) => b.length - a.length)[0] || null;
}

function publicRecords(system) {
  return system.base.records.filter((r) => r.tier !== 'primitive' && system.base.resolve(r.path) !== null);
}

function outputData(ctx, system) {
  const tokens = {};
  const vars = {};
  for (const rec of publicRecords(system)) {
    tokens[rec.path] = plainValue(ctx, system.base.typeOf(rec), system.base.resolve(rec.path));
    vars[rec.path] = `var(${cssName(ctx, rec.path)})`;
  }
  const themes = {};
  for (const theme of system.themes.values()) {
    themes[theme.name] = {};
    for (const rec of themeChanges(ctx, system, theme)) {
      if (rec.tier === 'primitive') continue;
      themes[theme.name][rec.path] = plainValue(ctx, theme.set.typeOf(rec), theme.set.resolve(rec.path));
    }
  }
  return { tokens, vars, themes };
}

function jsLiteral(value, indent) {
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`);
    const inner = entries.map(([k, v]) => `${indent}  ${key(k)}: ${jsLiteral(v, `${indent}  `)},`);
    return `{\n${inner.join('\n')}\n${indent}}`;
  }
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return JSON.stringify(value);
}

function renderTs(ctx, system, rel) {
  const ts = rel.endsWith('.ts') || rel.endsWith('.mts');
  const { tokens, vars, themes } = outputData(ctx, system);
  const asConst = ts ? ' as const' : '';
  const lines = [
    generatedHeader(system, 'css').replace('/*', '//').replace(/ \*\/$/, ''),
    '// Resolved values (default theme) for places CSS variables cannot reach: email, canvas, OG images, passes.',
    '// In CSS-capable code prefer cssVars so themes keep working.',
    '',
    `export const tokens = ${jsLiteral(tokens, '')}${asConst};`,
    '',
    `export const cssVars = ${jsLiteral(vars, '')}${asConst};`,
    '',
    `export const themes = ${jsLiteral(themes, '')}${asConst};`,
  ];
  if (ts) lines.push('', 'export type TokenName = keyof typeof tokens;', 'export type ThemeName = keyof typeof themes;');
  return `${lines.join('\n')}\n`;
}

function renderJson(ctx, system) {
  const { tokens, themes } = outputData(ctx, system);
  return `${JSON.stringify({ tokens, themes }, null, 2)}\n`;
}

function groupKey(rec) {
  return rec.tier === 'component' ? rec.segs.slice(0, 2).join('.') : rec.segs[0];
}

function renderTokensMd(ctx, system) {
  const { base } = system;
  const pairs = evaluatePairs(base, [], null, '');
  const onIndex = new Map();
  for (const p of pairs) {
    if (!onIndex.has(p.fg)) onIndex.set(p.fg, []);
    onIndex.get(p.fg).push(`${p.bg.replace(/^color\./, '')} ${p.ratio.toFixed(1)}`);
  }
  const themeValues = new Map();
  for (const theme of system.themes.values()) {
    for (const rec of themeChanges(ctx, system, theme)) {
      if (!themeValues.has(rec.path)) themeValues.set(rec.path, []);
      themeValues.get(rec.path).push(`${theme.name} ${displayValue(ctx, theme.set.typeOf(rec), theme.set.resolve(rec.path))}`);
    }
  }
  const themeNames = [...system.themes.keys()];
  const sample = publicRecords(system)[0];
  const lines = [
    '---',
    'title: Design tokens',
    'description: "Generated cheat sheet: every semantic and component token with its value and what to use it for"',
    'read_when: Before using any color, font, size, radius, shadow or motion value in code',
    '---',
    '',
    '# Design tokens',
    '',
    generatedHeader(system, 'md'),
    '',
    `Use names, never values. ${sample ? `CSS \`var(${cssName(ctx, sample.path)})\`, TS \`tokens['${sample.path}']\`` : 'CSS `var(--<name with dots as dashes>)`'}${ctx.config.css.tailwind ? '; Tailwind utilities use the same names (`bg-surface`, `p-md`, `rounded-card`); `type.*` are utility classes' : ''}.`,
    `\`primitive.*\` is never used in code. \`(provisional)\` may still change.${themeNames.length ? ` Themes: ${themeNames.join(', ')}.` : ''} "on:" lists checked backgrounds with contrast ratios.`,
  ];
  const groups = new Map();
  for (const rec of publicRecords(system)) {
    const key = groupKey(rec);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }
  // Typography shows its family token (font.body) instead of repeating the whole stack.
  const mdValue = (rec) => {
    const type = base.typeOf(rec);
    const v = base.resolve(rec.path);
    if (type !== 'typography') return displayValue(ctx, type, v);
    const fam = isObject(rec.raw) && aliasOf(rec.raw.fontFamily) ? aliasOf(rec.raw.fontFamily) : cssFamily(v.fontFamily);
    const lh = v.lineHeight !== undefined ? `/${lineHeightCss(v.lineHeight)}` : '';
    const ls = v.letterSpacing && v.letterSpacing.value !== 0 ? ` ls ${cssDim(v.letterSpacing)}` : '';
    return `${v.fontWeight} ${cssDim(v.fontSize)}${lh} ${fam}${ls}`;
  };
  for (const [key, recs] of groups) {
    const statuses = new Set(recs.map((r) => base.statusOf(r)));
    const groupStatus = statuses.size === 1 && !statuses.has('stable') ? [...statuses][0] : null;
    lines.push('', `## ${key}${groupStatus ? ` (${groupStatus})` : ''}`, '');
    for (const rec of recs) {
      const bits = [`- \`${rec.path}\` ${mdValue(rec)}`];
      if (base.statusOf(rec) !== 'stable' && !groupStatus) bits.push(`(${base.statusOf(rec)})`);
      if (rec.deprecated) bits.push(typeof rec.deprecated === 'string' ? `(deprecated: ${rec.deprecated})` : '(deprecated)');
      let line = bits.join(' ');
      const extra = [];
      if (rec.description) extra.push(rec.description.replace(/\s+/g, ' ').replace(/\.$/, ''));
      if (onIndex.has(rec.path)) extra.push(`on: ${onIndex.get(rec.path).join(', ')}`);
      if (themeValues.has(rec.path)) extra.push(themeValues.get(rec.path).join('; '));
      if (base.typeOf(rec) === 'typography') extra.push(`class ${cssName(ctx, rec.path).slice(2)}`);
      if (extra.length) line += ` — ${extra.join('. ')}`;
      lines.push(line);
    }
  }
  const prims = new Map();
  for (const rec of base.records.filter((r) => r.tier === 'primitive')) {
    const key = rec.segs.slice(0, 2).join('.');
    if (!prims.has(key)) prims.set(key, new Set());
    prims.get(key).add(rec.segs[2] || rec.segs[1]);
  }
  if (prims.size) {
    lines.push('', '## Primitives (never in code)', '');
    for (const [key, names] of prims) lines.push(`- \`${key}\`: ${[...names].join(', ')}`);
    lines.push('', 'Details: `design show primitive`.');
  }
  return `${lines.join('\n')}\n`;
}

function renderInventory(ctx, docs) {
  const comps = docs.filter((d) => d.kind === 'component');
  if (!comps.length) return '_No component specs yet. Add one with `design new component <name>` when a screen needs it._';
  const rows = ['| component | read when |', '|---|---|'];
  for (const d of comps) {
    const rel = toPosix(path.relative(ctx.dirAbs, d.abs));
    const title = String(d.fm.title || path.basename(d.abs, '.md'));
    const status = d.fm.status && d.fm.status !== 'current' ? ` (${d.fm.status})` : '';
    rows.push(`| [${title}](${rel})${status} | ${String(d.fm.read_when || '').replace(/\|/g, '\\|')} |`);
  }
  return rows.join('\n');
}

function designMdPath(ctx) {
  return path.join(ctx.dirAbs, 'DESIGN.md');
}

function withInventory(text, inventory) {
  const start = text.indexOf(MARK_START);
  const end = text.indexOf(MARK_END);
  if (start < 0 || end < start) return null;
  return `${text.slice(0, start + MARK_START.length)}\n${inventory}\n${text.slice(end)}`;
}

function computeOutputs(ctx, system, docs) {
  const out = [];
  const o = ctx.config.outputs;
  const add = (rel, content) => out.push({ rel: toPosix(rel), abs: path.resolve(ctx.root, rel), content });
  if (o.css) add(o.css, renderCss(ctx, system));
  if (o.ts) add(o.ts, renderTs(ctx, system, o.ts));
  if (o.json) add(o.json, renderJson(ctx, system));
  if (o.md) add(o.md, renderTokensMd(ctx, system));
  const designMd = designMdPath(ctx);
  if (fs.existsSync(designMd)) {
    const updated = withInventory(fs.readFileSync(designMd, 'utf8'), renderInventory(ctx, docs));
    if (updated !== null) add(relToRoot(ctx, designMd), updated);
  }
  return out;
}

function staleOutputs(outputs) {
  return outputs.filter((f) => !fs.existsSync(f.abs) || fs.readFileSync(f.abs, 'utf8') !== f.content);
}

// ---------------------------------------------------------------------------
// Design docs (DESIGN.md, components/, targets/, references/)

function walkMarkdown(dirAbs, out = []) {
  if (!fs.existsSync(dirAbs)) return out;
  for (const entry of fs.readdirSync(dirAbs, { withFileTypes: true }).sort((a, b) => byName(a.name, b.name))) {
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'assets' && !entry.name.startsWith('.')) walkMarkdown(abs, out);
    } else if (entry.name.endsWith('.md') && entry.name !== 'INDEX.md' && entry.name !== 'README.md') {
      out.push(abs);
    }
  }
  return out;
}

function loadDoc(ctx, abs, kind) {
  const lines = readLines(abs);
  const fm = parseFrontmatter(lines);
  return { abs, rel: relToRoot(ctx, abs), kind, lines, fm: fm.data, fmPresent: fm.present, fmErrors: fm.errors, bodyStart: fm.bodyStart, headings: parseHeadings(lines, fm.bodyStart) };
}

function loadDocs(ctx) {
  const docs = [];
  const designMd = designMdPath(ctx);
  if (fs.existsSync(designMd)) docs.push(loadDoc(ctx, designMd, 'design'));
  for (const [dir, kind] of Object.entries(DOC_DIRS)) {
    for (const abs of walkMarkdown(path.join(ctx.dirAbs, dir))) docs.push(loadDoc(ctx, abs, kind));
  }
  return docs;
}

const LINK_RE = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const TOKEN_SPAN_RE = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_$-]+)+$/;

function checkDoc(ctx, doc, system, report) {
  if (!doc.fmPresent) report('error', doc.rel, 1, `missing frontmatter (${REQUIRED_KEYS.join(', ')})`);
  for (const e of doc.fmErrors) report('error', doc.rel, e.line, `frontmatter: ${e.message}`);
  if (doc.fmPresent) {
    for (const key of REQUIRED_KEYS) {
      if (typeof doc.fm[key] !== 'string' || !doc.fm[key].trim()) report('error', doc.rel, 1, `frontmatter: missing "${key}"`);
    }
  }
  const budget = doc.kind === 'design' ? ctx.config.budgets.design : doc.kind === 'component' ? ctx.config.budgets.component : null;
  if (budget && doc.lines.length > budget) {
    report(doc.kind === 'design' ? 'error' : 'warn', doc.rel, null, `${doc.lines.length} lines, budget is ${budget}: move detail into components/ or targets/`);
  }
  const groups = new Set(system ? system.base.records.map((r) => r.segs[0]) : []);
  const vars = new Map(system ? system.base.records.map((r) => [cssName(ctx, r.path), r]) : []);
  let inFence = false;
  let inComment = false;
  for (let i = doc.bodyStart; i < doc.lines.length; i++) {
    let line = doc.lines[i];
    if (!inComment && /^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    // HTML comments are template instructions: neither links nor token names in them are checked.
    if (inComment) {
      const close = line.indexOf('-->');
      if (close < 0) continue;
      line = line.slice(close + 3);
      inComment = false;
    }
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    const open = line.indexOf('<!--');
    if (open >= 0) {
      line = line.slice(0, open);
      inComment = true;
    }
    for (const m of line.replace(/`[^`]*`/g, '').matchAll(LINK_RE)) {
      const target = m[1].replace(/^<|>$/g, '');
      if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const file = decodeURIComponent(target.split('#')[0].split('?')[0]);
      if (file && !fs.existsSync(path.resolve(path.dirname(doc.abs), file))) report('error', doc.rel, i + 1, `broken link: ${target}`);
    }
    if (!system) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const span = m[1].trim();
      const varName = /^(?:var\()?(--[A-Za-z0-9-]+)\)?$/.exec(span);
      if (TOKEN_SPAN_RE.test(span) && groups.has(span.split('.')[0])) {
        const rec = system.base.byPath.get(span);
        const isGroup = !rec && system.base.records.some((r) => r.path.startsWith(`${span}.`));
        if (!rec && !isGroup) report('error', doc.rel, i + 1, `unknown token \`${span}\`${suggestToken(system, span)}`);
        else if (rec && rec.deprecated) report('warn', doc.rel, i + 1, `deprecated token \`${span}\``);
        else if (rec && rec.tier === 'primitive' && (doc.kind === 'component' || doc.kind === 'design')) report('warn', doc.rel, i + 1, `primitive token \`${span}\`: specs should name semantic or component tokens`);
      } else if (varName && groups.size) {
        const first = varName[1].slice(2).split('-')[0];
        const known = [...vars.keys()].some((v) => v.slice(2).split('-')[0] === first);
        const isTypoPart = [...vars.keys()].some((v) => varName[1].startsWith(`${v}-`));
        if (known && !vars.has(varName[1]) && !isTypoPart) report('error', doc.rel, i + 1, `unknown CSS variable \`${varName[1]}\``);
      }
    }
  }
}

function suggestToken(system, wrong) {
  let best = null;
  let bestScore = Infinity;
  for (const rec of system.base.records) {
    const d = editDistance(rec.path, wrong);
    if (d < bestScore) {
      best = rec.path;
      bestScore = d;
    }
  }
  return best && bestScore <= Math.max(2, Math.floor(wrong.length / 4)) ? ` (did you mean \`${best}\`?)` : '';
}

function editDistance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// ---------------------------------------------------------------------------
// Scan source files for hard-coded values and primitive-token use

function staticBase(glob) {
  const segs = glob.split('/');
  const base = [];
  for (const s of segs) {
    if (/[*?{[]/.test(s)) break;
    base.push(s);
  }
  return base.length === segs.length ? base.slice(0, -1).join('/') : base.join('/');
}

function scanFiles(ctx, paths) {
  const skip = new Set([...asArray(ctx.config.tokens), ...Object.values(ctx.config.themes), ...Object.values(ctx.config.outputs).filter(Boolean)].map((p) => toPosix(path.normalize(p))));
  const exclude = globMatchers(ctx.config.scan.exclude);
  const files = new Set();
  const walk = (abs, accept) => {
    if (!fs.existsSync(abs)) return;
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      const rel = relToRoot(ctx, abs);
      if (accept(rel) && !skip.has(rel) && !exclude.some((re) => re.test(rel)) && !/\.min\.\w+$/.test(rel)) files.add(rel);
      return;
    }
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory() && (ALWAYS_SKIP_DIRS.has(entry.name) || entry.name.startsWith('.'))) continue;
      walk(path.join(abs, entry.name), accept);
    }
  };
  if (paths.length) {
    for (const p of paths) {
      const abs = resolveUserPath(ctx, p);
      const direct = fs.existsSync(abs) && fs.statSync(abs).isFile();
      walk(abs, (rel) => direct || SCAN_DIR_EXTENSIONS.has(path.extname(rel)));
    }
  } else {
    const globs = asArray(ctx.config.scan.include).flatMap(expandBraces);
    const include = globs.map(globToRegExp);
    for (const base of new Set(globs.map(staticBase))) walk(path.resolve(ctx.root, base || '.'), (rel) => include.some((re) => re.test(rel)));
  }
  return [...files].sort(byName);
}

function valueIndex(ctx, system) {
  const index = new Map();
  for (const rec of system.base.records) {
    const type = system.base.typeOf(rec);
    const v = system.base.resolve(rec.path);
    if (v === null || (type !== 'color' && type !== 'dimension')) continue;
    const key = type === 'color' ? toHex(v) : cssDim(v);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(rec);
  }
  for (const list of index.values()) list.sort((a, b) => (a.tier === 'primitive') - (b.tier === 'primitive'));
  return index;
}

function tokenHint(ctx, index, key) {
  const recs = index.get(key) || [];
  const pub = recs.filter((r) => r.tier !== 'primitive');
  if (pub.length) return ` (use ${pub.slice(0, 3).map((r) => `${r.path} = var(${cssName(ctx, r.path)})`).join(' or ')})`;
  if (recs.length) return ` (equals ${recs[0].path}; add or use a semantic token for it)`;
  return '';
}

const HEX_RE = /(?<![\w&#/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const FUNC_RE = /\b(?:rgba?|hsla?)\(\s*-?[\d.]+[^)]*\)|\b(?:hwb|lab|lch|oklab|oklch)\(\s*-?[\d.][^)]*\)/g;
const SIZE_RE = /(?<![\w.#-])(\d*\.?\d+)(px|rem)\b/g;
const PRIM_VAR_RE = /--primitive-[a-z0-9-]+/g;
const PRIM_PATH_RE = /['"`]primitive\.[\w.$-]+['"`]/g;

function scanSource(ctx, system, paths) {
  const findings = [];
  const index = system ? valueIndex(ctx, system) : new Map();
  const allow = new Set(ctx.config.scan.allow.map((v) => String(v).toLowerCase()));
  const prefix = ctx.config.css.prefix ? `--${ctx.config.css.prefix}-primitive-` : '--primitive-';
  const primVar = ctx.config.css.prefix ? new RegExp(`${prefix}[a-z0-9-]+`, 'g') : PRIM_VAR_RE;
  const deprecatedVars = new Map(system ? system.base.records.filter((r) => r.deprecated).map((r) => [cssName(ctx, r.path), r]) : []);
  const files = scanFiles(ctx, paths);
  for (const rel of files) {
    const lines = readLines(path.resolve(ctx.root, rel));
    lines.forEach((line, i) => {
      if (line.includes('design-allow') || line.length > 2000) return;
      const add = (kind, value, message) => {
        if (allow.has(value.toLowerCase())) return;
        findings.push({ file: rel, line: i + 1, kind, value, message });
      };
      for (const m of line.matchAll(HEX_RE)) {
        const c = parseHex(m[0]);
        add('color', m[0], `hard-coded color ${m[0]}${tokenHint(ctx, index, toHex(c))}`);
      }
      for (const m of line.matchAll(FUNC_RE)) {
        const c = parseCssColor(m[0]);
        add('color', m[0], `hard-coded color ${m[0]}${c ? tokenHint(ctx, index, toHex(c)) : ''}`);
      }
      if (ctx.config.scan.sizes) {
        for (const m of line.matchAll(SIZE_RE)) {
          if (Number(m[1]) === 0 || m[0] === '1px') continue;
          add('size', m[0], `hard-coded size ${m[0]}${tokenHint(ctx, index, `${fmtNum(m[1])}${m[2]}`)}`);
        }
      }
      for (const m of line.matchAll(primVar)) add('primitive', m[0], `primitive token ${m[0]} used in code; use a semantic token`);
      for (const m of line.matchAll(PRIM_PATH_RE)) add('primitive', m[0], `primitive token ${m[0]} used in code; use a semantic token`);
      for (const m of line.matchAll(/var\((--[A-Za-z0-9-]+)\)/g)) {
        const rec = deprecatedVars.get(m[1]);
        if (rec) add('deprecated', m[1], `deprecated token ${rec.path}${typeof rec.deprecated === 'string' ? `: ${rec.deprecated}` : ''}`);
      }
    });
  }
  return { files, findings };
}

// ---------------------------------------------------------------------------
// Argument parsing and command registry

function parseArgs(argv, flags) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--') || arg === '--') {
      positional.push(arg);
      continue;
    }
    let name = arg.slice(2);
    let inline;
    const eq = name.indexOf('=');
    if (eq >= 0) {
      inline = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    if (name === 'help') {
      opts.help = true;
      continue;
    }
    const type = flags[name];
    if (!type) throw new UserError(`unknown option --${name}`, 2);
    if (type === 'boolean') {
      opts[name] = inline === undefined ? true : inline !== 'false';
      continue;
    }
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined) throw new UserError(`--${name} needs a value`, 2);
    if (type === 'number') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) throw new UserError(`--${name} must be a positive integer`, 2);
      opts[name] = n;
    } else {
      opts[name] = value;
    }
  }
  return { opts, positional };
}

const COMMANDS = {};

function define(name, spec) {
  COMMANDS[name] = { name, flags: {}, ...spec };
}

function usageText() {
  const lines = ['usage: design <command> [options]', '', 'commands:'];
  for (const cmd of Object.values(COMMANDS)) lines.push(`  ${cmd.name.padEnd(9)} ${cmd.summary}`);
  lines.push('', 'Run "design <command> --help" for details. Project root: nearest design.json, else .git, else cwd.');
  lines.push('Exit codes: 0 ok, 1 errors (or nothing found), 2 usage.');
  return lines.join('\n');
}

function printProblems(problems, io) {
  const sorted = [...problems].sort((a, b) => byName(a.file || '', b.file || '') || (a.line || 0) - (b.line || 0));
  for (const p of sorted) io.out(`${p.level === 'warn' ? 'warning' : 'error'}: ${p.file || '(project)'}${p.line ? `:${p.line}` : ''}: ${p.message}`);
}

function writeFiles(files) {
  for (const f of files) {
    fs.mkdirSync(path.dirname(f.abs), { recursive: true });
    fs.writeFileSync(f.abs, f.content);
  }
}

// ---- init -------------------------------------------------------------------

function templatePath(ctx, name) {
  const own = path.join(ctx.dirAbs, 'templates', name);
  if (fs.existsSync(own)) return own;
  return path.join(SKILL_DIR, 'templates', name);
}

function fillPlaceholders(text, values) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) => (values[key] !== undefined ? values[key] : m));
}

function yamlScalar(value) {
  const s = String(value);
  if (s === '' || s.startsWith('[')) return s;
  if (/: | #|^[-'"&*!|>%@`{}]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

function fillTemplate(text, values) {
  const m = /^---\n[\s\S]*?\n---\n/.exec(text);
  if (!m) return fillPlaceholders(text, values);
  const safe = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, yamlScalar(v)]));
  return fillPlaceholders(m[0], safe) + fillPlaceholders(text.slice(m[0].length), values);
}

function projectName(ctx) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ctx.root, 'package.json'), 'utf8'));
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name.replace(/^@[^/]+\//, '');
  } catch {
    // no package.json: fall back to the folder name
  }
  return path.basename(ctx.root);
}

define('init', {
  summary: 'scaffold design/ (DESIGN.md, tokens.json) and build; never overwrites',
  usage: 'design init [--tailwind] [--name "<project>"]\n\n  --tailwind   write design.json with css.tailwind=true (emit a Tailwind v4 @theme block)\n  --name       project name used in DESIGN.md (default: package.json name or folder name)',
  flags: { tailwind: 'boolean', name: 'string' },
  run(ctx, { opts }, io) {
    const created = [];
    const put = (abs, content) => {
      if (fs.existsSync(abs)) {
        io.out(`exists: ${relToRoot(ctx, abs)}`);
        return;
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      created.push(relToRoot(ctx, abs));
    };
    if (opts.tailwind) {
      put(path.join(ctx.root, CONFIG_FILE), `${JSON.stringify({ css: { tailwind: true, tailwindReset: ['color'] } }, null, 2)}\n`);
      ctx.config = loadConfig(ctx.root);
    }
    const name = opts.name || projectName(ctx);
    const values = { name, title: `${name} design system`, date: today() };
    put(designMdPath(ctx), fillTemplate(fs.readFileSync(templatePath(ctx, 'DESIGN.md'), 'utf8'), values));
    const tokensRel = asArray(ctx.config.tokens)[0];
    put(path.resolve(ctx.root, tokensRel), fs.readFileSync(templatePath(ctx, 'tokens.json'), 'utf8'));
    for (const c of created) io.out(`created: ${c}`);
    const code = COMMANDS.build.run(ctx, { opts: {}, positional: [] }, io);
    io.out('next: record your references in design/references/ ("design new reference"), then replace the provisional tokens. See SKILL.md "Creating".');
    return code;
  },
});

// ---- build --------------------------------------------------------------------

define('build', {
  summary: 'generate CSS, TS/JSON, TOKENS.md and the DESIGN.md component inventory',
  usage: 'design build [--check]\n\n  --check   write nothing; exit 1 listing outputs that are stale or missing',
  flags: { check: 'boolean' },
  run(ctx, { opts }, io) {
    const system = loadSystem(ctx);
    const errors = tokenErrors(system);
    if (errors.length) {
      printProblems(errors, io);
      io.out(`design build: ${errors.length} token error(s); nothing written`);
      return 1;
    }
    const outputs = computeOutputs(ctx, system, loadDocs(ctx));
    const stale = staleOutputs(outputs);
    if (opts.check) {
      for (const f of stale) io.out(`stale: ${f.rel}`);
      io.out(stale.length ? `design build --check: ${stale.length} stale output(s); run "design build"` : 'design build --check: OK');
      return stale.length ? 1 : 0;
    }
    writeFiles(stale);
    for (const f of stale) io.out(`wrote: ${f.rel}`);
    io.out(`design build: ${stale.length ? `${stale.length} file(s) updated` : 'up to date'} (${system.base.records.length} tokens)`);
    return 0;
  },
});

// ---- check --------------------------------------------------------------------

function runCheck(ctx, opts) {
  const problems = [];
  const report = (level, file, line, message) => problems.push({ level, file, line, message });
  const system = loadSystem(ctx);
  problems.push(...system.problems);
  const tokensOk = tokenErrors(system).length === 0;
  const docs = loadDocs(ctx);
  const stats = { tokens: system.base.records.length, provisional: system.base.records.filter((r) => system.base.statusOf(r) === 'provisional').length, themes: system.themes.size, components: docs.filter((d) => d.kind === 'component').length };

  if (system.base.shorthand.length) {
    const sample = [...new Set(system.base.shorthand)].slice(0, 3).join(', ');
    report(opts.strict ? 'error' : 'warn', system.files[0], null, `${new Set(system.base.shorthand).size} token(s) use shorthand values (${sample}${system.base.shorthand.length > 3 ? ', ...' : ''}); run "design fmt" to write DTCG 2025.10 objects`);
  }
  if (system.base.nonstandard.length) {
    report(opts.strict ? 'error' : 'warn', system.files[0], null, `non-standard units: ${[...new Set(system.base.nonstandard)].join(', ')} (DTCG 2025.10 allows px and rem)`);
  }

  // CSS name collisions
  const names = new Map();
  for (const rec of system.base.records) {
    const n = cssName(ctx, rec.path);
    if (names.has(n)) report('error', rec.file, null, `${rec.path}: CSS name ${n} collides with ${names.get(n)}`);
    else names.set(n, rec.path);
  }

  if (tokensOk) {
    evaluatePairs(system.base, problems, null, system.files[0]);
    for (const theme of system.themes.values()) {
      const changed = new Set(themeChanges(ctx, system, theme).map((r) => r.path));
      evaluatePairs(theme.set, problems, theme.name, theme.file, changed);
    }
    const outputs = computeOutputs(ctx, system, docs);
    for (const f of staleOutputs(outputs)) report('error', f.rel, null, 'generated output is stale or missing: run "design build"');
    const md = ctx.config.outputs.md && outputs.find((f) => f.rel === toPosix(ctx.config.outputs.md));
    const mdLines = md ? md.content.split('\n').length : 0;
    if (mdLines > ctx.config.budgets.tokens) {
      report('warn', md.rel, null, `${mdLines} lines, budget is ${ctx.config.budgets.tokens}: agents read it whole; merge near-duplicate semantic tokens`);
    }
  }

  const designMd = docs.find((d) => d.kind === 'design');
  if (!designMd) {
    report('error', `${ctx.dirRel}/DESIGN.md`, null, 'missing entry point (run "design init")');
  } else {
    const text = designMd.lines.join('\n');
    if (stats.components && !text.includes(MARK_START)) report('warn', designMd.rel, null, `no component inventory markers (${MARK_START} ... ${MARK_END})`);
    for (const t of docs.filter((d) => d.kind === 'target')) {
      if (!text.includes(toPosix(path.relative(ctx.dirAbs, t.abs)))) report('warn', designMd.rel, null, `target ${t.rel} is not linked from the Surfaces table`);
    }
  }
  for (const doc of docs) checkDoc(ctx, doc, tokensOk ? system : null, report);

  if (ctx.config.scan.include.length) {
    const { findings, files } = scanSource(ctx, tokensOk ? system : null, []);
    stats.scanned = files.length;
    for (const f of findings) report(f.kind === 'deprecated' ? 'warn' : ctx.config.scan.severity, f.file, f.line, f.message);
  }
  if (designMd) stats.designLines = designMd.lines.length;
  return { problems, stats };
}

define('check', {
  summary: 'validate tokens, contrast, generated files, docs and source (exit 1 on errors)',
  usage: 'design check [--strict] [--json]\n\n  --strict   shorthand values and non-standard units are errors, not warnings\n  --json     print { ok, errors, warnings, problems, stats }',
  flags: { strict: 'boolean', json: 'boolean' },
  run(ctx, { opts }, io) {
    const { problems, stats } = runCheck(ctx, opts);
    const errors = problems.filter((p) => p.level === 'error').length;
    const warnings = problems.length - errors;
    if (opts.json) {
      io.out(JSON.stringify({ ok: errors === 0, errors, warnings, problems, stats }, null, 2));
      return errors ? 1 : 0;
    }
    printProblems(problems, io);
    if (errors) {
      io.out(`design check: ${errors} error(s), ${warnings} warning(s)`);
      return 1;
    }
    const bits = [`${stats.tokens} tokens`, `${stats.provisional} provisional`, `${stats.themes} theme(s)`, `${stats.components} component spec(s)`];
    if (stats.designLines) bits.push(`DESIGN.md ${stats.designLines}/${ctx.config.budgets.design} lines`);
    if (stats.scanned !== undefined) bits.push(`${stats.scanned} source file(s) scanned`);
    if (warnings) bits.push(`${warnings} warning(s)`);
    io.out(`design check: OK (${bits.join(', ')})`);
    return 0;
  },
});

// ---- scan -----------------------------------------------------------------------

define('scan', {
  summary: 'find hard-coded colors/sizes and primitive tokens in source files',
  usage: 'design scan [paths...] [--summary] [--json]\n\n  paths       files or directories (default: design.json scan.include globs)\n  --summary   unique values with counts and matching tokens (for migrating existing CSS)\n  --json      machine-readable findings',
  flags: { summary: 'boolean', json: 'boolean' },
  run(ctx, { opts, positional }, io) {
    if (!positional.length && !ctx.config.scan.include.length) throw new UserError('scan: no paths given and design.json has no scan.include globs', 2);
    const system = loadSystem(ctx);
    const usable = tokenErrors(system).length === 0 ? system : null;
    const { files, findings } = scanSource(ctx, usable, positional);
    if (opts.summary) {
      const counts = new Map();
      for (const f of findings) {
        const key = f.kind === 'color' ? (parseCssColor(f.value) ? toHex(parseCssColor(f.value)) : f.value) : f.value;
        const entry = counts.get(key) || { value: key, kind: f.kind, count: 0, files: new Set(), message: f.message };
        entry.count++;
        entry.files.add(f.file);
        counts.set(key, entry);
      }
      const rows = [...counts.values()].sort((a, b) => b.count - a.count || byName(a.value, b.value));
      if (opts.json) {
        io.out(JSON.stringify(rows.map((r) => ({ ...r, files: [...r.files] })), null, 2));
      } else {
        for (const r of rows) {
          const hint = /\((use|equals) .*\)$/.exec(r.message);
          io.out(`${String(r.count).padStart(5)}  ${r.value.padEnd(10)} ${r.kind.padEnd(10)} ${r.files.size} file(s)${hint ? ` ${hint[0]}` : ''}`);
        }
        io.out(`design scan: ${rows.length} unique value(s) in ${files.length} file(s)`);
      }
      return 0;
    }
    if (opts.json) {
      io.out(JSON.stringify({ files: files.length, findings }, null, 2));
    } else {
      for (const f of findings) io.out(`${f.file}:${f.line}: ${f.message}`);
      io.out(`design scan: ${findings.length} finding(s) in ${files.length} file(s)`);
    }
    return findings.some((f) => f.kind !== 'deprecated') ? 1 : 0;
  },
});

// ---- show -----------------------------------------------------------------------

function tokenLine(ctx, set, rec) {
  const v = set.resolve(rec.path);
  const status = set.statusOf(rec) !== 'stable' ? ` (${set.statusOf(rec)})` : '';
  const desc = rec.description ? ` — ${rec.description}` : '';
  return `${rec.path}  ${v === null ? '(invalid)' : displayValue(ctx, set.typeOf(rec), v)}${status}${desc}`;
}

function aliasChain(set, rec) {
  const chain = [];
  let cur = rec;
  const seen = new Set();
  while (cur && aliasOf(cur.raw) && !seen.has(cur.path)) {
    seen.add(cur.path);
    chain.push(aliasOf(cur.raw));
    cur = set.byPath.get(aliasOf(cur.raw));
  }
  return chain;
}

function showToken(ctx, system, rec, io, json) {
  const { base } = system;
  const type = base.typeOf(rec);
  const value = base.resolve(rec.path);
  const usedBy = base.records.filter((r) => aliasesIn(r.raw).includes(rec.path)).map((r) => r.path);
  const pairs = contrastPairs(base).filter((p) => p.fg === rec.path || p.bg === rec.path).map((p) => {
    const fg = base.resolve(p.fg);
    const bg = base.resolve(p.bg);
    const ratio = fg && bg ? contrastRatio(fg, bg) : null;
    return { ...p, ratio, ok: ratio !== null && ratio >= levelThreshold(p.level) };
  });
  const themes = {};
  for (const theme of system.themes.values()) {
    const tv = theme.set.resolve(rec.path);
    if (tv !== null && JSON.stringify(tv) !== JSON.stringify(value)) themes[theme.name] = displayValue(ctx, type, tv);
  }
  const info = {
    path: rec.path, tier: rec.tier, type, status: base.statusOf(rec), deprecated: rec.deprecated || false, file: rec.file,
    value: value === null ? null : plainValue(ctx, type, value), raw: rec.raw, aliases: aliasChain(base, rec),
    css: `var(${cssName(ctx, rec.path)})${type === 'typography' ? ` or class ${cssName(ctx, rec.path).slice(2)}` : ''}`,
    description: rec.description, themes, contrast: pairs, usedBy, print: rec.ext.print || null, source: rec.ext.source || null,
  };
  if (json) {
    io.out(JSON.stringify(info, null, 2));
    return;
  }
  io.out(`${rec.path}  (${rec.tier} ${type}${info.status !== 'stable' ? `, ${info.status}` : ''}${rec.deprecated ? ', deprecated' : ''})`);
  if (value !== null) {
    let line = `  value:    ${displayValue(ctx, type, value)}`;
    if (type === 'color') line += `   ${toRgbString(value)}`;
    io.out(line);
  }
  if (info.aliases.length) io.out(`  alias:    ${[rec.path, ...info.aliases].join(' -> ')}`);
  io.out(`  css:      ${info.css}`);
  if (rec.tier !== 'primitive') io.out(`  ts:       tokens['${rec.path}']`);
  if (rec.description) io.out(`  use for:  ${rec.description}`);
  if (typeof rec.deprecated === 'string') io.out(`  deprecated: ${rec.deprecated}`);
  for (const [name, v] of Object.entries(themes)) io.out(`  ${`${name}:`.padEnd(9)} ${v}`);
  for (const p of pairs) io.out(`  contrast: ${p.fg} on ${p.bg} ${p.ratio === null ? '?' : p.ratio.toFixed(2)}:1 ${p.ok ? 'pass' : 'FAIL'} ${p.level}`);
  if (info.print) io.out(`  print:    ${Object.entries(info.print).map(([k, v]) => `${k} ${Array.isArray(v) ? v.join(' ') : v}`).join('; ')}`);
  if (info.source) io.out(`  source:   ${info.source}`);
  if (usedBy.length) io.out(`  used by:  ${usedBy.join(', ')}`);
  io.out(`  file:     ${rec.file}`);
}

define('show', {
  summary: 'show a token (value, aliases, contrast, usage), a token group, or a component/target spec',
  usage: 'design show <token | group | component | target> [--json]\n\n  token       color.primary: value, alias chain, CSS/TS names, contrast, themes, reverse references\n  group       color, spacing, primitive.color: one line per token\n  component   button (prints design/components/button.md); target and reference names work too',
  flags: { json: 'boolean' },
  run(ctx, { opts, positional }, io) {
    const query = positional[0];
    if (!query) throw new UserError('show: usage: design show <token | group | component>', 2);
    const system = loadSystem(ctx);
    const rec = system.base.byPath.get(query);
    if (rec) {
      showToken(ctx, system, rec, io, opts.json);
      return 0;
    }
    const group = system.base.records.filter((r) => r.path.startsWith(`${query}.`));
    if (group.length) {
      if (opts.json) io.out(JSON.stringify(group.map((r) => ({ path: r.path, value: system.base.resolve(r.path) === null ? null : plainValue(ctx, system.base.typeOf(r), system.base.resolve(r.path)), description: r.description, status: system.base.statusOf(r) })), null, 2));
      else for (const r of group) io.out(tokenLine(ctx, system.base, r));
      return 0;
    }
    const slug = slugify(query);
    const doc = loadDocs(ctx).find((d) => d.kind !== 'design' && (path.basename(d.abs, '.md') === slug || slugify(String(d.fm.title || '')) === slug));
    if (doc) {
      if (opts.json) io.out(JSON.stringify({ path: doc.rel, kind: doc.kind, frontmatter: doc.fm, body: doc.lines.slice(doc.bodyStart).join('\n') }, null, 2));
      else io.out(doc.lines.join('\n').replace(/\n+$/, ''));
      return 0;
    }
    io.err(`design: nothing named "${query}"${system.base.records.length ? suggestToken(system, query).replace(/`/g, '') : ''}`);
    return 1;
  },
});

// ---- find -----------------------------------------------------------------------

define('find', {
  summary: 'search tokens (name, description, value) and design docs, ranked',
  usage: 'design find <terms...> [--limit N] [--json]\n\n  Case- and diacritic-insensitive prefix match. A color value (#e5452d) finds tokens with that value.',
  flags: { limit: 'number', json: 'boolean' },
  run(ctx, { opts, positional }, io) {
    if (!positional.length) throw new UserError('find: usage: design find <terms...>', 2);
    const system = loadSystem(ctx);
    const terms = positional.flatMap((t) => (parseCssColor(t) ? [t] : words(t)));
    const match = (list, term) => list.some((w) => w.startsWith(term));
    const hits = [];
    for (const rec of system.base.records) {
      const v = system.base.resolve(rec.path);
      const type = system.base.typeOf(rec);
      const shown = v === null ? '' : displayValue(ctx, type, v);
      let score = 0;
      let all = true;
      for (const term of terms) {
        const color = parseCssColor(term);
        let s = 0;
        if (color) s = type === 'color' && v && toHex(v) === toHex(color) ? 20 : 0;
        else s = (match(words(rec.path), term) ? 10 : 0) + (match(words(rec.description), term) ? 6 : 0) + (match(words(shown), term) ? 2 : 0) + (normalizeText(rec.segs[rec.segs.length - 1]) === term ? 5 : 0);
        if (!s) all = false;
        score += s;
      }
      if (rec.tier === 'primitive') score -= 1;
      if (score > 0) hits.push({ kind: 'token', path: rec.path, line: null, score: score + (all && terms.length > 1 ? 10 : 0), title: shown, snippet: rec.description });
    }
    for (const doc of loadDocs(ctx)) {
      let score = 0;
      let all = true;
      let line = 1;
      let snippet = String(doc.fm.description || '');
      for (const term of terms) {
        if (parseCssColor(term)) {
          const idx = doc.lines.findIndex((l) => l.toLowerCase().includes(term.toLowerCase()));
          if (idx >= 0) {
            score += 8;
            line = idx + 1;
            snippet = doc.lines[idx].trim();
          } else {
            all = false;
          }
          continue;
        }
        let s = (match(words(doc.fm.title || ''), term) ? 10 : 0) + (match(words(doc.fm.description || ''), term) ? 6 : 0) + (match(words(doc.fm.read_when || ''), term) ? 6 : 0);
        const heading = doc.headings.find((h) => match(words(h.text), term));
        if (heading) {
          s += 4;
          if (line === 1) line = heading.line;
        }
        let body = 0;
        for (let i = doc.bodyStart; i < doc.lines.length && body < 10; i++) {
          if (match(words(doc.lines[i]), term)) {
            body++;
            if (line === 1) {
              line = i + 1;
              snippet = doc.lines[i].trim();
            }
          }
        }
        s += body;
        if (!s) all = false;
        score += s;
      }
      if (score > 0) hits.push({ kind: doc.kind, path: doc.rel, line, score: score + (all && terms.length > 1 ? 10 : 0), title: String(doc.fm.title || ''), snippet: snippet.slice(0, 100) });
    }
    hits.sort((a, b) => b.score - a.score || byName(a.path, b.path));
    const top = hits.slice(0, opts.limit || 15);
    if (opts.json) io.out(JSON.stringify(top, null, 2));
    else for (const h of top) io.out(`${h.kind.padEnd(9)} ${h.path}${h.line ? `:${h.line}` : ''}  ${h.title}${h.snippet ? ` — ${h.snippet}` : ''}`);
    return top.length ? 0 : 1;
  },
});

// ---- contrast ---------------------------------------------------------------------

define('contrast', {
  summary: 'WCAG contrast of two colors (tokens or CSS colors), with a passing suggestion',
  usage: 'design contrast <fg> <bg> [--theme name] [--min AA|AA-large|AAA|AAA-large|ui] [--json]\n\n  fg, bg    token paths (color.on-primary) or CSS colors (#fff, rgb(0 0 0))\n  --min     exit 1 when the ratio is below this level',
  flags: { theme: 'string', min: 'string', json: 'boolean' },
  run(ctx, { opts, positional }, io) {
    const [a, b] = positional;
    if (!a || !b) throw new UserError('contrast: usage: design contrast <fg> <bg>', 2);
    if (opts.min && levelThreshold(opts.min) === undefined) throw new UserError(`contrast: unknown level "${opts.min}"`, 2);
    let set = null;
    const need = [a, b].some((x) => !parseCssColor(x));
    if (need) {
      const system = loadSystem(ctx);
      set = system.base;
      if (opts.theme) {
        const theme = system.themes.get(opts.theme);
        if (!theme) throw new UserError(`contrast: unknown theme "${opts.theme}"`);
        set = theme.set;
      }
    }
    const pick = (x) => {
      const literal = parseCssColor(x);
      if (literal) return { label: x, color: literal };
      const rec = set.byPath.get(x);
      if (!rec) throw new UserError(`contrast: "${x}" is neither a CSS color nor a token`);
      if (set.typeOf(rec) !== 'color') throw new UserError(`contrast: ${x} is a ${set.typeOf(rec)} token, not a color`);
      const color = set.resolve(x);
      if (!color) throw new UserError(`contrast: ${x} does not resolve (run "design check")`);
      return { label: `${x} ${toHex(color)}`, color };
    };
    const fg = pick(a);
    const bg = pick(b);
    const ratio = contrastRatio(fg.color, bg.color);
    const levels = Object.entries(LEVELS).map(([level, threshold]) => ({ level, threshold, ok: ratio >= threshold }));
    const fix = suggestForeground(fg.color, bg.color, levelThreshold(opts.min || 'AA'));
    if (opts.json) {
      io.out(JSON.stringify({ fg: fg.label, bg: bg.label, ratio: Number(ratio.toFixed(2)), levels, suggestion: fix ? toHex(fix) : null }, null, 2));
    } else {
      io.out(`${fg.label} on ${bg.label}: ${ratio.toFixed(2)}:1`);
      for (const l of levels) io.out(`  ${l.level.padEnd(10)} ${String(l.threshold).padEnd(4)} ${l.ok ? 'pass' : 'FAIL'}`);
      if (fix) io.out(`  suggest:   ${toHex(fix)} (${contrastRatio(fix, bg.color).toFixed(2)}:1 for ${opts.min || 'AA'}; same hue and chroma, lightness adjusted)`);
    }
    if (opts.min && ratio < levelThreshold(opts.min)) return 1;
    return 0;
  },
});

// ---- new --------------------------------------------------------------------------

define('new', {
  summary: 'scaffold a component spec, target or reference note from a template',
  usage: 'design new <component|target|reference> "<name>" [--description ".."] [--read-when ".."] [--source <path|url>]\n\n  target presets: wallet-pass, email, print, og-image (others get the generic template)\n  component: also refreshes the DESIGN.md inventory',
  flags: { description: 'string', 'read-when': 'string', source: 'string' },
  run(ctx, { opts, positional }, io) {
    const [kind, name] = positional;
    if (!NEW_KINDS.includes(kind) || !name) throw new UserError(`new: usage: design new <${NEW_KINDS.join('|')}> "<name>"`, 2);
    const slug = slugify(name);
    if (!slug) throw new UserError(`new: "${name}" produces an empty file name`);
    const dir = { component: 'components', target: 'targets', reference: 'references' }[kind];
    const fileAbs = path.join(ctx.dirAbs, dir, `${slug}.md`);
    if (fs.existsSync(fileAbs)) throw new UserError(`new: refusing to overwrite ${relToRoot(ctx, fileAbs)}`);
    let tpl = templatePath(ctx, `${kind}.md`);
    if (kind === 'target' && fs.existsSync(templatePath(ctx, `targets/${slug}.md`))) tpl = templatePath(ctx, `targets/${slug}.md`);
    const title = name.length > 2 && name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ') : name;
    const values = { title, name: slug, description: opts.description || '', read_when: opts['read-when'] || '', date: today(), source: opts.source || '' };
    const filled = fillTemplate(fs.readFileSync(tpl, 'utf8'), values);
    fs.mkdirSync(path.dirname(fileAbs), { recursive: true });
    fs.writeFileSync(fileAbs, filled);
    io.out(relToRoot(ctx, fileAbs));
    if (kind === 'component') {
      const system = loadSystem(ctx);
      const designMd = designMdPath(ctx);
      if (!tokenErrors(system).length && fs.existsSync(designMd)) {
        const updated = withInventory(fs.readFileSync(designMd, 'utf8'), renderInventory(ctx, loadDocs(ctx)));
        if (updated !== null) fs.writeFileSync(designMd, updated);
      }
    }
    if (kind === 'target') io.out('link it from the Surfaces table in DESIGN.md');
    const fm = parseFrontmatter(filled.split('\n')).data;
    const missing = ['description', 'read_when'].filter((k) => !fm[k]);
    if (missing.length) io.out(`fill in ${missing.join(' and ')} in the frontmatter, then run "design build"`);
    return 0;
  },
});

// ---- fmt --------------------------------------------------------------------------

function normColor(raw) {
  return typeof raw === 'string' && parseHex(raw) ? hexToObject(raw) : raw;
}

function normDim(raw) {
  if (raw === 0) return { value: 0, unit: 'px' };
  if (typeof raw !== 'string') return raw;
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(raw.trim());
  if (!m || (!m[2] && Number(m[1]) !== 0)) return raw;
  return { value: Number(m[1]), unit: m[2] || 'px' };
}

function normDuration(raw) {
  if (typeof raw !== 'string') return raw;
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(raw.trim());
  return m ? { value: Number(m[1]), unit: m[2] } : raw;
}

function normalizeRaw(raw, type) {
  if (aliasOf(raw) || isRef(raw)) return raw;
  const fields = (obj, map) => {
    if (!isObject(obj)) return obj;
    const out = { ...obj };
    for (const [k, fn] of Object.entries(map)) if (out[k] !== undefined) out[k] = fn(out[k]);
    return out;
  };
  const wrap = (fn) => (v) => (aliasOf(v) || isRef(v) ? v : fn(v));
  const C = wrap(normColor);
  const D = wrap(normDim);
  const T = wrap(normDuration);
  switch (type) {
    case 'color': return normColor(raw);
    case 'dimension': return normDim(raw);
    case 'duration': return normDuration(raw);
    case 'border': return fields(raw, { color: C, width: D });
    case 'transition': return fields(raw, { duration: T, delay: T });
    case 'typography': return fields(raw, { fontSize: D, letterSpacing: D, lineHeight: (v) => (typeof v === 'string' && /^\d*\.?\d+$/.test(v) ? Number(v) : D(v)) });
    case 'shadow': {
      const one = (s) => (aliasOf(s) || isRef(s) ? s : fields(s, { color: C, offsetX: D, offsetY: D, blur: D, spread: D }));
      return Array.isArray(raw) ? raw.map(one) : one(raw);
    }
    case 'gradient': return Array.isArray(raw) ? raw.map((s) => (aliasOf(s) || isRef(s) ? s : fields(s, { color: C }))) : raw;
    default: return raw;
  }
}

function oneLine(v) {
  if (Array.isArray(v)) return `[${v.map(oneLine).join(', ')}]`;
  if (isObject(v)) {
    const e = Object.entries(v);
    return e.length ? `{ ${e.map(([k, x]) => `${JSON.stringify(k)}: ${oneLine(x)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(v);
}

// Stable JSON: groups and tokens expanded, short values inline.
function prettyJson(v, indent = '', inValue = false) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const single = oneLine(v);
  if ((inValue || Array.isArray(v)) && indent.length + single.length <= 100) return single;
  const next = `${indent}  `;
  if (Array.isArray(v)) return `[\n${v.map((x) => `${next}${prettyJson(x, next, true)}`).join(',\n')}\n${indent}]`;
  const entries = Object.entries(v);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, x]) => `${next}${JSON.stringify(k)}: ${prettyJson(x, next, inValue || k === '$value' || k === '$extensions')}`).join(',\n')}\n${indent}}`;
}

define('fmt', {
  summary: 'rewrite token files in canonical DTCG 2025.10 form (hex -> color objects, "16px" -> {value, unit})',
  usage: 'design fmt [--check]\n\n  --check   write nothing; exit 1 listing files that would change',
  flags: { check: 'boolean' },
  run(ctx, { opts }, io) {
    const problems = [];
    const files = [...asArray(ctx.config.tokens), ...Object.values(ctx.config.themes)].map(toPosix);
    const system = loadSystem(ctx);
    const typeOf = (p) => {
      const rec = system.base.byPath.get(p);
      return rec ? system.base.typeOf(rec) : null;
    };
    const changed = [];
    for (const rel of files) {
      const doc = readJsonFile(ctx, rel, problems);
      if (!doc) continue;
      const fileOf = new Map();
      for (const rec of collectTokens(doc, fileOf, rel, [])) {
        const type = rec.type || typeOf(rec.path);
        if (type) rec.node.$value = normalizeRaw(rec.node.$value, type);
      }
      const content = `${prettyJson(doc)}\n`;
      const abs = path.resolve(ctx.root, rel);
      if (fs.readFileSync(abs, 'utf8') !== content) changed.push({ rel, abs, content });
    }
    printProblems(problems, io);
    if (opts.check) {
      for (const f of changed) io.out(`would change: ${f.rel}`);
      io.out(changed.length ? `design fmt --check: ${changed.length} file(s) not formatted` : 'design fmt --check: OK');
      return changed.length || problems.length ? 1 : 0;
    }
    writeFiles(changed);
    for (const f of changed) io.out(`formatted: ${f.rel}`);
    io.out(`design fmt: ${changed.length} file(s) changed`);
    return problems.length ? 1 : 0;
  },
});

// ---- help -------------------------------------------------------------------------

define('help', {
  summary: 'show this help',
  usage: 'design help [command]',
  run(_ctx, { positional }, io) {
    const name = positional[0];
    io.out(name && COMMANDS[name] ? COMMANDS[name].usage : usageText());
    return 0;
  },
});

// ---------------------------------------------------------------------------
// Entry point

// Runs the CLI; returns the exit code. `io` lets tests capture output.
export function run(argv, { cwd = process.cwd(), io } = {}) {
  const out = io || { out: (s) => process.stdout.write(`${s}\n`), err: (s) => process.stderr.write(`${s}\n`) };
  try {
    const [name, ...rest] = argv;
    if (!name || name === '--help' || name === '-h') {
      out.out(usageText());
      return name ? 0 : 2;
    }
    if (name === '--version' || name === '-v') {
      out.out(`design ${VERSION}`);
      return 0;
    }
    const cmd = COMMANDS[name];
    if (!cmd) {
      out.err(`design: unknown command "${name}"\n`);
      out.err(usageText());
      return 2;
    }
    const parsed = parseArgs(rest, cmd.flags);
    if (parsed.opts.help) {
      out.out(cmd.usage);
      return 0;
    }
    const ctx = name === 'help' ? null : createContext(path.resolve(cwd));
    return cmd.run(ctx, parsed, out);
  } catch (err) {
    if (err instanceof UserError) {
      out.err(`design: ${err.message}`);
      return err.exitCode;
    }
    throw err;
  }
}

export { contrastRatio, parseCssColor, parseHex, toHex, colorFromObject, suggestForeground, globToRegExp, expandBraces, prettyJson, normalizeRaw, cssName, slugify };

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = run(process.argv.slice(2));
}
