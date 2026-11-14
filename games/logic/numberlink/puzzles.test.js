const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const puzzles = require('./puzzles.js');

const SIZES = { easy: 5, medium: 7, hard: 9 };
const PAIRS = { easy: [4, 5], medium: [6, 8], hard: [9, 12] };
const COUNTS = { easy: 17, medium: 17, hard: 16 };

test('there are 17 easy, 17 medium and 16 hard puzzles', () => {
  assert.deepEqual(Object.keys(puzzles), ['easy', 'medium', 'hard']);
  for (const level of Object.keys(COUNTS)) assert.equal(puzzles[level].length, COUNTS[level]);
});

test('every puzzle has the right size, pair count and two dots per id', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      const p = L.parsePuzzle(rows);
      assert.equal(p.size, SIZES[level], rows.join('/'));
      assert.ok(p.ids.length >= PAIRS[level][0] && p.ids.length <= PAIRS[level][1], rows.join('/'));
      p.ids.forEach((id) => assert.equal(rows.join('').split(id).length - 1, 2, `${id} in ${rows.join('/')}`));
    }
  }
});

test('no puzzle appears twice', () => {
  const all = Object.values(puzzles).flat().map((p) => p.join('/'));
  assert.equal(new Set(all).size, 50);
});

test('every puzzle has exactly one answer that fills the board', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      assert.equal(S.countSolutions(rows), 1, rows.join('/'));
      const sol = S.solve(rows);
      const p = L.parsePuzzle(rows);
      assert.equal(L.isSolved(p, { size: p.size, lines: sol }), true, rows.join('/'));
    }
  }
});

test('no answer line runs alongside itself (those boards feel like stripes)', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      const n = rows.length;
      const touching = (a, b) => Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n)) === 1;
      for (const line of Object.values(S.solve(rows))) {
        const bad = line.some((a, i) => line.some((b, j) => Math.abs(i - j) > 1 && touching(a, b)));
        assert.equal(bad, false, rows.join('/'));
      }
    }
  }
});
