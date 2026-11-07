const test = require('node:test');
const assert = require('node:assert/strict');
const raw = require('./puzzles.js');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzles = raw.map(L.normalisePuzzle);
const RANGE = { easy: [34, 38], medium: [28, 32], hard: [24, 28] };

function validGrid(g, regions) {
  if (g.length !== 81) return false;
  for (let a = 0; a < 9; a++) {
    const row = new Set(), col = new Set(), reg = new Set();
    for (let i = 0; i < 81; i++) {
      if (Math.floor(i / 9) === a) row.add(g[i]);
      if (i % 9 === a) col.add(g[i]);
      if (regions[i] === a) reg.add(g[i]);
    }
    if (row.size !== 9 || col.size !== 9 || reg.size !== 9) return false;
  }
  return g.every((d) => d >= 1 && d <= 9);
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

test('every puzzle has nine connected shapes of nine cells, a valid solution and exactly one answer', () => {
  for (const p of puzzles) {
    assert.equal(p.regions.length, 81, p.id);
    for (let k = 0; k < 9; k++) {
      const cells = [];
      p.regions.forEach((r, i) => { if (r === k) cells.push(i); });
      assert.equal(cells.length, 9, p.id + ' shape size');
      assert.ok(connected(cells), p.id + ' shape connected');
    }
    assert.ok(validGrid(p.solution, p.regions), p.id + ' solution');
    for (const [k, v] of Object.entries(p.givens)) assert.equal(p.solution[k], v, p.id + ' given');
    const givens = new Array(81).fill(0);
    for (const [k, v] of Object.entries(p.givens)) givens[k] = v;
    assert.equal(S.countSolutions(p.regions, givens), 1, p.id + ' unique');
  }
});

test('given counts match the level and shapes are not just the 3x3 boxes', () => {
  for (const p of puzzles) {
    const n = Object.keys(p.givens).length;
    const [lo, hi] = RANGE[p.difficulty];
    assert.ok(n >= lo && n <= hi, p.id + ' has ' + n + ' givens');
    const boxLike = p.regions.every((r, i) => r === Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));
    assert.equal(boxLike, false, p.id);
  }
});

test('a fresh game on every puzzle starts unsolved with only the givens', () => {
  for (const p of puzzles) {
    const s = L.createGame(p);
    assert.equal(L.isSolved(s, p), false);
    assert.equal(s.values.filter(Boolean).length, Object.keys(p.givens).length);
  }
});
