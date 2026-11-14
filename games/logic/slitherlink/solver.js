// Slitherlink solver. No DOM. Loaded as a plain <script> after logic.js in the
// browser (exposes window.SlitherlinkSolver) and via require() in Node tests.
//
// Works on a Uint8Array with one entry per edge: UNKNOWN, LINE or CROSS.
// propagate() applies the clue rules (count lines and crosses around a cell),
// the dot rules (a dot has 0 or 2 lines) and the no-early-loop rule until
// nothing changes. solve/countSolutions add backtracking on top.
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.SlitherlinkLogic;

  const UNKNOWN = 0;
  const LINE = 1;
  const CROSS = 2;

  const flagsOf = (a) => Array.from(a, (v) => v === LINE);

  // Union-find over dots joined by LINE edges.
  function components(p, a) {
    const parent = Array.from({ length: p.dotE.length }, (_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    p.edgeD.forEach((ds, e) => { if (a[e] === LINE) parent[find(ds[0])] = find(ds[1]); });
    return find;
  }

  // Cross every unknown edge that would close a loop that is not the finished
  // answer. Returns true if it changed anything.
  function stopEarlyLoops(p, a) {
    const find = components(p, a);
    let total = 0;
    const perRoot = new Map();
    p.edgeD.forEach((ds, e) => {
      if (a[e] !== LINE) return;
      total++;
      const r = find(ds[0]);
      perRoot.set(r, (perRoot.get(r) || 0) + 1);
    });
    if (total === 0) return false;
    const counts = p.cellE.map((es) => es.reduce((n, e) => n + (a[e] === LINE ? 1 : 0), 0));
    let changed = false;
    p.edgeD.forEach((ds, e) => {
      if (a[e] !== UNKNOWN || find(ds[0]) !== find(ds[1])) return;
      const finished = perRoot.get(find(ds[0])) === total
        && p.clues.every((n, cell) => n < 0 || counts[cell] + (p.edgeC[e].includes(cell) ? 1 : 0) === n);
      if (!finished) { a[e] = CROSS; changed = true; }
    });
    return changed;
  }

  // Applies the rules in place. Returns false if the board is contradictory.
  function propagate(p, a) {
    let changed = true;
    const set = (e, v) => {
      if (a[e] === UNKNOWN) { a[e] = v; changed = true; return true; }
      return a[e] === v;
    };
    while (changed) {
      changed = false;
      for (let cell = 0; cell < p.clues.length; cell++) {
        const n = p.clues[cell];
        if (n < 0) continue;
        const es = p.cellE[cell];
        const lines = es.filter((e) => a[e] === LINE).length;
        const unknown = es.filter((e) => a[e] === UNKNOWN);
        if (lines > n || lines + unknown.length < n) return false;
        if (unknown.length && lines === n) unknown.forEach((e) => set(e, CROSS));
        else if (unknown.length && lines + unknown.length === n) unknown.forEach((e) => set(e, LINE));
      }
      for (let d = 0; d < p.dotE.length; d++) {
        const es = p.dotE[d];
        const lines = es.filter((e) => a[e] === LINE).length;
        const unknown = es.filter((e) => a[e] === UNKNOWN);
        if (lines > 2) return false;
        if (lines === 2) unknown.forEach((e) => set(e, CROSS));
        else if (lines === 1) {
          if (unknown.length === 0) return false;
          if (unknown.length === 1) set(unknown[0], LINE);
        } else if (unknown.length === 1) set(unknown[0], CROSS);
      }
      if (stopEarlyLoops(p, a)) changed = true;
    }
    return true;
  }

  const isDone = (p, a) => {
    const lines = flagsOf(a);
    return Logic.isSingleLoop(p, lines) && Logic.cluesMet(p, lines);
  };

  // Prefer an edge that extends an open path, else the first unknown edge.
  function pickEdge(p, a) {
    let first = -1;
    for (let e = 0; e < a.length; e++) {
      if (a[e] !== UNKNOWN) continue;
      if (first < 0) first = e;
      if (p.edgeD[e].some((d) => p.dotE[d].some((o) => a[o] === LINE))) return e;
    }
    return first;
  }

  function search(p, a, found, limit, budget) {
    if (budget && ++budget.used > budget.max) return;
    if (!propagate(p, a)) return;
    if (isDone(p, a)) { found.push(flagsOf(a)); return; }
    const e = pickEdge(p, a);
    if (e < 0) return;
    for (const v of [LINE, CROSS]) {
      if (found.length >= limit) return;
      const b = Uint8Array.from(a);
      b[e] = v;
      search(p, b, found, limit, budget);
    }
  }

  function allSolutions(puzzle, limit, maxNodes) {
    const p = Logic.parsePuzzle(puzzle);
    const found = [];
    const budget = maxNodes ? { used: 0, max: maxNodes } : null;
    search(p, new Uint8Array(p.edgeCount), found, limit, budget);
    return { found, exhausted: !!budget && budget.used > budget.max };
  }

  // Array of booleans (true = line) for the first solution, or null.
  const solve = (puzzle) => allSolutions(puzzle, 1).found[0] || null;

  // Number of solutions, counted up to `limit` (default 2). With `maxNodes`,
  // a search that needs more than that many steps gives up and returns Infinity.
  function countSolutions(puzzle, limit = 2, maxNodes = 0) {
    const r = allSolutions(puzzle, limit, maxNodes);
    return r.exhausted ? Infinity : r.found.length;
  }

  // True when the rules alone finish the puzzle, with no guessing.
  function solvesByPropagation(puzzle) {
    const p = Logic.parsePuzzle(puzzle);
    const a = new Uint8Array(p.edgeCount);
    return propagate(p, a) && isDone(p, a);
  }

  const api = { UNKNOWN, LINE, CROSS, propagate, solve, countSolutions, solvesByPropagation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlitherlinkSolver = api;
})(this);
