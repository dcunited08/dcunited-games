// Calcudoku solver: backtracking with row/column bit masks and cage pruning.
// Node-only (used by the generator and tests). A puzzle is { size, cages: [{ op, target, cells }] }.
const { cageHolds } = require('./logic.js');

// Can a cage that already has `vals` placed (and `left` cells still empty) still reach its target?
function cageFeasible(cg, vals, left, n) {
  const target = cg.target;
  if (left === 0) return cageHolds(cg.op, target, vals);
  if (cg.op === '+') {
    const sum = vals.reduce((a, b) => a + b, 0);
    return sum + left <= target && sum + left * n >= target;
  }
  if (cg.op === '*') {
    const prod = vals.reduce((a, b) => a * b, 1);
    if (target % prod !== 0) return false;
    return prod * Math.pow(n, left) >= target;
  }
  if (cg.op === '-') return vals.length === 0 || vals[0] - target >= 1 || vals[0] + target <= n;
  if (cg.op === '/') return vals.length === 0 || vals[0] * target <= n || vals[0] % target === 0;
  return true;
}

// Counts solutions, stopping once `limit` are found. Calls onSolution(grid) for each.
function search(puzzle, limit, onSolution) {
  const n = puzzle.size;
  const total = n * n;
  const cageIdx = new Array(total).fill(-1);
  puzzle.cages.forEach((cg, k) => cg.cells.forEach((i) => { cageIdx[i] = k; }));
  const grid = new Array(total).fill(0);
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
  const placed = puzzle.cages.map(() => []);
  let found = 0;

  function go(pos) {
    if (found >= limit) return;
    if (pos === total) {
      found++;
      if (onSolution) onSolution(grid.slice());
      return;
    }
    const r = Math.floor(pos / n), c = pos % n;
    const k = cageIdx[pos];
    const cg = puzzle.cages[k];
    const vals = placed[k];
    const left = cg.cells.length - vals.length - 1;
    const used = rows[r] | cols[c];
    for (let d = 1; d <= n && found < limit; d++) {
      const bit = 1 << (d - 1);
      if (used & bit) continue;
      vals.push(d);
      if (cageFeasible(cg, vals, left, n)) {
        grid[pos] = d;
        rows[r] |= bit;
        cols[c] |= bit;
        go(pos + 1);
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        grid[pos] = 0;
      }
      vals.pop();
    }
  }
  go(0);
  return found;
}

function countSolutions(puzzle, limit = 2) {
  return search(puzzle, limit, null);
}

// First solution as an array of numbers, or null.
function solve(puzzle) {
  let first = null;
  search(puzzle, 1, (g) => { first = g; });
  return first;
}

module.exports = { countSolutions, solve };
