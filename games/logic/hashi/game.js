// Hashi game flow without the DOM: moves, undo, hints, timer, saving and drag
// targets. Loaded as a plain <script> after logic.js and solver.js in the
// browser (exposes window.HashiGame) and via require() in Node tests.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.HashiLogic;
  const Solver = isNode ? require('./solver.js') : root.HashiSolver;
  const Kit = isNode ? require('../kit.js') : root.LogicKit;

  // A game holds the current state plus an undo stack of earlier bridge counts.
  // Once the board is solved it is read-only.
  function createGame(puzzle, start) {
    const parsed = Logic.parsePuzzle(puzzle);
    let state = start ? { counts: start.counts.slice() } : Logic.createState(parsed);
    const undos = [];

    const same = (a, b) => a.counts.every((v, i) => v === b.counts[i]);
    function commit(next) {
      if (same(state, next)) return false;
      undos.push(state.counts);
      state = next;
      return true;
    }
    const locked = () => Logic.isSolved(parsed, state);
    let solution = null;
    const answer = () => { if (!solution) solution = Solver.solve(parsed); return solution; };

    const game = {
      puzzle: () => parsed,
      state: () => ({ counts: state.counts.slice() }),
      isSolved: () => locked(),
      conflicts: () => Logic.findConflicts(parsed, state),
      canUndo: () => undos.length > 0,
      // Edge indexes holding more bridges than the known solution has there.
      mistakes() {
        const sol = answer();
        if (!sol) return [];
        return state.counts.reduce((bad, v, e) => (v > sol[e] ? bad.concat(e) : bad), []);
      },
      cycle(e) {
        if (locked()) return false;
        return commit(Logic.cycleEdge(parsed, state, e));
      },
      // Cycle the bridge between two islands, if they can have one.
      link(a, b) {
        const e = Logic.edgeBetween(parsed, a, b);
        return e === -1 ? false : game.cycle(e);
      },
      // Tap on an island. `selected` is the island picked earlier (or null).
      // Returns the new selection and whether a bridge changed.
      tapIsland(selected, i) {
        if (locked()) return { selected: null, changed: false };
        if (selected === null) return { selected: i, changed: false };
        if (selected === i) return { selected: null, changed: false };
        if (Logic.edgeBetween(parsed, selected, i) === -1) return { selected: i, changed: false };
        return { selected, changed: game.link(selected, i) };
      },
      clear() {
        if (locked()) return false;
        return commit({ counts: state.counts.map(() => 0) });
      },
      applyHint() {
        if (locked()) return null;
        const h = Solver.hint(parsed, state);
        if (h) commit(Logic.setEdge(parsed, state, h.edge, h.value));
        return h;
      },
      undo() {
        if (locked() || !undos.length) return false;
        state = { counts: undos.pop() };
        return true;
      },
      // Screen reader text for an island.
      describeIsland(i) {
        const total = Logic.islandTotals(parsed, state)[i];
        const n = parsed.islands[i].n;
        return `Island ${n}, has ${total} of ${n} ${n === 1 ? 'bridge' : 'bridges'}`;
      },
    };
    return game;
  }

  // Which neighbour island a drag from island `from` points at, or -1. (x, y)
  // is the pointer in grid units (column, row). The drag counts once it has
  // gone at least half way to the neighbour along its main direction.
  function dragTarget(puzzle, from, x, y) {
    const isl = puzzle.islands[from];
    const dx = x - isl.c;
    const dy = y - isl.r;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sign = Math.sign(horizontal ? dx : dy);
    if (sign === 0) return -1;
    const travelled = Math.abs(horizontal ? dx : dy);
    for (const e of puzzle.edges) {
      if (e.dir !== (horizontal ? 'h' : 'v') || (e.a !== from && e.b !== from)) continue;
      const other = e.a === from ? e.b : e.a;
      const o = puzzle.islands[other];
      const gap = horizontal ? o.c - isl.c : o.r - isl.r;
      if (Math.sign(gap) === sign && travelled >= Math.abs(gap) / 2) return other;
    }
    return -1;
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
  const buildSave = (state, elapsedMs) => ({ counts: state.counts.slice(), elapsedMs: cleanTime(elapsedMs) });

  // Returns { state, elapsedMs } or null if the saved object does not fit this puzzle.
  function restoreSave(puzzle, saved) {
    if (!saved || !Array.isArray(saved.counts)) return null;
    const parsed = Logic.parsePuzzle(puzzle);
    const state = Logic.deserialize(JSON.stringify({ counts: saved.counts }), parsed);
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

  const api = { nextPuzzleId, createGame, dragTarget, createTimer, buildSave, restoreSave };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HashiGame = api;
})(this);
