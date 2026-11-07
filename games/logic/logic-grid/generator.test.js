const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./generator.js');
const S = require('./solver.js');
const L = require('./logic.js');

test('createRng is deterministic and stays in [0, 1)', () => {
  const a = G.createRng(7);
  const b = G.createRng(7);
  const xs = Array.from({ length: 20 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, Array.from({ length: 20 }, G.createRng(8)));
});

test('shuffle keeps the same items and randomInt stays in range', () => {
  const rng = G.createRng(1);
  const arr = [1, 2, 3, 4, 5, 6];
  const out = G.shuffle(rng, arr);
  assert.deepEqual(out.slice().sort(), arr);
  assert.deepEqual(arr, [1, 2, 3, 4, 5, 6], 'input is not changed');
  for (let i = 0; i < 50; i++) { const v = G.randomInt(rng, 5); assert.ok(v >= 0 && v < 5 && Number.isInteger(v)); }
});

test('LEVELS match the plan: sizes and whether there is a House', () => {
  assert.deepEqual(G.LEVELS.easy, { n: 3, k: 4, house: false });
  assert.deepEqual(G.LEVELS.medium, { n: 4, k: 4, house: true });
  assert.deepEqual(G.LEVELS.hard, { n: 4, k: 5, house: true });
});

test('skeleton: People first, identity solution, distinct themes and emoji, short names', () => {
  for (const level of Object.keys(G.LEVELS)) {
    for (let seed = 1; seed <= 12; seed++) {
      const spec = G.LEVELS[level];
      const p = G.skeleton(level, G.createRng(seed));
      assert.equal(p.cats.length, spec.n);
      assert.equal(p.cats[0].kind, 'people');
      assert.deepEqual(p.solution[0], Array.from({ length: spec.k }, (_, i) => i));
      assert.ok(p.cats.every((c) => c.items.length === spec.k));
      assert.ok(p.solution.every((perm) => perm.slice().sort().join() === Array.from({ length: spec.k }, (_, i) => i).join()));
      assert.ok(p.cats[0].items.every((it) => it.w.length >= 3 && it.w.length <= 4));
      assert.equal(p.cats.filter((c) => c.ordered).length, spec.house ? 1 : 0);
      const kinds = p.cats.map((c) => c.kind);
      assert.equal(new Set(kinds).size, kinds.length);
      const emoji = p.cats.flatMap((c) => c.items.map((i) => i.e)).filter(Boolean);
      assert.equal(new Set(emoji).size, emoji.length);
      const house = p.cats.find((c) => c.ordered);
      if (house) assert.deepEqual(house.items.map((i) => i.w), Array.from({ length: spec.k }, (_, i) => String(i + 1)));
    }
  }
});

test('skeletons vary: different seeds use different themes and names', () => {
  const sigs = new Set();
  for (let seed = 1; seed <= 15; seed++) {
    const p = G.skeleton('medium', G.createRng(seed));
    sigs.add(p.cats.map((c) => c.kind).join() + p.cats[0].items.map((i) => i.w).join());
  }
  assert.ok(sigs.size >= 10);
});

test('clue pool: every clue is true, easy has only is/not/or, others add house clues', () => {
  const easy = G.skeleton('easy', G.createRng(3));
  const poolE = G.cluePool(easy);
  assert.deepEqual(Object.keys(poolE).sort(), ['is', 'not', 'or']);
  const med = G.skeleton('medium', G.createRng(3));
  const poolM = G.cluePool(med);
  assert.deepEqual(Object.keys(poolM).sort(), ['before', 'is', 'left', 'next', 'not', 'or']);
  for (const pool of [poolE, poolM]) {
    const p = pool === poolE ? easy : med;
    for (const list of Object.values(pool)) {
      assert.ok(list.length > 0);
      for (const clue of list) assert.ok(S.holds(p, clue), JSON.stringify(clue));
    }
  }
});

test('clue pool never links items of one category with is, or uses the House in relations', () => {
  const p = G.skeleton('hard', G.createRng(5));
  const house = p.cats.findIndex((c) => c.ordered);
  const pool = G.cluePool(p);
  for (const clue of [...pool.is, ...pool.not]) assert.notEqual(clue.a[0], clue.b[0]);
  for (const clue of [...pool.next, ...pool.left, ...pool.before]) {
    assert.notEqual(clue.a[0], house);
    assert.notEqual(clue.b[0], house);
    assert.notDeepEqual(clue.a, clue.b);
  }
  for (const clue of pool.or) {
    assert.equal(clue.b[0], clue.c[0]);
    assert.notEqual(clue.a[0], clue.b[0]);
    assert.notEqual(clue.b[1], clue.c[1]);
  }
});

test('generate: deterministic, unique, and every clue is needed', () => {
  for (const level of Object.keys(G.LEVELS)) {
    const p = G.generate(level, 11);
    assert.deepEqual(p, G.generate(level, 11));
    assert.equal(S.countSolutions(p), 1, level);
    assert.deepEqual(S.solve(p), p.solution);
    p.clues.forEach((_, i) => {
      const fewer = { ...p, clues: p.clues.filter((__, j) => j !== i) };
      assert.ok(S.countSolutions(fewer) > 1, `${level} clue ${i} is redundant`);
    });
    for (const clue of p.clues) assert.match(L.clueText(p, clue), /^[A-Z].*\.$/);
  }
});

test('generate keeps clue counts playable and hard leans on relational clues', () => {
  const MAX = { easy: 14, medium: 18, hard: 24 };
  let isHard = 0; let totalHard = 0; let isMed = 0; let totalMed = 0;
  for (let seed = 1; seed <= 6; seed++) {
    for (const level of Object.keys(G.LEVELS)) {
      const p = G.generate(level, seed);
      assert.ok(p.clues.length <= MAX[level], `${level} ${p.clues.length} clues`);
      const is = p.clues.filter((c) => c.t === 'is').length;
      if (level === 'hard') { isHard += is; totalHard += p.clues.length; }
      if (level === 'medium') { isMed += is; totalMed += p.clues.length; }
    }
  }
  assert.ok(isHard / totalHard < isMed / totalMed, 'hard has a smaller share of is clues');
});

test('buildPuzzleSet makes the requested counts and is deterministic', () => {
  const counts = { easy: 2, medium: 1, hard: 1 };
  const set = G.buildPuzzleSet(counts, 1);
  assert.deepEqual(Object.keys(set), ['easy', 'medium', 'hard']);
  assert.deepEqual(Object.keys(counts).map((l) => set[l].length), [2, 1, 1]);
  assert.deepEqual(set, G.buildPuzzleSet(counts, 1));
  assert.notEqual(JSON.stringify(set.easy[0]), JSON.stringify(set.easy[1]));
});

test('puzzlesSource writes a script that works in Node and as a browser global', () => {
  const set = G.buildPuzzleSet({ easy: 1, medium: 0, hard: 0 }, 2);
  const src = G.puzzlesSource(set);
  assert.match(src, /^\/\/ Generated by make-puzzles\.js/);
  assert.match(src, /window\.LogicGridPuzzles|root\.LogicGridPuzzles/);
  const mod = { exports: {} };
  new Function('module', src).call({}, mod);
  assert.deepEqual(mod.exports, set);
  const root = {};
  new Function(src).call(root);
  assert.deepEqual(root.LogicGridPuzzles, set);
});
