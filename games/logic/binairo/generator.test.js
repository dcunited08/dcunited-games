const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');

test('createRng is seeded and returns floats in [0, 1)', () => {
  const a = G.createRng(42);
  const b = G.createRng(42);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, [G.createRng(43)(), 0, 0]);
  const r = G.createRng(1);
  assert.ok([...Array(50)].every(() => { const n = G.randomInt(r, 5); return n >= 0 && n < 5; }));
});

test('randomGrid makes a full grid that obeys every rule', () => {
  for (const size of [4, 6, 8, 10]) {
    const rows = G.randomGrid(size, G.createRng(size));
    assert.equal(rows.length, size);
    assert.ok(rows.every((r) => /^[01]+$/.test(r) && r.length === size));
    const state = L.createState(rows);
    assert.equal(L.isSolved(rows, state), true, rows.join('/'));
  }
  assert.notDeepEqual(G.randomGrid(6, G.createRng(1)), G.randomGrid(6, G.createRng(2)));
});

test('generate makes unique puzzles of each level', () => {
  const easy = G.generate('easy', G.createRng(5));
  assert.equal(easy.length, 6);
  assert.equal(S.countSolutions(easy), 1);
  assert.equal(S.difficultyScore(easy).solved, true);
  const medium = G.generate('medium', G.createRng(5));
  assert.equal(medium.length, 8);
  assert.equal(S.difficultyScore(medium).solved, true);
  const hard = G.generate('hard', G.createRng(5));
  assert.equal(hard.length, 10);
  assert.equal(S.countSolutions(hard), 1);
  assert.equal(S.difficultyScore(hard).solved, false);
});

test('easy puzzles keep a few extra clues', () => {
  const rng = G.createRng(9);
  const easy = G.generate('easy', rng);
  const clues = easy.join('').replace(/\./g, '').length;
  assert.ok(clues >= 8, `clues ${clues}`);
});

test('generate is repeatable for a seed', () => {
  assert.deepEqual(G.generate('easy', G.createRng(3)), G.generate('easy', G.createRng(3)));
  assert.throws(() => G.generate('huge', G.createRng(1)), /level/);
});

test('grade names the level by size and by how it can be solved', () => {
  assert.equal(G.grade(G.generate('easy', G.createRng(2))), 'easy');
  assert.equal(G.grade(G.generate('medium', G.createRng(2))), 'medium');
  assert.equal(G.grade(G.generate('hard', G.createRng(2))), 'hard');
  assert.equal(G.grade(Array(6).fill('......')), null);
  assert.equal(G.grade(Array(8).fill('........')), null);
  assert.equal(G.grade(Array(10).fill('..........')), null);
  assert.equal(G.grade(Array(4).fill('....')), null);
  const full6 = G.randomGrid(6, G.createRng(1));
  assert.equal(G.grade(full6), 'easy');
  const full10 = G.randomGrid(10, G.createRng(1));
  assert.equal(G.grade(full10), null); // fully given is solvable by simple rules, so not hard
});

test('buildPuzzleSet makes the asked counts without repeats; puzzlesSource writes them', () => {
  const set = G.buildPuzzleSet({ easy: 3, medium: 2, hard: 1 }, 7);
  assert.deepEqual(Object.keys(set), ['easy', 'medium', 'hard']);
  assert.deepEqual([set.easy.length, set.medium.length, set.hard.length], [3, 2, 1]);
  assert.equal(new Set(Object.values(set).flat().map((p) => p.join('/'))).size, 6);
  const src = G.puzzlesSource(set);
  const sandbox = { exports: {} };
  new Function('module', src).call({}, sandbox);
  assert.deepEqual(sandbox.exports, set);
  assert.match(src, /window\.BinairoPuzzles|root\.BinairoPuzzles/);
});
