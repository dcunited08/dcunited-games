const test = require('node:test');
const assert = require('node:assert/strict');
const raw = require('./puzzles.js');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzles = raw.map(L.normalisePuzzle);

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

test('there are 17 easy, 17 medium and 16 hard puzzles with unique "<level>-<n>" ids', () => {
  assert.deepEqual(L.levelCounts(puzzles), { easy: 17, medium: 17, hard: 16 });
  assert.equal(puzzles.length, 50);
  assert.equal(new Set(puzzles.map((p) => p.id)).size, 50);
  for (const level of L.LEVELS) {
    const ps = puzzles.filter((p) => p.difficulty === level);
    ps.forEach((p, i) => assert.equal(p.id, level + '-' + (i + 1)));
  }
});

test('every puzzle is well formed and has exactly one solution', () => {
  for (const p of puzzles) {
    const label = p.id;
    assert.ok(validGrid(p.solution), label + ' solution');
    const seen = new Set();
    for (const cg of p.cages) {
      assert.ok(cg.cells.length >= 1 && connected(cg.cells), label + ' connected');
      assert.equal(new Set(cg.cells.map((i) => p.solution[i])).size, cg.cells.length, label + ' repeat');
      assert.equal(cg.cells.reduce((s, i) => s + p.solution[i], 0), cg.sum, label + ' sum');
      cg.cells.forEach((i) => { assert.ok(!seen.has(i), label + ' overlap'); seen.add(i); });
    }
    assert.equal(seen.size, 81, label + ' partition');
    for (const [k, v] of Object.entries(p.givens)) assert.equal(p.solution[k], v, label + ' given');
    assert.equal(S.countSolutions(p), 1, label + ' unique');
  }
});

test('difficulty shapes cages and givens', () => {
  for (const p of puzzles) {
    const max = Math.max(...p.cages.map((c) => c.cells.length));
    const min = Math.min(...p.cages.map((c) => c.cells.length));
    const g = Object.keys(p.givens).length;
    if (p.difficulty === 'easy') assert.ok(max <= 4);
    else assert.ok(min >= 2);
    if (p.difficulty === 'medium') assert.ok(max <= 5 && g <= 3, p.id);
    if (p.difficulty === 'hard') assert.ok(max <= 6, p.id);
  }
});

test('a fresh game on every puzzle starts unsolved with only the givens', () => {
  for (const p of puzzles) {
    const s = L.createGame(p);
    assert.equal(L.isSolved(s, p), false);
    assert.equal(s.values.filter(Boolean).length, Object.keys(p.givens).length);
  }
});
