#!/usr/bin/env node
// verify: the single definition of "green" for this repo. Runs every skill's tests, checks
// that every skill has a SKILL.md with name + description matching its folder, that the README
// catalog lists every skill, and that each CLI answers --version with the version in package.json.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const skillsDir = path.join(ROOT, 'skills');
const skills = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const problems = [];

for (const name of skills) {
  const dir = path.join(skillsDir, name);
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) { problems.push(`${name}: missing SKILL.md`); continue; }
  const text = fs.readFileSync(skillFile, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) { problems.push(`${name}: SKILL.md has no frontmatter`); continue; }
  const field = (k) => (new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm[1]) || [])[1]?.trim();
  if (field('name') !== name) problems.push(`${name}: SKILL.md name is "${field('name')}", expected "${name}"`);
  const desc = field('description') || '';
  if (desc.length < 40 || desc.length > 1024) problems.push(`${name}: description must be 40..1024 chars (is ${desc.length})`);
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

const tests = spawnSync(process.execPath, ['--test', ...skills.map((n) => path.join(skillsDir, n, 'scripts', `${n}.test.mjs`)).filter((f) => fs.existsSync(f))], { encoding: 'utf8', stdio: 'inherit' });
if (tests.status !== 0) problems.push('tests failed');

for (const p of problems) console.error(`error: ${p}`);
if (problems.length) {
  console.error(`verify: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`verify: OK (${skills.length} skills: ${skills.join(', ')})`);
