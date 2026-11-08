const test = require('node:test');
const assert = require('node:assert/strict');
const raw = require('./puzzles.js');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzles = raw.map(L.normalisePuzzle);
const SIZES = { easy: 4, medium: 5, hard: 6 };

function latin(sol, n) {
  if (sol.length !== n * n) return false;
  for (let a = 0; a < n; a++) {
    const row = new Set(), col = new Set();
    for (let b = 0; b < n; b++) { row.add(sol[a * n + b]); col.add(sol[b * n + a]); }
    if (row.size !== n || col.size !== n) return false;
    for (const d of row) if (!(d >= 1 && d <= n)) return false;
  }
  return true;
}

function connected(cells, n) {
  const set = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop(), r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
      const j = nr * n + nc;
      if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === set.size;
}

test('there are 17 easy, 17 medium and 16 hard puzzles with ids "<level>-<n>"', () => {
  assert.deepEqual(L.levelCounts(puzzles), { easy: 17, medium: 17, hard: 16 });
  assert.equal(new Set(puzzles.map((p) => p.id)).size, 50);
  for (const level of L.LEVELS) {
    puzzles.filter((p) => p.difficulty === level).forEach((p, i) => assert.equal(p.id, `${level}-${i + 1}`));
  }
});

test('every puzzle is well formed and has exactly one solution', () => {
  for (const p of puzzles) {
    const n = p.size;
    assert.equal(n, SIZES[p.difficulty], p.id + ' size');
    assert.ok(latin(p.solution, n), p.id + ' latin');
    const seen = new Set();
    for (const cg of p.cages) {
      assert.ok(connected(cg.cells, n), p.id + ' connected');
      const vals = cg.cells.map((i) => p.solution[i]);
      if (cg.cells.length === 1) {
        assert.equal(cg.op, '', p.id + ' single has no sign');
        assert.equal(cg.target, vals[0]);
      } else {
        assert.ok(['+', '-', '*', '/'].includes(cg.op), p.id + ' sign');
        if (cg.op === '+') assert.equal(vals.reduce((a, b) => a + b, 0), cg.target);
        if (cg.op === '*') assert.equal(vals.reduce((a, b) => a * b, 1), cg.target);
        if (cg.op === '-' || cg.op === '/') {
          assert.equal(vals.length, 2, p.id + ' - and / only on pairs');
          const hi = Math.max(...vals), lo = Math.min(...vals);
          if (cg.op === '-') assert.equal(hi - lo, cg.target);
          else { assert.equal(hi % lo, 0); assert.equal(hi / lo, cg.target); }
        }
        if (p.difficulty === 'easy') assert.ok(['+', '-'].includes(cg.op), p.id + ' easy signs');
      }
      cg.cells.forEach((i) => { assert.ok(!seen.has(i), p.id + ' overlap'); seen.add(i); });
    }
    assert.equal(seen.size, n * n, p.id + ' partition');
    assert.equal(S.countSolutions(p), 1, p.id + ' unique');
    assert.deepEqual(S.solve(p), p.solution);
  }
});

test('medium and hard use all four signs between them; hard has big cages and few singles', () => {
  const ops = new Set();
  for (const p of puzzles.filter((q) => q.difficulty !== 'easy')) p.cages.forEach((c) => ops.add(c.op));
  for (const o of ['+', '-', '*', '/']) assert.ok(ops.has(o), 'uses ' + o);
  for (const p of puzzles.filter((q) => q.difficulty === 'hard')) {
    assert.ok(p.cages.filter((c) => c.cells.length === 1).length <= 2, p.id);
    assert.ok(Math.max(...p.cages.map((c) => c.cells.length)) >= 3, p.id);
  }
});

test('a fresh game on every puzzle starts empty and unsolved', () => {
  for (const p of puzzles) {
    const s = L.createGame(p);
    assert.equal(L.isSolved(s, p), false);
    assert.equal(s.values.filter(Boolean).length, 0);
  }
});
