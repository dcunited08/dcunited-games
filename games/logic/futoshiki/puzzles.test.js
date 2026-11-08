const test = require('node:test');
const assert = require('node:assert/strict');
const raw = require('./puzzles.js');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzles = raw.map(L.normalisePuzzle);
const SIZES = { easy: 5, medium: 6, hard: 7 };

function isLatin(g, n) {
  if (g.length !== n * n) return false;
  for (let a = 0; a < n; a++) {
    const row = new Set(), col = new Set();
    for (let b = 0; b < n; b++) { row.add(g[a * n + b]); col.add(g[b * n + a]); }
    if (row.size !== n || col.size !== n) return false;
  }
  return g.every((d) => d >= 1 && d <= n);
}

test('there are 17 easy 5x5, 17 medium 6x6 and 16 hard 7x7 puzzles with ids easy-1..', () => {
  assert.deepEqual(L.levelCounts(puzzles), { easy: 17, medium: 17, hard: 16 });
  assert.equal(puzzles.length, 50);
  assert.equal(new Set(puzzles.map((p) => p.id)).size, 50);
  for (const level of L.LEVELS) {
    const ps = puzzles.filter((p) => p.difficulty === level);
    ps.forEach((p, i) => { assert.equal(p.id, level + '-' + (i + 1)); assert.equal(p.size, SIZES[level]); });
  }
});

test('every puzzle is well formed: string lengths, givens, Latin solution and signs agree', () => {
  for (const r of raw) {
    const n = r.size;
    assert.equal(r.givens.length, n * n, r.id);
    assert.equal(r.h.length, n * (n - 1), r.id);
    assert.equal(r.v.length, n * (n - 1), r.id);
    assert.match(r.h + r.v, /^[<>.]*$/, r.id);
  }
  for (const p of puzzles) {
    assert.ok(isLatin(p.solution, p.size), p.id + ' solution');
    p.givens.forEach((d, i) => { if (d) assert.equal(d, p.solution[i], p.id + ' given ' + i); });
    assert.ok(p.givens.some((d) => d) || p.lt.length > 0, p.id + ' has clues');
    for (const [a, b] of p.lt) assert.ok(p.solution[a] < p.solution[b], p.id + ' sign ' + a + '<' + b);
    // Each stored sign is the true relation.
    assert.equal(p.lt.length, (p.h + p.v).replace(/\./g, '').length, p.id);
  }
});

test('every puzzle has exactly one solution, and it is the stored one', () => {
  for (const p of puzzles) {
    assert.equal(S.countSolutions(p), 1, p.id);
    assert.deepEqual(S.solve(p), p.solution, p.id);
  }
});

test('easy and medium puzzles fall to simple logic; hard ones have the fewest givens', () => {
  for (const p of puzzles.filter((q) => q.difficulty !== 'hard')) assert.equal(S.simpleSolve(p).solved, true, p.id);
  const givens = (level) => puzzles.filter((p) => p.difficulty === level).map((p) => p.givens.filter(Boolean).length);
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(avg(givens('hard')) < avg(givens('medium')));
  assert.ok(avg(givens('hard')) <= 4);
});
