const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./solver.js');
const L = require('./logic.js');
const puzzles = require('./puzzles.js');
const { build } = require('./make-puzzles.js');

const SPEC = { easy: { n: 3, k: 4 }, medium: { n: 4, k: 4 }, hard: { n: 4, k: 5 } };
const COUNTS = { easy: 17, medium: 17, hard: 16 };

test('there are 17 easy, 17 medium and 16 hard puzzles', () => {
  assert.deepEqual(Object.keys(puzzles), ['easy', 'medium', 'hard']);
  for (const level of Object.keys(COUNTS)) assert.equal(puzzles[level].length, COUNTS[level]);
});

test('puzzles have the right size and a House on medium and hard', () => {
  for (const level of Object.keys(SPEC)) {
    for (const p of puzzles[level]) {
      assert.equal(p.cats.length, SPEC[level].n);
      assert.ok(p.cats.every((c) => c.items.length === SPEC[level].k));
      assert.equal(p.cats[0].name, 'People');
      assert.equal(p.cats.some((c) => c.name === 'House' && c.ordered), level !== 'easy');
    }
  }
});

test('every puzzle has exactly one solution and it is the stored one', () => {
  const start = Date.now();
  for (const p of Object.values(puzzles).flat()) {
    assert.equal(S.countSolutions(p), 1);
    assert.deepEqual(S.solve(p), p.solution);
  }
  assert.ok(Date.now() - start < 10000, 'solver is fast');
});

test('no puzzle appears twice', () => {
  const all = Object.values(puzzles).flat().map((p) => JSON.stringify(p));
  assert.equal(new Set(all).size, 50);
  const sig = Object.values(puzzles).flat().map((p) => JSON.stringify([p.cats.map((c) => [c.kind, c.items.map((i) => i.w)]), p.solution]));
  assert.equal(new Set(sig).size, 50);
});

test('clues only reference valid items, with true statements', () => {
  for (const p of Object.values(puzzles).flat()) {
    const house = p.cats.findIndex((c) => c.ordered);
    const ref = (r) => Array.isArray(r) && r.length === 2 && p.cats[r[0]] && Number.isInteger(r[1]) && r[1] >= 0 && r[1] < p.cats[r[0]].items.length;
    for (const clue of p.clues) {
      assert.ok(['is', 'not', 'or', 'next', 'left', 'before'].includes(clue.t));
      assert.ok(ref(clue.a) && ref(clue.b), JSON.stringify(clue));
      assert.equal(clue.t === 'or', !!clue.c);
      if (clue.c) assert.ok(ref(clue.c));
      if (['next', 'left', 'before'].includes(clue.t)) assert.ok(house >= 0 && clue.a[0] !== house && clue.b[0] !== house);
      assert.ok(S.holds(p, clue));
      assert.match(L.clueText(p, clue), /^[A-Z].*\.$/);
    }
  }
});

test('puzzles.js is what make-puzzles.js generates', () => {
  assert.deepEqual(build(), puzzles);
});
