const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');
const puzzles = require('./puzzles.js');

const SIZES = { easy: 7, medium: 8, hard: 10 };
const COUNTS = { easy: 17, medium: 17, hard: 16 };

test('there are 17 easy, 17 medium and 16 hard puzzles', () => {
  assert.deepEqual(Object.keys(puzzles), ['easy', 'medium', 'hard']);
  for (const level of Object.keys(COUNTS)) assert.equal(puzzles[level].length, COUNTS[level]);
});

test('every puzzle parses at the right size and has exactly one solution', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      assert.equal(L.parsePuzzle(rows).size, SIZES[level], rows.join('/'));
      assert.equal(S.countSolutions(rows), 1, rows.join('/'));
    }
  }
});

test('no puzzle appears twice', () => {
  const all = Object.values(puzzles).flat().map((p) => p.join('/'));
  assert.equal(new Set(all).size, 50);
});

test('puzzles are graded by their level', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) assert.equal(G.grade(rows), level, rows.join('/'));
  }
});

test('easy puzzles are solved by the simple rules alone', () => {
  assert.ok(puzzles.easy.every((p) => S.difficultyScore(p).simple));
  assert.ok(puzzles.medium.every((p) => !S.difficultyScore(p).simple));
  assert.ok(puzzles.hard.every((p) => !S.difficultyScore(p).simple));
});

test('the solution of every puzzle lights the board', () => {
  for (const level of Object.keys(SIZES)) {
    for (const rows of puzzles[level]) {
      const size = rows.length;
      const cells = Array(size * size).fill('empty');
      S.solve(rows).forEach((i) => { cells[i] = 'bulb'; });
      assert.ok(L.isSolved(rows, { size, cells }), rows.join('/'));
    }
  }
});

test('puzzles.js matches what make-puzzles would write', () => {
  const fs = require('node:fs');
  const set = G.buildPuzzleSet(COUNTS, 1);
  assert.equal(fs.readFileSync(`${__dirname}/puzzles.js`, 'utf8'), G.puzzlesSource(set));
});
