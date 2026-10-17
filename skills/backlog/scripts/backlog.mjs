#!/usr/bin/env node
// backlog - file-based issue tracker for agents and humans.
// Node >= 20, ESM, zero dependencies, synchronous fs, no network.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_CONFIG = {
  dir: 'backlog',
  prefix: 'ISS',
  statuses: ['backlog', 'todo', 'in-progress', 'blocked', 'review', 'done', 'cancelled'],
  priorities: ['P0', 'P1', 'P2', 'P3'],
  kinds: ['epic', 'feature', 'bug', 'chore', 'spike', 'decision'],
  areas: [],
  progressDir: 'progress',
  staleDays: 7,
  verify: 'pnpm verify',
};

const KNOWN_KEYS = ['id', 'title', 'kind', 'status', 'priority', 'area', 'parent', 'depends_on',
  'created', 'updated', 'due', 'owner', 'branch', 'estimate', 'tags'];
const REQUIRED_KEYS = ['id', 'title', 'kind', 'status', 'priority', 'created', 'updated'];
const LIST_KEYS = ['depends_on', 'tags'];
const ESTIMATES = ['S', 'M', 'L', 'XL'];
const CLOSED = ['done', 'cancelled'];
const SECTION_CRITERIA = 'Acceptance criteria';

class UserError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

// ---------------------------------------------------------------------------
// Time helpers (BACKLOG_NOW=ISO-date overrides the clock, used by tests)

function now() {
  const override = process.env.BACKLOG_NOW;
  const d = override ? new Date(override) : new Date();
  if (Number.isNaN(d.getTime())) throw new UserError('BACKLOG_NOW is not a valid date');
  return d;
}

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => fmtDate(now());
const stamp = () => `${fmtDate(now())} ${pad2(now().getHours())}:${pad2(now().getMinutes())}`;

function isDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function daysSince(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((now().getTime() - new Date(y, m - 1, d).getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Project root and config

function findRoot(start) {
  for (const marker of ['backlog.json', '.git']) {
    let dir = start;
    for (;;) {
      if (fs.existsSync(path.join(dir, marker))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return start;
}

function loadConfig(root) {
  const file = path.join(root, 'backlog.json');
  if (!fs.existsSync(file)) return { ...DEFAULT_CONFIG };
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new UserError(`backlog.json: invalid JSON (${e.message})`);
  }
  const cfg = { ...DEFAULT_CONFIG, ...parsed };
  for (const key of ['statuses', 'priorities', 'kinds', 'areas']) {
    if (!Array.isArray(cfg[key])) throw new UserError(`backlog.json: "${key}" must be an array`);
  }
  for (const s of ['todo', 'in-progress', 'blocked', 'done', 'cancelled']) {
    if (!cfg.statuses.includes(s)) throw new UserError(`backlog.json: "statuses" must include "${s}"`);
  }
  return cfg;
}

function makeContext(cwd) {
  const root = findRoot(cwd);
  const cfg = loadConfig(root);
  const dir = path.join(root, cfg.dir);
  return {
    root,
    cfg,
    dir,
    issuesDir: path.join(dir, 'issues'),
    indexFile: path.join(dir, 'INDEX.md'),
    progressDir: path.join(root, cfg.progressDir),
    rel: (abs) => path.relative(root, abs).split(path.sep).join('/'),
  };
}

// ---------------------------------------------------------------------------
// Frontmatter: tiny YAML subset (key: value, quoted strings, inline and block arrays,
// empty values, comments). Serialising preserves key order and unknown keys.

function parseScalar(raw) {
  const s = raw.trim();
  if (s.startsWith('"')) {
    const end = findClosingQuote(s, '"');
    return s.slice(1, end).replace(/\\(["\\])/g, '$1');
  }
  if (s.startsWith("'")) {
    const end = findClosingQuote(s, "'");
    return s.slice(1, end).replace(/''/g, "'");
  }
  return s.replace(/\s+#.*$/, '').trim();
}

function findClosingQuote(s, q) {
  for (let i = 1; i < s.length; i++) {
    if (q === '"' && s[i] === '\\') { i++; continue; }
    if (s[i] === q) {
      if (q === "'" && s[i + 1] === "'") { i++; continue; }
      return i;
    }
  }
  return s.length;
}

function parseInlineArray(raw, where) {
  const close = raw.lastIndexOf(']');
  if (close === -1) throw new UserError(`${where}: unterminated inline array`);
  const inner = raw.slice(1, close);
  const items = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && quote === '"') { cur += inner[++i] ?? ''; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === ',') { items.push(cur); cur = ''; continue; }
    cur += ch;
  }
  items.push(cur);
  return items.map((x) => x.trim()).filter((x) => x !== '').map(parseScalar);
}

function parseFrontmatter(text, where) {
  if (!text.startsWith('---\n')) throw new UserError(`${where}: missing frontmatter (file must start with ---)`);
  const end = text.indexOf('\n---\n', 3);
  if (end === -1) throw new UserError(`${where}: unterminated frontmatter (no closing ---)`);
  const lines = text.slice(4, end).split('\n');
  const body = text.slice(end + 5);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const m = /^([A-Za-z_][\w-]*):(?:\s(.*))?$/.exec(line);
    if (!m) throw new UserError(`${where}: cannot parse frontmatter line ${i + 1}: "${line}"`);
    const key = m[1];
    const raw = (m[2] ?? '').trim();
    if (raw === '' || raw.startsWith('#')) {
      const items = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-(\s|$)/.test(lines[j])) {
        items.push(parseScalar(lines[j].replace(/^\s*-\s?/, '')));
        j++;
      }
      if (j > i + 1) { data[key] = items; i = j - 1; } else data[key] = '';
    } else if (raw.startsWith('[')) {
      data[key] = parseInlineArray(raw, `${where}: ${key}`);
    } else {
      data[key] = parseScalar(raw);
    }
  }
  return { data, body };
}

function yamlQuote(s) {
  if (s === '') return '""';
  const needs = /[:#\[\]{},"'`|>&*!%@\\]/.test(s) || /^[-?\s]/.test(s) || /\s$/.test(s)
    || /^(true|false|null|yes|no|~)$/i.test(s);
  return needs ? `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : s;
}

function serializeFrontmatter(data) {
  const out = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) out.push(`${key}: [${value.map((v) => yamlQuote(String(v))).join(', ')}]`);
    else if (value === '' || value == null) out.push(`${key}:`);
    else out.push(`${key}: ${yamlQuote(String(value))}`);
  }
  out.push('---');
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Markdown body sections ("## Name" headings)

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findSection(lines, name) {
  const re = new RegExp(`^##\\s+${escapeRe(name)}\\s*$`, 'i');
  const start = lines.findIndex((l) => re.test(l));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
  return { start, end };
}

function getSection(body, name) {
  const lines = body.split('\n');
  const r = findSection(lines, name);
  return r ? lines.slice(r.start + 1, r.end).join('\n').trim() : null;
}

function setSection(body, name, text) {
  const content = text.trim() === '' ? [] : text.trim().split('\n');
  const block = [`## ${name}`, ...content, ''];
  const lines = body.replace(/\n*$/, '\n').split('\n');
  const r = findSection(lines, name);
  if (!r) {
    const base = body.trim() === '' ? '' : `${body.replace(/\n*$/, '')}\n\n`;
    return `${base}${block.join('\n')}`;
  }
  const tail = lines.slice(r.end);
  const merged = [...lines.slice(0, r.start), ...block, ...tail];
  return merged.join('\n');
}

function appendToSection(body, name, line) {
  const existing = getSection(body, name);
  return setSection(body, name, existing ? `${existing}\n${line}` : line);
}

const stripComments = (s) => (s ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();

function criteriaOf(body) {
  const text = getSection(body, SECTION_CRITERIA) ?? '';
  const items = text.split('\n').filter((l) => /^\s*[-*]\s+\[[ xX]\]/.test(l));
  return {
    all: items,
    unchecked: items.filter((l) => /\[ \]/.test(l)),
  };
}

function logLines(body) {
  return (getSection(body, 'Log') ?? '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- '));
}

// ---------------------------------------------------------------------------
// Issue store

function normalizeId(ctx, raw) {
  const m = new RegExp(`^(?:${escapeRe(ctx.cfg.prefix)}-)?(\\d+)$`, 'i').exec(String(raw).trim());
  if (!m) throw new UserError(`invalid issue id "${raw}" (expected ${ctx.cfg.prefix}-0001 or 1)`);
  return `${ctx.cfg.prefix}-${m[1].padStart(4, '0')}`;
}

function readIssue(ctx, file) {
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (!text.endsWith('\n')) text += '\n';
  const { data, body } = parseFrontmatter(text, ctx.rel(file));
  for (const key of LIST_KEYS) {
    if (!(key in data)) continue; // never add keys the file did not have
    if (data[key] === '' || data[key] == null) data[key] = [];
    else if (!Array.isArray(data[key])) data[key] = String(data[key]).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return { file, rel: ctx.rel(file), fm: data, body };
}

function writeIssue(issue) {
  fs.writeFileSync(issue.file, serializeFrontmatter(issue.fm) + issue.body);
}

function issueFiles(ctx) {
  if (!fs.existsSync(ctx.issuesDir)) return [];
  return fs.readdirSync(ctx.issuesDir).filter((f) => f.endsWith('.md')).sort()
    .map((f) => path.join(ctx.issuesDir, f));
}

// strict: throw on first problem. Otherwise collect problems (used by check).
function loadIssues(ctx, { strict = true } = {}) {
  const issues = [];
  const problems = [];
  const seen = new Map();
  for (const file of issueFiles(ctx)) {
    let issue;
    try {
      issue = readIssue(ctx, file);
    } catch (e) {
      if (strict || !(e instanceof UserError)) throw e;
      problems.push(e.message);
      continue;
    }
    const id = issue.fm.id;
    if (id && seen.has(id)) {
      const msg = `${issue.rel}: duplicate id ${id} (also in ${seen.get(id)})`;
      if (strict) throw new UserError(msg);
      problems.push(msg);
    }
    if (id) seen.set(id, issue.rel);
    issues.push(issue);
  }
  const byId = new Map(issues.filter((i) => i.fm.id).map((i) => [i.fm.id, i]));
  return { issues, byId, problems };
}

function getIssue(ctx, store, rawId) {
  const id = normalizeId(ctx, rawId);
  const issue = store.byId.get(id);
  if (!issue) throw new UserError(`issue ${id} not found in ${ctx.rel(ctx.issuesDir)}/`);
  return issue;
}

function nextId(ctx, store) {
  let max = 0;
  const re = new RegExp(`^${escapeRe(ctx.cfg.prefix)}-(\\d+)`, 'i');
  const consider = (s) => { const m = re.exec(s ?? ''); if (m) max = Math.max(max, Number(m[1])); };
  for (const file of issueFiles(ctx)) consider(path.basename(file));
  for (const issue of store.issues) consider(issue.fm.id);
  return `${ctx.cfg.prefix}-${String(max + 1).padStart(4, '0')}`;
}

function slugify(title) {
  const s = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return s || 'issue';
}

function progressFile(ctx, id) {
  return path.join(ctx.progressDir, `${id}.md`);
}

function readTemplate(ctx, name) {
  const candidates = [path.join(ctx.dir, 'templates', name), path.join(SKILL_DIR, 'templates', name)];
  const found = candidates.find((f) => fs.existsSync(f));
  if (!found) throw new UserError(`template ${name} not found (looked in ${candidates.map((c) => ctx.rel(c)).join(', ')})`);
  return fs.readFileSync(found, 'utf8').replace(/\r\n/g, '\n');
}

function fillTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? '')).replace(/\n{3,}/g, '\n\n');
}

function defaultOwner() {
  return process.env.BACKLOG_OWNER || os.userInfo().username || 'agent';
}

// ---------------------------------------------------------------------------
// Validation

function validateField(ctx, store, fm, key, value) {
  const { cfg } = ctx;
  const inList = (list, label) => (list.includes(value) ? null : `${key}: "${value}" is not a valid ${label} (${list.join(', ')})`);
  switch (key) {
    case 'id': return /^[A-Za-z]+-\d+$/.test(value) ? null : `id: "${value}" is malformed`;
    case 'title': return String(value).trim() ? null : 'title: must not be empty';
    case 'status': return inList(cfg.statuses, 'status');
    case 'priority': return inList(cfg.priorities, 'priority');
    case 'kind': return inList(cfg.kinds, 'kind');
    case 'area': return !value || cfg.areas.length === 0 ? null : inList(cfg.areas, 'area');
    case 'estimate': return !value ? null : inList(ESTIMATES, 'estimate');
    case 'created': case 'updated': return isDate(value) ? null : `${key}: "${value}" is not a YYYY-MM-DD date`;
    case 'due': return !value || isDate(value) ? null : `due: "${value}" is not a YYYY-MM-DD date`;
    case 'parent':
      if (!value) return null;
      if (!store.byId.has(value)) return `parent: unknown issue ${value}`;
      return value === fm.id ? 'parent: an issue cannot be its own parent' : null;
    case 'depends_on': {
      if (!Array.isArray(value)) return 'depends_on: must be a list';
      for (const dep of value) {
        if (!store.byId.has(dep)) return `depends_on: unknown issue ${dep}`;
        if (dep === fm.id) return 'depends_on: an issue cannot depend on itself';
      }
      return null;
    }
    default: return null;
  }
}

// Returns the cycle path (array of ids) if following `key` from `startId` loops, else null.
function findCycle(store, startId, key, override) {
  const edges = (id) => {
    const fm = override && override.id === id ? override : store.byId.get(id)?.fm;
    if (!fm) return [];
    return key === 'parent' ? (fm.parent ? [fm.parent] : []) : (fm.depends_on ?? []);
  };
  const stack = [];
  const visit = (id, seen) => {
    if (stack.includes(id)) return [...stack.slice(stack.indexOf(id)), id];
    if (seen.has(id)) return null;
    seen.add(id);
    stack.push(id);
    for (const next of edges(id)) {
      const found = visit(next, seen);
      if (found) return found;
    }
    stack.pop();
    return null;
  };
  return visit(startId, new Set());
}

function unmetDeps(store, fm) {
  return (fm.depends_on ?? []).filter((d) => store.byId.get(d)?.fm.status !== 'done');
}

function otherInProgress(store, owner, exceptId) {
  return store.issues.find((i) => i.fm.status === 'in-progress' && i.fm.owner === owner && i.fm.id !== exceptId);
}

function checkTransition(ctx, store, issue, next, { force }) {
  const from = issue.fm.status;
  const to = next.status;
  if (to === from) return;
  if (to === 'done' && !force) {
    throw new UserError(`${issue.fm.id}: use "backlog done ${issue.fm.id}" to close an issue (or --force)`);
  }
  if (to === 'in-progress') {
    const other = otherInProgress(store, next.owner, issue.fm.id);
    if (other && !force) {
      throw new UserError(`${issue.fm.id}: ${next.owner} already has ${other.fm.id} in progress; finish or block it first (or --force)`);
    }
    const unmet = unmetDeps(store, next);
    if (unmet.length && !force) {
      throw new UserError(`${issue.fm.id}: dependencies not done: ${unmet.join(', ')} (or --force)`);
    }
  }
}

// changes: [{ key, op: '='|'+='|'-=', value }]
function applyChanges(ctx, store, issue, changes, { force = false } = {}) {
  const next = { ...issue.fm };
  let depsChanged = false;
  let parentChanged = false;
  for (const { key, op, value } of changes) {
    if (!KNOWN_KEYS.includes(key) || ['id', 'created', 'updated'].includes(key)) {
      throw new UserError(`cannot set "${key}" (settable: ${KNOWN_KEYS.filter((k) => !['id', 'created', 'updated'].includes(k)).join(', ')})`);
    }
    let v = value;
    if (LIST_KEYS.includes(key)) {
      let items = String(value).split(',').map((s) => s.trim()).filter(Boolean);
      if (key === 'depends_on') items = items.map((x) => normalizeId(ctx, x));
      const current = next[key] ?? [];
      if (op === '+=') v = [...new Set([...current, ...items])];
      else if (op === '-=') v = current.filter((x) => !items.includes(x));
      else v = [...new Set(items)];
      if (key === 'depends_on') depsChanged = true;
    } else {
      if (op !== '=') throw new UserError(`${op} is only valid for list keys (${LIST_KEYS.join(', ')})`);
      if (key === 'parent' && value) v = normalizeId(ctx, value);
      if (key === 'parent') parentChanged = true;
    }
    const err = validateField(ctx, store, next, key, v);
    if (err) throw new UserError(`${issue.rel}: ${err}`);
    next[key] = v;
  }
  if (next.status === 'in-progress' && !next.owner) {
    throw new UserError(`${issue.fm.id}: in-progress requires an owner (owner=<name> or --owner <name>)`);
  }
  if (depsChanged) {
    const cycle = findCycle(store, next.id, 'depends_on', next);
    if (cycle) throw new UserError(`${issue.rel}: depends_on would create a cycle: ${cycle.join(' -> ')}`);
  }
  if (parentChanged) {
    const cycle = findCycle(store, next.id, 'parent', next);
    if (cycle) throw new UserError(`${issue.rel}: parent would create a cycle: ${cycle.join(' -> ')}`);
  }
  checkTransition(ctx, store, issue, next, { force });
  next.updated = today();
  issue.fm = next;
  writeIssue(issue);
}

function appendLog(issue, owner, message) {
  issue.body = appendToSection(issue.body, 'Log', `- ${stamp()} ${owner}: ${message}`);
  issue.fm.updated = today();
  writeIssue(issue);
}

// ---------------------------------------------------------------------------
// Ordering and presentation

function compareIssues(cfg) {
  const rank = (list, v) => { const i = list.indexOf(v); return i === -1 ? list.length : i; };
  return (a, b) => rank(cfg.priorities, a.fm.priority) - rank(cfg.priorities, b.fm.priority)
    || (a.fm.due || '9999').localeCompare(b.fm.due || '9999')
    || (a.fm.created || '').localeCompare(b.fm.created || '')
    || a.fm.id.localeCompare(b.fm.id);
}

const isOpen = (issue) => !CLOSED.includes(issue.fm.status);
const isOverdue = (issue) => isOpen(issue) && issue.fm.due && issue.fm.due < today();

function table(headers, rows) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)));
  const line = (cells) => cells.map((c, i) => String(c ?? '').padEnd(widths[i])).join('  ').trimEnd();
  return [line(headers), ...rows.map(line)].join('\n');
}

function depsSummary(store, fm) {
  return (fm.depends_on ?? []).map((d) => `${d} (${store.byId.get(d)?.fm.status ?? 'unknown'})`).join(', ');
}

function brief(ctx, store, issue) {
  const fm = issue.fm;
  const out = [
    `${fm.id}  ${fm.priority}  ${fm.status}  ${fm.kind}  area:${fm.area || '-'}  owner:${fm.owner || '-'}  due:${fm.due || '-'}  est:${fm.estimate || '-'}`,
    fm.title,
    `file: ${issue.rel}`,
  ];
  if (fm.parent) out.push(`parent: ${fm.parent}`);
  if (fm.depends_on?.length) out.push(`depends_on: ${depsSummary(store, fm)}`);
  if (fm.branch) out.push(`branch: ${fm.branch}`);
  if (fm.tags?.length) out.push(`tags: ${fm.tags.join(', ')}`);
  const criteria = criteriaOf(issue.body).all;
  out.push(`${SECTION_CRITERIA}:`);
  out.push(...(criteria.length ? criteria.map((l) => `  ${l.trim()}`) : ['  (none)']));
  const logs = logLines(issue.body).slice(-3);
  if (logs.length) {
    out.push('Log (last 3):');
    out.push(...logs.map((l) => `  ${l}`));
  }
  return out.join('\n');
}

const toJson = (issue) => ({ ...issue.fm, file: issue.rel });

function printVerifyReminder(ctx) {
  if (ctx.cfg.verify) console.log(`verify: ${ctx.cfg.verify}`);
}

function parentNotice(store, issue) {
  if (!issue.fm.parent) return null;
  const parent = store.byId.get(issue.fm.parent);
  if (!parent) return null;
  const open = store.issues.filter((i) => i.fm.parent === parent.fm.id && isOpen(i)).length;
  return `parent ${parent.fm.id} has ${open} open ${open === 1 ? 'child' : 'children'}`;
}

// ---------------------------------------------------------------------------
// INDEX.md

function renderIndex(ctx, store) {
  const { cfg } = ctx;
  const cmp = compareIssues(cfg);
  const open = store.issues.filter(isOpen).length;
  const done = store.issues.filter((i) => i.fm.status === 'done').length;
  const cancelled = store.issues.filter((i) => i.fm.status === 'cancelled').length;
  const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');
  const lines = [
    '# Backlog',
    '',
    '<!-- generated by `backlog index`; do not edit by hand -->',
    '',
    `${open} open / ${done} done${cancelled ? ` / ${cancelled} cancelled` : ''}`,
    '',
  ];
  for (const status of cfg.statuses) {
    const rows = store.issues.filter((i) => i.fm.status === status).sort(cmp);
    if (!rows.length) continue;
    lines.push(`## ${status} (${rows.length})`, '');
    lines.push('| id | pri | kind | area | owner | due | title |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const issue of rows) {
      const fm = issue.fm;
      let title = cell(fm.title);
      if (fm.kind === 'epic') {
        const children = store.issues.filter((i) => i.fm.parent === fm.id);
        const openChildren = children.filter(isOpen).length;
        title += ` (${children.length} children, ${openChildren} open)`;
      }
      const link = `[${fm.id}](issues/${path.basename(issue.file)})`;
      lines.push(`| ${link} | ${cell(fm.priority)} | ${cell(fm.kind)} | ${cell(fm.area)} | ${cell(fm.owner)} | ${cell(fm.due)} | ${title} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

function writeIndex(ctx, store) {
  fs.mkdirSync(ctx.dir, { recursive: true });
  fs.writeFileSync(ctx.indexFile, renderIndex(ctx, store));
}

function indexIsStale(ctx, store) {
  if (!fs.existsSync(ctx.indexFile)) return true;
  return fs.readFileSync(ctx.indexFile, 'utf8').replace(/\r\n/g, '\n') !== renderIndex(ctx, store);
}

// ---------------------------------------------------------------------------
// Commands

function cmdNew(ctx, args) {
  const title = args._[0];
  if (!title || !title.trim()) throw new UserError('new: title is required', 2);
  const store = loadIssues(ctx);
  const id = nextId(ctx, store);
  const template = readTemplate(ctx, 'issue.md');
  const criteria = (args.criteria ?? '').split('|').map((s) => s.trim()).filter(Boolean).map((c) => `- [ ] ${c}`).join('\n');
  const text = fillTemplate(template, { id, title, context: args.context ?? '', criteria, created: today(), updated: today() });
  const { data: fm, body } = parseFrontmatter(text, 'templates/issue.md');
  const file = path.join(ctx.issuesDir, `${id}-${slugify(title)}.md`);
  const issue = { file, rel: ctx.rel(file), fm, body };
  Object.assign(fm, {
    id,
    title: title.trim(),
    kind: args.kind ?? fm.kind ?? 'feature',
    status: args.status ?? 'todo',
    priority: args.priority ?? fm.priority ?? 'P2',
    area: args.area ?? fm.area ?? '',
    parent: args.parent ? normalizeId(ctx, args.parent) : '',
    depends_on: (args['depends-on'] ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((x) => normalizeId(ctx, x)),
    created: today(),
    updated: today(),
    due: args.due ?? '',
    owner: args.owner ?? '',
    branch: '',
    estimate: args.estimate ?? '',
    tags: (args.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  });
  for (const key of KNOWN_KEYS) {
    const err = validateField(ctx, store, fm, key, fm[key]);
    if (err) throw new UserError(`new: ${err}`);
  }
  if (fm.status === 'in-progress' && !fm.owner) throw new UserError('new: --status in-progress requires --owner');
  fs.mkdirSync(ctx.issuesDir, { recursive: true });
  writeIssue(issue);
  writeIndex(ctx, loadIssues(ctx));
  console.log(`created ${id} ${issue.rel}`);
}

function cmdList(ctx, args) {
  const store = loadIssues(ctx);
  const statuses = args.status ? args.status.split(',').map((s) => s.trim()) : null;
  let rows = store.issues.filter((i) => {
    const fm = i.fm;
    if (statuses) { if (!statuses.includes(fm.status)) return false; } else if (!args.all && !isOpen(i)) return false;
    if (args.priority && fm.priority !== args.priority) return false;
    if (args.area && fm.area !== args.area) return false;
    if (args.kind && fm.kind !== args.kind) return false;
    if (args.parent && fm.parent !== normalizeId(ctx, args.parent)) return false;
    if (args.owner && fm.owner !== args.owner) return false;
    if (args.tag && !(fm.tags ?? []).includes(args.tag)) return false;
    if (args['due-before'] && !(fm.due && fm.due < args['due-before'])) return false;
    return true;
  });
  const sort = args.sort ?? 'priority';
  const cmp = compareIssues(ctx.cfg);
  if (sort === 'priority') rows.sort(cmp);
  else if (['created', 'updated', 'due'].includes(sort)) {
    rows.sort((a, b) => (a.fm[sort] || '9999').localeCompare(b.fm[sort] || '9999') || cmp(a, b));
  } else throw new UserError(`list: unknown sort "${sort}" (priority, created, updated, due)`, 2);
  if (args.json) { console.log(JSON.stringify(rows.map(toJson), null, 2)); return; }
  if (!rows.length) { console.log('no issues'); return; }
  console.log(table(['id', 'pri', 'status', 'kind', 'area', 'owner', 'due', 'title'],
    rows.map((i) => [i.fm.id, i.fm.priority, i.fm.status, i.fm.kind, i.fm.area, i.fm.owner, i.fm.due, i.fm.title])));
}

function cmdShow(ctx, args) {
  if (!args._[0]) throw new UserError('show: issue id is required', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, args._[0]);
  if (args.json) { console.log(JSON.stringify({ ...toJson(issue), body: issue.body }, null, 2)); return; }
  if (args.brief) { console.log(brief(ctx, store, issue)); return; }
  console.log(`# ${issue.rel}`);
  process.stdout.write(serializeFrontmatter(issue.fm) + issue.body);
}

function parseAssignment(token) {
  const m = /^([A-Za-z_]+)(\+=|-=|=)([\s\S]*)$/.exec(token);
  if (!m) throw new UserError(`set: expected key=value, got "${token}"`, 2);
  return { key: m[1], op: m[2], value: m[3] };
}

function cmdSet(ctx, args) {
  const [rawId, ...assignments] = args._;
  if (!rawId) throw new UserError('set: issue id is required', 2);
  const changes = assignments.map(parseAssignment);
  if (args.owner !== undefined) changes.push({ key: 'owner', op: '=', value: args.owner });
  if (!changes.length) throw new UserError('set: nothing to set (key=value ...)', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, rawId);
  applyChanges(ctx, store, issue, changes, { force: args.force });
  writeIndex(ctx, loadIssues(ctx));
  console.log(`${issue.fm.id} updated: ${changes.map((c) => `${c.key}${c.op}${Array.isArray(issue.fm[c.key]) ? issue.fm[c.key].join(',') : issue.fm[c.key]}`).join(' ')}`);
}

function startIssue(ctx, store, issue, owner, branch, force) {
  const changes = [{ key: 'status', op: '=', value: 'in-progress' }, { key: 'owner', op: '=', value: owner }];
  if (branch) changes.push({ key: 'branch', op: '=', value: branch });
  applyChanges(ctx, store, issue, changes, { force });
  const pf = progressFile(ctx, issue.fm.id);
  if (!fs.existsSync(pf)) {
    fs.mkdirSync(ctx.progressDir, { recursive: true });
    fs.writeFileSync(pf, fillTemplate(readTemplate(ctx, 'progress.md'), { id: issue.fm.id, title: issue.fm.title }));
  }
  appendLog(issue, owner, `started${branch ? ` on ${branch}` : ''}; plan in ${ctx.rel(pf)}`);
  writeIndex(ctx, loadIssues(ctx));
}

function cmdStart(ctx, args) {
  if (!args._[0]) throw new UserError('start: issue id is required', 2);
  const owner = args.owner || defaultOwner();
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, args._[0]);
  if (issue.fm.status === 'in-progress' && issue.fm.owner === owner) {
    console.log(`${issue.fm.id} is already in progress by ${owner}; resuming`);
  } else {
    startIssue(ctx, store, issue, owner, args.branch, args.force);
  }
  console.log(brief(ctx, loadIssues(ctx), issue));
  console.log(`progress: ${ctx.rel(progressFile(ctx, issue.fm.id))}`);
  printVerifyReminder(ctx);
}

function cmdLog(ctx, args) {
  const [rawId, message] = args._;
  if (!rawId || !message) throw new UserError('log: usage: backlog log <ID> "<message>"', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, rawId);
  appendLog(issue, args.owner || issue.fm.owner || defaultOwner(), message);
  console.log(`${issue.fm.id} logged`);
}

function cmdBlock(ctx, args) {
  const [rawId, reason] = args._;
  if (!rawId || !reason) throw new UserError('block: usage: backlog block <ID> "<reason>"', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, rawId);
  if (CLOSED.includes(issue.fm.status)) throw new UserError(`${issue.fm.id} is ${issue.fm.status}; cannot block a closed issue`);
  applyChanges(ctx, store, issue, [{ key: 'status', op: '=', value: 'blocked' }], { force: true });
  appendLog(issue, args.owner || issue.fm.owner || defaultOwner(), `blocked: ${reason}`);
  writeIndex(ctx, loadIssues(ctx));
  console.log(`${issue.fm.id} blocked: ${reason}`);
}

function cmdUnblock(ctx, args) {
  if (!args._[0]) throw new UserError('unblock: issue id is required', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, args._[0]);
  if (issue.fm.status !== 'blocked') throw new UserError(`${issue.fm.id} is ${issue.fm.status}, not blocked`);
  const status = issue.fm.owner ? 'in-progress' : 'todo';
  applyChanges(ctx, store, issue, [{ key: 'status', op: '=', value: status }], { force: args.force });
  appendLog(issue, args.owner || issue.fm.owner || defaultOwner(), `unblocked -> ${status}`);
  writeIndex(ctx, loadIssues(ctx));
  console.log(`${issue.fm.id} unblocked -> ${status}`);
}

function resolveOutcome(ctx, issue, args) {
  if (args.outcome && args.outcome.trim()) return args.outcome.trim();
  const pf = progressFile(ctx, issue.fm.id);
  if (fs.existsSync(pf)) {
    const summary = stripComments(getSection(fs.readFileSync(pf, 'utf8').replace(/\r\n/g, '\n'), 'Summary'));
    if (summary) return summary;
  }
  const existing = stripComments(getSection(issue.body, 'Outcome'));
  if (existing) return existing;
  throw new UserError(`${issue.fm.id}: Outcome is empty; pass --outcome "..." or fill "## Summary" in ${ctx.rel(pf)}`);
}

function cmdDone(ctx, args) {
  if (!args._[0]) throw new UserError('done: issue id is required', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, args._[0]);
  if (issue.fm.status === 'done') throw new UserError(`${issue.fm.id} is already done`);
  const { unchecked } = criteriaOf(issue.body);
  if (unchecked.length && !args.force) {
    throw new UserError(`${issue.fm.id}: ${unchecked.length} unchecked acceptance criteria (tick them in ${issue.rel} or use --force):\n${unchecked.map((l) => `  ${l.trim()}`).join('\n')}`);
  }
  const outcome = resolveOutcome(ctx, issue, args);
  const owner = args.owner || issue.fm.owner || defaultOwner();
  issue.body = setSection(issue.body, 'Outcome', outcome);
  if (unchecked.length) appendLog(issue, owner, `done --force with ${unchecked.length} unchecked acceptance criteria`);
  appendLog(issue, owner, 'done');
  applyChanges(ctx, store, issue, [{ key: 'status', op: '=', value: 'done' }, { key: 'owner', op: '=', value: '' }], { force: true });
  const pf = progressFile(ctx, issue.fm.id);
  if (fs.existsSync(pf)) fs.unlinkSync(pf);
  const fresh = loadIssues(ctx);
  writeIndex(ctx, fresh);
  console.log(`${issue.fm.id} done: ${issue.fm.title}`);
  const notice = parentNotice(fresh, issue);
  if (notice) console.log(notice);
  if (ctx.cfg.verify) console.log(`next: run "${ctx.cfg.verify}", then commit with ${issue.fm.id} in the message`);
  else console.log(`next: commit with ${issue.fm.id} in the message`);
}

function cmdCancel(ctx, args) {
  const [rawId, reason] = args._;
  if (!rawId || !reason) throw new UserError('cancel: usage: backlog cancel <ID> "<reason>"', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, rawId);
  if (CLOSED.includes(issue.fm.status)) throw new UserError(`${issue.fm.id} is already ${issue.fm.status}`);
  appendLog(issue, args.owner || issue.fm.owner || defaultOwner(), `cancelled: ${reason}`);
  applyChanges(ctx, store, issue, [{ key: 'status', op: '=', value: 'cancelled' }, { key: 'owner', op: '=', value: '' }]);
  const pf = progressFile(ctx, issue.fm.id);
  if (fs.existsSync(pf)) fs.unlinkSync(pf);
  writeIndex(ctx, loadIssues(ctx));
  console.log(`${issue.fm.id} cancelled: ${reason}`);
}

const isActionable = (issue) => issue.fm.status === 'todo' && issue.fm.kind !== 'epic';

function pickNext(ctx, store, args) {
  return store.issues
    .filter((i) => isActionable(i) && unmetDeps(store, i.fm).length === 0)
    .filter((i) => !args.area || i.fm.area === args.area)
    .sort(compareIssues(ctx.cfg))[0] ?? null;
}

function cmdNext(ctx, args) {
  const store = loadIssues(ctx);
  const owner = args.owner || (args.claim ? defaultOwner() : null);
  const emit = (issue, label) => {
    if (args.json) console.log(JSON.stringify({ ...toJson(issue), pick: label }, null, 2));
    else { console.log(`${label}: ${issue.fm.id}`); console.log(brief(ctx, store, issue)); }
  };
  if (owner) {
    const current = store.issues.find((i) => i.fm.status === 'in-progress' && i.fm.owner === owner);
    if (current) {
      emit(current, 'RESUME');
      if (!args.json) printVerifyReminder(ctx);
      return 0;
    }
    const blocked = store.issues.find((i) => i.fm.status === 'blocked' && i.fm.owner === owner);
    if (blocked) {
      emit(blocked, 'BLOCKED');
      if (!args.json) console.log(`reason: ${blockedReason(blocked)}`);
      return 4;
    }
  }
  const issue = pickNext(ctx, store, args);
  if (!issue) {
    if (args.json) console.log(JSON.stringify({ pick: 'NOTHING TO DO' }));
    else console.log('NOTHING TO DO');
    return 3;
  }
  if (args.claim) {
    startIssue(ctx, store, issue, owner, args.branch, false);
    const fresh = loadIssues(ctx);
    const claimed = fresh.byId.get(issue.fm.id);
    if (args.json) console.log(JSON.stringify({ ...toJson(claimed), pick: 'CLAIMED', progress: ctx.rel(progressFile(ctx, claimed.fm.id)) }, null, 2));
    else {
      console.log(`CLAIMED: ${claimed.fm.id}`);
      console.log(brief(ctx, fresh, claimed));
      console.log(`progress: ${ctx.rel(progressFile(ctx, claimed.fm.id))}`);
      printVerifyReminder(ctx);
    }
    return 0;
  }
  emit(issue, 'NEXT');
  if (!args.json) printVerifyReminder(ctx);
  return 0;
}

function blockedReason(issue) {
  const line = logLines(issue.body).reverse().find((l) => /: blocked: /.test(l)) ?? logLines(issue.body).at(-1);
  if (!line) return '(no reason logged)';
  return line.replace(/^- \S+ \S+ [^:]+: (blocked: )?/, '');
}

function cmdBoard(ctx) {
  const store = loadIssues(ctx);
  const { cfg } = ctx;
  const cmp = compareIssues(cfg);
  const count = (s) => store.issues.filter((i) => i.fm.status === s).length;
  const out = ['backlog board', ''];
  out.push(`counts: ${cfg.statuses.map((s) => `${s} ${count(s)}`).join(' | ')}`, '');
  const section = (title, rows) => {
    out.push(`${title} (${rows.length})`);
    out.push(...(rows.length ? rows : ['  -']));
    out.push('');
  };
  section('in-progress', store.issues.filter((i) => i.fm.status === 'in-progress').sort(cmp)
    .map((i) => `  ${i.fm.id}  ${i.fm.priority}  ${i.fm.owner || '-'}  updated ${daysSince(i.fm.updated)}d ago  ${i.fm.title}`));
  section('blocked', store.issues.filter((i) => i.fm.status === 'blocked').sort(cmp)
    .map((i) => `  ${i.fm.id}  ${i.fm.priority}  ${i.fm.owner || '-'}  ${i.fm.title}\n      reason: ${blockedReason(i)}`));
  section('overdue', store.issues.filter(isOverdue).sort(cmp)
    .map((i) => `  ${i.fm.id}  ${i.fm.priority}  due ${i.fm.due}  ${i.fm.status}  ${i.fm.title}`));
  section('next up (top 5 todo)', store.issues.filter(isActionable).sort(cmp).slice(0, 5)
    .map((i) => `  ${i.fm.id}  ${i.fm.priority}  ${unmetDeps(store, i.fm).length ? 'waiting on ' + unmetDeps(store, i.fm).join(',') : 'ready'}  ${i.fm.title}`));
  console.log(out.join('\n').trimEnd());
}

function cmdStale(ctx) {
  const store = loadIssues(ctx);
  const rows = store.issues
    .filter((i) => ['in-progress', 'blocked'].includes(i.fm.status) && daysSince(i.fm.updated) > ctx.cfg.staleDays)
    .sort(compareIssues(ctx.cfg));
  if (!rows.length) { console.log(`no stale issues (threshold ${ctx.cfg.staleDays} days)`); return; }
  console.log(table(['id', 'status', 'owner', 'updated', 'age', 'title'],
    rows.map((i) => [i.fm.id, i.fm.status, i.fm.owner, i.fm.updated, `${daysSince(i.fm.updated)}d`, i.fm.title])));
}

function cmdIndex(ctx) {
  const store = loadIssues(ctx);
  writeIndex(ctx, store);
  console.log(`wrote ${ctx.rel(ctx.indexFile)} (${store.issues.length} issues)`);
}

function cmdTick(ctx, args) {
  const [rawId, ...which] = args._;
  if (!rawId || !which.length) throw new UserError('tick: usage: backlog tick <ID> <n|all> [n...]', 2);
  const store = loadIssues(ctx);
  const issue = getIssue(ctx, store, rawId);
  const lines = issue.body.split('\n');
  const r = findSection(lines, SECTION_CRITERIA);
  if (!r) throw new UserError(`${issue.rel}: no "## ${SECTION_CRITERIA}" section`);
  const indexes = [];
  for (let i = r.start + 1; i < r.end; i++) if (/^\s*[-*]\s+\[[ xX]\]/.test(lines[i])) indexes.push(i);
  const wanted = which.includes('all') ? indexes.map((_, n) => n + 1) : which.map((n) => Number(n));
  for (const n of wanted) {
    if (!Number.isInteger(n) || n < 1 || n > indexes.length) throw new UserError(`${issue.fm.id}: criterion ${n} does not exist (1-${indexes.length})`);
    lines[indexes[n - 1]] = lines[indexes[n - 1]].replace(/\[ \]/, '[x]');
  }
  issue.body = lines.join('\n');
  issue.fm.updated = today();
  writeIssue(issue);
  console.log(`${issue.fm.id} ticked ${wanted.join(', ')} of ${indexes.length}`);
}

function collectChecks(ctx) {
  const { cfg } = ctx;
  const store = loadIssues(ctx, { strict: false });
  const errors = [...store.problems];
  const warnings = [];
  const err = (issue, msg) => errors.push(`${issue.rel}: ${msg}`);
  const warn = (issue, msg) => warnings.push(`${issue.rel}: ${msg}`);

  for (const issue of store.issues) {
    const fm = issue.fm;
    const missing = REQUIRED_KEYS.filter((k) => fm[k] === undefined || fm[k] === '');
    if (missing.length) { err(issue, `missing required keys: ${missing.join(', ')}`); continue; }
    const base = path.basename(issue.file);
    if (!(base === `${fm.id}.md` || base.startsWith(`${fm.id}-`))) err(issue, `filename does not match id ${fm.id}`);
    for (const key of KNOWN_KEYS) {
      if (fm[key] === undefined) continue;
      const e = validateField(ctx, store, fm, key, fm[key]);
      if (e) err(issue, e);
    }
    for (const key of ['depends_on', 'parent']) {
      const cycle = findCycle(store, fm.id, key);
      if (cycle && cycle[0] === fm.id) err(issue, `${key} cycle: ${cycle.join(' -> ')}`);
    }
    if (fm.status === 'in-progress' && !fm.owner) err(issue, 'in-progress without owner');
    const { all, unchecked } = criteriaOf(issue.body);
    if (fm.status === 'done') {
      if (!stripComments(getSection(issue.body, 'Outcome'))) err(issue, 'done without a non-empty "## Outcome"');
      if (unchecked.length) warn(issue, `done with ${unchecked.length} unchecked acceptance criteria`);
    }
    if (fm.status === 'in-progress' && isDate(fm.updated) && daysSince(fm.updated) > cfg.staleDays) {
      warn(issue, `in-progress and not updated for ${daysSince(fm.updated)} days (staleDays ${cfg.staleDays})`);
    }
    if (isOverdue(issue)) warn(issue, `overdue (due ${fm.due})`);
    if (fm.status === 'todo' && fm.kind !== 'epic' && all.length === 0) warn(issue, 'todo with no acceptance criteria');
  }
  if (indexIsStale(ctx, store)) errors.push(`${ctx.rel(ctx.indexFile)}: stale or missing; run "backlog index"`);
  if (fs.existsSync(ctx.progressDir)) {
    for (const f of fs.readdirSync(ctx.progressDir).filter((f) => f.endsWith('.md')).sort()) {
      const id = f.slice(0, -3);
      const issue = store.byId.get(id);
      if (!issue || !['in-progress', 'blocked'].includes(issue.fm.status)) {
        errors.push(`${ctx.rel(path.join(ctx.progressDir, f))}: orphan progress file (${issue ? `${id} is ${issue.fm.status}` : `${id} does not exist`})`);
      }
    }
  }
  return { store, errors, warnings };
}

function cmdCheck(ctx, args) {
  if (args.fix) writeIndex(ctx, loadIssues(ctx, { strict: false }));
  const { store, errors, warnings } = collectChecks(ctx);
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  if (errors.length) {
    console.log(`backlog check: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
    return 1;
  }
  console.log(`backlog check: OK (${store.issues.length} issues${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''})`);
  return 0;
}

// ---------------------------------------------------------------------------
// CLI plumbing

const COMMANDS = {
  new: {
    usage: 'new "<title>" [--kind k] [--priority P] [--area a] [--parent ID] [--depends-on ID,ID] [--due D] [--estimate S|M|L|XL] [--tags a,b] [--status s] [--owner o] [--context "..."] [--criteria "a|b|c"]',
    desc: 'create an issue (next free id, slugified filename) and regenerate INDEX.md',
    opts: ['kind', 'priority', 'area', 'parent', 'depends-on', 'due', 'estimate', 'tags', 'status', 'owner', 'context', 'criteria'],
    flags: [],
    run: cmdNew,
  },
  list: {
    usage: 'list [--status s,s] [--priority p] [--area a] [--kind k] [--parent ID] [--owner o] [--tag t] [--due-before D] [--sort priority|created|updated|due] [--all] [--json]',
    desc: 'list issues (open ones by default)',
    opts: ['status', 'priority', 'area', 'kind', 'parent', 'owner', 'tag', 'due-before', 'sort'],
    flags: ['all', 'json'],
    run: cmdList,
  },
  show: { usage: 'show <ID> [--brief] [--json]', desc: 'print an issue; --brief = frontmatter, criteria, last 3 log lines', opts: [], flags: ['brief', 'json'], run: cmdShow },
  set: { usage: 'set <ID> key=value [key=value...] [--owner o] [--force]', desc: 'update frontmatter with validation (tags+=x, tags-=x, depends_on=A,B)', opts: ['owner'], flags: ['force'], run: cmdSet },
  start: { usage: 'start <ID> --owner <name> [--branch b] [--force]', desc: 'claim: status=in-progress, owner, progress file, log line', opts: ['owner', 'branch'], flags: ['force'], run: cmdStart },
  log: { usage: 'log <ID> "<message>" [--owner name]', desc: 'append a timestamped line to ## Log', opts: ['owner'], flags: [], run: cmdLog },
  block: { usage: 'block <ID> "<reason>" [--owner name]', desc: 'status=blocked and log the reason', opts: ['owner'], flags: [], run: cmdBlock },
  unblock: { usage: 'unblock <ID> [--force]', desc: 'blocked -> in-progress (if owner set) or todo', opts: ['owner'], flags: ['force'], run: cmdUnblock },
  done: { usage: 'done <ID> [--outcome "..."] [--force]', desc: 'close: requires ticked criteria and a non-empty Outcome', opts: ['outcome', 'owner'], flags: ['force'], run: cmdDone },
  cancel: { usage: 'cancel <ID> "<reason>"', desc: 'status=cancelled with a logged reason', opts: ['owner'], flags: [], run: cmdCancel },
  next: { usage: 'next [--area a] [--owner o] [--claim] [--branch b] [--json]', desc: 'pick the best todo issue; exit 3 = nothing to do, 4 = owner is blocked', opts: ['area', 'owner', 'branch'], flags: ['claim', 'json'], run: cmdNext },
  tick: { usage: 'tick <ID> <n|all> [n...]', desc: 'mark acceptance criteria as done (1-based)', opts: [], flags: [], run: cmdTick },
  board: { usage: 'board', desc: 'status counts, in-progress, blocked, overdue, top 5 todo', opts: [], flags: [], run: cmdBoard },
  stale: { usage: 'stale', desc: 'in-progress/blocked issues not updated within staleDays', opts: [], flags: [], run: cmdStale },
  index: { usage: 'index', desc: 'regenerate backlog/INDEX.md', opts: [], flags: [], run: cmdIndex },
  check: { usage: 'check [--fix]', desc: 'validate every issue and the INDEX; exit 1 on errors', opts: [], flags: ['fix'], run: cmdCheck },
};

function parseArgs(argv, spec, cmd) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--') { args._.push(...argv.slice(i + 1)); break; }
    if (!tok.startsWith('--')) { args._.push(tok); continue; }
    const eq = tok.indexOf('=');
    const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
    if (spec.flags.includes(name)) { args[name] = true; continue; }
    if (!spec.opts.includes(name)) throw new UserError(`${cmd}: unknown option --${name}\nusage: backlog ${spec.usage}`, 2);
    if (eq !== -1) { args[name] = tok.slice(eq + 1); continue; }
    if (i + 1 >= argv.length) throw new UserError(`${cmd}: --${name} needs a value`, 2);
    args[name] = argv[++i];
  }
  return args;
}

function printHelp(cmd) {
  if (cmd && COMMANDS[cmd]) {
    console.log(`usage: backlog ${COMMANDS[cmd].usage}\n${COMMANDS[cmd].desc}`);
    return;
  }
  console.log('usage: backlog <command> [options]\n');
  const width = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  for (const [name, spec] of Object.entries(COMMANDS)) console.log(`  ${name.padEnd(width)}  ${spec.desc}`);
  console.log('\nRun "backlog <command> --help" for options. Config: backlog.json at the project root.');
  console.log('Exit codes: 0 ok, 1 error, 2 usage, 3 nothing to do (next), 4 owner is blocked (next).');
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { printHelp(rest[0]); return 0; }
  const spec = COMMANDS[cmd];
  if (!spec) { console.error(`backlog: unknown command "${cmd}"`); printHelp(); return 2; }
  if (rest.includes('--help') || rest.includes('-h')) { printHelp(cmd); return 0; }
  const args = parseArgs(rest, spec, cmd);
  const ctx = makeContext(process.cwd());
  return spec.run(ctx, args) ?? 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  if (e instanceof UserError) {
    console.error(`backlog: ${e.message}`);
    process.exitCode = e.exitCode;
  } else {
    throw e;
  }
}
