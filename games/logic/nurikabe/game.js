// Nurikabe game flow without the DOM: moves, undo, hints, timer and saving.
// Loaded as a plain <script> after logic.js and solver.js in the browser
// (exposes window.NurikabeGame) and via require() in Node tests.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.NurikabeLogic;
  const Solver = isNode ? require('./solver.js') : root.NurikabeSolver;
  const Kit = isNode ? require('../kit.js') : root.LogicKit;

  const CYCLE = { empty: 'sea', sea: 'dot', dot: 'empty' };

  // A game holds the current state plus an undo stack of earlier cell lists.
  // Once the board is solved it is read-only.
  function createGame(puzzle, start) {
    const parsed = Logic.parsePuzzle(puzzle);
    let state = start ? { size: start.size, cells: start.cells.slice() } : Logic.createState(parsed);
    const undos = [];
    let answer = null;

    const same = (a, b) => a.cells.every((v, i) => v === b.cells[i]);
    function commit(next) {
      if (same(state, next)) return false;
      undos.push(state.cells);
      state = next;
      return true;
    }
    const locked = () => Logic.isSolved(parsed, state);
    const inBoard = (r, c) => r >= 0 && c >= 0 && r < state.size && c < state.size;

    return {
      state: () => ({ size: state.size, cells: state.cells.slice() }),
      isSolved: () => locked(),
      conflicts: () => Logic.findConflicts(parsed, state),
      canUndo: () => undos.length > 0,
      // Sorted cell indexes that disagree with the known answer: shaded
      // squares that are island in it and dots on squares that are sea.
      mistakes() {
        answer = answer || Solver.solve(parsed);
        const bad = [];
        state.cells.forEach((v, i) => {
          if ((v === 'sea' && !answer[i]) || (v === 'dot' && answer[i])) bad.push(i);
        });
        return bad;
      },
      tap(r, c) {
        if (locked() || !inBoard(r, c)) return false;
        return commit(Logic.cycleCell(parsed, state, r, c));
      },
      // Drag over a list of [r, c] cells: the first cell steps to its next
      // value and every other cell passed over gets that same value.
      drag(list) {
        if (locked()) return false;
        const first = list.find(([r, c]) => inBoard(r, c) && !parsed.clues[r * state.size + c]);
        if (!first) return false;
        const value = CYCLE[Logic.getCell(state, first[0], first[1])];
        return commit(Logic.paint(parsed, state, list, value));
      },
      clear() {
        if (locked()) return false;
        return commit(Logic.clearBoard(state));
      },
      applyHint() {
        if (locked()) return null;
        const h = Solver.hint(parsed, state);
        if (h) commit(Logic.setCell(parsed, state, h.r, h.c, h.value));
        return h;
      },
      undo() {
        if (locked() || !undos.length) return false;
        state = { size: state.size, cells: undos.pop() };
        return true;
      },
    };
  }

  // Elapsed-time model. Pass `now` (ms) in so it can be tested; the page uses
  // Date.now(). Pausing keeps the time, so it survives the tab being hidden.
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

  // The object stored with createProgress.save(id, obj).
  const buildSave = (state, elapsedMs) => ({ cells: state.cells.slice(), elapsedMs: cleanTime(elapsedMs) });

  // Returns { state, elapsedMs } or null if the saved object does not fit this puzzle.
  function restoreSave(puzzle, saved) {
    if (!saved || !Array.isArray(saved.cells)) return null;
    const size = Logic.parsePuzzle(puzzle).size;
    const state = Logic.deserialize(JSON.stringify({ size, cells: saved.cells }), puzzle);
    return state ? { state, elapsedMs: cleanTime(saved.elapsedMs) } : null;
  }

  // Next puzzle to offer after `currentId` (counted as done): the next unsolved
  // one in the same level, then later levels, then earlier ones. When
  // everything is solved, the next puzzle in the same level (wrapping round).
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

  const api = { nextPuzzleId, createGame, createTimer, buildSave, restoreSave };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NurikabeGame = api;
})(this);
