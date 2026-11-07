const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./generator.js');
const S = require('./solver.js');

function validGrid(g) {
  if (g.length !== 81) return false;
  for (let a = 0; a < 9; a++) {
    const row = new Set(), col = new Set(), box = new Set();
    for (let b = 0; b < 9; b++) {
      row.add(g[a * 9 + b]);
      col.add(g[b * 9 + a]);
      box.add(g[(Math.floor(a / 3) * 3 + Math.floor(b / 3)) * 9 + (a % 3) * 3 + (b % 3)]);
    }
    if (row.size !== 9 || col.size !== 9 || box.size !== 9) return false;
  }
  return true;
}

function connected(cells) {
  const set = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / 9), c = i % 9;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) continue;
      const j = nr * 9 + nc;
      if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === set.size;
}

function checkCages(cages, solution) {
  const seen = new Set();
  for (const cg of cages) {
    assert.ok(connected(cg.cells), 'connected');
    assert.equal(new Set(cg.cells.map((i) => solution[i])).size, cg.cells.length, 'distinct digits');
    assert.equal(cg.cells.reduce((s, i) => s + solution[i], 0), cg.sum, 'sum');
    cg.cells.forEach((i) => { assert.ok(!seen.has(i)); seen.add(i); });
  }
  assert.equal(seen.size, 81);
}

test('mulberry32 is repeatable and in [0,1)', () => {
  const a = G.mulberry32(5), b = G.mulberry32(5), c = G.mulberry32(6);
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  assert.deepEqual(xs, ys);
  assert.notEqual(c(), xs[0]);
  xs.forEach((x) => assert.ok(x >= 0 && x < 1));
});

test('randomSolution is a valid sudoku, repeatable per seed, varied across seeds', () => {
  const s1 = G.randomSolution(G.mulberry32(1));
  assert.ok(validGrid(s1));
  assert.deepEqual(s1, G.randomSolution(G.mulberry32(1)));
  assert.notDeepEqual(s1, G.randomSolution(G.mulberry32(2)));
});

test('makeCages partitions the grid with valid cages for every difficulty', () => {
  const max = { easy: 4, medium: 5, hard: 6 };
  for (const diff of ['easy', 'medium', 'hard']) {
    for (let seed = 1; seed <= 3; seed++) {
      const rng = G.mulberry32(seed);
      const sol = G.randomSolution(rng);
      const cages = G.makeCages(sol, rng, diff);
      checkCages(cages, sol);
      cages.forEach((cg) => {
        assert.ok(cg.cells.length <= max[diff]);
        if (diff !== 'easy') assert.ok(cg.cells.length >= 2);
      });
    }
  }
});

test('makeCages is repeatable', () => {
  const sol = G.randomSolution(G.mulberry32(9));
  const a = G.makeCages(sol, G.mulberry32(3), 'medium');
  const b = G.makeCages(sol, G.mulberry32(3), 'medium');
  assert.deepEqual(a, b);
});

test('splitCage cuts a cage into two connected halves keeping every cell', () => {
  const sol = G.randomSolution(G.mulberry32(4));
  const rng = G.mulberry32(4);
  const cages = G.makeCages(sol, rng, 'hard');
  const big = cages.find((c) => c.cells.length >= 4);
  assert.ok(big);
  const parts = G.splitCage(big, sol, rng, 2);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.flatMap((p) => p.cells).sort((a, b) => a - b), [...big.cells].sort((a, b) => a - b));
  parts.forEach((p) => { assert.ok(p.cells.length >= 2); assert.ok(connected(p.cells)); });
  assert.equal(parts[0].sum + parts[1].sum, big.sum);
  assert.equal(G.splitCage({ sum: 3, cells: [0, 1] }, sol, rng, 2), null);
});

test('generatePuzzle gives a unique, repeatable puzzle for each difficulty', () => {
  for (const diff of ['easy', 'medium', 'hard']) {
    const p = G.generatePuzzle(11, diff);
    assert.equal(p.difficulty, diff);
    assert.equal(typeof p.id, 'string');
    assert.ok(validGrid(p.solution));
    checkCages(p.cages, p.solution);
    for (const [k, v] of Object.entries(p.givens)) assert.equal(p.solution[k], v);
    assert.equal(S.countSolutions(p), 1);
    assert.deepEqual(p, G.generatePuzzle(11, diff));
  }
});

test('difficulty shapes givens', () => {
  const easy = G.generatePuzzle(21, 'easy');
  assert.ok(Object.keys(easy.givens).length >= 6);
  const med = G.generatePuzzle(21, 'medium');
  assert.ok(Object.keys(med.givens).length <= 3);
});

test('unknown difficulty throws', () => {
  assert.throws(() => G.generatePuzzle(1, 'insane'), /difficulty/);
});

test('fixUniqueness falls back to adding givens when nothing can be split', () => {
  const rng = G.mulberry32(8);
  const sol = G.randomSolution(rng);
  // Whole-row cages (sum 45) can only be split, so use size-2 cages from a domino tiling.
  const cages = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 8; c += 2) {
      const a = r * 9 + c;
      if (sol[a] !== sol[a + 1]) cages.push({ sum: sol[a] + sol[a + 1], cells: [a, a + 1] });
    }
    cages.push({ sum: sol[r * 9 + 8], cells: [r * 9 + 8] });
  }
  const p = G.fixUniqueness({ cages, givens: {} }, sol, rng, 'hard', 99);
  assert.ok(p);
  assert.equal(S.countSolutions(p), 1);
  assert.deepEqual(p.cages, cages);
  assert.ok(Object.keys(p.givens).length > 0);
});
