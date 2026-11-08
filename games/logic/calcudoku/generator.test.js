const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./generator.js');
const L = require('./logic.js');
const S = require('./solver.js');

test('makeRng is repeatable and spans 0..1', () => {
  const a = G.makeRng(7), b = G.makeRng(7), c = G.makeRng(8);
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  assert.deepEqual(xs, ys);
  assert.notEqual(c(), xs[0]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});

test('randomLatin makes a valid square', () => {
  for (const n of [4, 5, 6]) {
    const g = G.randomLatin(G.makeRng(n), n);
    assert.equal(g.length, n * n);
    for (let a = 0; a < n; a++) {
      const row = new Set(), col = new Set();
      for (let b = 0; b < n; b++) { row.add(g[a * n + b]); col.add(g[b * n + a]); }
      assert.equal(row.size, n);
      assert.equal(col.size, n);
    }
  }
});

test('carveCages partitions the grid into connected cages within the size limits', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const cfg = G.LEVELS[level];
    const cages = G.carveCages(G.makeRng(3), cfg);
    const seen = new Set();
    for (const cells of cages) {
      assert.ok(cells.length >= 1 && cells.length <= cfg.maxSize);
      cells.forEach((i) => { assert.ok(!seen.has(i)); seen.add(i); });
    }
    assert.equal(seen.size, cfg.size * cfg.size);
    assert.ok(cages.filter((c) => c.length === 1).length <= cfg.maxSingles);
  }
});

test('assignOps picks only allowed signs with matching targets', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const cfg = G.LEVELS[level];
    const rng = G.makeRng(11);
    const solution = G.randomLatin(rng, cfg.size);
    const cages = G.assignOps(rng, G.carveCages(rng, cfg), solution, cfg);
    for (const cg of cages) {
      assert.ok(cfg.ops.includes(cg.op) || cg.op === '');
      assert.ok(L.cageHolds(cg.op, cg.target, cg.cells.map((i) => solution[i])));
      if (cg.cells.length === 1) assert.equal(cg.op, '');
      else assert.notEqual(cg.op, '');
      if (cg.op === '-' || cg.op === '/') assert.equal(cg.cells.length, 2);
    }
  }
});

test('generatePuzzle is repeatable and has exactly one solution', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const a = G.generatePuzzle(5, level), b = G.generatePuzzle(5, level);
    assert.deepEqual(a, b);
    assert.equal(a.difficulty, level);
    assert.equal(a.size, G.LEVELS[level].size);
    assert.equal(S.countSolutions(a), 1);
    assert.deepEqual(S.solve(a), a.solution);
  }
});

test('easy uses only + and -, hard avoids tiny cages', () => {
  const easy = G.generatePuzzle(9, 'easy');
  assert.ok(easy.cages.every((c) => ['', '+', '-'].includes(c.op)));
  const hard = G.generatePuzzle(9, 'hard');
  assert.ok(hard.cages.filter((c) => c.cells.length === 1).length <= 2);
  assert.ok(Math.max(...hard.cages.map((c) => c.cells.length)) <= 4);
});

test('generatePuzzle rejects an unknown level', () => {
  assert.throws(() => G.generatePuzzle(1, 'insane'));
});
