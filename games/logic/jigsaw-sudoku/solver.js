// Jigsaw Sudoku solver, free of DOM. Loaded as a plain <script> (window.JigsawSolver)
// or via require() in Node. Grid is 81 cells, index r*9+c. `regions` is an array of
// 81 ints 0-8 (the shape each cell belongs to); `givens` is 81 digits (array or
// string), 0 for blank.
(function (root) {
  const FULL = 511; // bits 0-8 stand for digits 1-9
  const POP = new Uint8Array(512);
  for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);

  // Core search. Returns { sols, aborted }. `rng` (optional) randomises digit order.
  function search(regions, givens, limit, maxNodes, rng) {
    const g = typeof givens === 'string' ? givens.split('').map(Number) : givens;
    const rowU = new Int16Array(9), colU = new Int16Array(9), regU = new Int16Array(9);
    const grid = new Int8Array(81);
    const sols = [];
    let nodes = 0;
    let aborted = false;

    for (let i = 0; i < 81; i++) {
      const d = g[i];
      if (!d) continue;
      const b = 1 << (d - 1);
      if ((rowU[(i / 9) | 0] | colU[i % 9] | regU[regions[i]]) & b) return { sols, aborted };
      grid[i] = d; rowU[(i / 9) | 0] |= b; colU[i % 9] |= b; regU[regions[i]] |= b;
    }

    function rec() {
      if (++nodes > maxNodes) { aborted = true; return; }
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (grid[i]) continue;
        const mask = FULL & ~(rowU[(i / 9) | 0] | colU[i % 9] | regU[regions[i]]);
        const n = POP[mask];
        if (n === 0) return;
        if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n === 1) break; }
      }
      if (best < 0) { sols.push(Array.from(grid)); return; }
      const digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
      if (rng) {
        for (let k = digits.length - 1; k > 0; k--) {
          const j = Math.floor(rng() * (k + 1));
          [digits[k], digits[j]] = [digits[j], digits[k]];
        }
      }
      const r = (best / 9) | 0, c = best % 9, g2 = regions[best];
      for (const d of digits) {
        const b = 1 << (d - 1);
        grid[best] = d; rowU[r] |= b; colU[c] |= b; regU[g2] |= b;
        rec();
        grid[best] = 0; rowU[r] &= ~b; colU[c] &= ~b; regU[g2] &= ~b;
        if (aborted || sols.length >= limit) return;
      }
    }
    rec();
    return { sols, aborted };
  }

  // Number of solutions, stopping at `limit`. If the node budget runs out the
  // answer is unknown, so the limit is returned (treated as "not unique").
  function countSolutions(regions, givens, limit = 2, maxNodes = Infinity) {
    const r = search(regions, givens, limit, maxNodes, null);
    return r.aborted ? limit : r.sols.length;
  }

  // One solution (81-digit array) or null (none, or the node budget ran out).
  // Pass an rng for a random one.
  function solve(regions, givens, maxNodes = Infinity, rng = null) {
    const r = search(regions, givens, 1, maxNodes, rng);
    return r.sols.length ? r.sols[0] : null;
  }

  const api = { countSolutions, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JigsawSolver = api;
})(this);
