const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./game.js');
const L = require('./logic.js');
const Gen = require('./generator.js');

const puzzle = Gen.generate('easy', 4);
const lay = L.layout(puzzle);
// A true cell and a false cell in block 0.
const find = (truth) => {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (L.cellTruth(puzzle, lay.blocks[0], r, c) === truth) return { r, c };
};

function solveAll(game) {
  lay.blocks.forEach((blk, b) => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (L.cellTruth(puzzle, blk, r, c)) {
        while (game.state().cells[b][r * 4 + c] !== 'o') game.tap(b, r, c);
      }
    }
  });
}

test('tap cycles a cell and undo steps back one whole move, auto-x included', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.canUndo(), false);
  assert.equal(g.tap(0, 0, 0), true);
  assert.equal(g.state().cells[0][0], 'x');
  g.tap(0, 0, 0);
  assert.equal(g.state().cells[0][0], 'o');
  assert.equal(g.state().cells[0][1], 'x');
  assert.equal(g.undo(), true);
  assert.equal(g.state().cells[0][0], 'x');
  assert.equal(g.state().cells[0][1], '');
  g.undo();
  assert.equal(g.undo(), false);
});

test('taps outside the grid are ignored', () => {
  const g = G.createGame(puzzle);
  assert.equal(g.tap(99, 0, 0), false);
  assert.equal(g.tap(0, 4, 0), false);
  assert.equal(g.tap(0, 0, -1), false);
  assert.equal(g.canUndo(), false);
});

test('tapping clues toggles strike-through', () => {
  const g = G.createGame(puzzle);
  g.toggleClue(1);
  g.toggleClue(0);
  assert.deepEqual(g.struck(), [0, 1]);
  g.toggleClue(1);
  assert.deepEqual(g.struck(), [0]);
  g.toggleClue(99);
  g.toggleClue(-1);
  assert.deepEqual(g.struck(), [0]);
});

test('restart clears marks, struck clues and undo history', () => {
  const g = G.createGame(puzzle);
  g.tap(0, 0, 0);
  g.toggleClue(0);
  g.clear();
  assert.ok(g.state().cells.every((c) => c.every((v) => v === '')));
  assert.deepEqual(g.struck(), []);
  assert.equal(g.canUndo(), false);
});

test('mistakes reports wrong marks', () => {
  const g = G.createGame(puzzle);
  const f = find(false);
  g.tap(0, f.r, f.c); g.tap(0, f.r, f.c); // o on a false cell
  assert.ok(g.mistakes().some((m) => m.b === 0 && m.r === f.r && m.c === f.c));
});

test('hint fixes a wrong mark first, then places a correct o with its x marks', () => {
  const g = G.createGame(puzzle);
  const f = find(false);
  g.tap(0, f.r, f.c); // wrong? an x on a false cell is fine
  g.tap(0, f.r, f.c); // now o: wrong
  const h1 = g.hint();
  assert.equal(h1.kind, 'fix');
  assert.equal(g.state().cells[0][f.r * 4 + f.c], '');
  assert.match(h1.text, /wrong/i);
  g.undo(); // the fix is one undo step
  assert.equal(g.state().cells[0][f.r * 4 + f.c], 'o');
  let h2 = g.hint();
  for (let i = 0; i < 20 && h2.kind === 'fix'; i++) h2 = g.hint(); // wrong auto-x marks are fixed too
  assert.equal(h2.kind, 'place');
  assert.equal(g.state().cells[h2.b][h2.r * 4 + h2.c], 'o');
  assert.ok(L.cellTruth(puzzle, lay.blocks[h2.b], h2.r, h2.c));
  assert.match(h2.text, /\w/);
});

test('hints alone can solve the puzzle, then there is nothing left to hint', () => {
  const g = G.createGame(puzzle);
  let guard = 0;
  while (!g.isSolved() && guard++ < 100) assert.ok(g.hint());
  assert.ok(g.isSolved());
  assert.equal(g.hint(), null);
});

test('a solved game is locked', () => {
  const g = G.createGame(puzzle);
  solveAll(g);
  assert.equal(g.isSolved(), true);
  assert.equal(g.tap(0, 0, 0), false);
  assert.equal(g.undo(), false);
  assert.equal(g.toggleClue(0), false);
});

test('a hint with a wrong x on a true cell clears that x', () => {
  const g = G.createGame(puzzle);
  const t = find(true);
  g.tap(0, t.r, t.c); // x on a true cell
  const h = g.hint();
  assert.equal(h.kind, 'fix');
  assert.equal(g.state().cells[0][t.r * 4 + t.c], '');
});

test('timer counts only while running', () => {
  const t = G.createTimer(5000);
  assert.equal(t.elapsed(100), 5000);
  t.start(1000);
  t.start(2000);
  assert.equal(t.isRunning(), true);
  assert.equal(t.elapsed(3000), 7000);
  t.pause(4000);
  t.pause(9000);
  assert.equal(t.elapsed(9999), 8000);
  assert.equal(t.isRunning(), false);
  t.reset();
  assert.equal(t.elapsed(1), 0);
  assert.equal(G.createTimer(-4).elapsed(0), 0);
  assert.equal(G.createTimer('x').elapsed(0), 0);
});

test('save and restore round-trip marks, struck clues and time', () => {
  const g = G.createGame(puzzle);
  g.tap(0, 1, 1); g.tap(0, 1, 1); g.toggleClue(2);
  const saved = JSON.parse(JSON.stringify(G.buildSave(g, 12345.9)));
  assert.equal(saved.elapsedMs, 12345);
  const back = G.restoreSave(puzzle, saved);
  assert.deepEqual(back.state, g.state());
  assert.deepEqual(back.struck, [2]);
  assert.equal(back.elapsedMs, 12345);
  const g2 = G.createGame(puzzle, back);
  assert.deepEqual(g2.state(), g.state());
  assert.deepEqual(g2.struck(), [2]);
});

test('restoreSave rejects saves that do not fit the puzzle', () => {
  assert.equal(G.restoreSave(puzzle, null), null);
  assert.equal(G.restoreSave(puzzle, {}), null);
  assert.equal(G.restoreSave(puzzle, { cells: [[]] }), null);
  const g = G.createGame(puzzle);
  const good = G.buildSave(g, 0);
  assert.equal(G.restoreSave(puzzle, { ...good, cells: good.cells.map((c) => c.map(() => 'z')) }), null);
  const r = G.restoreSave(puzzle, { ...good, struck: 'nope', elapsedMs: -5 });
  assert.deepEqual(r.struck, []);
  assert.equal(r.elapsedMs, 0);
  const r2 = G.restoreSave(puzzle, { ...good, struck: [0, 0, 99, -1, 'a', 1] });
  assert.deepEqual(r2.struck, [0, 1]);
});

test('nextPuzzleId moves to the next unsolved puzzle, then other levels, then wraps', () => {
  const counts = { easy: 3, medium: 2, hard: 2 };
  const none = () => false;
  assert.equal(G.nextPuzzleId(counts, none, 'easy-1'), 'easy-2');
  assert.equal(G.nextPuzzleId(counts, (id) => id === 'easy-2', 'easy-1'), 'easy-3');
  assert.equal(G.nextPuzzleId(counts, (id) => id.startsWith('easy'), 'easy-3'), 'medium-1');
  assert.equal(G.nextPuzzleId(counts, () => true, 'easy-3'), 'easy-1');
  assert.equal(G.nextPuzzleId(counts, () => true, 'easy-2'), 'easy-3');
  assert.equal(G.nextPuzzleId(counts, none, 'junk'), 'easy-1');
});
