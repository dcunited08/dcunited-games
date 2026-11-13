// Logic Grid game flow without the DOM: moves, undo, hints, timer, saving.
// Loaded as a plain <script> after logic.js (window.LogicGridGame) and via require() in Node.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.LogicGridLogic;
  const Kit = isNode ? require('../kit.js') : root.LogicKit;

  function createGame(puzzle, start) {
    const lay = Logic.layout(puzzle);
    let state = start && start.state ? Logic.setCell(start.state, 0, 0, 0, start.state.cells[0][0]) : Logic.createState(puzzle);
    let struck = new Set(start && start.struck ? start.struck : []);
    let undos = [];
    const locked = () => Logic.isSolved(puzzle, state);

    function commit(next) {
      undos.push(state);
      state = next;
      return true;
    }
    const inGrid = (b, r, c) => b >= 0 && b < lay.blocks.length && r >= 0 && c >= 0 && r < lay.k && c < lay.k;

    return {
      state: () => Logic.setCell(state, 0, 0, 0, state.cells[0][0]),
      struck: () => [...struck].sort((a, b) => a - b),
      isSolved: () => locked(),
      canUndo: () => undos.length > 0,
      mistakes: () => Logic.mistakes(puzzle, state),
      tap(b, r, c) {
        if (locked() || !inGrid(b, r, c)) return false;
        return commit(Logic.cycleCell(state, b, r, c));
      },
      toggleClue(i) {
        if (locked() || !Number.isInteger(i) || i < 0 || i >= puzzle.clues.length) return false;
        if (!struck.delete(i)) struck.add(i);
        return true;
      },
      undo() {
        if (locked() || !undos.length) return false;
        state = undos.pop();
        return true;
      },
      clear() {
        state = Logic.createState(puzzle);
        struck = new Set();
        undos = [];
      },
      // Fix one wrong mark; if there is none, place one correct o (with its x marks).
      hint() {
        if (locked()) return null;
        const bad = Logic.mistakes(puzzle, state)[0];
        if (bad) {
          commit(Logic.setCell(state, bad.b, bad.r, bad.c, ''));
          return { kind: 'fix', ...bad, text: 'Hint: that mark was wrong, so it was cleared.' };
        }
        for (let b = 0; b < lay.blocks.length; b++) {
          for (let r = 0; r < lay.k; r++) {
            for (let c = 0; c < lay.k; c++) {
              if (Logic.cellTruth(puzzle, lay.blocks[b], r, c) && state.cells[b][r * lay.k + c] !== 'o') {
                commit(Logic.placeO(state, b, r, c));
                const rowW = puzzle.cats[lay.blocks[b].rc].items[r].w;
                const colW = puzzle.cats[lay.blocks[b].cc].items[c].w;
                return { kind: 'place', b, r, c, text: `Hint: ${rowW} goes with ${colW}.` };
              }
            }
          }
        }
        return null;
      },
    };
  }

  // Elapsed-time model. Pass `now` (ms) in so it can be tested; the page uses Date.now().
  function createTimer(startMs) {
    let base = Number.isFinite(startMs) && startMs > 0 ? startMs : 0;
    let since = null;
    return {
      start(now) { if (since === null) since = now; },
      pause(now) { if (since !== null) { base += Math.max(0, now - since); since = null; } },
      elapsed: (now) => base + (since === null ? 0 : Math.max(0, now - since)),
      isRunning: () => since !== null,
      reset() { base = 0; since = null; },
    };
  }

  const cleanTime = (ms) => (Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0);

  const buildSave = (game, elapsedMs) => ({
    cells: game.state().cells, struck: game.struck(), elapsedMs: cleanTime(elapsedMs),
  });

  // Returns { state, struck, elapsedMs } or null if the saved object does not fit this puzzle.
  function restoreSave(puzzle, saved) {
    if (!saved || !Array.isArray(saved.cells)) return null;
    const fresh = Logic.createState(puzzle);
    const fits = saved.cells.length === fresh.cells.length && saved.cells.every((cells, b) =>
      Array.isArray(cells) && cells.length === fresh.cells[b].length && cells.every((v) => v === '' || v === 'x' || v === 'o'));
    if (!fits) return null;
    const n = puzzle.clues.length;
    const struck = Array.isArray(saved.struck)
      ? [...new Set(saved.struck.filter((i) => Number.isInteger(i) && i >= 0 && i < n))].sort((a, b) => a - b)
      : [];
    return { state: { k: fresh.k, cells: saved.cells.map((c) => c.slice()) }, struck, elapsedMs: cleanTime(saved.elapsedMs) };
  }

  // Next puzzle to offer after `currentId` (counted as done): the next unsolved one in the
  // same level, then later levels, then earlier ones; when all are solved, the next in the level.
  function nextPuzzleId(counts, isSolved, currentId) {
    const cur = Kit.parsePuzzleId(currentId) || { level: 'easy', n: 0 };
    const done = (id) => id === currentId || isSolved(id);
    const at = Kit.LEVELS.indexOf(cur.level);
    for (let i = 0; i < Kit.LEVELS.length; i++) {
      const next = Kit.nextUnsolved(counts, done, Kit.LEVELS[(at + i) % Kit.LEVELS.length]);
      if (next) return next;
    }
    const total = counts[cur.level];
    return Kit.puzzleId(cur.level, cur.n >= total ? 1 : cur.n + 1);
  }

  const api = { createGame, createTimer, buildSave, restoreSave, nextPuzzleId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LogicGridGame = api;
})(this);
