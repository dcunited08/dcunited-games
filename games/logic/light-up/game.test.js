const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const S = require('./solver.js');

const ROWS = ['.3.', '...', '...'];
const solution = S.solve(ROWS); // [0, 2, 4]

function solveGame(game) {
  solution.forEach((i) => game.tap(Math.floor(i / 3), i % 3));
}

test('tap cycles empty -> bulb -> dot -> empty', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.tap(0, 0), true);
  assert.equal(g.state().cells[0], 'bulb');
  g.tap(0, 0);
  assert.equal(g.state().cells[0], 'dot');
  g.tap(0, 0);
  assert.equal(g.state().cells[0], 'empty');
});

test('tap on a wall or out of range is ignored and not undoable', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.tap(0, 1), false);
  assert.equal(g.tap(9, 9), false);
  assert.equal(g.canUndo(), false);
});

test('undo reverses taps one at a time', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.undo(), false);
  g.tap(1, 1);
  g.tap(1, 1);
  assert.equal(g.undo(), true);
  assert.equal(g.state().cells[4], 'bulb');
  g.undo();
  assert.equal(g.state().cells[4], 'empty');
  assert.equal(g.canUndo(), false);
});

test('dragDot dots empty cells as one undo step', () => {
  const g = G.createGame(ROWS);
  g.tap(2, 0);
  assert.equal(g.dragDot([[2, 0], [2, 1], [2, 2], [2, 2], [0, 1]]), true);
  assert.deepEqual(g.state().cells.slice(6), ['bulb', 'dot', 'dot']);
  assert.equal(g.state().cells[1], 'empty');
  g.undo();
  assert.deepEqual(g.state().cells.slice(6), ['bulb', 'empty', 'empty']);
});

test('dragDot that changes nothing adds no history', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.dragDot([]), false);
  g.tap(0, 0);
  assert.equal(g.dragDot([[0, 0]]), false);
  g.undo();
  assert.equal(g.canUndo(), false);
});

test('clear empties the board and can be undone', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.clear(), false);
  g.tap(0, 0);
  g.tap(2, 2);
  assert.equal(g.clear(), true);
  assert.ok(g.state().cells.every((v) => v === 'empty'));
  g.undo();
  assert.equal(g.state().cells[0], 'bulb');
  assert.equal(g.state().cells[8], 'bulb');
});

test('applyHint places a mark, can be undone and gives a reason', () => {
  const g = G.createGame(ROWS);
  const h = g.applyHint();
  assert.equal(h.value, 'bulb');
  assert.equal(g.state().cells[h.r * 3 + h.c], 'bulb');
  assert.equal(typeof h.reason, 'string');
  g.undo();
  assert.equal(g.state().cells[h.r * 3 + h.c], 'empty');
});

test('applyHint clears a wrong bulb', () => {
  const g = G.createGame(ROWS);
  g.tap(2, 2);
  const h = g.applyHint();
  assert.equal(h.value, 'empty');
  assert.equal(g.state().cells[8], 'empty');
});

test('applyHint returns null when solved', () => {
  const g = G.createGame(ROWS);
  solveGame(g);
  assert.equal(g.applyHint(), null);
});

test('solving makes the game read-only', () => {
  const g = G.createGame(ROWS);
  assert.equal(g.isSolved(), false);
  solveGame(g);
  assert.equal(g.isSolved(), true);
  const before = g.state();
  assert.equal(g.tap(2, 2), false);
  assert.equal(g.dragDot([[1, 0]]), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.deepEqual(g.state(), before);
});

test('conflicts lists bulbs that see each other and bad numbers', () => {
  const g = G.createGame(ROWS);
  g.tap(0, 0);
  g.tap(2, 0);
  assert.deepEqual(g.conflicts(), [0, 6]);
});

test('lit and wallStatus describe the board', () => {
  const g = G.createGame(ROWS);
  assert.ok(g.lit().every((n) => n === 0));
  g.tap(0, 0);
  assert.deepEqual(g.lit(), [1, 0, 0, 1, 0, 0, 1, 0, 0]);
  assert.equal(g.wallStatus()[1], 'open');
  g.tap(0, 2);
  g.tap(1, 1);
  assert.equal(g.wallStatus()[1], 'done');
});

test('createGame can start from a saved state', () => {
  const start = L.setCell(ROWS, L.createState(ROWS), 0, 0, 'bulb');
  const g = G.createGame(ROWS, start);
  assert.equal(g.state().cells[0], 'bulb');
  assert.equal(g.canUndo(), false);
  start.cells[0] = 'empty';
  assert.equal(g.state().cells[0], 'bulb');
});

test('state() returns a copy', () => {
  const g = G.createGame(ROWS);
  g.state().cells[0] = 'bulb';
  assert.equal(g.state().cells[0], 'empty');
});

test('timer counts while running and pauses', () => {
  const t = G.createTimer(0);
  assert.equal(t.isRunning(), false);
  t.start(1000);
  t.start(5000);
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(4000), 3000);
  t.pause(6000);
  t.pause(9000);
  assert.equal(t.elapsed(20000), 5000);
  t.start(30000);
  assert.equal(t.elapsed(31000), 6000);
  assert.equal(t.elapsed(10), 5000);
});

test('timer defaults to zero and rejects bad starting values', () => {
  assert.equal(G.createTimer().elapsed(5), 0);
  assert.equal(G.createTimer(-5).elapsed(5), 0);
  assert.equal(G.createTimer(NaN).elapsed(5), 0);
  assert.equal(G.createTimer(2500).elapsed(5), 2500);
});

test('timer reset', () => {
  const t = G.createTimer(900);
  t.start(0);
  t.reset();
  assert.equal(t.elapsed(500), 0);
  assert.equal(t.isRunning(), false);
});

test('buildSave and restoreSave round trip', () => {
  let st = L.setCell(ROWS, L.createState(ROWS), 0, 0, 'bulb');
  st = L.setCell(ROWS, st, 2, 2, 'dot');
  const saved = G.buildSave(st, 12345.9);
  assert.deepEqual(saved, { cells: st.cells, elapsedMs: 12345 });
  const back = G.restoreSave(ROWS, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, st);
  assert.equal(back.elapsedMs, 12345);
});

test('restoreSave rejects bad data', () => {
  assert.equal(G.restoreSave(ROWS, null), null);
  assert.equal(G.restoreSave(ROWS, {}), null);
  assert.equal(G.restoreSave(ROWS, { cells: ['bulb'], elapsedMs: 1 }), null);
  assert.equal(G.restoreSave(ROWS, { cells: Array(9).fill('star'), elapsedMs: 1 }), null);
});

test('restoreSave tolerates a missing or bad time', () => {
  const cells = Array(9).fill('empty');
  assert.equal(G.restoreSave(ROWS, { cells }).elapsedMs, 0);
  assert.equal(G.restoreSave(ROWS, { cells, elapsedMs: -3 }).elapsedMs, 0);
  assert.equal(G.buildSave({ size: 3, cells }, -1).elapsedMs, 0);
});

test('mistakes lists bulbs off the answer and dots on answer bulbs', () => {
  const g = G.createGame(ROWS);
  assert.deepEqual(g.mistakes(), []);
  g.tap(2, 2); // wrong bulb
  g.tap(0, 0); g.tap(0, 0); // dot on an answer bulb
  g.tap(0, 2); // right bulb
  g.tap(2, 0); g.tap(2, 0); // dot on a non-answer cell is fine
  assert.deepEqual(g.mistakes(), [0, 8]);
});

test('mistakes is empty for a solved board', () => {
  const g = G.createGame(ROWS);
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
