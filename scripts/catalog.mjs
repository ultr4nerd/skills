#!/usr/bin/env node
// catalog: catalog.json is the single source for the list of skills. This script validates it
// against the skills/ folders and regenerates the README tables between
// <!-- catalog:<category>:start --> and <!-- catalog:<category>:end --> markers.
//   node scripts/catalog.mjs --write   regenerate every output that changed
//   node scripts/catalog.mjs --check   exit 1 and name each stale file
// Outputs are a list (OUTPUTS) so another generated file can be added next to the README.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CATEGORIES = ['software', 'tool-guide', 'orchestration', 'setup'];

const HEADER = ['| Skill | What it does | When it triggers |', '|---|---|---|'];
const cell = (s) => String(s).replace(/\|/g, '\\|');

/** Returns the list of problems found in a parsed catalog; skillNames are the folders in skills/. */
export function validate(catalog, skillNames) {
  const problems = [];
  const entries = catalog && Array.isArray(catalog.skills) ? catalog.skills : null;
  if (!entries) return ['catalog.json: "skills" must be an array'];
  const seen = new Set();
  const names = new Set(skillNames);
  for (const [i, e] of entries.entries()) {
    const at = e && typeof e.name === 'string' && e.name ? e.name : `skills[${i}]`;
    if (!e || typeof e.name !== 'string' || !e.name) { problems.push(`catalog.json: ${at} has no name`); continue; }
    if (seen.has(e.name)) problems.push(`catalog.json: duplicate name "${e.name}"`);
    seen.add(e.name);
    if (!names.has(e.name)) problems.push(`catalog.json: "${e.name}" is not a skill folder in skills/`);
    if (!CATEGORIES.includes(e.category)) problems.push(`catalog.json: "${e.name}" has unknown category "${e.category}" (expected ${CATEGORIES.join(' | ')})`);
    for (const k of ['summary', 'triggers']) {
      if (typeof e[k] !== 'string' || !e[k].trim()) problems.push(`catalog.json: "${e.name}" needs a non-empty ${k}`);
      else if (/[\r\n]/.test(e[k])) problems.push(`catalog.json: "${e.name}" ${k} must be a single line`);
    }
    for (const k of ['requires', 'optional']) {
      if (!Array.isArray(e[k])) { problems.push(`catalog.json: "${e.name}" ${k} must be an array`); continue; }
      for (const dep of e[k]) {
        if (!names.has(dep)) problems.push(`catalog.json: "${e.name}" ${k} "${dep}" does not exist in skills/`);
        else if (dep === e.name) problems.push(`catalog.json: "${e.name}" ${k} itself`);
      }
    }
  }
  for (const n of skillNames) if (!seen.has(n)) problems.push(`catalog.json: skill folder "${n}" is missing from the catalog`);
  return problems;
}

function table(entries) {
  return [...HEADER, ...entries.map((e) => `| [\`${e.name}\`](skills/${e.name}/) | ${cell(e.summary)} | ${cell(e.triggers)} |`)].join('\n');
}

/** Replaces the content between each category's markers; throws on missing, duplicated or overlapping markers. */
export function renderReadme(readmeText, catalog) {
  // Validate every category against the ORIGINAL text before replacing anything.
  const regions = [];
  for (const category of CATEGORIES) {
    const entries = catalog.skills.filter((e) => e.category === category);
    const start = `<!-- catalog:${category}:start -->`;
    const end = `<!-- catalog:${category}:end -->`;
    const count = (s) => readmeText.split(s).length - 1;
    const [ns, ne] = [count(start), count(end)];
    if (!entries.length && !ns && !ne) continue;
    if (ns !== 1 || ne !== 1) {
      throw new Error(`README.md: expected exactly one "${start}" and one "${end}" (found ${ns} and ${ne})${entries.length ? '' : ' (category has no entries; remove the markers or add a skill)'}`);
    }
    const a = readmeText.indexOf(start) + start.length;
    const b = readmeText.indexOf(end);
    if (b < a - start.length) throw new Error(`README.md: "${end}" comes before "${start}"`);
    regions.push({ category, a, b, entries });
  }
  const sorted = [...regions].sort((x, y) => x.a - y.a);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].a - 1 < sorted[i - 1].b) throw new Error(`README.md: catalog regions "${sorted[i - 1].category}" and "${sorted[i].category}" overlap`);
  }
  let text = readmeText;
  for (const r of sorted.reverse()) text = `${text.slice(0, r.a)}\n${r.entries.length ? table(r.entries) : ''}\n${text.slice(r.b)}`;
  return text;
}

export const OUTPUTS = [{ file: 'README.md', render: renderReadme }];

export function loadCatalog(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
}

export function skillFolders(root = ROOT) {
  return fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
}

/** Computes each output; returns { problems, outputs: [{file, current, next, stale}] }. */
export function plan(root = ROOT) {
  let catalog;
  try { catalog = loadCatalog(root); } catch (e) { return { problems: [`catalog.json: ${e.message}`], outputs: [] }; }
  const problems = validate(catalog, skillFolders(root));
  const outputs = [];
  if (problems.length) return { problems, outputs };
  for (const o of OUTPUTS) {
    const file = path.join(root, o.file);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    try {
      const next = o.render(current, catalog);
      outputs.push({ file: o.file, current, next, stale: next !== current });
    } catch (e) { problems.push(e.message); }
  }
  return { problems, outputs };
}

function main(argv, root = ROOT) {
  const mode = argv.includes('--write') ? 'write' : argv.includes('--check') ? 'check' : null;
  if (!mode) { console.error('usage: node scripts/catalog.mjs --write | --check'); return 2; }
  const { problems, outputs } = plan(root);
  if (problems.length) { for (const p of problems) console.error(`error: ${p}`); return 1; }
  const stale = outputs.filter((o) => o.stale);
  if (mode === 'check') {
    for (const o of stale) console.error(`stale: ${o.file} (run: node scripts/catalog.mjs --write)`);
    if (!stale.length) console.log('catalog: up to date');
    return stale.length ? 1 : 0;
  }
  for (const o of stale) { fs.writeFileSync(path.join(root, o.file), o.next); console.log(`wrote ${o.file}`); }
  if (!stale.length) console.log('catalog: nothing to write');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2), process.env.CATALOG_ROOT ? path.resolve(process.env.CATALOG_ROOT) : ROOT));
