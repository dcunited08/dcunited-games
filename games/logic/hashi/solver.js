// Hashi solver: propagation on per-edge bounds plus backtracking. No DOM.
// Browser global: window.HashiSolver (after logic.js). Puzzles are row arrays
// or the output of HashiLogic.parsePuzzle.
//
// Each edge has bounds lo..hi (bridges). Rules: an island's bridges add up to
// its number, crossing edges exclude each other, and every island must stay
// reachable (and a finished group may not leave islands outside it).
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.HashiLogic;

  function setup(puzzle) {
    const p = Logic.parsePuzzle(puzzle);
    const m = p.edges.length;
    const lo = new Int8Array(m);
    const hi = Int8Array.from(p.edges, (e) => Math.min(2, p.islands[e.a].n, p.islands[e.b].n));
    const inc = p.islands.map(() => []);
    p.edges.forEach((e, i) => { inc[e.a].push(i); inc[e.b].push(i); });
    const cross = p.edges.map((e, i) => Logic.crossersOf(p, i));
    return { p, lo, hi, inc, cross };
  }

  // Component id per island using edges that satisfy `use`.
  function components(ctx, use) {
    const { p } = ctx;
    const id = p.islands.map((_, i) => i);
    const find = (x) => { while (id[x] !== x) { id[x] = id[id[x]]; x = id[x]; } return x; };
    p.edges.forEach((e, i) => { if (use(i)) id[find(e.a)] = find(e.b); });
    return p.islands.map((_, i) => find(i));
  }

  // Tightens lo/hi in place. Returns false on contradiction. `stats.rounds`
  // counts the passes that changed something.
  function propagate(ctx, lo, hi, stats) {
    const { p, inc, cross } = ctx;
    for (;;) {
      let changed = false;
      for (let i = 0; i < p.islands.length; i++) {
        let sumLo = 0;
        let sumHi = 0;
        for (const e of inc[i]) { sumLo += lo[e]; sumHi += hi[e]; }
        const n = p.islands[i].n;
        if (sumLo > n || sumHi < n) return false;
        for (const e of inc[i]) {
          const newLo = Math.max(lo[e], n - (sumHi - hi[e]));
          const newHi = Math.min(hi[e], n - (sumLo - lo[e]));
          if (newLo !== lo[e] || newHi !== hi[e]) { lo[e] = newLo; hi[e] = newHi; changed = true; }
          if (lo[e] > hi[e]) return false;
        }
      }
      for (let e = 0; e < lo.length; e++) {
        if (lo[e] === 0) continue;
        for (const x of cross[e]) {
          if (lo[x] > 0) return false;
          if (hi[x] > 0) { hi[x] = 0; changed = true; }
        }
      }
      if (!connectivityOk(ctx, lo, hi)) return false;
      if (!changed) return true;
      if (stats) stats.rounds++;
    }
  }

  function connectivityOk(ctx, lo, hi) {
    const { p, inc } = ctx;
    if (p.islands.length < 2) return true;
    const possible = components(ctx, (i) => hi[i] > 0);
    if (possible.some((c) => c !== possible[0])) return false;
    // A group that is already complete must be the whole board.
    const sure = components(ctx, (i) => lo[i] > 0);
    const open = new Set();
    p.islands.forEach((isl, i) => {
      let sum = 0;
      for (const e of inc[i]) sum += lo[e];
      if (sum < isl.n) open.add(sure[i]);
    });
    return new Set(sure).size === 1 || sure.every((c) => open.has(c));
  }

  // Calls onSolution(lo) for each solution until it returns true (stop).
  function search(ctx, lo, hi, onSolution) {
    if (!propagate(ctx, lo, hi)) return false;
    const e = lo.findIndex((v, i) => v < hi[i]);
    if (e === -1) return onSolution(lo);
    for (let v = hi[e]; v >= lo[e]; v--) {
      const l = lo.slice();
      const h = hi.slice();
      l[e] = v;
      h[e] = v;
      if (search(ctx, l, h, onSolution)) return true;
    }
    return false;
  }

  function solve(puzzle) {
    const ctx = setup(puzzle);
    let found = null;
    search(ctx, ctx.lo, ctx.hi, (sol) => { found = Array.from(sol); return true; });
    return found;
  }

  function countSolutions(puzzle, limit = 2) {
    const ctx = setup(puzzle);
    let count = 0;
    search(ctx, ctx.lo, ctx.hi, () => { count++; return count >= limit; });
    return count;
  }

  // How far plain deduction (no guessing) gets: { solved, rounds }.
  function analyze(puzzle) {
    const ctx = setup(puzzle);
    const stats = { rounds: 0 };
    const ok = propagate(ctx, ctx.lo, ctx.hi, stats);
    return { solved: ok && ctx.lo.every((v, i) => v === ctx.hi[i]), rounds: stats.rounds };
  }

  // Bridges island i could still take from each open edge, given the board.
  function room(p, state, totals, e) {
    const edge = p.edges[e];
    const left = (i) => p.islands[i].n - totals[i];
    return Math.max(0, Math.min(2 - state.counts[e], left(edge.a), left(edge.b)));
  }

  // A bridge forced by counting alone: an island needs R more and its other
  // edges can take only `others`, so this edge must take at least R - others.
  function forcedByCounting(p, state, sol) {
    const totals = Logic.islandTotals(p, state);
    const free = (e) => !Logic.crossersOf(p, e).some((x) => state.counts[x] > 0);
    for (let i = 0; i < p.islands.length; i++) {
      const need = p.islands[i].n - totals[i];
      if (need <= 0) continue;
      const mine = p.edges.map((_, e) => e).filter((e) => (p.edges[e].a === i || p.edges[e].b === i) && free(e));
      const rooms = mine.map((e) => room(p, state, totals, e));
      const total = rooms.reduce((a, b) => a + b, 0);
      for (let k = 0; k < mine.length; k++) {
        const must = need - (total - rooms[k]);
        const e = mine[k];
        if (must <= 0 || state.counts[e] + must !== sol[e]) continue;
        const n = p.islands[i].n;
        const reason = must === rooms[k] && mine.filter((x, j) => rooms[j] > 0).length === 1
          ? `Island ${n} needs ${need} more and this is the only way it can go.`
          : must === rooms[k]
            ? `Island ${n} needs ${need} more and has room for just that many, so every bridge it can still take is needed.`
            : `Island ${n} needs ${need} more, and its other neighbours can take only ${total - rooms[k]} of them, so this bridge needs at least ${must} more.`;
        return { edge: e, value: sol[e], reason };
      }
    }
    return null;
  }

  // { edge, value, reason } for one bridge to set, or null when the board
  // already matches the answer (or the puzzle has none).
  function hint(puzzle, state) {
    const p = Logic.parsePuzzle(puzzle);
    const sol = solve(p);
    if (!sol) return null;
    const wrong = state.counts.findIndex((v, e) => v > sol[e]);
    if (wrong !== -1) {
      return { edge: wrong, value: sol[wrong], reason: 'This bridge is not part of the answer, so it has too many.' };
    }
    const missing = state.counts.findIndex((v, e) => v < sol[e]);
    if (missing === -1) return null;
    const forced = forcedByCounting(p, state, sol);
    if (forced) return forced;
    return { edge: missing, value: sol[missing], reason: 'This bridge is part of the answer.' };
  }

  const api = { solve, countSolutions, analyze, hint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HashiSolver = api;
})(this);
