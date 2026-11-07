const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzle = { grid: ['T...', '....', '..T.', '....'], rows: [0, 1, 1, 0], cols: [1, 0, 0, 1] };
const solution = S.solve(puzzle); // [4, 11]: tents at (1,0) and (2,3)

function solveGame(game) {
  for (const i of solution) { game.tap(Math.floor(i / 4), i % 4); game.tap(Math.floor(i / 4), i % 4); }
}

test('tap cycles empty -> grass -> tent -> empty', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(0, 1), true);
  assert.equal(g.state().cells[1], 'grass');
  g.tap(0, 1);
  assert.equal(g.state().cells[1], 'tent');
  g.tap(0, 1);
  assert.equal(g.state().cells[1], 'empty');
});

test('tapping a tree or outside the board does nothing and is not undoable', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(0, 0), false);
  assert.equal(g.tap(9, 9), false);
  assert.equal(g.tap(-1, 0), false);
  assert.equal(g.canUndo(), false);
});

test('undo reverses taps one at a time', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.undo(), false);
  g.tap(1, 1);
  g.tap(1, 1);
  assert.equal(g.undo(), true);
  assert.equal(g.state().cells[5], 'grass');
  g.undo();
  assert.equal(g.state().cells[5], 'empty');
  assert.equal(g.canUndo(), false);
});

test('dragGrass marks empty cells as one undo step', () => {
  const g = G.createGame(puzzle);
  g.tap(0, 1);
  g.tap(0, 1); // tent
  assert.equal(g.dragGrass([[0, 0], [0, 1], [0, 2], [0, 2], [1, 2]]), true);
  assert.deepEqual(g.state().cells.slice(0, 3), ['empty', 'tent', 'grass']);
  assert.equal(g.state().cells[6], 'grass');
  g.undo();
  assert.deepEqual(g.state().cells.slice(0, 3), ['empty', 'tent', 'empty']);
  assert.equal(g.state().cells[6], 'empty');
});

test('dragGrass that changes nothing adds no history', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.dragGrass([]), false);
  g.tap(0, 1);
  const before = g.state();
  assert.equal(g.dragGrass([[0, 1]]), false);
  assert.deepEqual(g.state(), before);
  g.undo();
  assert.equal(g.canUndo(), false);
});

test('clear empties the board and can be undone', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.clear(), false);
  g.tap(0, 1);
  g.tap(2, 1);
  assert.equal(g.clear(), true);
  assert.ok(g.state().cells.every((v) => v === 'empty'));
  g.undo();
  assert.equal(g.state().cells[1], 'grass');
  assert.equal(g.state().cells[9], 'grass');
});

test('applyHint places a mark and can be undone', () => {
  const g = G.createGame(puzzle);
  const h = g.applyHint();
  assert.ok(['tent', 'grass'].includes(h.value));
  assert.equal(g.state().cells[h.r * 4 + h.c], h.value);
  assert.equal(typeof h.reason, 'string');
  g.undo();
  assert.equal(g.state().cells[h.r * 4 + h.c], 'empty');
});

test('applyHint clears a wrong tent', () => {
  const g = G.createGame(puzzle);
  g.tap(3, 3);
  g.tap(3, 3);
  const h = g.applyHint();
  assert.equal(h.value, 'empty');
  assert.equal(g.state().cells[15], 'empty');
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
  assert.equal(g.tap(0, 1), false);
  assert.equal(g.dragGrass([[0, 1]]), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.deepEqual(g.state(), before);
});

test('conflicts lists touching tents and lineStatus reports the clue state', () => {
  const g = G.createGame(puzzle);
  for (const [r, c] of [[1, 0], [2, 1]]) { g.tap(r, c); g.tap(r, c); }
  assert.deepEqual(g.conflicts(), [4, 9]);
  assert.deepEqual(g.lineStatus().rows, ['met', 'met', 'met', 'met']);
  assert.deepEqual(g.lineStatus().cols, ['met', 'over', 'met', 'under']);
});

test('createGame can start from a saved state', () => {
  const st = L.setCell(puzzle, L.createState(puzzle), 2, 1, 'grass');
  const g = G.createGame(puzzle, st);
  assert.equal(g.state().cells[9], 'grass');
  assert.equal(g.canUndo(), false);
});

test('state() returns a copy', () => {
  const g = G.createGame(puzzle);
  g.state().cells[1] = 'tent';
  assert.equal(g.state().cells[1], 'empty');
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
  let st = L.setCell(puzzle, L.createState(puzzle), 1, 0, 'tent');
  st = L.setCell(puzzle, st, 3, 3, 'grass');
  const saved = G.buildSave(st, 12345.9);
  assert.deepEqual(saved, { cells: st.cells, elapsedMs: 12345 });
  const back = G.restoreSave(puzzle, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, st);
  assert.equal(back.elapsedMs, 12345);
});

test('restoreSave rejects bad data', () => {
  assert.equal(G.restoreSave(puzzle, null), null);
  assert.equal(G.restoreSave(puzzle, {}), null);
  assert.equal(G.restoreSave(puzzle, { cells: ['tent'], elapsedMs: 1 }), null);
  assert.equal(G.restoreSave(puzzle, { cells: Array(16).fill('q'), elapsedMs: 1 }), null);
});

test('restoreSave tolerates a missing or bad time', () => {
  const cells = Array(16).fill('empty');
  assert.equal(G.restoreSave(puzzle, { cells }).elapsedMs, 0);
  assert.equal(G.restoreSave(puzzle, { cells, elapsedMs: -3 }).elapsedMs, 0);
  assert.equal(G.buildSave({ size: 4, cells }, -1).elapsedMs, 0);
});

test('mistakes lists wrong tents and grass on solution tents', () => {
  const g = G.createGame(puzzle);
  assert.deepEqual(g.mistakes(), []);
  g.tap(3, 3); g.tap(3, 3); // wrong tent
  g.tap(1, 0); // grass on a solution tent
  g.tap(2, 3); g.tap(2, 3); // correct tent
  g.tap(0, 2); // grass on a non-solution cell is fine
  assert.deepEqual(g.mistakes(), [4, 15]);
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
