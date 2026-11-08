// Futoshiki solvers: an exhaustive counter (used to prove a puzzle has one
// answer) and a "simple logic" solver (singles + sign bounds) used to grade
// difficulty. Works on puzzles from FutoshikiLogic.normalisePuzzle.
(function (root) {
  const bitOf = (d) => 1 << (d - 1);
  const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const lowest = (m) => 31 - Math.clz32(m & -m) + 1;       // smallest digit in mask
  const highest = (m) => 32 - Math.clz32(m);               // largest digit in mask

  function neighboursOf(puzzle) {
    const lo = [], hi = [];   // lo[i]: cells that must be smaller than i; hi[i]: bigger
    for (let i = 0; i < puzzle.size * puzzle.size; i++) { lo.push([]); hi.push([]); }
    for (const [a, b] of puzzle.lt) { hi[a].push(b); lo[b].push(a); }
    return { lo, hi };
  }

  // Backtracking search, always extending the most constrained empty square.
  function search(puzzle, limit, onSolution) {
    const n = puzzle.size, total = n * n, full = (1 << n) - 1;
    const { lo, hi } = neighboursOf(puzzle);
    // Longest chain of < signs below / above a square limits its range, e.g. a < b < c means a >= 1, c >= 3.
    const minV = new Array(total).fill(1), maxV = new Array(total).fill(n);
    for (let pass = 0; pass <= n; pass++) {
      for (const [a, b] of puzzle.lt) {
        minV[b] = Math.max(minV[b], minV[a] + 1);
        maxV[a] = Math.min(maxV[a], maxV[b] - 1);
      }
    }
    const rangeMask = minV.map((lo_, i) => (maxV[i] < lo_ ? 0 : ((1 << maxV[i]) - 1) & ~((1 << (lo_ - 1)) - 1)));
    const grid = puzzle.givens.slice();
    const rowUsed = new Array(n).fill(0), colUsed = new Array(n).fill(0);
    for (let i = 0; i < total; i++) {
      const d = grid[i];
      if (!d) continue;
      const r = Math.floor(i / n), c = i % n;
      if ((rowUsed[r] | colUsed[c]) & bitOf(d)) return 0;
      rowUsed[r] |= bitOf(d); colUsed[c] |= bitOf(d);
    }

    function candidates(i) {
      const r = Math.floor(i / n), c = i % n;
      let m = rangeMask[i] & full & ~(rowUsed[r] | colUsed[c]);
      for (const j of lo[i]) if (grid[j]) m &= ~((1 << grid[j]) - 1);
      for (const j of hi[i]) if (grid[j]) m &= (1 << (grid[j] - 1)) - 1;
      return m;
    }

    let found = 0;
    function dfs() {
      let best = -1, bestMask = 0, bestCount = 99;
      for (let i = 0; i < total; i++) {
        if (grid[i]) continue;
        const m = candidates(i), k = popcount(m);
        if (k < bestCount) { best = i; bestMask = m; bestCount = k; if (k <= 1) break; }
      }
      if (best < 0) {
        found++;
        if (onSolution) onSolution(grid);
        return found >= limit;
      }
      if (bestCount === 0) return false;
      const r = Math.floor(best / n), c = best % n;
      for (let d = 1; d <= n; d++) {
        if (!(bestMask & bitOf(d))) continue;
        grid[best] = d; rowUsed[r] |= bitOf(d); colUsed[c] |= bitOf(d);
        const stop = dfs();
        grid[best] = 0; rowUsed[r] &= ~bitOf(d); colUsed[c] &= ~bitOf(d);
        if (stop) return true;
      }
      return false;
    }
    dfs();
    return found;
  }

  function countSolutions(puzzle, limit = 2) { return search(puzzle, limit, null); }

  function solve(puzzle) {
    let result = null;
    search(puzzle, 1, (g) => { result = g.slice(); });
    return result;
  }

  // Row/column singles plus sign-bound propagation. Returns { solved, grid }
  // (grid is null when the clues contradict each other).
  function simpleSolve(puzzle) {
    const n = puzzle.size, total = n * n, full = (1 << n) - 1;
    const cand = puzzle.givens.map((d) => (d ? bitOf(d) : full));
    const units = [];
    for (let a = 0; a < n; a++) {
      units.push(Array.from({ length: n }, (_, k) => a * n + k));
      units.push(Array.from({ length: n }, (_, k) => k * n + a));
    }
    const peers = (i) => units.filter((u) => u.includes(i));

    let changed = true;
    const narrow = (i, mask) => {
      const next = cand[i] & mask;
      if (next !== cand[i]) { cand[i] = next; changed = true; }
      return next !== 0;
    };
    while (changed) {
      changed = false;
      for (let i = 0; i < total; i++) {
        if (popcount(cand[i]) !== 1) continue;
        for (const u of peers(i)) for (const j of u) if (j !== i && !narrow(j, ~cand[i])) return { solved: false, grid: null };
      }
      for (const u of units) {
        for (let d = 1; d <= n; d++) {
          const spots = u.filter((j) => cand[j] & bitOf(d));
          if (spots.length === 0) return { solved: false, grid: null };
          if (spots.length === 1 && !narrow(spots[0], bitOf(d))) return { solved: false, grid: null };
        }
      }
      for (const [a, b] of puzzle.lt) {
        if (!narrow(a, (1 << (highest(cand[b]) - 1)) - 1)) return { solved: false, grid: null };
        if (!narrow(b, ~((1 << lowest(cand[a])) - 1) & full)) return { solved: false, grid: null };
      }
    }
    if (cand.every((m) => popcount(m) === 1)) return { solved: true, grid: cand.map(lowest) };
    return { solved: false, grid: cand.map((m) => (popcount(m) === 1 ? lowest(m) : 0)) };
  }

  const api = { countSolutions, solve, simpleSolve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FutoshikiSolver = api;
})(typeof self !== 'undefined' ? self : this);
