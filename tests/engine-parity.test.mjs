import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAudit } from './helpers/load-engine.mjs';

/* The snapshot was captured from the pre-refactor monolith (see _meta in the fixture).
   Every verdict, ranking, calculator result and search hit must stay identical. */
const snap = JSON.parse(readFileSync(new URL('./fixtures/engine-snapshot.json', import.meta.url), 'utf8'));
const A = loadAudit();

const num = (x) => (x === Infinity ? 'Infinity' : x === -Infinity ? '-Infinity' : Number.isNaN(x) ? 'NaN' : x);
const obj = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? num(v) : v]));
const clone = (x) => JSON.parse(JSON.stringify(x));
/* the engine lives in another vm realm, so compare plain JSON copies */
const same = (got, want, msg) => assert.deepEqual(clone(got), want, msg);
const envs = () => A.ENVS.concat([clone(A.CUSTOM_DEFAULT)]);

test('data set sizes are unchanged', () => {
  same(
    { rows: A.ROWS.length, envs: A.ENVS.length, evidence: A.EVIDENCE.length, investigations: Object.keys(A.INV).length, sources: Object.keys(A.SOURCES).length },
    snap.counts
  );
  same(envs().map((e) => e.id), snap._meta.envIds);
  same(A.ROWS.map((r) => r.id), snap._meta.ruleIds);
});

for (const id of snap._meta.envIds) {
  test(`verdicts, evidence split and rankings match the snapshot: ${id}`, () => {
    const env = envs().find((e) => e.id === id);
    const want = snap.environments[id];
    same(
      { g: env.g, p: env.p, o2: env.o2, v: env.v, dust: env.dust, beyond: env.beyond, assumed: Object.keys(env.assumed || {}), notes: env.notes, name: env.name, phrase: env.phrase, kind: env.kind, src: env.src },
      want.conditions
    );
    const s = A.summary(env);
    same(s.counts, want.counts);
    assert.equal(A.summaryText(s.counts), want.summaryText);
    const verdicts = A.ROWS.map((r) => {
      const v = A.evaluate(r.id, env);
      return { rule: r.id, status: v.status, basis: v.basis, basisLabel: v.basisLabel, carried: !!v.carried, reason: v.reason, why: v.why, direct: v.direct.map((e) => e.id), related: v.related.map((e) => e.id), gap: r.gap(env) };
    });
    same(verdicts, want.verdicts);
    same(
      A.rankInvestigations(env).map((x) => ({ id: x.id, score: x.score, rows: x.rows.map((r) => ({ row: r.row.id, status: r.status, how: r.how })) })),
      want.rankInvestigations
    );
    same(
      A.rankGaps(env).map((x) => ({ row: x.row.id, status: x.status, basisLabel: x.basisLabel, text: x.text, src: x.src, u: x.u, w: x.w })),
      want.rankGaps
    );
  });

  test(`calculator results match the snapshot: ${id}`, () => {
    const env = envs().find((e) => e.id === id);
    const c = {};
    c.co2 = [0.5, 2.7, 6].map((kg) => ({ kg, ...obj(A.co2Discharge(env, kg)) }));
    c.co2Default = obj(A.co2Discharge(env));
    c.flood = [0.2, 0.3].map((f) => ({ f, kg: num(A.floodKg(env, f)) }));
    c.fire = [0.25, 1, 4].map((m) => ({ m, ...obj(A.fireScale(env, m)) }));
    c.fireDefault = obj(A.fireScale(env));
    c.mask = obj(A.maskO2(env));
    c.o2After = [0, 500, 5000].map((l) => ({ l, o2: num(A.o2After(env, l)) }));
    c.cleanup = [[5, 100], [20, 100], [100, 50], [20, 0]].map(([cfm, eff]) => ({ cfm, eff, min: num(A.cleanupMinutes(env.v, A.fireScale(env, 1).coPpm, A.LIMITS.co_24h_ppm, cfm, eff / 100)) }));
    same(c, snap.calculators[id]);
  });
}

test('search results match the snapshot', () => {
  const custom = clone(A.CUSTOM_DEFAULT);
  for (const [q, want] of Object.entries(snap.searches)) {
    const r = A.search(q, custom);
    same(
      { cells: r.cells.map((c) => ({ env: c.env.id, row: c.row.id, status: c.v.status })), evidence: r.evidence.map((e) => e.id), rows: r.rows.map((x) => x.id), envIds: r.envIds, wantStatus: r.wantStatus, empty: r.empty },
      want,
      `search: ${q}`
    );
  }
});

test('evidence records (text, conditions, source, locator) match the snapshot', () => {
  const got = A.EVIDENCE.map((e) => ({ id: e.id, row: e.row, dir: e.dir, basis: e.basis, inv: e.inv, src: e.src, loc: e.loc, cond: e.cond, finding: e.finding }));
  same(got, snap.evidenceIds);
});

test('exportData() matches the snapshot apart from source URLs', () => {
  const exp = clone(A.exportData(clone(A.CUSTOM_DEFAULT)));
  exp.sources.forEach((s) => delete s.url);
  exp.evidence.forEach((e) => delete e.url);
  same(exp, snap.exportDataWithoutUrls);
});

test('source URLs and investigation links are unchanged, except the repaired Orion link', () => {
  const urls = Object.fromEntries(Object.entries(A.SOURCES).map(([k, s]) => [k, s.url]));
  const want = { ...snap.sourceUrls };
  delete urls.orion; delete want.orion;
  same(urls, want);
  same(Object.fromEntries(Object.entries(A.INV).map(([k, v]) => [k, v.links])), snap.invLinks);
});
