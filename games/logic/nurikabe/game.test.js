const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const S = require('./solver.js');

const ROWS = ['.2..2', '.....', '..2..', '.1...', '....2'];
const puzzle = L.parsePuzzle(ROWS);
const sea = S.solve(puzzle);
const seaCells = sea.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
const islandCells = sea.map((v, i) => (!v && !puzzle.clues[i] ? i : -1)).filter((i) => i >= 0);

function solveGame(game) {
  seaCells.forEach((i) => game.tap(Math.floor(i / 5), i % 5));
}

test('tap cycles empty -> sea -> dot -> empty', () => {
  const g = G.createGame(puzzle);
  const [r, c] = [1, 1];
  assert.equal(g.tap(r, c), true);
  assert.equal(g.state().cells[6], 'sea');
  g.tap(r, c);
  assert.equal(g.state().cells[6], 'dot');
  g.tap(r, c);
  assert.equal(g.state().cells[6], 'empty');
});

test('tapping a number or off the board does nothing', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(0, 1), false);
  assert.equal(g.tap(9, 9), false);
  assert.equal(g.canUndo(), false);
});

test('undo reverses taps one at a time', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.undo(), false);
  g.tap(1, 1);
  g.tap(1, 1);
  assert.equal(g.undo(), true);
  assert.equal(g.state().cells[6], 'sea');
  g.undo();
  assert.equal(g.state().cells[6], 'empty');
  assert.equal(g.canUndo(), false);
});

test('drag gives every cell passed over the value the first cell became', () => {
  const g = G.createGame(puzzle);
  g.tap(1, 3); // sea
  assert.equal(g.drag([[1, 0], [1, 1], [0, 1], [1, 3], [9, 9]]), true);
  const c = g.state().cells;
  assert.deepEqual([c[5], c[6], c[1], c[8]], ['sea', 'sea', 'empty', 'sea']);
  g.undo();
  assert.equal(g.state().cells[5], 'empty');
  // First cell is a dot-> next is empty; others cleared too.
  g.tap(2, 0); g.tap(2, 0); // dot
  g.tap(2, 1); // sea
  g.drag([[2, 0], [2, 1]]);
  assert.deepEqual(g.state().cells.slice(10, 12), ['empty', 'empty']);
});

test('drag starting on a number uses the first open cell; all-number drags do nothing', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.drag([[0, 1], [0, 2]]), true);
  assert.deepEqual(g.state().cells.slice(1, 3), ['empty', 'sea']);
  assert.equal(g.drag([[0, 1], [9, 9]]), false);
  assert.equal(g.drag([]), false);
});

test('clear empties the board and can be undone', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.clear(), false);
  g.tap(1, 1);
  g.tap(2, 3);
  assert.equal(g.clear(), true);
  assert.ok(g.state().cells.every((v) => v === 'empty'));
  g.undo();
  assert.equal(g.state().cells[6], 'sea');
});

test('applyHint places a square or clears a wrong one and can be undone', () => {
  const g = G.createGame(puzzle);
  const h = g.applyHint();
  assert.ok(['sea', 'dot'].includes(h.value));
  assert.equal(g.state().cells[h.r * 5 + h.c], h.value);
  assert.equal(typeof h.reason, 'string');
  g.undo();
  assert.equal(g.state().cells[h.r * 5 + h.c], 'empty');
  const wrong = islandCells[0];
  g.tap(Math.floor(wrong / 5), wrong % 5);
  const h2 = g.applyHint();
  assert.equal(h2.value, 'empty');
  assert.equal(g.state().cells[wrong], 'empty');
});

test('solving makes the game read-only', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.isSolved(), false);
  solveGame(g);
  assert.equal(g.isSolved(), true);
  const before = g.state();
  assert.equal(g.tap(1, 1), false);
  assert.equal(g.drag([[1, 1]]), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.equal(g.applyHint(), null);
  assert.deepEqual(g.state(), before);
});

test('solved with dots on the islands still counts', () => {
  const g = G.createGame(puzzle);
  islandCells.forEach((i) => { g.tap(Math.floor(i / 5), i % 5); g.tap(Math.floor(i / 5), i % 5); });
  solveGame(g);
  assert.equal(g.isSolved(), true);
});

test('conflicts lists rule breakers', () => {
  const g = G.createGame(puzzle);
  assert.deepEqual(g.conflicts(), []);
  const h = G.createGame(L.parsePuzzle(['2.2', '...', '..1']));
  h.tap(0, 1); h.tap(0, 1);
  assert.deepEqual(h.conflicts(), [0, 1, 2]);
});

test('createGame can start from a saved state and state() returns a copy', () => {
  const st = L.setCell(puzzle, L.createState(puzzle), 2, 3, 'sea');
  const g = G.createGame(puzzle, st);
  assert.equal(g.state().cells[13], 'sea');
  assert.equal(g.canUndo(), false);
  g.state().cells[0] = 'sea';
  assert.equal(g.state().cells[0], 'empty');
});

test('mistakes lists sea on island squares and dots on sea squares', () => {
  const g = G.createGame(puzzle);
  assert.deepEqual(g.mistakes(), []);
  const w = islandCells[0];
  const s = seaCells[0];
  g.tap(Math.floor(w / 5), w % 5); // sea on an island square
  g.tap(Math.floor(s / 5), s % 5); g.tap(Math.floor(s / 5), s % 5); // dot on a sea square
  const okSea = seaCells[1];
  g.tap(Math.floor(okSea / 5), okSea % 5); // correct
  const okDot = islandCells[1];
  g.tap(Math.floor(okDot / 5), okDot % 5); g.tap(Math.floor(okDot / 5), okDot % 5); // correct dot
  assert.deepEqual(g.mistakes(), [w, s].sort((a, b) => a - b));
});

test('timer counts while running and pauses', () => {
  const t = G.createTimer(1000);
  assert.equal(t.elapsed(5000), 1000);
  assert.equal(t.isRunning(), false);
  t.start(5000);
  t.start(5500);
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(7000), 3000);
  t.pause(8000);
  assert.equal(t.elapsed(99999), 4000);
  t.pause(100000);
  assert.equal(t.elapsed(100001), 4000);
  t.start(200000);
  assert.equal(t.elapsed(201000), 5000);
  t.reset();
  assert.equal(t.isRunning(), false);
  assert.equal(t.elapsed(10), 0);
});

test('timer rejects bad starting values', () => {
  assert.equal(G.createTimer().elapsed(0), 0);
  assert.equal(G.createTimer(-5).elapsed(0), 0);
  assert.equal(G.createTimer(NaN).elapsed(0), 0);
});

test('buildSave and restoreSave round trip', () => {
  const st = L.setCell(puzzle, L.createState(puzzle), 1, 1, 'dot');
  const saved = G.buildSave(st, 12345.9);
  assert.deepEqual(saved, { cells: st.cells, elapsedMs: 12345 });
  const back = G.restoreSave(puzzle, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, st);
  assert.equal(back.elapsedMs, 12345);
});

test('restoreSave rejects bad data and tolerates a bad time', () => {
  assert.equal(G.restoreSave(puzzle, null), null);
  assert.equal(G.restoreSave(puzzle, {}), null);
  assert.equal(G.restoreSave(puzzle, { cells: ['sea'], elapsedMs: 1 }), null);
  assert.equal(G.restoreSave(puzzle, { cells: Array(25).fill('q'), elapsedMs: 1 }), null);
  const cells = Array(25).fill('empty');
  assert.equal(G.restoreSave(puzzle, { cells }).elapsedMs, 0);
  assert.equal(G.restoreSave(puzzle, { cells, elapsedMs: -3 }).elapsedMs, 0);
  assert.equal(G.buildSave({ size: 5, cells }, -1).elapsedMs, 0);
});

test('nextPuzzleId picks the next unsolved puzzle, same level first', () => {
  const counts = { easy: 3, medium: 2, hard: 2 };
  const solved = new Set(['easy-1']);
  const is = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, is, 'easy-1'), 'easy-2');
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
