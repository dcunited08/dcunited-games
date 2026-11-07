const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const S = require('./solver.js');

const puzzle = ['1.1...', '..0...', '0.1.1.', '....0.', '....11', '...00.'];
const solution = S.solve(puzzle);
const NAME = ['sun', 'moon'];

function solveGame(game) {
  solution.forEach((row, r) => row.forEach((v, c) => {
    while (game.state().cells[r * 6 + c] !== NAME[v] && !game.isSolved()) {
      if (!game.tap(r, c)) break;
    }
  }));
}

test('tap cycles empty, sun, moon, empty and ignores givens', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(0, 1), true);
  assert.equal(g.state().cells[1], 'sun');
  g.tap(0, 1);
  assert.equal(g.state().cells[1], 'moon');
  g.tap(0, 1);
  assert.equal(g.state().cells[1], 'empty');
  assert.equal(g.tap(0, 0), false);
  assert.equal(g.tap(9, 9), false);
  assert.equal(g.tap(-1, 0), false);
});

test('undo reverses taps one at a time', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.canUndo(), false);
  assert.equal(g.undo(), false);
  g.tap(0, 1);
  g.tap(0, 1);
  assert.equal(g.canUndo(), true);
  assert.equal(g.undo(), true);
  assert.equal(g.state().cells[1], 'sun');
  g.undo();
  assert.equal(g.state().cells[1], 'empty');
  assert.equal(g.canUndo(), false);
});

test('clear empties player cells only and can be undone', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.clear(), false);
  g.tap(0, 1);
  assert.equal(g.clear(), true);
  assert.equal(g.state().cells[1], 'empty');
  assert.equal(g.state().cells[0], 'moon');
  g.undo();
  assert.equal(g.state().cells[1], 'sun');
});

test('applyHint places a square with a reason and can be undone', () => {
  const g = G.createGame(puzzle);
  const h = g.applyHint();
  assert.ok(['sun', 'moon'].includes(h.value));
  assert.equal(g.state().cells[h.r * 6 + h.c], h.value);
  assert.equal(typeof h.reason, 'string');
  g.undo();
  assert.equal(g.state().cells[h.r * 6 + h.c], 'empty');
});

test('applyHint clears a wrong square', () => {
  const g = G.createGame(puzzle);
  const wrong = solution[0][1] === 0 ? 'moon' : 'sun';
  while (g.state().cells[1] !== wrong) g.tap(0, 1);
  const h = g.applyHint();
  assert.equal(h.value, 'empty');
  assert.equal(g.state().cells[1], 'empty');
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
  assert.equal(g.tap(1, 0), false);
  assert.equal(g.clear(), false);
  assert.equal(g.undo(), false);
  assert.deepEqual(g.state(), before);
});

test('conflicts lists squares that break a rule', () => {
  const g = G.createGame(['......', '......', '......', '......', '......', '......']);
  for (const c of [0, 1, 2]) g.tap(0, c);
  assert.deepEqual(g.conflicts(), [0, 1, 2]);
});

test('mistakes lists squares that differ from the answer', () => {
  const g = G.createGame(puzzle);
  assert.deepEqual(g.mistakes(), []);
  const wrong = solution[0][1] === 0 ? 'moon' : 'sun';
  while (g.state().cells[1] !== wrong) g.tap(0, 1);
  const right = NAME[solution[0][3]];
  while (g.state().cells[3] !== right) g.tap(0, 3);
  assert.deepEqual(g.mistakes(), [1]);
});

test('createGame can start from a saved state; state() is a copy', () => {
  const st = L.setCell(L.createState(puzzle), 0, 1, 'moon');
  const g = G.createGame(puzzle, st);
  assert.equal(g.state().cells[1], 'moon');
  assert.equal(g.canUndo(), false);
  g.state().cells[1] = 'sun';
  assert.equal(g.state().cells[1], 'moon');
  assert.equal(G.createGame(puzzle, st).state().given[0], true);
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

test('timer defaults to zero and rejects bad starting values', () => {
  assert.equal(G.createTimer().elapsed(0), 0);
  assert.equal(G.createTimer(-5).elapsed(0), 0);
  assert.equal(G.createTimer(NaN).elapsed(0), 0);
});

test('buildSave and restoreSave round trip', () => {
  const st = L.setCell(L.createState(puzzle), 0, 1, 'moon');
  const saved = G.buildSave(st, 12345.9);
  assert.deepEqual(saved, { cells: st.cells, elapsedMs: 12345 });
  const back = G.restoreSave(puzzle, JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(back.state, st);
  assert.equal(back.elapsedMs, 12345);
});

test('restoreSave rejects bad data and tolerates a bad time', () => {
  assert.equal(G.restoreSave(puzzle, null), null);
  assert.equal(G.restoreSave(puzzle, {}), null);
  assert.equal(G.restoreSave(puzzle, { cells: ['sun'], elapsedMs: 1 }), null);
  assert.equal(G.restoreSave(puzzle, { cells: Array(36).fill('q') }), null);
  const cells = L.createState(puzzle).cells;
  assert.equal(G.restoreSave(puzzle, { cells }).elapsedMs, 0);
  assert.equal(G.restoreSave(puzzle, { cells, elapsedMs: -3 }).elapsedMs, 0);
  assert.equal(G.buildSave({ size: 6, cells }, -1).elapsedMs, 0);
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
});

test('nextPuzzleId goes back to earlier levels and wraps when all are solved', () => {
  const counts = { easy: 2, medium: 1, hard: 1 };
  const solved = new Set(['easy-1', 'medium-1', 'hard-1']);
  const is = (id) => solved.has(id);
  assert.equal(G.nextPuzzleId(counts, is, 'hard-1'), 'easy-2');
  solved.add('easy-2');
  assert.equal(G.nextPuzzleId(counts, is, 'easy-2'), 'easy-1');
  assert.equal(G.nextPuzzleId(counts, is, 'bogus'), 'easy-1');
});
