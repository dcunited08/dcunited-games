const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');
const G = require('./generator.js');

test('createRng is deterministic and stays in [0, 1)', () => {
  const a = G.createRng(5);
  const b = G.createRng(5);
  const xs = [a(), a(), a()];
  assert.deepEqual(xs, [b(), b(), b()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notEqual(G.createRng(6)(), xs[0]);
});

test('randomInt and shuffled use the generator', () => {
  const rng = G.createRng(1);
  const picks = new Set(Array.from({ length: 50 }, () => G.randomInt(rng, 4)));
  assert.deepEqual([...picks].sort(), [0, 1, 2, 3]);
  const list = [1, 2, 3, 4, 5];
  assert.deepEqual(G.shuffled(list, G.createRng(2)).sort(), list);
  assert.deepEqual(list, [1, 2, 3, 4, 5]);
});

test('generate makes a unique puzzle of the right size and island count', () => {
  const rows = G.generate({ size: 7, minIslands: 8, maxIslands: 12 }, G.createRng(3));
  const p = L.parsePuzzle(rows);
  assert.equal(p.size, 7);
  assert.equal(p.width, 7);
  assert.ok(p.islands.length >= 8 && p.islands.length <= 12, `${p.islands.length} islands`);
  assert.equal(S.countSolutions(rows), 1);
  assert.deepEqual(G.generate({ size: 7, minIslands: 8, maxIslands: 12 }, G.createRng(3)), rows);
});

test('generate gives up with an error when it cannot meet the target', () => {
  assert.throws(() => G.generate({ size: 3, minIslands: 40, maxIslands: 50 }, G.createRng(1), 5), /Could not generate/);
});

test('grade says hard when plain deduction is not enough', () => {
  assert.equal(G.isHardEnough(['1.3.2']), false);
  assert.equal(G.isHardEnough(['2.2', '...', '2.2']), true);
});

test('buildPuzzleSet is deterministic, unique and sized by level', () => {
  const set = G.buildPuzzleSet({ easy: 2, medium: 1, hard: 1 }, 1);
  assert.deepEqual(Object.keys(set), ['easy', 'medium', 'hard']);
  assert.deepEqual([set.easy.length, set.medium.length, set.hard.length], [2, 1, 1]);
  assert.deepEqual(G.buildPuzzleSet({ easy: 2, medium: 1, hard: 1 }, 1), set);
  assert.equal(L.parsePuzzle(set.easy[0]).size, 7);
  assert.equal(L.parsePuzzle(set.medium[0]).size, 9);
  assert.equal(L.parsePuzzle(set.hard[0]).size, 11);
  assert.equal(S.analyze(set.hard[0]).solved, false);
  assert.notDeepEqual(set.easy[0], set.easy[1]);
});

test('puzzlesSource writes a script that evaluates back to the set', () => {
  const set = { easy: [['2.2', '...', '2.2']], medium: [], hard: [] };
  const src = G.puzzlesSource(set);
  const mod = { exports: {} };
  new Function('module', src).call({}, mod);
  assert.deepEqual(mod.exports, set);
  const root = {};
  new Function(src).call(root);
  assert.deepEqual(root.HashiPuzzles, set);
});
