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

test('randomPlacement gives one star per row and column, none touching', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const size of [5, 6, 9]) {
      const cols = G.randomPlacement(size, G.createRng(seed));
      assert.equal(new Set(cols).size, size);
      cols.forEach((c, r) => {
        assert.ok(c >= 0 && c < size);
        if (r > 0) assert.ok(Math.abs(c - cols[r - 1]) > 1);
      });
    }
  }
});

test('randomPlacement gives up (null) when size has no placement', () => {
  assert.equal(G.randomPlacement(2, G.createRng(1)), null);
});

test('generate returns a valid puzzle with exactly one solution', () => {
  for (const size of [4, 5, 6, 8, 9]) {
    const rows = G.generate(size, G.createRng(size * 100 + 7));
    const parsed = L.parsePuzzle(rows);
    assert.equal(parsed.size, size);
    assert.equal(S.countSolutions(rows), 1);
  }
});

test('generate is deterministic for a seed', () => {
  assert.deepEqual(G.generate(6, G.createRng(5)), G.generate(6, G.createRng(5)));
  assert.notDeepEqual(G.generate(6, G.createRng(5)), G.generate(6, G.createRng(6)));
});

test('generate 9x9 is fast on average', () => {
  const t0 = Date.now();
  for (let seed = 1; seed <= 10; seed++) G.generate(9, G.createRng(seed));
  assert.ok((Date.now() - t0) / 10 < 1000);
});

test('grade sorts puzzles by how far easy deductions get', () => {
  assert.equal(G.grade(['DADD', 'DDDB', 'CDDD', 'DDDD']), 'easy');
  assert.equal(G.grade(['BBAAA', 'BBCCC', 'BCCCC', 'BCCCD', 'EECCD']), 'hard');
});

test('buildPuzzleSet makes the requested counts of unique, distinct puzzles', () => {
  const set = G.buildPuzzleSet({ easy: 2, medium: 2, hard: 2 }, 1);
  assert.deepEqual(Object.keys(set), ['easy', 'medium', 'hard']);
  assert.deepEqual([set.easy.length, set.medium.length, set.hard.length], [2, 2, 2]);
  const all = [...set.easy, ...set.medium, ...set.hard];
  assert.equal(new Set(all.map((p) => p.join('/'))).size, 6);
  all.forEach((p) => assert.equal(S.countSolutions(p), 1));
  assert.ok(set.easy.every((p) => p.length === 6 && G.grade(p) === 'easy'));
  assert.ok(set.medium.every((p) => p.length === 8 && G.grade(p) === 'medium'));
  assert.ok(set.hard.every((p) => p.length === 9 && G.grade(p) === 'hard'));
  assert.deepEqual(G.buildPuzzleSet({ easy: 2, medium: 2, hard: 2 }, 1), set);
});

test('puzzlesSource renders a loadable puzzles.js', () => {
  const set = { easy: [['AB', 'AB']], medium: [], hard: [] };
  const text = G.puzzlesSource(set);
  assert.match(text, /StarBattlePuzzles/);
  const mod = { exports: {} };
  new Function('module', 'exports', text).call({}, mod, mod.exports);
  assert.deepEqual(mod.exports, set);
});
