const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');

const isLatin = (grid, n) => {
  for (let a = 0; a < n; a++) {
    const row = new Set(), col = new Set();
    for (let b = 0; b < n; b++) { row.add(grid[a * n + b]); col.add(grid[b * n + a]); }
    if (row.size !== n || col.size !== n) return false;
  }
  return grid.every((d) => d >= 1 && d <= n);
};

test('makeRng is seeded and repeatable', () => {
  const a = G.makeRng(7), b = G.makeRng(7), c = G.makeRng(8);
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  assert.deepEqual(xs, ys);
  assert.notEqual(xs[0], c());
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('shuffle keeps the same items', () => {
  const out = G.shuffle([1, 2, 3, 4, 5, 6], G.makeRng(3));
  assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5, 6]);
});

test('randomLatinSquare makes valid squares of each size', () => {
  for (const n of [4, 5, 6, 7]) assert.ok(isLatin(G.randomLatinSquare(n, G.makeRng(n)), n));
  assert.notDeepEqual(G.randomLatinSquare(5, G.makeRng(1)), G.randomLatinSquare(5, G.makeRng(2)));
});

test('level sizes are 5, 6 and 7', () => {
  assert.deepEqual([G.LEVELS.easy.size, G.LEVELS.medium.size, G.LEVELS.hard.size], [5, 6, 7]);
});

for (const [level, n] of [['easy', 5], ['medium', 6]]) {
  test(`generatePuzzle(${level}) is unique, consistent and solvable by simple logic`, () => {
    const raw = G.generatePuzzle(11, level);
    const p = L.normalisePuzzle(Object.assign({ id: level + '-1' }, raw));
    assert.equal(p.size, n);
    assert.equal(raw.difficulty, level);
    assert.ok(isLatin(p.solution, n));
    assert.equal(S.countSolutions(p), 1);
    assert.deepEqual(S.solve(p), p.solution);
    assert.equal(S.simpleSolve(p).solved, true);
    p.givens.forEach((d, i) => { if (d) assert.equal(d, p.solution[i]); });
    for (const [a, b] of p.lt) assert.ok(p.solution[a] < p.solution[b]);
  });
}

test('generatePuzzle is repeatable for the same seed', () => {
  assert.deepEqual(G.generatePuzzle(5, 'easy'), G.generatePuzzle(5, 'easy'));
  assert.notDeepEqual(G.generatePuzzle(5, 'easy'), G.generatePuzzle(6, 'easy'));
});

test('hard puzzles are unique, 7x7, and carry fewer givens than easy ones', () => {
  const raw = G.generatePuzzle(21, 'hard');
  const p = L.normalisePuzzle(Object.assign({ id: 'hard-1' }, raw));
  assert.equal(p.size, 7);
  assert.equal(S.countSolutions(p), 1);
  const count = (r) => r.givens.split('').filter((ch) => ch !== '.').length;
  assert.ok(count(raw) < count(G.generatePuzzle(21, 'easy')));
});

test('countClues counts givens and signs', () => {
  assert.deepEqual(G.countClues({ givens: '1..2', h: '<.', v: '>.' }), { givens: 2, signs: 2 });
});
