// Run: node --test tests/catalog.test.mjs
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, renderReadme } from '../scripts/catalog.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'catalog.mjs');
const entry = (name, extra = {}) => ({ name, category: 'software', summary: `${name} summary`, triggers: `${name} triggers`, requires: [], optional: [], ...extra });
const good = () => ({ skills: [entry('a'), entry('b', { requires: ['a'], optional: ['a'] })] });
const names = ['a', 'b'];

describe('validate', () => {
  test('accepts a valid catalog', () => assert.deepEqual(validate(good(), names), []));

  test('skill folder missing from the catalog', () => {
    const c = good(); c.skills.pop();
    assert.match(validate(c, names).join('\n'), /skill folder "b" is missing/);
  });
  test('entry naming an unknown skill', () => {
    const c = good(); c.skills.push(entry('ghost'));
    assert.match(validate(c, names).join('\n'), /"ghost" is not a skill folder/);
  });
  test('duplicate name', () => {
    const c = good(); c.skills.push(entry('a'));
    assert.match(validate(c, names).join('\n'), /duplicate name "a"/);
  });
  test('unknown category', () => {
    const c = good(); c.skills[0].category = 'misc';
    assert.match(validate(c, names).join('\n'), /unknown category "misc"/);
  });
  test('requires target does not exist', () => {
    const c = good(); c.skills[0].requires = ['nope'];
    assert.match(validate(c, names).join('\n'), /requires "nope" does not exist/);
  });
  test('optional target does not exist', () => {
    const c = good(); c.skills[0].optional = ['nope'];
    assert.match(validate(c, names).join('\n'), /optional "nope" does not exist/);
  });
  test('summary and triggers must be single non-empty lines', () => {
    const c = good(); c.skills[0].summary = 'a\nb'; c.skills[1].triggers = ' ';
    const p = validate(c, names).join('\n');
    assert.match(p, /summary must be a single line/);
    assert.match(p, /needs a non-empty triggers/);
  });
  test('skills must be an array', () => assert.match(validate({}, names)[0], /must be an array/));
});

describe('renderReadme', () => {
  const md = (body = 'old') => `# t\n\n<!-- catalog:software:start -->\n${body}\n<!-- catalog:software:end -->\n\ntail\n`;

  test('replaces the table between markers and keeps the rest', () => {
    const out = renderReadme(md(), good());
    assert.match(out, /^# t\n\n<!-- catalog:software:start -->\n\| Skill \| What it does \| When it triggers \|\n\|---\|---\|---\|\n\| \[`a`\]\(skills\/a\/\) \| a summary \| a triggers \|\n\| \[`b`\]/);
    assert.ok(out.endsWith('<!-- catalog:software:end -->\n\ntail\n'));
  });
  test('is idempotent', () => {
    const once = renderReadme(md(), good());
    assert.equal(renderReadme(once, good()), once);
  });
  test('escapes pipes in cells', () => {
    const c = good(); c.skills[0].summary = 'x | y';
    assert.match(renderReadme(md(), c), /x \\\| y/);
  });
  test('missing markers throw', () => assert.throws(() => renderReadme('# no markers\n', good()), /found 0 and 0/));
  test('duplicated markers throw', () => assert.throws(() => renderReadme(md() + md(), good()), /found 2 and 2/));
  test('end before start throws', () => assert.throws(() => renderReadme('<!-- catalog:software:end -->\n<!-- catalog:software:start -->\n', good()), /comes before/));
  test('category with no entries needs no markers', () => {
    const c = { skills: [entry('a')] };
    assert.equal(renderReadme(md(), c).includes('catalog:setup'), false);
  });
});

describe('CLI', () => {
  let root;
  const run = (...args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, CATALOG_ROOT: root } }); return { code: r.status, out: r.stdout, err: r.stderr }; };
  const readme = () => fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'));
    for (const n of names) fs.mkdirSync(path.join(root, 'skills', n), { recursive: true });
    fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify(good()));
    fs.writeFileSync(path.join(root, 'README.md'), '# t\n<!-- catalog:software:start -->\nold\n<!-- catalog:software:end -->\n');
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('--check exits 1 naming the stale file, --write fixes it, --check then passes', () => {
    const r = run('--check');
    assert.equal(r.code, 1);
    assert.match(r.err, /stale: README\.md/);
    assert.equal(run('--write').code, 0);
    assert.equal(run('--check').code, 0);
  });
  test('--write rewrites only changed files (second write is a no-op)', () => {
    run('--write');
    const before = fs.statSync(path.join(root, 'README.md')).mtimeMs;
    const r = run('--write');
    assert.match(r.out, /nothing to write/);
    assert.equal(fs.statSync(path.join(root, 'README.md')).mtimeMs, before);
  });
  test('duplicated markers fail and leave the README untouched', () => {
    const dup = readme() + readme();
    fs.writeFileSync(path.join(root, 'README.md'), dup);
    assert.equal(run('--write').code, 1);
    assert.equal(readme(), dup);
  });
  test('missing markers fail and leave the README untouched', () => {
    fs.writeFileSync(path.join(root, 'README.md'), '# nothing\n');
    assert.equal(run('--write').code, 1);
    assert.equal(readme(), '# nothing\n');
  });
  test('validation problems exit 1 and nothing is written', () => {
    fs.mkdirSync(path.join(root, 'skills', 'extra'));
    const r = run('--write');
    assert.equal(r.code, 1);
    assert.match(r.err, /"extra" is missing/);
    assert.match(readme(), /\nold\n/);
  });
  test('no flag prints usage and exits 2', () => assert.equal(run().code, 2));
});
