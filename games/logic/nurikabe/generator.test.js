const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');

test('createRng is deterministic and in [0, 1)', () => {
  const a = G.createRng(42);
  const b = G.createRng(42);
  const xs = Array.from({ length: 20 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 20 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs, Array.from({ length: 20 }, G.createRng(43)));
});

test('randomInt stays in range', () => {
  const rng = G.createRng(1);
  const seen = new Set(Array.from({ length: 200 }, () => G.randomInt(rng, 5)));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
});

test('randomAnswer makes a legal board: islands apart, one sea, no pools', () => {
  let made = 0;
  for (let seed = 1; seed <= 60 && made < 8; seed++) {
    const rng = G.createRng(seed);
    const a = G.randomAnswer(6, rng, 5, 0.35);
    if (!a) continue;
    made++;
    const rows = G.clueRows(6, a, rng);
    const p = L.parsePuzzle(rows);
    assert.equal(p.clues.filter((v) => v).length, a.sizes.length);
    const state = { size: 6, cells: a.owner.map((o) => (o === -1 ? 'sea' : 'empty')) };
    assert.ok(L.isSolved(p, state), rows.join('/'));
    a.sizes.forEach((n, id) => assert.equal(a.owner.filter((o) => o === id).length, n));
  }
  assert.ok(made >= 3);
});

test('clueRows writes sizes above 9 as letters', () => {
  const owner = Array(16).fill(-1);
  for (let i = 0; i < 10; i++) owner[i] = 0;
  const rows = G.clueRows(4, { owner, sizes: [10] }, G.createRng(1));
  assert.equal(rows.join('').replace(/\./g, ''), 'A');
});

test('generate returns a puzzle with exactly one solution', () => {
  for (const [size, max] of [[5, 4], [6, 5]]) {
    const rows = G.generate(size, G.createRng(7), max);
    assert.equal(rows.length, size);
    assert.equal(S.countSolutions(rows), 1);
  }
});

test('generate is deterministic for a seed', () => {
  assert.deepEqual(G.generate(5, G.createRng(3), 4), G.generate(5, G.createRng(3), 4));
});

test('generate gives up with an error when the board cannot work', () => {
  assert.throws(() => G.generate(5, G.createRng(1), 4, 0), /Could not generate/);
});

test('grade follows the difficulty tier', () => {
  assert.equal(G.grade(['.2..2', '.....', '..2..', '.1...', '....2']), 'easy');
  assert.equal(G.grade(['1.1..', '...1.', '.2...', '...1.', '.2..1']), 'medium');
  assert.equal(G.grade(['1.1.1', '.....', '4..1.', '....3', '.....']), 'hard');
});

test('buildPuzzleSet makes graded, unique, distinct puzzles at the right sizes', () => {
  const set = G.buildPuzzleSet({ easy: 2, medium: 0, hard: 0 }, 5);
  assert.equal(set.easy.length, 2);
  assert.deepEqual(set.medium, []);
  assert.notDeepEqual(set.easy[0], set.easy[1]);
  for (const rows of set.easy) {
    assert.equal(rows.length, 6);
    assert.equal(G.grade(rows), 'easy');
    assert.equal(S.countSolutions(rows), 1);
  }
  assert.deepEqual(set, G.buildPuzzleSet({ easy: 2, medium: 0, hard: 0 }, 5));
});

test('puzzlesSource produces loadable code', () => {
  const set = { easy: [['1.', '.1']], medium: [], hard: [] };
  const src = G.puzzlesSource(set);
  const mod = { exports: {} };
  new Function('module', src).call({}, mod);
  assert.deepEqual(mod.exports, set);
});
