#!/usr/bin/env node
// docmap: make a Markdown docs tree navigable without an LLM.
// Zero dependencies. Node >= 20. See ../SKILL.md and ../README.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const VERSION = '0.1.0';
const CONFIG_FILE = 'docmap.json';
const STATUSES = ['draft', 'current', 'deprecated', 'superseded'];
const REQUIRED_KEYS = ['title', 'description', 'read_when'];
const TEMPLATES = ['doc', 'decision', 'learning', 'spec'];
const NUMBERED_FILE = /^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const DRAFT_MAX_AGE_DAYS = 30;
const LONG_DOC_LINES = 400;
const BODY_HITS_CAP = 10;
const HEADING_HITS_CAP = 3;

const DEFAULT_CONFIG = {
  roots: ['docs'],
  indexName: 'INDEX.md',
  exclude: ['**/assets/**', '**/node_modules/**'],
  numbered: ['docs/decisions', 'docs/learnings'],
  maxDescription: 160,
  templatesDir: '.claude/skills/docmap/templates',
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

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function relToRoot(ctx, abs) {
  return toPosix(path.relative(ctx.root, abs));
}

// Lowercase, strip diacritics. "Garantía" -> "garantia".
function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokens(text) {
  return normalize(text).split(/[^a-z0-9]+/).filter(Boolean);
}

function slugify(text) {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countWords(lines) {
  let n = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t) n += t.split(/\s+/).length;
  }
  return n;
}

function today() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function byName(a, b) {
  // Code-unit order: deterministic across locales, unlike localeCompare.
  return a < b ? -1 : a > b ? 1 : 0;
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
  const config = { ...DEFAULT_CONFIG };
  if (!fs.existsSync(file)) return config;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new UserError(`${CONFIG_FILE}: invalid JSON (${err.message})`);
  }
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (raw[key] !== undefined) config[key] = raw[key];
  }
  for (const key of ['roots', 'exclude', 'numbered']) {
    if (!Array.isArray(config[key])) throw new UserError(`${CONFIG_FILE}: "${key}" must be an array`);
  }
  if (!Number.isInteger(config.maxDescription) || config.maxDescription < 1) {
    throw new UserError(`${CONFIG_FILE}: "maxDescription" must be a positive integer`);
  }
  config.roots = config.roots.map((r) => r.replace(/\/+$/, ''));
  config.numbered = config.numbered.map((r) => r.replace(/\/+$/, ''));
  return config;
}

function createContext(cwd) {
  const root = findProjectRoot(cwd);
  const config = loadConfig(root);
  return {
    cwd,
    root,
    config,
    excludes: config.exclude.map(globToRegExp),
    numbered: new Set(config.numbered),
  };
}

function isExcluded(ctx, rel, isDir) {
  const probe = isDir ? `${rel}/` : rel;
  return ctx.excludes.some((re) => re.test(probe) || re.test(rel));
}

// Resolve a user-supplied path: relative to cwd if that exists, else to root.
function resolveUserPath(ctx, p) {
  const fromCwd = path.resolve(ctx.cwd, p);
  if (fs.existsSync(fromCwd)) return fromCwd;
  return path.resolve(ctx.root, p);
}

// ---------------------------------------------------------------------------
// Frontmatter parser (YAML subset: scalars, quoted strings, inline and block lists)

const PENDING = Symbol('pending');

function parseScalar(raw) {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    return splitInlineList(s.slice(1, -1)).map(parseScalar);
  }
  // Trailing comment on an unquoted scalar: "value # comment".
  return s.replace(/\s+#.*$/, '').trim();
}

function splitInlineList(inner) {
  const items = [];
  let current = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(current);
  return items.map((s) => s.trim()).filter((s) => s !== '');
}

// Returns { present, data, errors: [{line, message}], bodyStart } with 0-based bodyStart.
function parseFrontmatter(lines) {
  const result = { present: false, data: {}, errors: [], bodyStart: 0 };
  if ((lines[0] || '').trim() !== '---') return result;
  result.present = true;

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) {
    result.errors.push({ line: 1, message: 'frontmatter is not closed (no second "---")' });
    result.bodyStart = lines.length;
    return result;
  }
  result.bodyStart = end + 1;

  const data = result.data;
  let listKey = null;
  const settlePending = () => {
    if (listKey && data[listKey] === PENDING) data[listKey] = '';
    listKey = null;
  };

  for (let i = 1; i < end; i++) {
    const text = lines[i].trim();
    const lineNo = i + 1;
    if (!text || text.startsWith('#')) continue;

    if (text === '-' || text.startsWith('- ')) {
      if (!listKey) {
        result.errors.push({ line: lineNo, message: 'list item without a key' });
        continue;
      }
      if (data[listKey] === PENDING) data[listKey] = [];
      data[listKey].push(parseScalar(text.slice(1)));
      continue;
    }

    const m = /^([A-Za-z_][\w.-]*):(?:\s+(.*))?$/.exec(text);
    if (!m) {
      settlePending();
      result.errors.push({ line: lineNo, message: `expected "key: value", got "${text}"` });
      continue;
    }
    settlePending();
    const [, key, value] = m;
    if (Object.hasOwn(data, key)) {
      result.errors.push({ line: lineNo, message: `duplicate key "${key}"` });
      continue;
    }
    if (value === undefined || value === '') {
      data[key] = PENDING;
      listKey = key;
    } else if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      result.errors.push({ line: lineNo, message: `"${key}": multi-line values are not supported, use one line` });
    } else {
      data[key] = parseScalar(value);
    }
  }
  settlePending();
  return result;
}

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  return String(value);
}

// ---------------------------------------------------------------------------
// Documents and headings

function parseHeadings(lines, bodyStart) {
  const headings = [];
  let inFence = false;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (m) headings.push({ level: m[1].length, text: m[2], line: i + 1, slug: slugify(m[2]) });
  }
  return headings;
}

function loadDoc(ctx, abs) {
  const lines = readLines(abs);
  const fm = parseFrontmatter(lines);
  const name = path.basename(abs);
  return {
    abs,
    rel: relToRoot(ctx, abs),
    dir: toPosix(path.dirname(relToRoot(ctx, abs))),
    name,
    isReadme: name === 'README.md',
    lines,
    fm: fm.data,
    fmPresent: fm.present,
    fmErrors: fm.errors,
    bodyStart: fm.bodyStart,
    headings: parseHeadings(lines, fm.bodyStart),
    words: countWords(lines.slice(fm.bodyStart)),
    mtime: fs.statSync(abs).mtime,
  };
}

function docStatus(doc) {
  return typeof doc.fm.status === 'string' && doc.fm.status ? doc.fm.status : 'current';
}

function docTags(doc) {
  const t = doc.fm.tags;
  if (Array.isArray(t)) return t.map(String);
  if (typeof t === 'string' && t) return [t];
  return [];
}

// ---------------------------------------------------------------------------
// Tree scan

// A directory node: { rel, name, abs, readme, docs, subdirs, indexAbs, existingIndex }.
// Returns null when the directory holds no docs anywhere below it.
function scanDir(ctx, abs, rel) {
  const node = {
    rel,
    abs,
    name: path.basename(abs),
    readme: null,
    docs: [],
    subdirs: [],
    indexAbs: path.join(abs, ctx.config.indexName),
    existingIndex: null,
  };
  let entries;
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return null;
  }
  entries.sort((a, b) => byName(a.name, b.name));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    const childAbs = path.join(abs, entry.name);
    if (entry.isDirectory()) {
      if (isExcluded(ctx, childRel, true)) continue;
      const child = scanDir(ctx, childAbs, childRel);
      if (child) node.subdirs.push(child);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (isExcluded(ctx, childRel, false)) continue;
      if (entry.name === ctx.config.indexName) {
        node.existingIndex = fs.readFileSync(childAbs, 'utf8');
      } else if (entry.name === 'README.md') {
        node.readme = loadDoc(ctx, childAbs);
      } else {
        node.docs.push(loadDoc(ctx, childAbs));
      }
    }
  }
  if (!node.readme && node.docs.length === 0 && node.subdirs.length === 0) return null;
  return node;
}

function scanTree(ctx) {
  const roots = [];
  for (const rootRel of ctx.config.roots) {
    const abs = path.join(ctx.root, rootRel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
    const node = scanDir(ctx, abs, toPosix(rootRel));
    if (node) roots.push(node);
  }
  const dirs = [];
  const docs = [];
  const visit = (node) => {
    dirs.push(node);
    if (node.readme) docs.push(node.readme);
    docs.push(...node.docs);
    node.subdirs.forEach(visit);
  };
  roots.forEach(visit);
  return { roots, dirs, docs };
}

// Orphan indexes: INDEX.md files left in directories that no longer hold docs.
function findOrphanIndexes(ctx, tree) {
  const live = new Set(tree.dirs.map((d) => d.indexAbs));
  const orphans = [];
  const walk = (abs, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!isExcluded(ctx, childRel, true)) walk(childAbs, childRel);
      } else if (entry.name === ctx.config.indexName && !live.has(childAbs)) {
        orphans.push(childAbs);
      }
    }
  };
  for (const rootRel of ctx.config.roots) {
    const abs = path.join(ctx.root, rootRel);
    if (fs.existsSync(abs)) walk(abs, toPosix(rootRel));
  }
  return orphans;
}

// ---------------------------------------------------------------------------
// INDEX.md rendering

function cell(value) {
  return formatValue(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function linkTarget(name) {
  return /[\s()]/.test(name) ? `<${name}>` : name;
}

function renderIndex(ctx, node) {
  const readme = node.readme;
  const title = readme && typeof readme.fm.title === 'string' && readme.fm.title ? readme.fm.title : node.name;
  const out = [`# ${title}`, '', '_Generated by `docmap index`. Do not edit by hand._', ''];

  if (readme && typeof readme.fm.description === 'string' && readme.fm.description) {
    out.push(readme.fm.description, '');
  }

  if (node.subdirs.length) {
    out.push('## Directories', '', '| dir | description | read when |', '|---|---|---|');
    for (const sub of node.subdirs) {
      const fm = sub.readme ? sub.readme.fm : {};
      const description = fm.description || `(no README.md; ${sub.docs.length} docs, ${sub.subdirs.length} dirs)`;
      const target = `${sub.name}/${ctx.config.indexName}`;
      out.push(`| [${sub.name}/](${linkTarget(target)}) | ${cell(description)} | ${cell(fm.read_when)} |`);
    }
    out.push('');
  }

  if (node.docs.length) {
    out.push('## Documents', '', '| doc | description | read when | status | updated |', '|---|---|---|---|---|');
    for (const doc of node.docs) {
      const fm = doc.fm;
      out.push(
        `| [${doc.name}](${linkTarget(doc.name)}) | ${cell(fm.description)} | ${cell(fm.read_when)} | ${cell(docStatus(doc))} | ${cell(fm.updated)} |`,
      );
    }
    out.push('');
  }

  while (out.length && out[out.length - 1] === '') out.pop();
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Argument parsing

// spec: { flags: { name: 'string' | 'boolean' | 'number' }, positional: n (min) }
function parseArgs(argv, spec) {
  const opts = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
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
    if (name.startsWith('no-') && spec.flags[name.slice(3)] === 'boolean') {
      opts[name.slice(3)] = false;
      continue;
    }
    const type = spec.flags[name];
    if (!type) throw new UserError(`unknown option --${name}`, 2);
    if (type === 'boolean') {
      opts[name] = inline === undefined ? true : inline !== 'false';
      continue;
    }
    const value = inline !== undefined ? inline : argv[++i];
    if (value === undefined) throw new UserError(`--${name} needs a value`, 2);
    if (type === 'number') {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0) throw new UserError(`--${name} must be a non-negative integer`, 2);
      opts[name] = n;
    } else {
      opts[name] = value;
    }
  }
  return { opts, positional };
}

// ---------------------------------------------------------------------------
// Commands

const COMMANDS = {};

function define(name, { summary, usage, flags = {}, run }) {
  COMMANDS[name] = { name, summary, usage, flags, run };
}

function usageText() {
  const lines = ['usage: docmap <command> [options]', '', 'commands:'];
  for (const cmd of Object.values(COMMANDS)) {
    lines.push(`  ${cmd.name.padEnd(9)} ${cmd.summary}`);
  }
  lines.push('', 'Run "docmap <command> --help" for details. Project root: nearest docmap.json, else .git, else cwd.');
  return lines.join('\n');
}

// ---- index ----------------------------------------------------------------

function computeIndexChanges(ctx, tree) {
  const changes = [];
  for (const node of tree.dirs) {
    const expected = renderIndex(ctx, node);
    if (node.existingIndex === null) {
      changes.push({ kind: 'missing', abs: node.indexAbs, rel: relToRoot(ctx, node.indexAbs), content: expected });
    } else if (node.existingIndex !== expected) {
      changes.push({ kind: 'stale', abs: node.indexAbs, rel: relToRoot(ctx, node.indexAbs), content: expected });
    }
  }
  for (const abs of findOrphanIndexes(ctx, tree)) {
    changes.push({ kind: 'orphan', abs, rel: relToRoot(ctx, abs) });
  }
  return changes;
}

function applyIndexChanges(changes) {
  for (const change of changes) {
    if (change.kind === 'orphan') fs.unlinkSync(change.abs);
    else fs.writeFileSync(change.abs, change.content);
  }
}

define('index', {
  summary: 'regenerate every INDEX.md under the configured roots',
  usage: 'docmap index [--check]\n\n  --check   exit 1 if any index would change, without writing',
  flags: { check: 'boolean' },
  run(ctx, { opts }, io) {
    const tree = scanTree(ctx);
    if (!tree.dirs.length) {
      throw new UserError(`no docs found under roots: ${ctx.config.roots.join(', ')} (project root: ${toPosix(ctx.root)})`);
    }
    const changes = computeIndexChanges(ctx, tree);
    if (opts.check) {
      for (const c of changes) io.out(`${c.kind}: ${c.rel}`);
      if (changes.length) {
        io.out(`docmap index --check: ${changes.length} index(es) out of date, run "docmap index"`);
        return 1;
      }
      io.out(`docmap index --check: OK (${tree.dirs.length} indexes up to date)`);
      return 0;
    }
    applyIndexChanges(changes);
    for (const c of changes) io.out(`${c.kind === 'orphan' ? 'removed' : 'wrote'}: ${c.rel}`);
    io.out(`docmap index: ${tree.dirs.length} indexes, ${changes.length} changed`);
    return 0;
  },
});

// ---- find -----------------------------------------------------------------

const FIELD_WEIGHTS = [
  ['title', 10],
  ['tags', 8],
  ['description', 6],
  ['read_when', 6],
];

function fieldText(doc, field) {
  if (field === 'tags') return docTags(doc).join(' ');
  const v = doc.fm[field];
  return typeof v === 'string' ? v : '';
}

function matchesTerm(words, term) {
  let n = 0;
  for (const w of words) if (w.startsWith(term)) n++;
  return n;
}

function scoreDoc(doc, terms) {
  let score = 0;
  let fmScore = 0;
  const matched = new Set();
  const lineScores = new Map();
  const bump = (line, n) => lineScores.set(line, (lineScores.get(line) || 0) + n);

  for (const term of terms) {
    for (const [field, weight] of FIELD_WEIGHTS) {
      if (matchesTerm(tokens(fieldText(doc, field)), term) > 0) {
        score += weight;
        fmScore += weight;
        matched.add(term);
      }
    }
    let headingHits = 0;
    for (const h of doc.headings) {
      if (headingHits >= HEADING_HITS_CAP) break;
      if (matchesTerm(tokens(h.text), term) > 0) {
        headingHits++;
        score += 4;
        bump(h.line, 4);
        matched.add(term);
      }
    }
    let bodyHits = 0;
    const headingLines = new Set(doc.headings.map((h) => h.line));
    for (let i = doc.bodyStart; i < doc.lines.length && bodyHits < BODY_HITS_CAP; i++) {
      if (headingLines.has(i + 1)) continue;
      const n = matchesTerm(tokens(doc.lines[i]), term);
      if (n === 0) continue;
      const counted = Math.min(n, BODY_HITS_CAP - bodyHits);
      bodyHits += counted;
      score += counted;
      bump(i + 1, counted);
      matched.add(term);
    }
  }
  if (score === 0) return null;
  if (terms.length > 1 && matched.size === terms.length) score += 10;

  let bestLine = 0;
  let bestLineScore = 0;
  for (const [line, s] of lineScores) {
    if (s > bestLineScore || (s === bestLineScore && line < bestLine)) {
      bestLine = line;
      bestLineScore = s;
    }
  }
  if (fmScore >= bestLineScore) {
    return { score, line: 1, snippet: fieldText(doc, 'description') };
  }
  return { score, line: bestLine, snippet: doc.lines[bestLine - 1] };
}

function trimSnippet(line, terms, max = 100) {
  const text = line.trim();
  if (text.length <= max) return text;
  const norm = normalize(text);
  let at = -1;
  for (const term of terms) {
    const idx = norm.indexOf(term);
    if (idx >= 0 && (at < 0 || idx < at)) at = idx;
  }
  let start = Math.max(0, (at < 0 ? 0 : at) - 30);
  if (start + max > text.length) start = Math.max(0, text.length - max);
  const slice = text.slice(start, start + max);
  return `${start > 0 ? '...' : ''}${slice}${start + max < text.length ? '...' : ''}`;
}

define('find', {
  summary: 'ranked search across all docs',
  usage:
    'docmap find <terms...> [--in <dir>] [--tag <t>] [--status <s>] [--limit N] [--json]\n\n' +
    '  Matching is case- and diacritic-insensitive prefix match on words.\n' +
    '  Weights: title 10, tags 8, description 6, read_when 6, heading 4, body 1 per hit (capped), +10 if all terms hit.\n' +
    '  Output: <path>:<line>  score=<n>  <title> — <snippet>',
  flags: { in: 'string', tag: 'string', status: 'string', limit: 'number', json: 'boolean' },
  run(ctx, { opts, positional }, io) {
    const terms = positional.flatMap((t) => tokens(t));
    if (!terms.length) throw new UserError('find: give at least one search term', 2);
    const limit = opts.limit ?? 15;
    const tree = scanTree(ctx);
    let docs = tree.docs;

    if (opts.in) {
      const abs = resolveUserPath(ctx, opts.in);
      const prefix = relToRoot(ctx, abs).replace(/\/+$/, '');
      docs = docs.filter((d) => d.rel === prefix || d.rel.startsWith(`${prefix}/`));
    }
    if (opts.tag) {
      const tag = normalize(opts.tag);
      docs = docs.filter((d) => docTags(d).some((t) => normalize(t) === tag));
    }
    if (opts.status) docs = docs.filter((d) => docStatus(d) === opts.status);

    const hits = [];
    for (const doc of docs) {
      const s = scoreDoc(doc, terms);
      if (s) hits.push({ path: doc.rel, line: s.line, score: s.score, title: fieldText(doc, 'title') || doc.name, snippet: trimSnippet(s.snippet, terms) });
    }
    hits.sort((a, b) => b.score - a.score || byName(a.path, b.path));
    const shown = limit > 0 ? hits.slice(0, limit) : hits;

    if (opts.json) {
      io.out(JSON.stringify(shown, null, 2));
      return 0;
    }
    if (!shown.length) {
      io.out(`no matches for: ${terms.join(' ')}`);
      return 1;
    }
    for (const h of shown) io.out(`${h.path}:${h.line}  score=${h.score}  ${h.title} — ${h.snippet}`);
    if (hits.length > shown.length) io.out(`(${hits.length - shown.length} more, raise --limit)`);
    return 0;
  },
});

// ---- outline / section / show --------------------------------------------

function loadDocArg(ctx, file, command) {
  if (!file) throw new UserError(`${command}: missing <file> argument`, 2);
  const abs = resolveUserPath(ctx, file);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new UserError(`${command}: file not found: ${file}`);
  return loadDoc(ctx, abs);
}

// End line (exclusive, 1-based) of the section starting at headings[idx].
function sectionEnd(doc, idx, withChildren) {
  const start = doc.headings[idx];
  for (let j = idx + 1; j < doc.headings.length; j++) {
    const h = doc.headings[j];
    if (!withChildren || h.level <= start.level) return h.line;
  }
  return doc.lines.length + 1;
}

function sectionWords(doc, idx) {
  const start = doc.headings[idx];
  const end = sectionEnd(doc, idx, true);
  return countWords(doc.lines.slice(start.line, end - 1));
}

function outlineLines(doc) {
  const width = String(doc.lines.length).length;
  return doc.headings.map((h, i) => `${String(h.line).padStart(width)}  ${'#'.repeat(h.level).padEnd(6)} ${h.text} (${sectionWords(doc, i)}w)`);
}

function printFrontmatterSummary(doc, io) {
  io.out(`title: ${formatValue(doc.fm.title ?? '')}`);
  io.out(`description: ${formatValue(doc.fm.description ?? '')}`);
}

define('outline', {
  summary: 'headings of a doc with line numbers and section word counts',
  usage: 'docmap outline <file>\n\n  Word count covers the section including its subsections (what "section" prints by default).',
  run(ctx, { positional }, io) {
    const doc = loadDocArg(ctx, positional[0], 'outline');
    printFrontmatterSummary(doc, io);
    io.out('');
    if (!doc.headings.length) {
      io.out(`(no headings; ${doc.lines.length} lines, ${doc.words} words)`);
      return 0;
    }
    for (const line of outlineLines(doc)) io.out(line);
    return 0;
  },
});

function findHeading(doc, query) {
  const wanted = normalize(query).trim();
  const wantedSlug = slugify(query);
  const exact = doc.headings.filter((h) => normalize(h.text).trim() === wanted || h.slug === wantedSlug);
  const candidates = exact.length ? exact : doc.headings.filter((h) => normalize(h.text).startsWith(wanted) || h.slug.startsWith(wantedSlug));
  if (candidates.length === 1) return doc.headings.indexOf(candidates[0]);
  if (!candidates.length) {
    const list = doc.headings.map((h) => `  ${h.line}  ${h.text}`).join('\n');
    throw new UserError(`${doc.rel}: no heading matches "${query}". Headings:\n${list}`);
  }
  const list = candidates.map((h) => `  ${h.line}  ${h.text}`).join('\n');
  throw new UserError(`${doc.rel}: "${query}" is ambiguous, use the full text, its slug or --lines:\n${list}`);
}

function parseLineRange(spec, doc) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(spec);
  if (!m) throw new UserError(`--lines expects START-END, got "${spec}"`, 2);
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  if (start < 1 || end < start) throw new UserError(`--lines: invalid range "${spec}"`, 2);
  if (start > doc.lines.length) throw new UserError(`--lines: ${doc.rel} has only ${doc.lines.length} lines`);
  return [start, Math.min(end, doc.lines.length)];
}

define('section', {
  summary: 'print one section of a doc (by heading text or slug, or a line range)',
  usage:
    'docmap section <file> <heading> [--with-children|--no-children]\n' +
    'docmap section <file> --lines 40-80\n\n' +
    '  <heading> is exact text (case-insensitive), a slug like "criterios-de-aceptacion", or a unique prefix.\n' +
    '  Subsections are included by default; --no-children stops at the next heading of any level.',
  flags: { 'with-children': 'boolean', children: 'boolean', lines: 'string' },
  run(ctx, { opts, positional }, io) {
    const doc = loadDocArg(ctx, positional[0], 'section');
    let start;
    let end;
    if (opts.lines) {
      [start, end] = parseLineRange(opts.lines, doc);
      end += 1;
    } else {
      if (!positional[1]) throw new UserError('section: give a <heading> or --lines START-END', 2);
      const idx = findHeading(doc, positional[1]);
      const withChildren = opts.children !== false && opts['with-children'] !== false;
      start = doc.headings[idx].line;
      end = sectionEnd(doc, idx, withChildren);
    }
    const lines = doc.lines.slice(start - 1, end - 1);
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    io.out(`${doc.rel}:${start}-${start + lines.length - 1}`);
    for (const line of lines) io.out(line);
    return 0;
  },
});

define('show', {
  summary: 'frontmatter plus outline: the cheap way to inspect a doc',
  usage: 'docmap show <file>',
  run(ctx, { positional }, io) {
    const doc = loadDocArg(ctx, positional[0], 'show');
    io.out(`path: ${doc.rel}`);
    for (const [key, value] of Object.entries(doc.fm)) io.out(`${key}: ${formatValue(value)}`);
    if (!doc.fmPresent) io.out('(no frontmatter)');
    io.out(`lines: ${doc.lines.length}`);
    io.out(`words: ${doc.words}`);
    io.out('');
    if (!doc.headings.length) {
      io.out('(no headings)');
      return 0;
    }
    for (const line of outlineLines(doc)) io.out(line);
    return 0;
  },
});

// ---- check ----------------------------------------------------------------

function isNumberedDir(ctx, dirRel) {
  return ctx.numbered.has(dirRel);
}

const LINK_RE = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function checkLinks(ctx, doc, report) {
  let inFence = false;
  for (let i = doc.bodyStart; i < doc.lines.length; i++) {
    const line = doc.lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const stripped = line.replace(/`[^`]*`/g, '');
    for (const m of stripped.matchAll(LINK_RE)) {
      const target = m[1].replace(/^<|>$/g, '');
      if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const file = decodeURIComponent(target.split('#')[0].split('?')[0]);
      if (!file) continue;
      const abs = file.startsWith('/') ? path.join(ctx.root, file) : path.resolve(path.dirname(doc.abs), file);
      if (!fs.existsSync(abs)) report('error', doc.rel, i + 1, `broken link: ${target}`);
    }
  }
}

function checkFrontmatter(ctx, doc, report) {
  if (!doc.fmPresent) {
    report('error', doc.rel, 1, 'missing frontmatter (title, description, read_when)');
    return false;
  }
  for (const e of doc.fmErrors) report('error', doc.rel, e.line, `invalid frontmatter: ${e.message}`);
  if (doc.fmErrors.length) return false;

  let ok = true;
  const fm = doc.fm;
  for (const key of REQUIRED_KEYS) {
    if (typeof fm[key] !== 'string' || !fm[key].trim()) {
      report('error', doc.rel, 1, `missing required frontmatter key "${key}"`);
      ok = false;
    }
  }
  const max = ctx.config.maxDescription;
  if (typeof fm.description === 'string' && fm.description.length > max) {
    report('error', doc.rel, 1, `description is ${fm.description.length} chars, max ${max}`);
    ok = false;
  }
  if (fm.status !== undefined && !STATUSES.includes(fm.status)) {
    report('error', doc.rel, 1, `invalid status "${formatValue(fm.status)}", expected one of: ${STATUSES.join(', ')}`);
    ok = false;
  }
  if (fm.updated !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(fm.updated))) {
    report('error', doc.rel, 1, `"updated" must be YYYY-MM-DD, got "${formatValue(fm.updated)}"`);
    ok = false;
  }
  if (fm.tags !== undefined && !Array.isArray(fm.tags)) {
    report('error', doc.rel, 1, '"tags" must be a list, e.g. [a, b]');
    ok = false;
  }
  for (const key of ['id', 'supersedes', 'area']) {
    if (fm[key] !== undefined && typeof fm[key] !== 'string') {
      report('error', doc.rel, 1, `"${key}" must be a string`);
      ok = false;
    }
  }
  return ok;
}

function checkWarnings(doc, report) {
  if (doc.lines.length > LONG_DOC_LINES) {
    report('warning', doc.rel, null, `${doc.lines.length} lines; consider splitting so agents can read sections`);
  }
  if (docStatus(doc) === 'draft') {
    const since = typeof doc.fm.updated === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(doc.fm.updated) ? new Date(doc.fm.updated) : doc.mtime;
    const ageDays = (Date.now() - since.getTime()) / 86400000;
    if (ageDays > DRAFT_MAX_AGE_DAYS) report('warning', doc.rel, null, `draft for ${Math.floor(ageDays)} days; finish it or mark it deprecated`);
  }
}

function checkNumberedDirs(ctx, tree, report) {
  for (const node of tree.dirs) {
    if (!isNumberedDir(ctx, node.rel)) continue;
    const seen = new Map();
    for (const doc of node.docs) {
      const m = NUMBERED_FILE.exec(doc.name);
      if (!m) {
        report('error', doc.rel, null, `file in numbered dir must be named NNNN-slug.md (use "docmap new ${node.rel} ...")`);
        continue;
      }
      if (seen.has(m[1])) report('error', doc.rel, null, `number ${m[1]} already used by ${seen.get(m[1])}`);
      else seen.set(m[1], doc.rel);
    }
  }
}

function checkIds(tree, report) {
  const ids = new Map();
  for (const doc of tree.docs) {
    const id = doc.fm.id;
    if (typeof id !== 'string' || !id) continue;
    if (ids.has(id)) report('error', doc.rel, 1, `duplicate id "${id}", also in ${ids.get(id)}`);
    else ids.set(id, doc.rel);
  }
  for (const doc of tree.docs) {
    const target = doc.fm.supersedes;
    if (typeof target === 'string' && target && !ids.has(target)) {
      report('error', doc.rel, 1, `supersedes unknown id "${target}"`);
    }
  }
}

function runCheck(ctx, io) {
  const tree = scanTree(ctx);
  const problems = [];
  const report = (level, file, line, message) => problems.push({ level, file, line, message });

  for (const doc of tree.docs) {
    checkFrontmatter(ctx, doc, report);
    checkLinks(ctx, doc, report);
    checkWarnings(doc, report);
  }
  checkIds(tree, report);
  checkNumberedDirs(ctx, tree, report);
  for (const change of computeIndexChanges(ctx, tree)) {
    const hint = change.kind === 'orphan' ? 'directory has no docs; delete it' : 'run "docmap index"';
    report('error', change.rel, null, `${change.kind} ${ctx.config.indexName}: ${hint}`);
  }

  problems.sort((a, b) => byName(a.file, b.file) || (a.line || 0) - (b.line || 0));
  for (const p of problems) io.out(`${p.level}: ${p.file}${p.line ? `:${p.line}` : ''}: ${p.message}`);
  const errors = problems.filter((p) => p.level === 'error').length;
  const warnings = problems.length - errors;
  if (errors) {
    io.out(`docmap check: ${errors} error(s), ${warnings} warning(s)`);
    return 1;
  }
  io.out(`docmap check: OK (${tree.docs.length} docs, ${tree.dirs.length} dirs${warnings ? `, ${warnings} warning(s)` : ''})`);
  return 0;
}

define('check', {
  summary: 'lint frontmatter, links, numbering and indexes (exit 1 on errors)',
  usage: 'docmap check [--fix]\n\n  --fix   regenerate indexes first, then check',
  flags: { fix: 'boolean' },
  run(ctx, { opts }, io) {
    if (opts.fix) {
      const tree = scanTree(ctx);
      const changes = computeIndexChanges(ctx, tree);
      applyIndexChanges(changes);
      for (const c of changes) io.out(`fixed: ${c.rel}`);
    }
    return runCheck(ctx, io);
  },
});

// ---- new ------------------------------------------------------------------

function templatesDir(ctx) {
  const configured = path.resolve(ctx.root, ctx.config.templatesDir);
  if (fs.existsSync(configured)) return configured;
  const own = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
  if (fs.existsSync(own)) return own;
  throw new UserError(`templates dir not found: ${ctx.config.templatesDir} (set "templatesDir" in ${CONFIG_FILE})`);
}

function defaultTemplate(dirRel) {
  const segments = dirRel.split('/');
  if (segments.includes('decisions')) return 'decision';
  if (segments.includes('learnings')) return 'learning';
  if (segments.includes('specs')) return 'spec';
  return 'doc';
}

function nextNumber(dirAbs) {
  let max = 0;
  for (const name of fs.readdirSync(dirAbs)) {
    const m = /^(\d{4})-/.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return String(max + 1).padStart(4, '0');
}

function fillPlaceholders(text, values) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) => (values[key] !== undefined ? values[key] : m));
}

// Quote a value for the frontmatter when YAML would otherwise misread it.
function yamlScalar(value) {
  const s = String(value);
  if (s === '' || s.startsWith('[')) return s;
  if (/: | #|^[-'"&*!|>%@`{}]|^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

// Frontmatter placeholders get YAML-safe values; body placeholders get raw text.
function fillTemplate(text, values) {
  const m = /^---\n[\s\S]*?\n---\n/.exec(text);
  if (!m) return fillPlaceholders(text, values);
  const safe = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, yamlScalar(v)]));
  return fillPlaceholders(m[0], safe) + fillPlaceholders(text.slice(m[0].length), values);
}

define('new', {
  summary: 'scaffold a doc from a template, then reindex',
  usage:
    'docmap new <dir> "<title>" [--template doc|decision|learning|spec] [--tags a,b] [--description "..."] [--read-when "..."]\n\n' +
    '  Template defaults to decision/learning/spec when <dir> contains decisions/, learnings/ or specs/, else doc.\n' +
    '  In numbered dirs the file is NNNN-<slug>.md with the next free number.',
  flags: { template: 'string', tags: 'string', description: 'string', 'read-when': 'string' },
  run(ctx, { opts, positional }, io) {
    const [dirArg, title] = positional;
    if (!dirArg || !title) throw new UserError('new: usage: docmap new <dir> "<title>"', 2);
    const slug = slugify(title);
    if (!slug) throw new UserError(`new: title "${title}" produces an empty slug`);

    const dirAbs = resolveUserPath(ctx, dirArg);
    const dirRel = relToRoot(ctx, dirAbs);
    if (!ctx.config.roots.some((r) => dirRel === r || dirRel.startsWith(`${r}/`))) {
      throw new UserError(`new: ${dirRel} is not under a configured root (${ctx.config.roots.join(', ')})`);
    }
    const template = opts.template || defaultTemplate(dirRel);
    if (!TEMPLATES.includes(template)) throw new UserError(`new: unknown template "${template}", expected one of: ${TEMPLATES.join(', ')}`, 2);
    const templateFile = path.join(templatesDir(ctx), `${template}.md`);
    if (!fs.existsSync(templateFile)) throw new UserError(`new: template file not found: ${toPosix(templateFile)}`);

    fs.mkdirSync(dirAbs, { recursive: true });
    const numbered = isNumberedDir(ctx, dirRel);
    const number = numbered ? nextNumber(dirAbs) : null;
    const fileName = numbered ? `${number}-${slug}.md` : `${slug}.md`;
    const fileAbs = path.join(dirAbs, fileName);
    if (fs.existsSync(fileAbs)) throw new UserError(`new: refusing to overwrite existing file: ${relToRoot(ctx, fileAbs)}`);

    const tags = opts.tags ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const values = {
      title,
      description: opts.description || '',
      read_when: opts['read-when'] || '',
      date: today(),
      id: numbered ? `${path.basename(dirRel)}-${number}` : slug,
      tags: `[${tags.join(', ')}]`,
      status: 'current',
      slug,
    };
    fs.writeFileSync(fileAbs, fillTemplate(fs.readFileSync(templateFile, 'utf8'), values));

    const tree = scanTree(ctx);
    applyIndexChanges(computeIndexChanges(ctx, tree));
    io.out(relToRoot(ctx, fileAbs));
    if (!values.description || !values.read_when) io.out('fill in description and read_when, then run "docmap index"');
    return 0;
  },
});

// ---- stats ----------------------------------------------------------------

define('stats', {
  summary: 'docs, dirs, word counts and the largest docs (reading cost estimate)',
  usage: 'docmap stats',
  run(ctx, _args, io) {
    const tree = scanTree(ctx);
    const total = tree.docs.reduce((n, d) => n + d.words, 0);
    io.out(`docs: ${tree.docs.length}`);
    io.out(`dirs: ${tree.dirs.length}`);
    io.out(`words: ${total} (~${Math.round(total * 1.3)} tokens)`);
    io.out('');
    io.out('words per dir:');
    for (const node of tree.dirs) {
      const docs = node.readme ? [node.readme, ...node.docs] : node.docs;
      const words = docs.reduce((n, d) => n + d.words, 0);
      io.out(`  ${String(words).padStart(7)}  ${node.rel}/ (${docs.length} docs)`);
    }
    io.out('');
    io.out('largest docs:');
    const largest = [...tree.docs].sort((a, b) => b.words - a.words || byName(a.rel, b.rel)).slice(0, 5);
    for (const doc of largest) io.out(`  ${String(doc.words).padStart(7)}w  ${String(doc.lines.length).padStart(5)} lines  ${doc.rel}`);
    return 0;
  },
});

// ---- help -----------------------------------------------------------------

define('help', {
  summary: 'show this help',
  usage: 'docmap help [command]',
  run(_ctx, { positional }, io) {
    const name = positional[0];
    if (name && COMMANDS[name]) {
      io.out(COMMANDS[name].usage);
      return 0;
    }
    io.out(usageText());
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
      out.out(`docmap ${VERSION}`);
      return 0;
    }
    const cmd = COMMANDS[name];
    if (!cmd) {
      out.err(`docmap: unknown command "${name}"\n`);
      out.err(usageText());
      return 2;
    }
    const parsed = parseArgs(rest, { flags: cmd.flags });
    if (parsed.opts.help) {
      out.out(cmd.usage);
      return 0;
    }
    const ctx = name === 'help' ? null : createContext(path.resolve(cwd));
    return cmd.run(ctx, parsed, out);
  } catch (err) {
    if (err instanceof UserError) {
      out.err(`docmap: ${err.message}`);
      return err.exitCode;
    }
    throw err;
  }
}

export { parseFrontmatter, renderIndex, slugify, normalize, globToRegExp };

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
