// Killer Sudoku solver, free of DOM. Loaded as a plain <script> (window.KillerSolver)
// or via require() in Node. Grid is 81 cells, index r*9+c.
// Puzzle: { cages: [{ sum, cells: [idx,...] }], givens: { idx: digit } }.
(function (root) {
  const FULL = 511; // bits 0-8 stand for digits 1-9

  const POP = new Uint8Array(512);
  for (let m = 1; m < 512; m++) POP[m] = POP[m >> 1] + (m & 1);

  // MIN_SUM[mask*10+k] / MAX_SUM: smallest / largest total of k distinct digits
  // taken from mask; -1 when mask has fewer than k digits.
  const MIN_SUM = new Int16Array(5120).fill(-1);
  const MAX_SUM = new Int16Array(5120).fill(-1);
  for (let m = 0; m < 512; m++) {
    const digits = [];
    for (let d = 0; d < 9; d++) if (m & (1 << d)) digits.push(d + 1);
    let lo = 0, hi = 0;
    MIN_SUM[m * 10] = 0;
    MAX_SUM[m * 10] = 0;
    for (let k = 1; k <= digits.length; k++) {
      lo += digits[k - 1];
      hi += digits[digits.length - k];
      MIN_SUM[m * 10 + k] = lo;
      MAX_SUM[m * 10 + k] = hi;
    }
  }

  const ROW = (i) => (i / 9) | 0;
  const COL = (i) => i % 9;
  const BOX = (i) => ((ROW(i) / 3) | 0) * 3 + ((COL(i) / 3) | 0);

  // Core search. Returns { sols, aborted }.
  function search(puzzle, limit, maxNodes) {
    const cageOf = new Int8Array(81).fill(-1);
    const cages = puzzle.cages;
    const nCages = cages.length;
    for (let g = 0; g < nCages; g++) for (const c of cages[g].cells) cageOf[c] = g;
    const cUsed = new Int16Array(nCages);
    const cRem = new Int16Array(nCages);
    const cLeft = new Int16Array(nCages);
    for (let g = 0; g < nCages; g++) { cRem[g] = cages[g].sum; cLeft[g] = cages[g].cells.length; }
    const rowU = new Int16Array(9), colU = new Int16Array(9), boxU = new Int16Array(9);
    const grid = new Int8Array(81);
    const sols = [];
    let nodes = 0;
    let aborted = false;

    // Can digit bit `b` go into cell i? (cage feasibility included)
    function ok(i, b, d) {
      const g = cageOf[i];
      if (g < 0) return true;
      const rem = cRem[g] - d;
      const left = cLeft[g] - 1;
      if (rem < 0) return false;
      if (left === 0) return rem === 0;
      const avail = FULL & ~(cUsed[g] | b);
      const lo = MIN_SUM[avail * 10 + left];
      return lo >= 0 && rem >= lo && rem <= MAX_SUM[avail * 10 + left];
    }

    function place(i, d) {
      const b = 1 << (d - 1), g = cageOf[i];
      grid[i] = d; rowU[ROW(i)] |= b; colU[COL(i)] |= b; boxU[BOX(i)] |= b;
      if (g >= 0) { cUsed[g] |= b; cRem[g] -= d; cLeft[g]--; }
    }
    function unplace(i, d) {
      const b = 1 << (d - 1), g = cageOf[i];
      grid[i] = 0; rowU[ROW(i)] &= ~b; colU[COL(i)] &= ~b; boxU[BOX(i)] &= ~b;
      if (g >= 0) { cUsed[g] &= ~b; cRem[g] += d; cLeft[g]++; }
    }

    // Cells with no cage get no sum check; cells in a cage need cage cells all listed once.
    for (const [k, v] of Object.entries(puzzle.givens || {})) {
      const i = Number(k), d = v, b = 1 << (d - 1);
      const g = cageOf[i];
      const used = rowU[ROW(i)] | colU[COL(i)] | boxU[BOX(i)] | (g >= 0 ? cUsed[g] : 0);
      if (grid[i] || (used & b) || !ok(i, b, d)) return { sols, aborted };
      place(i, d);
    }

    function rec() {
      if (aborted) return;
      if (++nodes > maxNodes) { aborted = true; return; }
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (grid[i]) continue;
        const g = cageOf[i];
        let mask = FULL & ~(rowU[ROW(i)] | colU[COL(i)] | boxU[BOX(i)] | (g >= 0 ? cUsed[g] : 0));
        let m = mask;
        while (m) {
          const b = m & -m;
          m ^= b;
          if (!ok(i, b, 31 - Math.clz32(b) + 1)) mask ^= b;
        }
        const n = POP[mask];
        if (n === 0) return;
        if (n < bestN) { bestN = n; best = i; bestMask = mask; if (n === 1) break; }
      }
      if (best < 0) { sols.push(Array.from(grid)); return; }
      let m = bestMask;
      while (m) {
        const b = m & -m;
        m ^= b;
        const d = 31 - Math.clz32(b) + 1;
        place(best, d);
        rec();
        unplace(best, d);
        if (aborted || sols.length >= limit) return;
      }
    }
    rec();
    return { sols, aborted };
  }

  // Up to `limit` distinct solutions (81-digit arrays). Aborted searches give [].
  function solutions(puzzle, limit = 2, maxNodes = Infinity) {
    const r = search(puzzle, limit, maxNodes);
    return r.aborted ? [] : r.sols;
  }

  // Number of solutions, stopping at `limit`. If the node budget runs out the
  // answer is unknown, so the limit is returned (treated as "not unique").
  function countSolutions(puzzle, limit = 2, maxNodes = Infinity) {
    const r = search(puzzle, limit, maxNodes);
    return r.aborted ? limit : r.sols.length;
  }

  function solve(puzzle) {
    const r = search(puzzle, 1, Infinity);
    return r.sols.length ? r.sols[0] : null;
  }

  const api = { countSolutions, solve, solutions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KillerSolver = api;
})(this);
