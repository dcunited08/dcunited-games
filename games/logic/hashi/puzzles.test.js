const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const puzzles = require('./puzzles.js');

const SIZES = { easy: 7, medium: 9, hard: 11 };
const COUNTS = { easy: 17, medium: 17, hard: 16 };
const ISLANDS = { easy: [8, 12], medium: [14, 20], hard: [22, 30] };

test('there are 17 easy, 17 medium and 16 hard puzzles', () => {
  assert.deepEqual(Object.keys(puzzles), ['easy', 'medium', 'hard']);
  for (const level of Object.keys(COUNTS)) assert.equal(puzzles[level].length, COUNTS[level]);
});

test('every puzzle has the right size, island count and exactly one solution', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      const p = L.parsePuzzle(rows);
      assert.equal(p.size, SIZES[level], rows.join('/'));
      assert.equal(p.width, SIZES[level], rows.join('/'));
      const [min, max] = ISLANDS[level];
      assert.ok(p.islands.length >= min && p.islands.length <= max, `${level}: ${p.islands.length} islands`);
      assert.equal(S.countSolutions(rows), 1, rows.join('/'));
    }
  }
});

test('the solution of every puzzle passes isSolved', () => {
  for (const rows of Object.values(puzzles).flat()) {
    const p = L.parsePuzzle(rows);
    assert.equal(L.isSolved(p, { counts: S.solve(p) }), true, rows.join('/'));
  }
});

test('no puzzle appears twice', () => {
  const all = Object.values(puzzles).flat().map((p) => p.join('/'));
  assert.equal(new Set(all).size, 50);
});

test('hard puzzles need more than plain deduction', () => {
  assert.ok(puzzles.hard.every((p) => !S.analyze(p).solved));
});
