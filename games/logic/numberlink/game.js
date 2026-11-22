// Numberlink game flow without the DOM: strokes, undo, hints, timer and saving.
// Loaded as a plain <script> after logic.js and solver.js in the browser
// (exposes window.NumberlinkGame) and via require() in Node tests.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.NumberlinkLogic;
  const Solver = isNode ? require('./solver.js') : root.NumberlinkSolver;
  const Kit = isNode ? require('../kit.js') : root.LogicKit;

  const copy = (state) => ({ size: state.size, lines: JSON.parse(JSON.stringify(state.lines)) });
  const same = (a, b) => JSON.stringify(a.lines) === JSON.stringify(b.lines);

  // A game holds the current lines plus an undo stack of earlier states. A drag
  // is begun, moved and ended; the whole drag is one undo step. Once the board
  // is solved it is read-only.
  function createGame(puzzle, start) {
    const parsed = Logic.parsePuzzle(puzzle);
    let state = start ? copy(start) : Logic.createState(parsed);
    const undos = [];
    let active = null; // { stroke, before }
    let solution = null;
    const answer = () => solution || (solution = Solver.solve(parsed));
    const locked = () => Logic.isSolved(parsed, state);

    function commit(next) {
      if (same(state, next)) return false;
      undos.push(copy(state));
      state = next;
      return true;
    }

    return {
      state: () => copy(state),
      isSolved: () => locked(),
      status: () => Logic.status(parsed, state),
      canUndo: () => undos.length > 0,
      strokeActive: () => active !== null,
      beginStroke(cell) {
        if (active || locked()) return false;
        const begun = Logic.beginStroke(parsed, state, cell);
        if (!begun) return false;
        active = { stroke: begun.stroke, before: copy(state) };
        state = begun.state;
        return true;
      },
      moveStroke(cell) {
        if (!active) return false;
        const next = Logic.stepStroke(parsed, state, active.stroke, cell);
        const changed = !same(state, next.state);
        state = next.state;
        active.stroke = next.stroke;
        return changed;
      },
      // Finishes the drag; true when it changed the board (one undo step).
      endStroke() {
        if (!active) return false;
        const before = active.before;
        active = null;
        state = Logic.finishStroke(state);
        if (same(before, state)) return false;
        undos.push(before);
        return true;
      },
      clear() {
        if (locked() || active) return false;
        return commit(Logic.clearAll(parsed, state));
      },
      mistakes: () => Logic.findMistakes(parsed, state, answer()),
      applyHint() {
        if (locked() || active) return null;
        const h = Logic.hint(parsed, state, answer());
        if (!h) return null;
        commit(h.state);
        return { id: h.id, reason: h.reason };
      },
      undo() {
        if (locked() || active || !undos.length) return false;
        state = undos.pop();
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

  // The object stored with createProgress.save(id, obj): only drawn lines.
  function buildSave(state, elapsedMs) {
    const lines = {};
    Object.keys(state.lines).forEach((id) => { if (state.lines[id].length) lines[id] = state.lines[id].slice(); });
    return { lines, elapsedMs: cleanTime(elapsedMs) };
  }

  // Returns { state, elapsedMs } or null if the saved object does not fit this puzzle.
  function restoreSave(puzzle, saved) {
    if (!saved) return null;
    const state = Logic.validateLines(puzzle, saved.lines);
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
  else root.NumberlinkGame = api;
})(this);
