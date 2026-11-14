const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const puzzles = require('./puzzles.js');

const SIZES = { easy: 5, medium: 7, hard: 9 };
const COUNTS = { easy: 17, medium: 17, hard: 16 };

test('there are 17 easy, 17 medium and 16 hard puzzles', () => {
  assert.deepEqual(Object.keys(puzzles), ['easy', 'medium', 'hard']);
  for (const level of Object.keys(COUNTS)) assert.equal(puzzles[level].length, COUNTS[level]);
});

test('every puzzle parses at the right size, has exactly one solution, and clues fit it', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      const p = L.parsePuzzle(rows);
      assert.equal(p.rows, SIZES[level], rows.join('/'));
      assert.equal(p.cols, SIZES[level]);
      assert.equal(S.countSolutions(rows), 1, rows.join('/'));
      const sol = S.solve(rows);
      assert.equal(L.isSingleLoop(p, sol), true);
      assert.equal(L.cluesMet(p, sol), true);
    }
  }
});

test('easy and medium puzzles need no guessing', () => {
  for (const level of ['easy', 'medium']) {
    for (const rows of puzzles[level]) assert.equal(S.solvesByPropagation(rows), true, rows.join('/'));
  }
});

test('no puzzle appears twice', () => {
  const all = Object.values(puzzles).flat().map((p) => p.join('/'));
  assert.equal(new Set(all).size, 50);
});

test('every puzzle solves in well under 200ms', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      const t = process.hrtime.bigint();
      S.solve(rows);
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      assert.ok(ms < 200, `${level} ${rows.join('/')} took ${ms}ms`);
    }
  }
});

test('hard puzzles have fairly few clues', () => {
  for (const rows of puzzles.hard) {
    const clues = rows.join('').replace(/\./g, '').length;
    assert.ok(clues <= 40, `${clues} clues`);
  }
});
