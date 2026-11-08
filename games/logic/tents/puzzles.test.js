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
    for (const puz of puzzles[level]) {
      const p = L.parsePuzzle(puz);
      assert.equal(p.size, SIZES[level], puz.grid.join('/'));
      assert.equal(S.countSolutions(puz), 1, puz.grid.join('/'));
    }
  }
});

test('the solution satisfies every rule', () => {
  for (const level of Object.keys(SIZES)) {
    for (const puz of puzzles[level]) {
      const p = L.parsePuzzle(puz);
      const state = L.createState(p);
      S.solve(p).forEach((i) => { state.cells[i] = 'tent'; });
      assert.equal(L.isSolved(p, state), true);
      assert.deepEqual(L.findConflicts(p, state), []);
    }
  }
});

test('no puzzle appears twice', () => {
  const all = Object.values(puzzles).flat().map((p) => JSON.stringify(p));
  assert.equal(new Set(all).size, 50);
});

test('puzzles are accepted for their level (size, one answer, difficulty)', () => {
  for (const level of Object.keys(SIZES)) {
    for (const puz of puzzles[level]) assert.equal(G.accepts(level, puz), true, puz.grid.join('/'));
  }
});

test('easy puzzles yield to the plain rules, hard ones need more than that', () => {
  assert.ok(puzzles.easy.every((p) => S.difficultyScore(p).tier === 1 && S.difficultyScore(p).solved));
  assert.ok(puzzles.medium.every((p) => S.difficultyScore(p).solved));
  assert.ok(puzzles.hard.every((p) => !S.difficultyScore(p).solved));
});

test('hard puzzles are denser than easy ones', () => {
  const density = (list) => list.reduce((a, p) => a + p.grid.join('').split('T').length - 1, 0)
    / list.reduce((a, p) => a + p.grid.length ** 2, 0);
  assert.ok(density(puzzles.hard) > density(puzzles.easy));
});

test('puzzles.js matches what make-puzzles.js would generate', () => {
  const set = G.buildPuzzleSet({ easy: 17, medium: 17, hard: 16 }, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(puzzles)), set);
});
