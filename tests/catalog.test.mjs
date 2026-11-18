// Run: node --test tests/catalog.test.mjs
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, renderReadme, renderCatalogMd } from '../scripts/catalog.mjs';

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
  test('nameless and null entries', () => {
    const c = good(); c.skills.push(null, { category: 'software' });
    assert.equal(validate(c, names).filter((x) => /has no name/.test(x)).length, 2);
  });
  test('requires and optional must be arrays', () => {
    const c = good(); c.skills[0].requires = 'b'; c.skills[1].optional = undefined;
    const p = validate(c, names).join('\n');
    assert.match(p, /"a" requires must be an array/);
    assert.match(p, /"b" optional must be an array/);
  });
  test('self-dependency in requires and optional', () => {
    const c = good(); c.skills[0].requires = ['a']; c.skills[0].optional = ['a'];
    const p = validate(c, names).join('\n');
    assert.match(p, /"a" requires itself/);
    assert.match(p, /"a" optional itself/);
  });
  test('missing or non-string summary and triggers', () => {
    const c = good(); delete c.skills[0].summary; c.skills[0].triggers = 5;
    const p = validate(c, names).join('\n');
    assert.match(p, /"a" needs a non-empty summary/);
    assert.match(p, /"a" needs a non-empty triggers/);
  });
  test('newlines rejected in summary and triggers', () => {
    const c = good(); c.skills[0].summary = 'x\ny'; c.skills[0].triggers = 'x\r\ny';
    const p = validate(c, names).join('\n');
    assert.match(p, /summary must be a single line/);
    assert.match(p, /triggers must be a single line/);
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
  test('duplicate later-category marker inside an earlier region throws', () => {
    const c = { skills: [entry('a'), entry('b', { category: 'tool-guide' })] };
    const ok = '<!-- catalog:software:start -->\n<!-- catalog:software:end -->\n<!-- catalog:tool-guide:start -->\n<!-- catalog:tool-guide:end -->\n';
    const bad = ok.replace('\n<!-- catalog:software:end -->', '\n<!-- catalog:tool-guide:start -->\n<!-- catalog:software:end -->');
    assert.doesNotThrow(() => renderReadme(ok, c));
    assert.throws(() => renderReadme(bad, c), /found 2 and 1/);
  });
  test('overlapping regions throw', () => {
    const c = { skills: [entry('a'), entry('b', { category: 'tool-guide' })] };
    const t = '<!-- catalog:software:start -->\n<!-- catalog:tool-guide:start -->\n<!-- catalog:software:end -->\n<!-- catalog:tool-guide:end -->\n';
    assert.throws(() => renderReadme(t, c), /overlap/);
  });
  test('category with no entries needs no markers', () => {
    const c = { skills: [entry('a')] };
    assert.equal(renderReadme(md(), c).includes('catalog:setup'), false);
  });
});

describe('renderCatalogMd', () => {
  test('header, one heading per category, one entry per skill with deps', () => {
    const c = { skills: [entry('a'), entry('b', { category: 'tool-guide', requires: ['a'], optional: ['a'] })] };
    const out = renderCatalogMd('ignored', c);
    assert.match(out, /^# Skill catalog\n\nGenerated by scripts\/catalog\.mjs from catalog\.json; do not edit\.\n/);
    assert.match(out, /## Running software projects \(`software`\)\n\n### a\n\n- Summary: a summary\n- Triggers: a triggers\n- Requires: none\n- Optional: none\n/);
    assert.match(out, /## Tool guides \(`tool-guide`\)\n\n### b\n[\s\S]*- Requires: `a`\n- Optional: `a`\n/);
    assert.equal(out.includes('## Orchestration'), false);
    assert.ok(out.endsWith('\n') && !out.endsWith('\n\n'));
  });
  test('is independent of the current text (idempotent)', () => {
    const once = renderCatalogMd('', good());
    assert.equal(renderCatalogMd(once, good()), once);
  });
});

describe('CLI', () => {
  let root;
  const run = (...args) => { const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', env: { ...process.env, CATALOG_ROOT: root } }); return { code: r.status, out: r.stdout, err: r.stderr }; };
  const readme = () => fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-'));
    // setup is in the fixture because --write creates skills/setup/references/, which then counts as a skill folder.
    for (const n of [...names, 'setup']) fs.mkdirSync(path.join(root, 'skills', n), { recursive: true });
    fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify({ skills: [...good().skills, entry('setup', { category: 'setup' })] }));
    fs.writeFileSync(path.join(root, 'README.md'), '# t\n<!-- catalog:software:start -->\nold\n<!-- catalog:software:end -->\n<!-- catalog:setup:start -->\n<!-- catalog:setup:end -->\n');
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
  test('duplicate later-category marker inside an earlier region fails CLI, README untouched', () => {
    fs.writeFileSync(path.join(root, 'catalog.json'), JSON.stringify({ skills: [entry('a'), entry('b', { category: 'tool-guide' }), entry('setup', { category: 'setup' })] }));
    const t = '<!-- catalog:software:start -->\n<!-- catalog:tool-guide:start -->\n<!-- catalog:software:end -->\n<!-- catalog:tool-guide:start -->\nx\n<!-- catalog:tool-guide:end -->\n<!-- catalog:setup:start -->\n<!-- catalog:setup:end -->\n';
    fs.writeFileSync(path.join(root, 'README.md'), t);
    const r = run('--write');
    assert.equal(r.code, 1);
    assert.match(r.err, /found 2 and 1/);
    assert.equal(readme(), t);
  });
  test('--write also generates skills/setup/references/catalog.md; --check flags it stale', () => {
    const f = path.join(root, 'skills', 'setup', 'references', 'catalog.md');
    run('--write');
    assert.match(fs.readFileSync(f, 'utf8'), /^# Skill catalog\n\nGenerated by scripts\/catalog\.mjs/);
    assert.equal(run('--check').code, 0);
    fs.writeFileSync(f, 'hand edited\n');
    const r = run('--check');
    assert.equal(r.code, 1);
    assert.match(r.err, /stale: skills\/setup\/references\/catalog\.md/);
    assert.doesNotMatch(r.err, /stale: README/);
    run('--write');
    assert.equal(run('--check').code, 0);
  });
  test('--check names the catalog reference when it is missing', () => {
    run('--write');
    fs.rmSync(path.join(root, 'skills', 'setup', 'references'), { recursive: true });
    assert.match(run('--check').err, /stale: skills\/setup\/references\/catalog\.md/);
  });
  test('no flag prints usage and exits 2', () => assert.equal(run().code, 2));
});
