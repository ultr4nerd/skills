// Run: node --test scripts/backlog.test.mjs
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backlog.mjs');
const NOW = '2026-10-17T10:12:00';

let root;

function run(args, { now = NOW, cwd = root, env = {} } = {}) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, BACKLOG_NOW: now, BACKLOG_OWNER: 'tester', ...env },
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

function ok(args, opts) {
  const r = run(args, opts);
  assert.equal(r.code, 0, `expected exit 0 for ${args.join(' ')}\nstdout: ${r.out}\nstderr: ${r.err}`);
  return r;
}

function fails(args, code, pattern, opts) {
  const r = run(args, opts);
  assert.equal(r.code, code, `expected exit ${code} for ${args.join(' ')}\nstdout: ${r.out}\nstderr: ${r.err}`);
  if (pattern) assert.match(r.err + r.out, pattern);
  return r;
}

const issueFile = (id) => fs.readdirSync(path.join(root, 'backlog/issues')).filter((f) => f.startsWith(`${id}-`)).map((f) => path.join(root, 'backlog/issues', f))[0];
const readIssue = (id) => fs.readFileSync(issueFile(id), 'utf8');
const fm = (id, key) => {
  const m = new RegExp(`^${key}:(.*)$`, 'm').exec(readIssue(id));
  return m ? m[1].trim() : undefined;
};
const progress = (id) => path.join(root, 'progress', `${id}.md`);
const indexFile = () => path.join(root, 'backlog/INDEX.md');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'backlog-test-'));
  fs.writeFileSync(path.join(root, 'backlog.json'), JSON.stringify({ areas: ['core', 'web'], verify: 'npm test' }));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function seed() {
  ok(['new', 'Auth epic', '--kind', 'epic', '--priority', 'P1', '--area', 'core']);
  ok(['new', 'Add login endpoint', '--parent', 'ISS-1', '--priority', 'P1', '--area', 'core', '--criteria', 'returns 200|returns 401', '--context', 'See docs/auth.md']);
  ok(['new', 'Add session cookie', '--parent', 'ISS-1', '--depends-on', 'ISS-2', '--priority', 'P0', '--criteria', 'HttpOnly']);
  ok(['new', 'Write docs', '--priority', 'P2', '--due', '2026-11-01', '--tags', 'docs,auth', '--criteria', 'docs exist']);
}

describe('new', () => {
  test('creates a file with defaults, slug and regenerated INDEX', () => {
    const r = ok(['new', 'Añadir señal: café']);
    assert.match(r.out, /^created ISS-0001 backlog\/issues\/ISS-0001-anadir-senal-cafe\.md/);
    const text = readIssue('ISS-0001');
    assert.ok(text.startsWith('---\nid: ISS-0001\ntitle: "Añadir señal: café"\nkind: feature\nstatus: todo\npriority: P2\n'));
    assert.match(text, /created: 2026-10-17\nupdated: 2026-10-17\n/);
    assert.match(text, /## Acceptance criteria\n\n## Notes/);
    assert.ok(fs.existsSync(indexFile()));
    assert.match(fs.readFileSync(indexFile(), 'utf8'), /\[ISS-0001\]\(issues\/ISS-0001-anadir-senal-cafe\.md\)/);
  });

  test('fills context, criteria, deps, parent, tags and validates values', () => {
    seed();
    const text = readIssue('ISS-0003');
    assert.match(text, /depends_on: \[ISS-0002\]/);
    assert.match(text, /parent: ISS-0001/);
    assert.match(text, /- \[ \] HttpOnly/);
    assert.match(readIssue('ISS-0004'), /tags: \[docs, auth\]/);
    assert.match(readIssue('ISS-0002'), /## Context\nSee docs\/auth\.md\n/);
    fails(['new', 'bad', '--priority', 'P9'], 1, /priority: "P9" is not a valid priority/);
    fails(['new', 'bad', '--area', 'nope'], 1, /area: "nope" is not a valid area/);
    fails(['new', 'bad', '--depends-on', 'ISS-99'], 1, /unknown issue ISS-0099/);
    fails(['new', 'bad', '--due', '2026-13-01'], 1, /not a YYYY-MM-DD date/);
    fails(['new', 'bad', '--status', 'in-progress'], 1, /requires --owner/);
    fails(['new'], 2, /title is required/);
  });
});

describe('list and show', () => {
  test('list hides closed issues by default and supports filters, sort and json', () => {
    seed();
    ok(['tick', 'ISS-2', 'all']);
    ok(['start', 'ISS-2', '--owner', 'ana']);
    ok(['done', 'ISS-2', '--outcome', 'shipped']);
    const r = ok(['list']);
    assert.doesNotMatch(r.out, /ISS-0002/);
    assert.match(ok(['list', '--all']).out, /ISS-0002/);
    assert.match(ok(['list', '--status', 'done']).out, /ISS-0002/);
    const json = JSON.parse(ok(['list', '--json', '--tag', 'docs']).out);
    assert.equal(json.length, 1);
    assert.equal(json[0].id, 'ISS-0004');
    assert.equal(json[0].file, 'backlog/issues/ISS-0004-write-docs.md');
    const byDue = JSON.parse(ok(['list', '--json', '--sort', 'due']).out).map((i) => i.id);
    assert.equal(byDue[0], 'ISS-0004');
    assert.equal(ok(['list', '--kind', 'epic', '--json']).out.match(/"id"/g).length, 1);
    assert.match(ok(['list', '--due-before', '2026-12-01', '--json']).out, /ISS-0004/);
    fails(['list', '--sort', 'nope'], 2, /unknown sort/);
    fails(['list', '--bogus'], 2, /unknown option --bogus/);
  });

  test('show prints the file, --brief prints criteria and last 3 log lines', () => {
    seed();
    const full = ok(['show', '2']);
    assert.match(full.out, /^# backlog\/issues\/ISS-0002-add-login-endpoint\.md\n---\nid: ISS-0002/);
    assert.match(full.out, /## Outcome/);
    for (const n of [1, 2, 3, 4]) ok(['log', 'ISS-2', `step ${n}`]);
    const brief = ok(['show', 'ISS-0002', '--brief']).out;
    assert.match(brief, /^ISS-0002  P1  todo  feature  area:core/);
    assert.match(brief, /parent: ISS-0001/);
    assert.match(brief, /- \[ \] returns 200/);
    assert.doesNotMatch(brief, /step 1/);
    assert.match(brief, /step 2\n.*step 3\n.*step 4/);
    fails(['show', 'ISS-42'], 1, /issue ISS-0042 not found/);
    fails(['show', 'abc'], 1, /invalid issue id/);
  });
});

describe('set', () => {
  test('validates values, bumps updated, supports list ops', () => {
    seed();
    ok(['set', 'ISS-4', 'priority=P0', 'estimate=M', 'tags+=urgent', 'tags-=docs'], { now: '2026-10-18T09:00:00' });
    assert.equal(fm('ISS-0004', 'priority'), 'P0');
    assert.equal(fm('ISS-0004', 'estimate'), 'M');
    assert.equal(fm('ISS-0004', 'tags'), '[auth, urgent]');
    assert.equal(fm('ISS-0004', 'updated'), '2026-10-18');
    fails(['set', 'ISS-4', 'priority=P7'], 1, /priority: "P7"/);
    fails(['set', 'ISS-4', 'kind=story'], 1, /kind: "story"/);
    fails(['set', 'ISS-4', 'estimate=XXL'], 1, /estimate/);
    fails(['set', 'ISS-4', 'due=soon'], 1, /due: "soon"/);
    fails(['set', 'ISS-4', 'id=ISS-9'], 1, /cannot set "id"/);
    fails(['set', 'ISS-4', 'colour=red'], 1, /cannot set "colour"/);
    fails(['set', 'ISS-4', 'priority'], 2, /expected key=value/);
    fails(['set', 'ISS-4'], 2, /nothing to set/);
  });

  test('rejects unknown dependencies and cycles', () => {
    seed();
    fails(['set', 'ISS-2', 'depends_on=ISS-99'], 1, /unknown issue ISS-0099/);
    fails(['set', 'ISS-2', 'depends_on=ISS-2'], 1, /cannot depend on itself/);
    // ISS-3 depends on ISS-2; ISS-2 -> ISS-4 -> ISS-3 would close the loop.
    ok(['set', 'ISS-4', 'depends_on=ISS-3']);
    fails(['set', 'ISS-2', 'depends_on=ISS-4'], 1, /cycle: ISS-0002 -> ISS-0004 -> ISS-0003 -> ISS-0002/);
    fails(['set', 'ISS-1', 'parent=ISS-2'], 1, /parent would create a cycle/);
    fails(['set', 'ISS-1', 'parent=ISS-1'], 1, /its own parent/);
  });

  test('enforces status transitions', () => {
    seed();
    fails(['set', 'ISS-2', 'status=done'], 1, /use "backlog done ISS-0002"/);
    ok(['set', 'ISS-2', 'status=done', '--force']);
    ok(['set', 'ISS-2', 'status=todo']);
    fails(['set', 'ISS-2', 'status=in-progress'], 1, /requires an owner/);
    fails(['set', 'ISS-3', 'status=in-progress', '--owner', 'ana'], 1, /dependencies not done: ISS-0002/);
    ok(['set', 'ISS-3', 'status=in-progress', '--owner', 'ana', '--force']);
    fails(['set', 'ISS-2', 'status=in-progress', 'owner=ana'], 1, /ana already has ISS-0003 in progress/);
    ok(['set', 'ISS-2', 'status=in-progress', 'owner=bob']);
    fails(['set', 'ISS-2', 'owner='], 1, /in-progress requires an owner/);
    fails(['set', 'ISS-2', 'status=flying'], 1, /status: "flying"/);
    ok(['set', 'ISS-2', 'status=cancelled']);
    assert.equal(fm('ISS-0002', 'status'), 'cancelled');
  });

  test('preserves unknown keys, key order and body verbatim', () => {
    seed();
    const file = issueFile('ISS-0004');
    const custom = [
      '---',
      '# a comment line',
      'id: ISS-0004',
      'title: \'It\'\'s quoted\'',
      'custom_key: keep me   # trailing comment',
      'kind: chore',
      'status: todo',
      'priority: P3',
      'tags:',
      '  - alpha',
      '  - "beta, gamma"',
      'created: 2026-10-01',
      'updated: 2026-10-01',
      '---',
      '',
      'Preamble    with   odd   spacing',
      '',
      '## Acceptance criteria',
      '- [x] fine',
      '',
      '## Notes',
      'Line with trailing spaces   ',
      '',
      '## Log',
      '',
    ].join('\n');
    fs.writeFileSync(file, custom);
    ok(['set', 'ISS-4', 'priority=P1']);
    const after = fs.readFileSync(file, 'utf8');
    assert.ok(after.startsWith('---\nid: ISS-0004\ntitle: "It\'s quoted"\ncustom_key: keep me\nkind: chore\nstatus: todo\npriority: P1\ntags: [alpha, "beta, gamma"]\ncreated: 2026-10-01\nupdated: 2026-10-17\n---\n'), after);
    assert.ok(after.endsWith('\nPreamble    with   odd   spacing\n\n## Acceptance criteria\n- [x] fine\n\n## Notes\nLine with trailing spaces   \n\n## Log\n'), after);
    const json = JSON.parse(ok(['show', 'ISS-4', '--json']).out);
    assert.deepEqual(json.tags, ['alpha', 'beta, gamma']);
    assert.equal(json.title, "It's quoted");
  });
});

describe('start, log, block, unblock', () => {
  test('start claims, creates the progress file and logs', () => {
    seed();
    const r = ok(['start', 'ISS-2', '--owner', 'ana', '--branch', 'feat/login']);
    assert.match(r.out, /ISS-0002  P1  in-progress  feature  area:core  owner:ana/);
    assert.match(r.out, /verify: npm test/);
    assert.equal(fm('ISS-0002', 'status'), 'in-progress');
    assert.equal(fm('ISS-0002', 'branch'), 'feat/login');
    assert.ok(fs.existsSync(progress('ISS-0002')));
    assert.match(fs.readFileSync(progress('ISS-0002'), 'utf8'), /^# ISS-0002 Add login endpoint\n/);
    assert.match(readIssue('ISS-0002'), /## Log\n- 2026-10-17 10:12 ana: started on feat\/login; plan in progress\/ISS-0002\.md\n/);
    fails(['start', 'ISS-4', '--owner', 'ana'], 1, /already has ISS-0002 in progress/);
    assert.match(ok(['start', 'ISS-2', '--owner', 'ana']).out, /already in progress by ana; resuming/);
  });

  test('log appends and creates the section when missing', () => {
    seed();
    ok(['log', 'ISS-4', 'first', '--owner', 'bob'], { now: '2026-10-18T08:05:00' });
    ok(['log', 'ISS-4', 'second']);
    assert.match(readIssue('ISS-0004'), /## Log\n- 2026-10-18 08:05 bob: first\n- 2026-10-17 10:12 tester: second\n\n## Outcome/);
    assert.equal(fm('ISS-0004', 'updated'), '2026-10-17');
    const file = issueFile('ISS-0004');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/## Log[\s\S]*?(?=## Outcome)/, ''));
    ok(['log', 'ISS-4', 'third']);
    assert.match(readIssue('ISS-0004'), /## Outcome\n[\s\S]*\n## Log\n- 2026-10-17 10:12 tester: third\n$/);
    fails(['log', 'ISS-4'], 2, /usage/);
  });

  test('block records the reason; unblock restores in-progress or todo', () => {
    seed();
    ok(['start', 'ISS-2', '--owner', 'ana']);
    const r = ok(['block', 'ISS-2', 'waiting for API key']);
    assert.match(r.out, /ISS-0002 blocked: waiting for API key/);
    assert.equal(fm('ISS-0002', 'status'), 'blocked');
    assert.equal(fm('ISS-0002', 'owner'), 'ana');
    assert.match(readIssue('ISS-0002'), /ana: blocked: waiting for API key/);
    assert.match(ok(['board']).out, /reason: waiting for API key/);
    ok(['unblock', 'ISS-2']);
    assert.equal(fm('ISS-0002', 'status'), 'in-progress');
    ok(['block', 'ISS-4', 'no owner here']);
    ok(['unblock', 'ISS-4']);
    assert.equal(fm('ISS-0004', 'status'), 'todo');
    fails(['unblock', 'ISS-4'], 1, /not blocked/);
    ok(['set', 'ISS-4', 'status=cancelled']);
    fails(['block', 'ISS-4', 'x'], 1, /cannot block a closed issue/);
  });
});

describe('done', () => {
  test('refuses unchecked criteria unless --force, which is logged', () => {
    seed();
    ok(['start', 'ISS-2', '--owner', 'ana']);
    fails(['done', 'ISS-2', '--outcome', 'x'], 1, /2 unchecked acceptance criteria/);
    assert.equal(fm('ISS-0002', 'status'), 'in-progress');
    ok(['done', 'ISS-2', '--outcome', 'forced through', '--force']);
    const text = readIssue('ISS-0002');
    assert.match(text, /ana: done --force with 2 unchecked acceptance criteria\n- 2026-10-17 10:12 ana: done: .+\n/);
    assert.match(text, /## Outcome\nforced through\n$/);
    assert.equal(fm('ISS-0002', 'status'), 'done');
    assert.equal(fm('ISS-0002', 'owner'), '');
    assert.ok(!fs.existsSync(progress('ISS-0002')));
    fails(['done', 'ISS-2', '--outcome', 'x'], 1, /already done/);
  });

  test('takes the Outcome from the progress Summary, refuses when empty, reports parent', () => {
    seed();
    ok(['start', 'ISS-2', '--owner', 'ana']);
    ok(['tick', 'ISS-2', '1']);
    ok(['tick', 'ISS-2', '2']);
    fails(['done', 'ISS-2'], 1, /Outcome is empty; pass --outcome/);
    const pf = progress('ISS-0002');
    fs.writeFileSync(pf, fs.readFileSync(pf, 'utf8').replace(/## Summary\n[\s\S]*$/, '## Summary\nShipped the endpoint.\n\n- verified with npm test\n'));
    const r = ok(['done', 'ISS-2']);
    assert.match(r.out, /ISS-0002 done: Add login endpoint\nparent ISS-0001 has 1 open child\nnext: run "npm test", then commit with ISS-0002/);
    assert.match(readIssue('ISS-0002'), /## Outcome\nShipped the endpoint\.\n\n- verified with npm test\n$/);
    assert.match(fs.readFileSync(indexFile(), 'utf8'), /## done \(1\)/);
    fails(['tick', 'ISS-3', '5'], 1, /criterion 5 does not exist/);
  });
});

describe('next', () => {
  test('orders by priority, due, created, id and skips epics and unmet deps', () => {
    ok(['new', 'Epic', '--kind', 'epic', '--priority', 'P0']);
    ok(['new', 'old P1 no due', '--priority', 'P1'], { now: '2026-01-01T00:00:00' });
    ok(['new', 'P1 due later', '--priority', 'P1', '--due', '2026-12-01']);
    ok(['new', 'P1 due sooner', '--priority', 'P1', '--due', '2026-11-01']);
    ok(['new', 'P0 blocked by deps', '--priority', 'P0', '--depends-on', 'ISS-2']);
    ok(['new', 'P1 same day as 3', '--priority', 'P1', '--due', '2026-11-01']);
    const pick = () => JSON.parse(ok(['next', '--json']).out).id;
    assert.equal(pick(), 'ISS-0004');
    ok(['set', 'ISS-4', 'status=cancelled']);
    assert.equal(pick(), 'ISS-0006');
    ok(['set', 'ISS-6', 'status=cancelled']);
    assert.equal(pick(), 'ISS-0003');
    ok(['set', 'ISS-3', 'status=cancelled']);
    assert.equal(pick(), 'ISS-0002');
    ok(['start', 'ISS-2', '--owner', 'x']);
    ok(['done', 'ISS-2', '--outcome', 'done', '--force']);
    assert.equal(pick(), 'ISS-0005');
    assert.equal(JSON.parse(fails(['next', '--json', '--area', 'web'], 3).out).pick, 'NOTHING TO DO');
  });

  test('--claim starts the issue, resumes, and exits 3/4 deterministically', () => {
    seed();
    const r = ok(['next', '--owner', 'ana', '--claim']);
    assert.match(r.out, /^CLAIMED: ISS-0002\n/);
    assert.match(r.out, /progress: progress\/ISS-0002\.md\nverify: npm test\n$/);
    assert.equal(fm('ISS-0002', 'owner'), 'ana');
    assert.match(ok(['next', '--owner', 'ana', '--claim']).out, /^RESUME: ISS-0002\n/);
    assert.match(ok(['next', '--owner', 'bob']).out, /^NEXT: ISS-0004\n/);
    ok(['block', 'ISS-2', 'tooling broken']);
    const blocked = fails(['next', '--owner', 'ana', '--claim'], 4, /^BLOCKED: ISS-0002\n/);
    assert.match(blocked.out, /reason: tooling broken\n$/);
    ok(['set', 'ISS-2', 'status=cancelled']);
    ok(['set', 'ISS-4', 'status=cancelled']);
    fails(['next', '--owner', 'ana', '--claim'], 3, /^NOTHING TO DO\n$/);
    assert.equal(JSON.parse(fails(['next', '--json'], 3).out).pick, 'NOTHING TO DO');
  });
});

describe('index and check', () => {
  test('index is deterministic, grouped by status, with epic child counts', () => {
    seed();
    ok(['set', 'ISS-4', 'status=cancelled']);
    const first = fs.readFileSync(indexFile(), 'utf8');
    ok(['index']);
    assert.equal(fs.readFileSync(indexFile(), 'utf8'), first);
    assert.match(first, /^# Backlog\n\n<!-- generated/);
    assert.match(first, /\n3 open \/ 0 done \/ 1 cancelled\n/);
    assert.match(first, /## todo \(3\)\n\n\| id \| pri \| kind \| area \| owner \| due \| title \|\n\| --- /);
    assert.match(first, /\| \[ISS-0001\]\(issues\/ISS-0001-auth-epic\.md\) \| P1 \| epic \| core \|  \|  \| Auth epic \(2 children, 2 open\) \|/);
    assert.match(first, /## cancelled \(1\)/);
    assert.ok(first.indexOf('## todo') < first.indexOf('## cancelled'));
    assert.doesNotMatch(first, /## done/);
  });

  test('check catches stale INDEX, duplicate ids, unknown deps, in-progress without owner, orphans', () => {
    seed();
    assert.match(ok(['check']).out, /backlog check: OK \(4 issues\)$/m);

    fs.appendFileSync(indexFile(), 'edited by hand\n');
    fails(['check'], 1, /INDEX\.md: stale or missing; run "backlog index"/);
    assert.match(ok(['check', '--fix']).out, /OK \(4 issues\)/);

    fs.copyFileSync(issueFile('ISS-0004'), path.join(root, 'backlog/issues/ISS-0004-copy.md'));
    fails(['check'], 1, /ISS-0004-write-docs\.md: duplicate id ISS-0004 \(also in backlog\/issues\/ISS-0004-copy\.md\)/);
    fs.unlinkSync(path.join(root, 'backlog/issues/ISS-0004-copy.md'));

    const f3 = issueFile('ISS-0003');
    fs.writeFileSync(f3, fs.readFileSync(f3, 'utf8').replace('depends_on: [ISS-0002]', 'depends_on: [ISS-0002, ISS-0099]'));
    fails(['check'], 1, /ISS-0003-add-session-cookie\.md: depends_on: unknown issue ISS-0099/);
    fs.writeFileSync(f3, fs.readFileSync(f3, 'utf8').replace('depends_on: [ISS-0002, ISS-0099]', 'depends_on: [ISS-0002]'));

    const f2 = issueFile('ISS-0002');
    fs.writeFileSync(f2, fs.readFileSync(f2, 'utf8').replace('status: todo', 'status: in-progress'));
    const r = fails(['check'], 1, /ISS-0002-add-login-endpoint\.md: in-progress without owner/);
    assert.match(r.out, /INDEX\.md: stale/);
    fs.writeFileSync(f2, fs.readFileSync(f2, 'utf8').replace('status: in-progress', 'status: todo'));

    fs.mkdirSync(path.join(root, 'progress'), { recursive: true });
    fs.writeFileSync(progress('ISS-0004'), '# scratch\n');
    fails(['check'], 1, /progress\/ISS-0004\.md: orphan progress file \(ISS-0004 is todo\)/);
    fs.unlinkSync(progress('ISS-0004'));

    fs.writeFileSync(f2, fs.readFileSync(f2, 'utf8').replace('status: todo', 'status: done'));
    const done = fails(['check'], 1, /done without a non-empty "## Outcome"/);
    assert.match(done.out, /warning: .*done with 2 unchecked acceptance criteria/);
    fs.writeFileSync(f2, fs.readFileSync(f2, 'utf8').replace('status: done', 'status: todo'));

    fs.writeFileSync(path.join(root, 'backlog/issues/ISS-0007-wrong.md'), fs.readFileSync(f2, 'utf8'));
    fails(['check'], 1, /ISS-0007-wrong\.md: duplicate id ISS-0002/);
    fs.unlinkSync(path.join(root, 'backlog/issues/ISS-0007-wrong.md'));

    fs.writeFileSync(path.join(root, 'backlog/issues/ISS-0008-broken.md'), 'no frontmatter here\n');
    fails(['check'], 1, /ISS-0008-broken\.md: missing frontmatter/);
    fails(['list'], 1, /ISS-0008-broken\.md: missing frontmatter/);
    fs.unlinkSync(path.join(root, 'backlog/issues/ISS-0008-broken.md'));

    fs.writeFileSync(f2, fs.readFileSync(f2, 'utf8').replace('priority: P1', 'priority: P9'));
    fails(['check'], 1, /priority: "P9" is not a valid priority/);
  });

  test('check warns on stale in-progress, overdue and missing criteria', () => {
    seed();
    ok(['new', 'No criteria', '--due', '2026-10-01']);
    ok(['start', 'ISS-2', '--owner', 'ana']);
    const r = ok(['check'], { now: '2026-10-30T10:00:00' });
    assert.match(r.out, /warning: .*ISS-0002.*in-progress and not updated for 13 days/);
    assert.match(r.out, /warning: .*ISS-0005.*overdue \(due 2026-10-01\)/);
    assert.match(r.out, /warning: .*ISS-0005.*todo with no acceptance criteria/);
    assert.match(r.out, /backlog check: OK \(5 issues, 3 warnings\)/);
    assert.match(ok(['stale'], { now: '2026-10-30T10:00:00' }).out, /ISS-0002 +in-progress +ana +2026-10-17 +13d/);
  });
});

describe('docmap bridge', () => {
  const DOCMAP = path.join(path.dirname(CLI), '..', '..', 'docmap', 'scripts', 'docmap.mjs');
  const docmap = (...args) => spawnSync(process.execPath, [DOCMAP, ...args], { cwd: root, encoding: 'utf8' });
  const withDocs = () => {
    assert.equal(docmap('init').status, 0);
    assert.equal(docmap('new', 'docs/learnings', 'Session cookies need SameSite=None behind the proxy', '--description', 'Cookies dropped unless SameSite=None', '--read-when', 'Touching session or cookie code', '--tags', 'auth').status, 0);
    assert.equal(docmap('new', 'docs/decisions', 'Use signed cookies, not server sessions', '--description', 'No session store', '--read-when', 'Adding per-user server state', '--tags', 'auth').status, 0);
  };

  test('claim, start and show surface related decisions and learnings; silent without docs or when disabled', () => {
    ok(['new', 'Add session cookie to login', '--area', 'core', '--criteria', 'HttpOnly']);
    ok(['new', 'Billing invoices chore', '--criteria', 'x']);
    assert.doesNotMatch(ok(['show', '1', '--brief']).out, /related/, 'no docs tree yet');
    withDocs();
    const r = ok(['next', '--owner', 'ana', '--claim']);
    assert.match(r.out, /related \(read before working[^\n]*\):\n  docs\/learnings\/0001-session-cookies-need-samesite-none-behind-the-proxy\.md  Session cookies need SameSite=None behind the proxy\n  docs\/decisions\/0001-use-signed-cookies-not-server-sessions\.md  Use signed cookies/);
    assert.ok(r.out.indexOf('related') < r.out.indexOf('progress:'), 'related is printed before the progress/verify lines');
    assert.doesNotMatch(ok(['show', '2', '--brief']).out, /related/, 'no frontmatter-level match for an unrelated issue');
    assert.doesNotMatch(ok(['show', '1', '--brief'], { env: { BACKLOG_DOCMAP: '0' } }).out, /related/);
    ok(['tick', '1', 'all']);
    ok(['done', '1', '--outcome', 'ok']);
    const j = JSON.parse(ok(['next', '--owner', 'ana', '--claim', '--json']).out);
    assert.deepEqual(j.related, [], 'json claim carries a related array');
  });

  test('learn files a tagged learning or decision and links it in the Log; done/block take --learning/--decision', () => {
    withDocs();
    ok(['new', 'Login endpoint', '--area', 'core', '--tags', 'auth', '--criteria', 'x']);
    const l = ok(['learn', '1', 'Ingress strips Set-Cookie without Secure', '--read-when', 'Setting cookies behind the ingress']);
    assert.match(l.out, /^docs\/learnings\/0002-ingress-strips-set-cookie-without-secure\.md\nnow write ## What happened, ## Lesson and ## Apply when\n$/);
    const file = fs.readFileSync(path.join(root, 'docs/learnings/0002-ingress-strips-set-cookie-without-secure.md'), 'utf8');
    assert.match(file, /^tags: \[iss-0001, core, auth\]$/m);
    assert.match(file, /^read_when: Setting cookies behind the ingress$/m);
    assert.match(readIssue('ISS-0001'), /tester: learning: docs\/learnings\/0002-ingress-strips-set-cookie-without-secure\.md\n/);

    ok(['start', '1', '--owner', 'ana']);
    const b = ok(['block', '1', 'proxy', '--learning', 'Proxy drops cookies']);
    assert.match(b.out, /blocked: proxy\ndocs\/learnings\/0003-proxy-drops-cookies\.md\nnow write [^\n]*docmap check fails until it is filled\n$/);
    ok(['unblock', '1']);
    ok(['tick', '1', 'all']);
    const d = ok(['done', '1', '--outcome', 'shipped', '--decision', 'Cookies are signed, never server-side']);
    assert.match(d.out, /docs\/decisions\/0002-cookies-are-signed-never-server-side\.md\nnow write ## Decision, ## Why and ## Consequences/);
    assert.doesNotMatch(d.out, /hint:/, 'a linked learning silences the friction hint');
    assert.match(readIssue('ISS-0001'), /ana: decision: docs\/decisions\/0002-/);
    assert.match(fs.readFileSync(path.join(root, 'docs/decisions/0002-cookies-are-signed-never-server-side.md'), 'utf8'), /^## Why$/m);

    fs.rmSync(path.join(root, 'docs'), { recursive: true });
    fs.rmSync(path.join(root, 'docmap.json'));
    fails(['learn', '1', 'nope'], 1, /docmap skill not found/);
  });

  test('done hints at friction; retro lists closed issues with friction and no learning', () => {
    withDocs();
    ok(['new', 'A', '--criteria', 'x']);
    ok(['new', 'B', '--criteria', 'x']);
    ok(['new', 'C', '--criteria', 'x']);
    ok(['start', '1', '--owner', 'ana']);
    ok(['log', '1', 'reverted the first attempt, retry with the flag']);
    ok(['tick', '1', 'all']);
    const d = ok(['done', '1', '--outcome', 'ok']);
    assert.match(d.out, /hint: Log shows revert, retry; if something non-obvious caused it, record it: backlog learn ISS-0001 "<title>"/);
    ok(['start', '2', '--owner', 'ana']);
    ok(['block', '2', 'creds']);
    ok(['cancel', '2', 'dropped']);
    ok(['start', '3', '--owner', 'ana']);
    ok(['tick', '3', 'all']);
    assert.doesNotMatch(ok(['done', '3', '--outcome', 'smooth']).out, /hint:/);

    const r = ok(['retro']);
    assert.match(r.out, /^retro: 2 of 3 issues closed in the last 14 days show friction and have no learning yet\n/);
    assert.match(r.out, /ISS-0001  done       2026-10-17  revert,retry       A/);
    assert.match(r.out, /ISS-0002  cancelled  2026-10-17  blocked,cancelled  B/);
    const j = JSON.parse(ok(['retro', '--json']).out);
    assert.deepEqual(j.map((x) => [x.id, x.signals]), [['ISS-0001', ['revert', 'retry']], ['ISS-0002', ['blocked', 'cancelled']]]);

    ok(['learn', '1', 'Flag X is required', '--read-when', 'Using X']);
    assert.match(ok(['retro']).out, /^retro: 1 of 3 issues/);
    assert.match(ok(['retro', '--days', '0'], { now: '2026-11-01T10:00:00' }).out, /nothing to learn from \(0 issues closed in the last 0 days/);
    fails(['retro', '--days', 'x'], 2);
    assert.match(ok(['--version']).out, /^backlog 0\.1\.0\n$/);
  });
});

describe('board, cancel, help, root discovery', () => {
  test('board summarises counts and sections', () => {
    seed();
    ok(['start', 'ISS-2', '--owner', 'ana']);
    ok(['block', 'ISS-4', 'needs design']);
    const r = ok(['board'], { now: '2026-10-19T10:00:00' });
    assert.match(r.out, /counts: backlog 0 \| todo 2 \| in-progress 1 \| blocked 1 \| review 0 \| done 0 \| cancelled 0/);
    assert.match(r.out, /in-progress \(1\)\n  ISS-0002  P1  ana  updated 2d ago  Add login endpoint/);
    assert.match(r.out, /blocked \(1\)\n  ISS-0004  P2  -  Write docs\n      reason: needs design/);
    assert.match(r.out, /next up \(top 5 todo\) \(1\)\n  ISS-0003  P0  waiting on ISS-0002  Add session cookie/);
  });

  test('cancel logs the reason, clears owner and removes the progress file', () => {
    seed();
    ok(['start', 'ISS-2', '--owner', 'ana']);
    ok(['cancel', 'ISS-2', 'superseded']);
    assert.equal(fm('ISS-0002', 'status'), 'cancelled');
    assert.equal(fm('ISS-0002', 'owner'), '');
    assert.match(readIssue('ISS-0002'), /ana: cancelled: superseded/);
    assert.ok(!fs.existsSync(progress('ISS-0002')));
  });

  test('help, unknown commands and root discovery from a subdirectory', () => {
    assert.match(ok(['help']).out, /usage: backlog <command>/);
    assert.match(ok(['next', '--help']).out, /usage: backlog next/);
    fails(['frobnicate'], 2, /unknown command "frobnicate"/);
    seed();
    const sub = path.join(root, 'src/deep');
    fs.mkdirSync(sub, { recursive: true });
    assert.match(ok(['list'], { cwd: sub }).out, /ISS-0001/);
    assert.match(ok(['new', 'From sub'], { cwd: sub }).out, /created ISS-0005 backlog\/issues\/ISS-0005-from-sub\.md/);
  });
});
