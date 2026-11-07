const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

// Slow, obviously correct counter used to check the real solver on small boards.
function bruteCount(rows) {
  const p = L.parsePuzzle(rows);
  const n = p.size;
  const occ = Array(n * n).fill(false);
  p.ids.forEach((id) => { occ[p.dots[id][0]] = true; occ[p.dots[id][1]] = true; });
  let count = 0;
  function pair(k) {
    if (k === p.ids.length) { if (occ.every(Boolean)) count++; return; }
    const [a, b] = p.dots[p.ids[k]];
    (function walk(cell) {
      const r = Math.floor(cell / n);
      const c = cell % n;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
        const next = nr * n + nc;
        if (next === b) { pair(k + 1); continue; }
        if (occ[next]) continue;
        occ[next] = true;
        walk(next);
        occ[next] = false;
      }
    }(a));
  }
  pair(0);
  return count;
}

function randomPuzzle(n, pairs, seed) {
  let a = seed;
  const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
  const cells = [...Array(n * n).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const grid = Array(n * n).fill('.');
  for (let k = 0; k < pairs; k++) { grid[cells[2 * k]] = L.idChar(k); grid[cells[2 * k + 1]] = L.idChar(k); }
  return Array.from({ length: n }, (_, r) => grid.slice(r * n, r * n + n).join(''));
}

test('finds the single answer of a small puzzle', () => {
  const rows = ['1..', '.21', '..2'];
  assert.equal(S.countSolutions(rows), 1);
  assert.deepEqual(S.solve(rows), { 1: [0, 1, 2, 5], 2: [4, 3, 6, 7, 8] });
});

test('every square must be filled', () => {
  assert.equal(S.countSolutions(['1.1', '2.2', '...']), 0);
  assert.equal(S.solve(['1.1', '2.2', '...']), null);
});

test('pairs that cannot be joined have no solution', () => {
  assert.equal(S.countSolutions(['12', '21']), 0);
});

test('countSolutions stops at the limit', () => {
  const rows = ['1.1', '...', '...'];
  assert.equal(S.countSolutions(rows), 2);
  assert.equal(S.countSolutions(rows, 1), 1);
  assert.equal(S.countSolutions(rows, 100), bruteCount(rows));
});

test('solve returns ordered paths that join and fill everything', () => {
  const rows = ['1..2', '....', '....', '1..2'];
  const sol = S.solve(rows);
  const p = L.parsePuzzle(rows);
  const seen = new Set();
  for (const id of p.ids) {
    const path = sol[id];
    assert.ok(p.dots[id].includes(path[0]) && p.dots[id].includes(path[path.length - 1]) && path[0] !== path[path.length - 1]);
    path.forEach((c, i) => {
      assert.ok(!seen.has(c));
      seen.add(c);
      if (i) assert.equal(Math.abs(Math.floor(c / 4) - Math.floor(path[i - 1] / 4)) + Math.abs((c % 4) - (path[i - 1] % 4)), 1);
    });
  }
  assert.equal(seen.size, 16);
});

test('counts agree with a brute-force search on random small puzzles', () => {
  let withSolutions = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const n = 3 + (seed % 2);
    const rows = randomPuzzle(n, 2 + (seed % 3 === 0 ? 1 : 0), seed * 7919);
    const expected = bruteCount(rows);
    assert.equal(S.countSolutions(rows, 1000), expected, rows.join('/'));
    if (expected > 0) withSolutions++;
  }
  assert.ok(withSolutions > 10, 'the random puzzles include solvable ones');
});

test('counts agree with brute force on 5x5 puzzles', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rows = randomPuzzle(5, 3, seed * 104729);
    assert.equal(S.countSolutions(rows, 1000), bruteCount(rows), rows.join('/'));
  }
});

test('a node budget makes a slow search give up with "more than one"', () => {
  const rows = ['1..2', '....', '....', '1..2'];
  assert.equal(S.countSolutions(rows, 2, 3), 2);
  assert.equal(S.countSolutions(rows, 5, 3), 5);
  assert.equal(S.countSolutions(['1..', '.21', '..2'], 2, 1000), 1);
});

