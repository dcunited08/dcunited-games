const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');

test('createRng is deterministic per seed and stays in [0, 1)', () => {
  const a = G.createRng(7);
  const b = G.createRng(7);
  const xs = Array.from({ length: 20 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, Array.from({ length: 20 }, G.createRng(8)));
});

test('randomInt covers the range', () => {
  const rng = G.createRng(1);
  const seen = new Set(Array.from({ length: 200 }, () => G.randomInt(rng, 5)));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
});

test('generate makes a board whose clues match its hidden answer', () => {
  const rng = G.createRng(3);
  for (const size of [6, 8, 10]) {
    const g = G.generate(size, Math.round(size * size * 0.2), rng);
    assert.equal(g.puzzle.grid.length, size);
    const p = L.parsePuzzle(g.puzzle);
    const state = { size, cells: Array(size * size).fill('empty') };
    g.tents.forEach((i) => { state.cells[i] = 'tent'; });
    assert.equal(L.isSolved(p, state), true);
    assert.equal(g.tents.length, p.trees.filter(Boolean).length);
    assert.deepEqual(L.findConflicts(p, state), []);
  }
});

test('generate gives up gracefully when the board is too crowded', () => {
  const g = G.generate(3, 20, G.createRng(1));
  assert.ok(g.tents.length < 20);
  assert.equal(g.tents.length, g.puzzle.grid.join('').split('T').length - 1);
});

test('buildPuzzleSet is deterministic, unique and graded', () => {
  const counts = { easy: 2, medium: 1, hard: 1 };
  const a = G.buildPuzzleSet(counts, 5);
  const b = G.buildPuzzleSet(counts, 5);
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a), ['easy', 'medium', 'hard']);
  const sizes = { easy: 6, medium: 8, hard: 10 };
  for (const level of Object.keys(counts)) {
    assert.equal(a[level].length, counts[level]);
    for (const puz of a[level]) {
      assert.equal(L.parsePuzzle(puz).size, sizes[level]);
      assert.equal(S.countSolutions(puz), 1);
      assert.equal(G.accepts(level, puz), true);
    }
  }
  assert.notDeepEqual(a, G.buildPuzzleSet(counts, 6));
});

test('accepts checks size, uniqueness and difficulty for a level', () => {
  const tiny = { grid: ['T...', '....', '..T.', '....'], rows: [0, 1, 1, 0], cols: [1, 0, 0, 1] };
  assert.equal(G.accepts('easy', tiny), false); // wrong size
  assert.equal(G.accepts('nope', tiny), false);
});

test('buildPuzzleSet throws when it cannot find enough puzzles', () => {
  assert.throws(() => G.buildPuzzleSet({ easy: 1 }, 1, { maxAttempts: 0 }), /Could not build/);
});

test('puzzlesSource writes a script that defines the browser global and exports', () => {
  const set = G.buildPuzzleSet({ easy: 1, medium: 0, hard: 0 }, 2);
  const src = G.puzzlesSource(set);
  assert.match(src, /do not edit by hand/);
  const sandbox = { module: undefined };
  vm.runInNewContext(src, sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.TentsPuzzles)), set);
  const mod = { exports: {} };
  vm.runInNewContext(src, { module: mod });
  assert.deepEqual(JSON.parse(JSON.stringify(mod.exports)), set);
});
