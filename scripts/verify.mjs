#!/usr/bin/env node
// verify: the single definition of "green" for this repo. Runs the tests in tests/, checks
// that every skill has a SKILL.md with name + description matching its folder (under 20000 bytes),
// that skills/ ships no dev files (installers copy the whole folder), that catalog.json matches
// skills/ and the README tables generated from it are fresh, that each CLI answers --version with the version in package.json,
// and that this repo's own docs/ and backlog/ (dogfooding) are consistent.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan as catalogPlan } from './catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const skillsDir = path.join(ROOT, 'skills');
const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const problems = [];

// catalog.json is the single source for the README catalog (scripts/catalog.mjs).
const catalogResult = catalogPlan(ROOT);
problems.push(...catalogResult.problems);
for (const o of catalogResult.outputs) if (o.stale) problems.push(`${o.file} is stale against catalog.json; run: node scripts/catalog.mjs --write`);

for (const name of skills) {
  const dir = path.join(skillsDir, name);
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) { problems.push(`${name}: missing SKILL.md`); continue; }
  const text = fs.readFileSync(skillFile, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) { problems.push(`${name}: SKILL.md has no frontmatter`); continue; }
  // Frontmatter must parse as YAML for installers (npx skills uses a strict parser): a plain
  // (unquoted) scalar may not contain ': ' or ' #'. Quote such values.
  for (const line of fm[1].split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s+(.+)$/.exec(line);
    if (!m) continue;
    const v = m[2].trim();
    if (/^["'[{>|]/.test(v)) continue;
    if (v.includes(': ') || v.includes(' #')) problems.push(`${name}: SKILL.md "${m[1]}" is an unquoted YAML value containing ': ' or ' #'; wrap it in double quotes`);
  }
  const unquote = (v) => {
    if (v?.startsWith('"') && v.endsWith('"')) { try { return JSON.parse(v); } catch { return v; } }
    if (v?.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
    return v;
  };
  const field = (k) => unquote((new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm[1]) || [])[1]?.trim());
  if (field('name') !== name) problems.push(`${name}: SKILL.md name is "${field('name')}", expected "${name}"`);
  const desc = field('description') || '';
  if (desc.length < 40 || desc.length > 1024) problems.push(`${name}: description must be 40..1024 chars (is ${desc.length})`);
  // Claude Code re-attaches an invoked skill truncated to 20000 characters after compaction;
  // bytes are a stricter bound for non-ASCII text.
  const bytes = Buffer.byteLength(text);
  if (bytes >= 20000) problems.push(`${name}: SKILL.md is ${bytes} bytes; keep it under 20000 and move detail to README/references`);
  const lines = text.split('\n').length;
  if (lines > 500) problems.push(`${name}: SKILL.md is ${lines} lines; keep it under 500 and move detail to README/references`);
  if (!fs.existsSync(path.join(dir, 'README.md'))) problems.push(`${name}: missing README.md`);
  if (!readme.includes(`skills/${name}/`)) problems.push(`${name}: not listed in the root README catalog`);

  const cli = path.join(dir, 'scripts', `${name}.mjs`);
  if (fs.existsSync(cli)) {
    const r = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    const v = (r.stdout || '').trim();
    if (r.status !== 0 || v !== `${name} ${pkg.version}`) problems.push(`${name}: "--version" printed "${v}" (exit ${r.status}), expected "${name} ${pkg.version}"`);
  }
}

// Example configs ship to users and are copied as is: they must parse, and none may hold a shell
// command (decision 0005: orchestration config names models, the harness runs them).
const COMMAND_KEY = /^(run|cmd|command|exec|shell|script)$/i;
for (const name of skills) {
  for (const f of fs.readdirSync(path.join(skillsDir, name)).filter((x) => x.endsWith('.example.json'))) {
    const rel = `skills/${name}/${f}`;
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(skillsDir, name, f), 'utf8')); } catch (e) { problems.push(`${rel}: invalid JSON (${e.message})`); continue; }
    (function scan(v, at) {
      if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${at}[${i}]`));
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
        if (name === 'crew' && COMMAND_KEY.test(k)) problems.push(`${rel}: "${at}.${k}" looks like a command; seats name a provider and model, never a command (decision 0005)`);
        scan(x, `${at}.${k}`);
      }
    })(data, '$');
  }
}

// `npx skills add` copies a skill folder as is, so tests and fixtures under skills/ end up in the
// user's project. Dev files live in tests/ at the repo root.
const DEV_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const DEV_DIR = new Set(['tests', 'test', '__tests__', 'fixtures', 'node_modules']);
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(ROOT, path.join(dir, e.name));
    if (e.isDirectory()) {
      if (DEV_DIR.has(e.name)) problems.push(`${rel}/: dev directory inside skills/ is installed into users' projects; move it to tests/`);
      else walk(path.join(dir, e.name));
    } else if (DEV_FILE.test(e.name)) problems.push(`${rel}: test file inside skills/ is installed into users' projects; move it to tests/`);
  }
})(skillsDir);

for (const [skill, args] of [['docmap', ['check']], ['backlog', ['check']]]) {
  const cli = path.join(skillsDir, skill, 'scripts', `${skill}.mjs`);
  if (!fs.existsSync(cli)) continue;
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) problems.push(`${skill} ${args.join(' ')} failed:\n${(r.stdout + r.stderr).trim()}`);
  else console.log((r.stdout || '').trim());
}

const testsDir = path.join(ROOT, 'tests');
const testFiles = fs.existsSync(testsDir) ? fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.mjs')).map((f) => path.join(testsDir, f)) : [];
const tests = spawnSync(process.execPath, ['--test', ...testFiles], { encoding: 'utf8', stdio: 'inherit' });
if (tests.status !== 0) problems.push('tests failed');

for (const p of problems) console.error(`error: ${p}`);
if (problems.length) {
  console.error(`verify: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`verify: OK (${skills.length} skills: ${skills.join(', ')})`);
