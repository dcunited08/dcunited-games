const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');
const puzzles = require('./puzzles.js');

const SIZES = { easy: 6, medium: 8, hard: 10 };
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

test('the answer of every puzzle satisfies the rules', () => {
  for (const rows of Object.values(puzzles).flat()) {
    const p = L.parsePuzzle(rows);
    const sea = S.solve(p);
    assert.ok(L.isSolved(p, { size: p.size, cells: sea.map((s, i) => (s && !p.clues[i] ? 'sea' : 'empty')) }));
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

test('easy and medium puzzles are solved by the simple rules, hard ones are not', () => {
  assert.ok(puzzles.easy.every((p) => S.difficultyScore(p).tier === 1));
  assert.ok(puzzles.medium.every((p) => S.difficultyScore(p).tier === 2));
  assert.ok(puzzles.hard.every((p) => !S.difficultyScore(p).solved));
});

test('island numbers stay small enough to enumerate', () => {
  const max = { easy: 5, medium: 6, hard: 8 };
  for (const level of Object.keys(max)) {
    for (const rows of puzzles[level]) assert.ok(Math.max(...L.parsePuzzle(rows).clues) <= max[level]);
  }
});
