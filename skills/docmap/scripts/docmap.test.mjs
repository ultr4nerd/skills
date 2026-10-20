import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, parseFrontmatter, slugify, globToRegExp } from './docmap.mjs';

// ---------------------------------------------------------------------------
// Helpers

const CONFIG = {
  roots: ['docs'],
  numbered: ['docs/decisions', 'docs/learnings'],
  maxDescription: 160,
};

function fm(fields, body = '') {
  const head = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  return `---\n${head}\n---\n\n${body}`;
}

function doc(title, extra = {}, body = `# ${title}\n\nBody text.\n`) {
  return fm({ title, description: `About ${title}`, read_when: `When you need ${title}`, ...extra }, body);
}

// Bodies that satisfy `check`'s section warnings for decisions and learnings.
const DECISION_BODY = (title) => `# ${title}\n\n## Decision\n\nX.\n\n## Why\n\nY.\n\n## Consequences\n\nZ.\n`;
const LEARNING_BODY = (title) => `# ${title}\n\n## What happened\n\nX.\n\n## Lesson\n\nY.\n\n## Apply when\n\nZ.\n`;
const decision = (title, extra = {}) => doc(title, extra, DECISION_BODY(title));

function project(files, config = CONFIG) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmap-'));
  fs.writeFileSync(path.join(dir, 'docmap.json'), JSON.stringify(config));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

function cli(dir, ...args) {
  const out = [];
  const err = [];
  const code = run(args, { cwd: dir, io: { out: (s) => out.push(s), err: (s) => err.push(s) } });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function read(dir, rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

const NESTED = {
  'docs/README.md': fm({ title: 'Project docs', description: '"Root: start here"', read_when: 'Any project context' }),
  'docs/decisions/README.md': fm({ title: 'Decisions', description: 'ADRs', read_when: 'Before changing architecture' }),
  'docs/decisions/0001-use-sqlite.md': decision('Use SQLite', { id: 'decisions-0001', status: 'current', updated: '2026-09-01', tags: '[storage, infra]' }),
  'docs/decisions/0002-drop-redux.md': decision('Drop Redux', { id: 'decisions-0002', status: 'superseded', updated: '2026-09-10' }),
  'docs/specs/payments/garantia.md': doc('Garantía de pago', { tags: '[payments, garantía]' }, [
    '# Garantía de pago',
    '',
    'Intro.',
    '',
    '## Alcance',
    '',
    'Covers card payments only.',
    '',
    '### Fuera de alcance',
    '',
    'Cash.',
    '',
    '## Criterios de aceptación',
    '',
    '- Refund within 30 days',
    '',
    '```md',
    '## Not a heading',
    '```',
    '',
    '## Riesgos',
    '',
    'Chargebacks.',
    '',
  ].join('\n')),
  'docs/specs/payments/checkout.md': doc('Checkout flow', { tags: '[payments]' }, '# Checkout\n\n## Steps\n\nPayment uses the garantía rules.\n'),
  'docs/assets/ignored.md': 'no frontmatter here',
};

// ---------------------------------------------------------------------------
// Frontmatter parser

test('parseFrontmatter handles the YAML subset', () => {
  const lines = [
    '---',
    '# a comment',
    'title: "Adopt pnpm: faster installs"',
    "description: 'it''s quoted'",
    'read_when: plain value with: colon',
    'tags: [a, "b c", d]',
    'more:',
    '  - x',
    '  - "y: z"',
    'area: core # trailing comment',
    'empty:',
    '---',
    'body',
  ];
  const r = parseFrontmatter(lines);
  assert.equal(r.present, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.bodyStart, 12);
  assert.equal(r.data.title, 'Adopt pnpm: faster installs');
  assert.equal(r.data.description, "it's quoted");
  assert.equal(r.data.read_when, 'plain value with: colon');
  assert.deepEqual(r.data.tags, ['a', 'b c', 'd']);
  assert.deepEqual(r.data.more, ['x', 'y: z']);
  assert.equal(r.data.area, 'core');
  assert.equal(r.data.empty, '');
});

test('parseFrontmatter reports errors with line numbers', () => {
  const r = parseFrontmatter(['---', 'title: a', 'title: b', 'junk line', 'description: >', '---']);
  assert.deepEqual(
    r.errors.map((e) => e.line),
    [3, 4, 5],
  );
  assert.equal(parseFrontmatter(['# no frontmatter']).present, false);
  assert.match(parseFrontmatter(['---', 'title: a']).errors[0].message, /not closed/);
});

test('slugify strips diacritics and punctuation', () => {
  assert.equal(slugify('Garantía de pago: ¿qué pasa?'), 'garantia-de-pago-que-pasa');
  assert.equal(slugify('  Señales y acentos  '), 'senales-y-acentos');
});

test('globToRegExp matches directories and files', () => {
  const re = globToRegExp('**/assets/**');
  assert.ok(re.test('docs/assets/x.md'));
  assert.ok(re.test('docs/assets/'));
  assert.ok(!re.test('docs/specs/x.md'));
  assert.ok(globToRegExp('docs/drafts/*.md').test('docs/drafts/a.md'));
});

// ---------------------------------------------------------------------------
// index

test('index generates nested INDEX.md files with descriptions', () => {
  const dir = project(NESTED);
  const r = cli(dir, 'index');
  assert.equal(r.code, 0, r.err);
  for (const p of ['docs/INDEX.md', 'docs/decisions/INDEX.md', 'docs/specs/INDEX.md', 'docs/specs/payments/INDEX.md']) {
    assert.ok(fs.existsSync(path.join(dir, p)), `${p} missing`);
  }
  assert.ok(!fs.existsSync(path.join(dir, 'docs/assets/INDEX.md')), 'excluded dir must not be indexed');

  const root = read(dir, 'docs/INDEX.md');
  assert.match(root, /^# Project docs\n\n_Generated by `docmap index`\. Do not edit by hand\._\n\nRoot: start here\n\n## Directories\n/);
  assert.match(root, /\| \[decisions\/\]\(decisions\/INDEX\.md\) \| ADRs \| Before changing architecture \|/);
  assert.match(root, /\| \[specs\/\]\(specs\/INDEX\.md\) \| \(no README\.md; 0 docs, 1 dirs\) \|  \|/);
  assert.ok(!root.includes('## Documents'), 'empty section must be omitted');
  assert.ok(!root.includes('[README.md]'), 'README must not be listed as a document');

  const decisions = read(dir, 'docs/decisions/INDEX.md');
  assert.match(decisions, /\| \[0001-use-sqlite\.md\]\(0001-use-sqlite\.md\) \| About Use SQLite \| When you need Use SQLite \| current \| 2026-09-01 \|\n\| \[0002-drop-redux\.md\]/);
  assert.match(decisions, /\| superseded \| 2026-09-10 \|/);
  assert.ok(!decisions.includes('## Directories'));

  const payments = read(dir, 'docs/specs/payments/INDEX.md');
  assert.match(payments, /^# payments\n/);
  assert.ok(payments.indexOf('checkout.md') < payments.indexOf('garantia.md'), 'documents sorted by filename');
});

test('index is deterministic and --check detects stale indexes', () => {
  const dir = project(NESTED);
  cli(dir, 'index');
  const before = read(dir, 'docs/decisions/INDEX.md');
  assert.equal(cli(dir, 'index').out.split('\n').pop(), 'docmap index: 4 indexes, 0 changed');
  assert.equal(read(dir, 'docs/decisions/INDEX.md'), before);
  assert.equal(cli(dir, 'index', '--check').code, 0);

  fs.writeFileSync(path.join(dir, 'docs/decisions/0002-drop-redux.md'), decision('Drop Redux', { description: 'Changed' }));
  const check = cli(dir, 'index', '--check');
  assert.equal(check.code, 1);
  assert.match(check.out, /^stale: docs\/decisions\/INDEX\.md$/m);
  assert.ok(!check.out.includes('docs/specs'), 'only the stale index is reported');
  assert.equal(read(dir, 'docs/decisions/INDEX.md'), before, '--check must not write');

  fs.mkdirSync(path.join(dir, 'docs/gone'));
  fs.writeFileSync(path.join(dir, 'docs/gone/INDEX.md'), '# gone\n');
  const fix = cli(dir, 'index');
  assert.match(fix.out, /^removed: docs\/gone\/INDEX\.md$/m);
  assert.equal(cli(dir, 'index', '--check').code, 0);
});

// ---------------------------------------------------------------------------
// find

test('find ranks frontmatter over headings over body', () => {
  const dir = project({
    'docs/a.md': doc('Widget design', {}, '# Widget design\n\nNothing.\n'),
    'docs/b.md': doc('Other', {}, '# Other\n\n## Widget notes\n\nText.\n'),
    'docs/c.md': doc('Plain', {}, '# Plain\n\nMentions a widget here.\n'),
  });
  const r = cli(dir, 'find', 'widget', '--json');
  const hits = JSON.parse(r.out);
  assert.deepEqual(
    hits.map((h) => h.path),
    ['docs/a.md', 'docs/b.md', 'docs/c.md'],
  );
  assert.equal(hits[0].line, 1);
  assert.equal(hits[1].line, 9);
  assert.equal(hits[2].line, 9);
  assert.ok(hits[0].score > hits[1].score && hits[1].score > hits[2].score);
  assert.equal(hits[2].snippet, 'Mentions a widget here.');
});

test('find is case- and diacritic-insensitive, multi-term, filterable', () => {
  const dir = project(NESTED);
  const plain = cli(dir, 'find', 'garantia');
  assert.equal(plain.code, 0);
  assert.match(plain.out.split('\n')[0], /^docs\/specs\/payments\/garantia\.md:1  score=\d+  Garantía de pago — About Garantía de pago$/);
  assert.match(plain.out, /checkout\.md:\d+/);

  const multi = JSON.parse(cli(dir, 'find', 'GARANTÍA', 'refund', '--json').out);
  assert.equal(multi[0].path, 'docs/specs/payments/garantia.md');
  const single = JSON.parse(cli(dir, 'find', 'garantia', '--json').out);
  assert.ok(multi[0].score > single[0].score, 'all-terms bonus applies');

  assert.equal(JSON.parse(cli(dir, 'find', 'payments', '--tag', 'payments', '--json').out).length, 2);
  assert.deepEqual(
    JSON.parse(cli(dir, 'find', 'sqlite', 'redux', '--in', 'docs/decisions', '--status', 'superseded', '--json').out).map((h) => h.path),
    ['docs/decisions/0002-drop-redux.md'],
  );
  assert.equal(JSON.parse(cli(dir, 'find', 'garantia', '--limit', '1', '--json').out).length, 1);
  assert.equal(cli(dir, 'find', 'zzznothing').code, 1);
  assert.equal(cli(dir, 'find').code, 2);
});

// ---------------------------------------------------------------------------
// outline / section / show

test('outline lists nested headings with line numbers and word counts', () => {
  const dir = project(NESTED);
  const r = cli(dir, 'outline', 'docs/specs/payments/garantia.md');
  assert.equal(r.code, 0, r.err);
  const lines = r.out.split('\n');
  assert.equal(lines[0], 'title: Garantía de pago');
  assert.equal(lines[1], 'description: About Garantía de pago');
  assert.match(r.out, /^12  ##     Alcance \(9w\)$/m);
  assert.match(r.out, /^16  ###    Fuera de alcance \(1w\)$/m);
  assert.match(r.out, /^28  ##     Riesgos \(1w\)$/m);
  assert.ok(!r.out.includes('Not a heading'), 'headings inside code fences are ignored');
});

test('section extracts by slug, exact text, prefix, with or without children', () => {
  const dir = project(NESTED);
  const file = 'docs/specs/payments/garantia.md';

  const slug = cli(dir, 'section', file, 'criterios-de-aceptacion');
  assert.equal(slug.code, 0, slug.err);
  assert.equal(slug.out.split('\n')[0], 'docs/specs/payments/garantia.md:20-26');
  assert.match(slug.out, /^## Criterios de aceptación$/m);
  assert.ok(slug.out.includes('## Not a heading'), 'fenced content inside the section is kept');
  assert.ok(!slug.out.includes('Riesgos'));

  const withChildren = cli(dir, 'section', file, 'ALCANCE').out;
  assert.ok(withChildren.includes('### Fuera de alcance') && withChildren.includes('Cash.'));
  const noChildren = cli(dir, 'section', file, 'Alcance', '--no-children').out;
  assert.ok(noChildren.includes('Covers card payments only.') && !noChildren.includes('Fuera de alcance'));

  const last = cli(dir, 'section', file, 'ries');
  assert.equal(last.out, 'docs/specs/payments/garantia.md:28-30\n## Riesgos\n\nChargebacks.');

  const range = cli(dir, 'section', file, '--lines', '12-14');
  assert.equal(range.out, 'docs/specs/payments/garantia.md:12-14\n## Alcance\n\nCovers card payments only.');

  const missing = cli(dir, 'section', file, 'nope');
  assert.equal(missing.code, 1);
  assert.match(missing.err, /no heading matches "nope"/);
  assert.match(missing.err, /28  Riesgos/);

  const dir2 = project({ 'docs/s.md': doc('Setup', {}, '# Doc\n\n## Setup local\n\na\n\n## Setup CI\n\nb\n') });
  const ambiguous = cli(dir2, 'section', 'docs/s.md', 'setup');
  assert.equal(ambiguous.code, 1);
  assert.match(ambiguous.err, /ambiguous[\s\S]*Setup local[\s\S]*Setup CI/);
  assert.equal(cli(dir2, 'section', 'docs/s.md', 'setup-ci').out, 'docs/s.md:13-15\n## Setup CI\n\nb');
});

test('show prints frontmatter then outline', () => {
  const dir = project(NESTED);
  const r = cli(dir, 'show', 'docs/decisions/0001-use-sqlite.md');
  assert.equal(r.code, 0);
  assert.match(r.out, /^path: docs\/decisions\/0001-use-sqlite\.md\ntitle: Use SQLite\n/);
  assert.match(r.out, /^tags: \[storage, infra\]$/m);
  assert.match(r.out, /^\d+  #      Use SQLite \(\d+w\)$/m);
  assert.equal(cli(dir, 'show', 'docs/none.md').code, 1);
});

// ---------------------------------------------------------------------------
// check

test('check passes on a healthy tree', () => {
  const dir = project(NESTED);
  cli(dir, 'index');
  const r = cli(dir, 'check');
  assert.equal(r.code, 0, r.out);
  assert.equal(r.out, 'docmap check: OK (6 docs, 4 dirs)');
});

test('check reports each kind of error with file and line', () => {
  const dir = project({
    ...NESTED,
    'docs/nofm.md': '# No frontmatter\n',
    'docs/long.md': doc('Long', { description: 'x'.repeat(161), status: 'bogus', supersedes: 'ghost', id: 'decisions-0001' }),
    'docs/links.md': doc('Links', {}, '# Links\n\nok [a](../docs/nofm.md) [b](https://x.y) [c](#anchor) [d](mailto:a@b.c)\nbad [e](missing.md#sec) `[f](not-checked.md)`\n'),
    'docs/decisions/0001-dup-number.md': decision('Dup', { id: 'other' }),
    'docs/decisions/not-numbered.md': decision('Unnumbered'),
  });
  cli(dir, 'index');
  fs.writeFileSync(path.join(dir, 'docs/decisions/0002-drop-redux.md'), decision('Drop Redux', { description: 'Changed' }));
  const r = cli(dir, 'check');
  assert.equal(r.code, 1);
  const expected = [
    'error: docs/decisions/0001-use-sqlite.md: number 0001 already used by docs/decisions/0001-dup-number.md',
    'error: docs/decisions/0001-use-sqlite.md:1: duplicate id "decisions-0001", also in docs/long.md',
    'error: docs/decisions/INDEX.md: stale INDEX.md: run "docmap index"',
    'error: docs/decisions/not-numbered.md: file in numbered dir must be named NNNN-slug.md (use "docmap new docs/decisions ...")',
    'error: docs/links.md:10: broken link: missing.md#sec',
    'error: docs/long.md:1: description is 161 chars, max 160',
    'error: docs/long.md:1: invalid status "bogus", expected one of: draft, current, deprecated, superseded',
    'error: docs/long.md:1: supersedes unknown id "ghost"',
    'error: docs/nofm.md:1: missing frontmatter (title, description, read_when)',
  ];
  for (const line of expected) assert.ok(r.out.includes(line), `missing: ${line}\n${r.out}`);
  assert.ok(!r.out.includes('not-checked.md'), 'links inside code spans are ignored');
  assert.ok(!r.out.includes('docs/specs/payments/INDEX.md'), 'fresh indexes are not reported');
  assert.match(r.out, /docmap check: 9 error\(s\), 0 warning\(s\)$/);
});

test('check --fix regenerates indexes and warns about old drafts and long docs', () => {
  const dir = project({
    'docs/a.md': doc('Old draft', { status: 'draft', updated: '2020-01-01' }),
    'docs/b.md': doc('Huge', {}, `# Huge\n${'line\n'.repeat(420)}`),
  });
  assert.equal(cli(dir, 'check').code, 1, 'missing index is an error');
  const r = cli(dir, 'check', '--fix');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^fixed: docs\/INDEX\.md$/m);
  assert.match(r.out, /^warning: docs\/a\.md: draft for \d+ days/m);
  assert.match(r.out, /^warning: docs\/b\.md: 42\d lines/m);
  assert.match(r.out, /docmap check: OK \(2 docs, 1 dirs, 2 warning\(s\)\)$/);
});

test('check reports invalid frontmatter and missing keys', () => {
  const dir = project({
    'docs/a.md': '---\ntitle: a\ndescription: >\n  multi\n---\n',
    'docs/b.md': fm({ title: 'b', description: 'ok', read_when: 'now', tags: 'single', updated: '17/10/2026' }),
  });
  cli(dir, 'index');
  const r = cli(dir, 'check');
  assert.match(r.out, /^error: docs\/a\.md:3: invalid frontmatter: "description": multi-line values are not supported/m);
  assert.match(r.out, /^error: docs\/b\.md:1: "tags" must be a list/m);
  assert.match(r.out, /^error: docs\/b\.md:1: "updated" must be YYYY-MM-DD/m);
});

// ---------------------------------------------------------------------------
// new

test('new scaffolds numbered decisions and slugified docs, then reindexes', () => {
  const dir = project(NESTED);
  cli(dir, 'index');

  const d = cli(dir, 'new', 'docs/decisions', 'Adopt pnpm: faster installs', '--tags', 'tooling, ci', '--description', 'Switch to pnpm', '--read-when', 'Touching lockfiles');
  assert.equal(d.code, 0, d.err);
  assert.equal(d.out, 'docs/decisions/0003-adopt-pnpm-faster-installs.md');
  const text = read(dir, d.out);
  assert.match(text, /^title: "Adopt pnpm: faster installs"$/m);
  assert.match(text, /^id: decisions-0003$/m);
  assert.match(text, /^tags: \[tooling, ci\]$/m);
  assert.match(text, /^updated: \d{4}-\d{2}-\d{2}$/m);
  assert.match(text, /^# Adopt pnpm: faster installs$/m);
  assert.match(text, /^## Decision\n[\s\S]*^## Why\n[\s\S]*^## Consequences\n/m);
  assert.ok(read(dir, 'docs/decisions/INDEX.md').includes('0003-adopt-pnpm-faster-installs.md'), 'index updated');
  assert.equal(cli(dir, 'check').code, 0);

  const l = cli(dir, 'new', 'docs/learnings', 'Señales y acentos', '--description', 'd', '--read-when', 'r');
  assert.equal(l.out, 'docs/learnings/0001-senales-y-acentos.md');
  assert.match(read(dir, l.out), /^## What happened\n[\s\S]*^## Lesson\n[\s\S]*^## Apply when\n/m);

  const s = cli(dir, 'new', 'docs/specs', 'Refund API', '--template', 'spec');
  assert.equal(s.out.split('\n')[0], 'docs/specs/refund-api.md');
  assert.match(read(dir, s.out.split('\n')[0]), /^## Acceptance criteria$/m);

  const again = cli(dir, 'new', 'docs/specs', 'Refund API');
  assert.equal(again.code, 1);
  assert.match(again.err, /refusing to overwrite/);
  assert.equal(cli(dir, 'new', 'src', 'Nope').code, 1);
  assert.equal(cli(dir, 'new', 'docs', 'X', '--template', 'nope').code, 2);
});

test('check warns about decisions without Why and learnings without Apply when', () => {
  const dir = project({
    ...NESTED,
    'docs/decisions/0003-bare.md': doc('Bare decision', {}, '# Bare decision\n\n## Decision\n\nX.\n'),
    'docs/learnings/0001-ok.md': doc('Fine', {}, LEARNING_BODY('Fine')),
    'docs/learnings/0002-bare.md': doc('Bare learning', {}, '# Bare learning\n\n## What happened\n\nX.\n'),
  });
  cli(dir, 'index');
  const r = cli(dir, 'check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /warning: docs\/decisions\/0003-bare\.md: missing section\(s\) "## Why"/);
  assert.match(r.out, /warning: docs\/learnings\/0002-bare\.md: missing section\(s\) "## Lesson", "## Apply when"/);
  assert.ok(!r.out.includes('0001-ok.md'));
  assert.match(r.out, /2 warning\(s\)\)$/);
});

test('new --template readme writes README.md that becomes the directory row', () => {
  const dir = project(NESTED);
  cli(dir, 'index');
  const r = cli(dir, 'new', 'docs/specs', 'Specs', '--template', 'readme', '--description', 'Feature specs', '--read-when', 'Implementing a feature');
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out, 'docs/specs/README.md');
  assert.match(read(dir, 'docs/INDEX.md'), /\| \[specs\/\]\(specs\/INDEX\.md\) \| Feature specs \| Implementing a feature \|/);
  assert.equal(cli(dir, 'check').code, 0);
});

test('init scaffolds config, routing READMEs and indexes, and never overwrites', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docmap-init-'));
  fs.mkdirSync(path.join(dir, '.git'));
  const r = cli(dir, 'init');
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^created docmap\.json\ncreated docs\/README\.md\ncreated docs\/decisions\/README\.md\ncreated docs\/learnings\/README\.md\nindexed docs\/INDEX\.md/);
  const index = read(dir, 'docs/INDEX.md');
  assert.match(index, /\| \[decisions\/\]\(decisions\/INDEX\.md\) \| Choices that constrain/);
  assert.match(index, /\| \[learnings\/\]\(learnings\/INDEX\.md\) \| Surprises/);
  assert.equal(cli(dir, 'check').out, 'docmap check: OK (3 docs, 3 dirs)');
  const again = cli(dir, 'init', '--root', 'other');
  assert.equal(again.code, 0);
  assert.match(again.out, /docmap\.json exists; --root ignored/);
  assert.match(again.out, /exists  docs\/README\.md/);
  assert.ok(!fs.existsSync(path.join(dir, 'other')));

  const custom = fs.mkdtempSync(path.join(os.tmpdir(), 'docmap-init-'));
  assert.equal(cli(custom, 'init', '--root', 'documentation').code, 0);
  assert.deepEqual(JSON.parse(read(custom, 'docmap.json')).numbered, ['documentation/decisions', 'documentation/learnings']);
  assert.equal(cli(custom, 'check').code, 0);
});

// ---------------------------------------------------------------------------
// stats, help, usage

test('stats and help', () => {
  const dir = project(NESTED);
  const stats = cli(dir, 'stats');
  assert.equal(stats.code, 0);
  assert.match(stats.out, /^docs: 6\ndirs: 4\nwords: \d+/);
  assert.match(stats.out, /largest docs:\n\s+\d+w\s+\d+ lines  docs\//);

  assert.equal(cli(dir, 'help').code, 0);
  assert.equal(cli(dir, '--help').code, 0);
  assert.match(cli(dir, 'section', '--help').out, /--lines/);
  const unknown = cli(dir, 'bogus');
  assert.equal(unknown.code, 2);
  assert.match(unknown.err, /unknown command/);
  assert.equal(cli(dir, 'find', 'x', '--nope').code, 2);
});

test('project root is found by walking up from a subdirectory', () => {
  const dir = project(NESTED);
  cli(dir, 'index');
  const sub = path.join(dir, 'docs/specs');
  const r = cli(sub, 'find', 'checkout', '--in', 'payments', '--json');
  assert.equal(JSON.parse(r.out)[0].path, 'docs/specs/payments/checkout.md');
  assert.equal(cli(sub, 'show', 'payments/checkout.md').code, 0);
});
