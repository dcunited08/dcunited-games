const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const S = require('./solver.js');

const ROWS = ['AABBB', 'ACBBB', 'CCCDD', 'EECDD', 'EEEDD'];
const puzzle = { size: 5, regions: ROWS };
const solution = S.solve(puzzle);

function solveGame(game) {
  solution.forEach((c, r) => { game.tap(r, c); game.tap(r, c); });
}

test('tap cycles empty -> x -> star -> empty', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(0, 0), true);
  assert.equal(g.state().cells[0], 'x');
  g.tap(0, 0);
  assert.equal(g.state().cells[0], 'star');
  g.tap(0, 0);
  assert.equal(g.state().cells[0], 'empty');
});

test('tap out of range is ignored and not undoable', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(9, 9), false);
  assert.equal(g.canUndo(), false);
});

test('undo reverses taps one at a time', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.undo(), false);
  g.tap(1, 1);
  g.tap(1, 1);
  assert.equal(g.undo(), true);
  assert.equal(g.state().cells[6], 'x');
  g.undo();
  assert.equal(g.state().cells[6], 'empty');
  assert.equal(g.canUndo(), false);
});

test('dragX marks empty cells as one undo step', () => {
  const g = G.createGame(puzzle);
  g.tap(0, 1);
  g.tap(0, 1); // star
  assert.equal(g.dragX([[0, 0], [0, 1], [0, 2], [0, 2], [1, 2]]), true);
  assert.deepEqual(g.state().cells.slice(0, 3), ['x', 'star', 'x']);
  assert.equal(g.state().cells[7], 'x');
  g.undo();
  assert.deepEqual(g.state().cells.slice(0, 3), ['empty', 'star', 'empty']);
  assert.equal(g.state().cells[7], 'empty');
});

test('dragX that changes nothing adds no history', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.dragX([]), false);
  g.tap(0, 0);
  const before = g.state();
  assert.equal(g.dragX([[0, 0]]), false);
  assert.deepEqual(g.state(), before);
  g.undo();
  assert.equal(g.canUndo(), false);
});

test('clear empties the board and can be undone', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.clear(), false);
  g.tap(0, 0);
  g.tap(2, 2);
  assert.equal(g.clear(), true);
  assert.ok(g.state().cells.every((v) => v === 'empty'));
  g.undo();
  assert.equal(g.state().cells[0], 'x');
  assert.equal(g.state().cells[12], 'x');
});

test('applyHint places a star or clears a cell and can be undone', () => {
  const g = G.createGame(puzzle);
  const h = g.applyHint();
  assert.equal(h.value, 'star');
  assert.equal(g.state().cells[h.r * 5 + h.c], 'star');
  assert.equal(typeof h.reason, 'string');
  g.undo();
  assert.equal(g.state().cells[h.r * 5 + h.c], 'empty');
});

test('applyHint clears a wrong star', () => {
  const g = G.createGame(puzzle);
  const wrong = [0, 1, 2, 3, 4].find((c) => c !== solution[0]);
  g.tap(0, wrong);
  g.tap(0, wrong);
  const h = g.applyHint();
  assert.equal(h.value, 'empty');
  assert.equal(g.state().cells[wrong], 'empty');
});

test('applyHint returns null when solved', () => {
  const g = G.createGame(puzzle);
  solveGame(g);
  assert.equal(g.applyHint(), null);
});

test('solving makes the game read-only', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.isSolved(), false);
  solveGame(g);
  assert.equal(g.isSolved(), true);
  const before = g.state();
  assert.equal(g.tap(0, 0), false);
  assert.equal(g.dragX([[0, 0]]), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.deepEqual(g.state(), before);
});

test('conflicts lists wrong stars', () => {
  const g = G.createGame(puzzle);
  g.tap(0, 0); g.tap(0, 0);
  g.tap(0, 1); g.tap(0, 1);
  assert.deepEqual(g.conflicts(), [0, 1]);
});

test('createGame can start from a saved state', () => {
  const st = L.setCell(L.createState(puzzle), 2, 2, 'x');
  const g = G.createGame(puzzle, st);
  assert.equal(g.state().cells[12], 'x');
  assert.equal(g.canUndo(), false);
});

test('state() returns a copy', () => {
  const g = G.createGame(puzzle);
  g.state().cells[0] = 'star';
  assert.equal(g.state().cells[0], 'empty');
});

test('timer counts while running and pauses', () => {
  const t = G.createTimer(1000);
  assert.equal(t.elapsed(5000), 1000);
  assert.equal(t.isRunning(), false);
  t.start(5000);
  t.start(5500); // second start is ignored
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(7000), 3000);
  t.pause(8000);
  assert.equal(t.isRunning(), false);
  assert.equal(t.elapsed(99999), 4000);
  t.pause(100000); // pausing twice changes nothing
  assert.equal(t.elapsed(100001), 4000);
  t.start(200000);
  assert.equal(t.elapsed(201000), 5000);
});

test('timer defaults to zero and rejects bad starting values', () => {
  assert.equal(G.createTimer().elapsed(0), 0);
  assert.equal(G.createTimer(-5).elapsed(0), 0);
  assert.equal(G.createTimer(NaN).elapsed(0), 0);
});

test('timer reset', () => {
  const t = G.createTimer(4000);
  t.start(0);
  t.reset();
  assert.equal(t.isRunning(), false);
  assert.equal(t.elapsed(10), 0);
});

test('buildSave and restoreSave round trip', () => {
  let st = L.setCell(L.createState(puzzle), 0, 0, 'star');
  st = L.setCell(st, 1, 4, 'x');
  const saved = G.buildSave(st, 12345.9);
  assert.deepEqual(saved, { cells: st.cells, elapsedMs: 12345 });
  const back = G.restoreSave(puzzle, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, st);
  assert.equal(back.elapsedMs, 12345);
});

test('restoreSave rejects bad data', () => {
  assert.equal(G.restoreSave(puzzle, null), null);
  assert.equal(G.restoreSave(puzzle, {}), null);
  assert.equal(G.restoreSave(puzzle, { cells: ['x'], elapsedMs: 1 }), null);
  assert.equal(G.restoreSave(puzzle, { cells: Array(25).fill('q'), elapsedMs: 1 }), null);
});

test('restoreSave tolerates a missing or bad time', () => {
  const cells = Array(25).fill('empty');
  assert.equal(G.restoreSave(puzzle, { cells }).elapsedMs, 0);
  assert.equal(G.restoreSave(puzzle, { cells, elapsedMs: -3 }).elapsedMs, 0);
  assert.equal(G.buildSave({ size: 5, cells }, -1).elapsedMs, 0);
});

test('regionBorders marks sides next to a different region', () => {
  const b = G.regionBorders(puzzle);
  assert.equal(b.length, 25);
  // (0,0) is A: right is A, bottom is A.
  assert.deepEqual(b[0], { top: false, right: false, bottom: false, left: false });
  // (0,1) is A: right neighbour (0,2) is B.
  assert.equal(b[1].right, true);
  assert.equal(b[1].bottom, true); // (1,1) is C
  // (0,2) is B: left neighbour is A.
  assert.equal(b[2].left, true);
  // (1,0) is A, below is C.
  assert.equal(b[5].bottom, true);
  // board edges are not region borders.
  assert.equal(b[0].top, false);
  assert.equal(b[0].left, false);
  assert.equal(b[24].right, false);
  assert.equal(b[24].bottom, false);
});

test('mistakes lists wrong stars and X marks on solution stars', () => {
  const g = G.createGame(puzzle);
  assert.deepEqual(g.mistakes(), []);
  const wrong = [0, 1, 2, 3, 4].find((c) => c !== solution[0]);
  g.tap(0, wrong); g.tap(0, wrong); // wrong star
  g.tap(1, solution[1]); // X on a solution star
  g.tap(2, solution[2]); g.tap(2, solution[2]); // correct star
  g.tap(3, (solution[3] + 1) % 5); // X on a non-solution cell is fine
  assert.deepEqual(g.mistakes(), [wrong, 5 + solution[1]].sort((a, b) => a - b));
});

test('mistakes is empty for a solved board', () => {
  const g = G.createGame(puzzle);
  solveGame(g);
  assert.deepEqual(g.mistakes(), []);
});

test('nextPuzzleId picks the next unsolved puzzle, same level first', () => {
  const counts = { easy: 3, medium: 2, hard: 2 };
  const solved = new Set(['easy-1']);
  const is = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, is, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-2'), 'easy-3');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-3'), 'easy-2');
  solved.add('easy-2').add('easy-3');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-3'), 'medium-1');
  solved.add('medium-1').add('medium-2').add('hard-1');
  assert.equal(G.nextPuzzleId(counts, is, 'medium-2'), 'hard-2');
  assert.equal(G.nextPuzzleId(counts, is, 'hard-2'), 'hard-1');
});

test('nextPuzzleId goes back to earlier levels and wraps when all are solved', () => {
  const counts = { easy: 2, medium: 1, hard: 1 };
  const solved = new Set(['easy-1', 'medium-1', 'hard-1']);
  const is = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, is, 'hard-1'), 'easy-2');
  solved.add('easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-2'), 'easy-1');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'bogus'), 'easy-1');
});
