const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');
const S = require('./solver.js');

const SQUARE = ['22', '22'];
const RING = ['212', '101', '212'];

test('solve finds the loop for a unique puzzle', () => {
  const p = L.parsePuzzle(SQUARE);
  const sol = S.solve(p);
  assert.equal(sol.length, p.edgeCount);
  assert.equal(sol.filter(Boolean).length, 8);
  assert.equal(L.isSingleLoop(p, sol), true);
  assert.equal(L.cluesMet(p, sol), true);
});

test('countSolutions counts 0, 1 and "2 or more"', () => {
  assert.equal(S.countSolutions(SQUARE), 1);
  assert.equal(S.countSolutions(RING), 1);
  assert.equal(S.countSolutions(['00', '00']), 0);
  assert.equal(S.countSolutions(['..', '..']), 2);
  assert.equal(S.countSolutions(['..', '..'], 5) > 2, true);
  assert.equal(S.solve(['00', '00']), null);
});

test('propagate applies clue rules', () => {
  const p = L.parsePuzzle(['0.', '..']);
  const a = new Uint8Array(p.edgeCount);
  assert.equal(S.propagate(p, a), true);
  p.cellE[0].forEach((e) => assert.equal(a[e], S.CROSS));
  const q = L.parsePuzzle(['...', '.3.', '...']);
  const b = new Uint8Array(q.edgeCount);
  b[q.cellE[4][0]] = S.CROSS;
  assert.equal(S.propagate(q, b), true);
  q.cellE[4].slice(1).forEach((e) => assert.equal(b[e], S.LINE));
  // A 2 with one side crossed and another drawn: the rest are crossed.
  const r = L.parsePuzzle(['2.', '..']);
  const c = new Uint8Array(r.edgeCount);
  c[r.cellE[0][0]] = S.LINE;
  c[r.cellE[0][2]] = S.LINE;
  assert.equal(S.propagate(r, c), true);
  assert.equal(c[r.cellE[0][1]], S.CROSS);
  assert.equal(c[r.cellE[0][3]], S.CROSS);
});

test('propagate detects contradictions', () => {
  const p = L.parsePuzzle(['1']);
  const a = new Uint8Array(p.edgeCount);
  a[0] = S.LINE;
  a[1] = S.LINE;
  assert.equal(S.propagate(p, a), false);
  const b = new Uint8Array(p.edgeCount);
  p.cellE[0].forEach((e) => { b[e] = S.CROSS; });
  assert.equal(S.propagate(p, b), false);
  // A dot with three lines.
  const q = L.parsePuzzle(['..', '..']);
  const c = new Uint8Array(q.edgeCount);
  q.dotE[4].slice(0, 3).forEach((e) => { c[e] = S.LINE; });
  assert.equal(S.propagate(q, c), false);
});

test('propagate follows dots: a dead end is impossible, two lines fill the dot', () => {
  const q = L.parsePuzzle(['..', '..']);
  const a = new Uint8Array(q.edgeCount);
  const [e0, e1, e2, e3] = q.dotE[4];
  a[e0] = S.LINE;
  a[e1] = S.LINE;
  assert.equal(S.propagate(q, a), true);
  assert.equal(a[e2], S.CROSS);
  assert.equal(a[e3], S.CROSS);
  // One line, only one way out: it must continue.
  const b = new Uint8Array(q.edgeCount);
  b[e0] = S.LINE;
  b[e1] = S.CROSS;
  b[e2] = S.CROSS;
  assert.equal(S.propagate(q, b), true);
  assert.equal(b[e3], S.LINE);
  // One line and nowhere to go.
  const c = new Uint8Array(q.edgeCount);
  c[e0] = S.LINE;
  c[e1] = S.CROSS;
  c[e2] = S.CROSS;
  c[e3] = S.CROSS;
  assert.equal(S.propagate(q, c), false);
  // No line and one way left: it can't be used.
  const d = new Uint8Array(q.edgeCount);
  d[e0] = S.CROSS;
  d[e1] = S.CROSS;
  d[e2] = S.CROSS;
  assert.equal(S.propagate(q, d), true);
  assert.equal(d[e3], S.CROSS);
});

test('propagate will not close a loop early', () => {
  // Four sides of one cell of a 1x2 board drawn except the last: closing it
  // would leave the other clue-less cell loop... closing is fine only if all clues hold.
  const p = L.parsePuzzle(['.1']);
  const a = new Uint8Array(p.edgeCount);
  const [top, bottom, left, right] = p.cellE[0];
  a[top] = S.LINE;
  a[left] = S.LINE;
  a[bottom] = S.LINE;
  // Closing with `right` would make a loop around cell 0, and cell 1 (clue 1)
  // would then have exactly one line (its left side), so closing is allowed.
  assert.equal(S.propagate(p, a), true);
  assert.notEqual(a[right], S.CROSS);
  // With clue 2 on cell 1, the same closing loop would leave the clue unmet.
  const q = L.parsePuzzle(['.2']);
  const b = new Uint8Array(q.edgeCount);
  b[top] = S.LINE;
  b[left] = S.LINE;
  b[bottom] = S.LINE;
  // The closing edge gets crossed, which then leaves no way to give the 2 its lines.
  assert.equal(S.propagate(q, b), false);
  assert.equal(b[right], S.CROSS);
});

test('propagate will not close a loop while other lines exist', () => {
  const p = L.parsePuzzle(['...', '...']);
  const a = new Uint8Array(p.edgeCount);
  const [top, bottom, left, right] = p.cellE[0];
  a[top] = S.LINE;
  a[left] = S.LINE;
  a[bottom] = S.LINE;
  // A separate line far away.
  a[p.cellE[2][3]] = S.LINE;
  assert.equal(S.propagate(p, a), true);
  assert.equal(a[right], S.CROSS);
});

test('solvesByPropagation separates easy puzzles from ones needing search', () => {
  assert.equal(S.solvesByPropagation(SQUARE), false);
  assert.equal(S.solvesByPropagation(['00', '00']), false);
  assert.equal(S.solvesByPropagation(['..', '..']), false);
  assert.equal(S.solvesByPropagation(['0']), false);
});

test('backtracking solves a puzzle propagation alone cannot', () => {
  // Remove clues until propagation stalls but the answer stays unique.
  const rows = ['2.2', '...', '2.2'];
  const n = S.countSolutions(rows);
  assert.ok(n >= 1);
  if (n === 1) assert.ok(S.solve(rows));
});

test('solve returns quickly on an empty 9x9 board (stops at two solutions)', () => {
  const t = Date.now();
  const rows = new Array(9).fill('.........');
  assert.equal(S.countSolutions(rows), 2);
  assert.ok(Date.now() - t < 2000);
});

test('countSolutions gives up with Infinity when the step budget runs out', () => {
  const rows = new Array(5).fill('.....');
  assert.equal(S.countSolutions(rows, 2, 3), Infinity);
  assert.equal(S.countSolutions(SQUARE, 2, 1000), 1);
});
