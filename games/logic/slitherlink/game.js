// Slitherlink game flow without the DOM: moves, undo, hints, timer, saving.
// Loaded as a plain <script> after logic.js and solver.js in the browser
// (exposes window.SlitherlinkGame) and via require() in Node tests.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.SlitherlinkLogic;
  const Solver = isNode ? require('./solver.js') : root.SlitherlinkSolver;
  const Kit = isNode ? require('../kit.js') : root.LogicKit;

  // A game holds the current state plus an undo stack of earlier edge lists.
  // Once the board is solved it is read-only.
  function createGame(puzzle, start) {
    const p = Logic.parsePuzzle(puzzle);
    let state = start ? { edges: start.edges.slice() } : Logic.createState(p);
    const undos = [];
    let answer = null;
    const solution = () => { if (!answer) answer = Solver.solve(p); return answer; };

    const same = (a, b) => a.edges.every((v, i) => v === b.edges[i]);
    function commit(next) {
      if (same(state, next)) return false;
      undos.push(state.edges);
      state = next;
      return true;
    }
    const locked = () => Logic.isSolved(p, state);

    // The reason shown with a hint that adds a line.
    function addReason(e) {
      const clued = p.edgeC[e].filter((c) => p.clues[c] >= 0);
      if (clued.length) {
        const n = Math.max(...clued.map((c) => p.clues[c]));
        return `The ${n} needs ${n === 1 ? 'one line' : `${n} lines`} around it, and this is one of them.`;
      }
      return 'The loop has to go through here.';
    }

    return {
      state: () => ({ edges: state.edges.slice() }),
      isSolved: () => locked(),
      conflicts: () => Logic.findConflicts(p, state),
      canUndo: () => undos.length > 0,
      // Sorted edges that disagree with the known answer: lines that are not
      // on it and X marks sitting on one of its edges.
      mistakes() {
        const sol = solution();
        const bad = [];
        state.edges.forEach((v, e) => {
          if ((v === 'line' && !sol[e]) || (v === 'x' && sol[e])) bad.push(e);
        });
        return bad;
      },
      tap(e) {
        if (locked()) return false;
        return commit(Logic.cycleEdge(state, e));
      },
      drawPath(list, erase) {
        if (locked()) return false;
        return commit(Logic.setPath(state, list, erase));
      },
      clear() {
        if (locked()) return false;
        return commit(Logic.clearBoard(state));
      },
      // { edge, value, reason }: fixes the first wrong edge, else draws one
      // answer line (next to a clue if possible, extending the loop if possible).
      applyHint() {
        if (locked()) return null;
        const sol = solution();
        const bad = this.mistakes();
        if (bad.length) {
          const e = bad[0];
          const wasLine = state.edges[e] === 'line';
          commit(Logic.setEdge(state, e, 'empty'));
          return {
            edge: e, value: 'empty',
            reason: wasLine ? "That line isn't part of the loop, so it's gone." : 'That X is on a side the loop uses, so it is cleared.',
          };
        }
        let best = -1;
        let bestScore = -1;
        sol.forEach((on, e) => {
          if (!on || state.edges[e] === 'line') return;
          const score = (p.edgeC[e].some((c) => p.clues[c] >= 0) ? 2 : 0)
            + (p.edgeD[e].some((d) => p.dotE[d].some((o) => state.edges[o] === 'line')) ? 1 : 0);
          if (score > bestScore) { bestScore = score; best = e; }
        });
        commit(Logic.setEdge(state, best, 'line'));
        return { edge: best, value: 'line', reason: addReason(best) };
      },
      undo() {
        if (locked() || !undos.length) return false;
        state = { edges: undos.pop() };
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
  const buildSave = (state, elapsedMs) => ({ edges: state.edges.slice(), elapsedMs: cleanTime(elapsedMs) });

  // Returns { state, elapsedMs } or null if the saved object does not fit this puzzle.
  function restoreSave(puzzle, saved) {
    if (!saved || !Array.isArray(saved.edges)) return null;
    const state = Logic.deserialize(JSON.stringify({ edges: saved.edges }), puzzle);
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
  else root.SlitherlinkGame = api;
})(this);
