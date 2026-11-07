// Binairo solver, hints and difficulty. No DOM. Loaded as a plain <script> in
// the browser (window.BinairoSolver) and via require() in Node tests.
//
// Internally a grid is a flat row-major array of -1 (empty), 0 (sun) or 1 (moon).
// solve() returns an array of rows of 0/1.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.BinairoLogic;

  const NAMES = ['sun', 'moon'];
  const PLURAL = ['suns', 'moons'];

  const gridOf = (puzzle) => [...Logic.parsePuzzle(puzzle).rows.join('')].map((ch) => (ch === '.' ? -1 : Number(ch)));

  function lineIndexes(n) {
    const out = [];
    for (let r = 0; r < n; r++) out.push({ kind: 'row', idx: Array.from({ length: n }, (_, c) => r * n + c) });
    for (let c = 0; c < n; c++) out.push({ kind: 'column', idx: Array.from({ length: n }, (_, r) => r * n + c) });
    return out;
  }
  const lineCache = {};
  const linesFor = (n) => lineCache[n] || (lineCache[n] = lineIndexes(n));

  // The simple rules, tried in this order. Each returns the first deduction it
  // finds in the grid, or null. A deduction is { r, c, value, rule, reason }.
  function make(n, i, value, rule, reason) {
    return { r: Math.floor(i / n), c: i % n, value, rule, reason };
  }

  function pairRule(n, g) {
    for (const { idx } of linesFor(n)) {
      for (let k = 0; k + 1 < n; k++) {
        const v = g[idx[k]];
        if (v === -1 || g[idx[k + 1]] !== v) continue;
        for (const t of [k - 1, k + 2]) {
          if (t >= 0 && t < n && g[idx[t]] === -1) {
            return make(n, idx[t], 1 - v, 'pair',
              `Two ${PLURAL[v]} side by side, so the next one is a ${NAMES[1 - v]}`);
          }
        }
      }
    }
    return null;
  }

  function gapRule(n, g) {
    for (const { idx } of linesFor(n)) {
      for (let k = 1; k + 1 < n; k++) {
        const v = g[idx[k - 1]];
        if (g[idx[k]] === -1 && v !== -1 && g[idx[k + 1]] === v) {
          return make(n, idx[k], 1 - v, 'gap',
            `A square between two ${PLURAL[v]} must be a ${NAMES[1 - v]}`);
        }
      }
    }
    return null;
  }

  function countRule(n, g) {
    for (const { kind, idx } of linesFor(n)) {
      const vals = idx.map((i) => g[i]);
      const empty = vals.indexOf(-1);
      if (empty === -1) continue;
      for (const v of [0, 1]) {
        if (vals.filter((x) => x === v).length === n / 2) {
          return make(n, idx[empty], 1 - v, 'count',
            `This ${kind} already has all its ${PLURAL[v]}, so the rest are ${PLURAL[1 - v]}`);
        }
      }
    }
    return null;
  }

  const RULES = [pairRule, gapRule, countRule];
  function nextDeduction(n, g) {
    for (const rule of RULES) {
      const d = rule(n, g);
      if (d) return d;
    }
    return null;
  }

  // Applies the simple rules until nothing changes. Returns { solved, steps, grid }.
  function simpleSolve(puzzle) {
    const g = gridOf(puzzle);
    const n = Math.sqrt(g.length);
    let steps = 0;
    for (let d = nextDeduction(n, g); d; d = nextDeduction(n, g)) {
      g[d.r * n + d.c] = d.value;
      steps++;
    }
    return { solved: !g.includes(-1), steps, grid: g };
  }
  const difficultyScore = (puzzle) => {
    const { solved, steps } = simpleSolve(puzzle);
    return { solved, steps };
  };

  // True when a (partial) grid already breaks a rule.
  function broken(n, g) {
    const seen = { row: new Set(), column: new Set() };
    for (const { kind, idx } of linesFor(n)) {
      const vals = idx.map((i) => g[i]);
      for (let k = 0; k + 2 < n; k++) {
        if (vals[k] !== -1 && vals[k] === vals[k + 1] && vals[k] === vals[k + 2]) return true;
      }
      const ones = vals.filter((v) => v === 1).length;
      const zeros = vals.filter((v) => v === 0).length;
      if (ones > n / 2 || zeros > n / 2) return true;
      if (ones + zeros === n) {
        const key = vals.join('');
        if (seen[kind].has(key)) return true;
        seen[kind].add(key);
      }
    }
    return false;
  }

  // Backtracking search with the simple rules as propagation between guesses.
  // Calls found(grid) for each solution; stops when found returns true.
  function search(n, start, found) {
    function go(grid) {
      const g = grid.slice();
      for (let d = nextDeduction(n, g); d; d = nextDeduction(n, g)) {
        g[d.r * n + d.c] = d.value;
        if (broken(n, g)) return false;
      }
      if (broken(n, g)) return false;
      const i = g.indexOf(-1);
      if (i === -1) return found(g);
      for (const v of [0, 1]) {
        const next = g.slice();
        next[i] = v;
        if (go(next)) return true;
      }
      return false;
    }
    return go(start);
  }

  function countSolutions(puzzle, limit = 2) {
    const g = gridOf(puzzle);
    let count = 0;
    search(Math.sqrt(g.length), g, () => { count++; return count >= limit; });
    return count;
  }

  function solve(puzzle) {
    const g = gridOf(puzzle);
    const n = Math.sqrt(g.length);
    let sol = null;
    search(n, g, (full) => { sol = full; return true; });
    return sol && Array.from({ length: n }, (_, r) => sol.slice(r * n, r * n + n));
  }

  // One helpful move for the current board, or null if there is nothing to do:
  // { r, c, value: 'sun' | 'moon' | 'empty', reason }.
  function hint(puzzle, state) {
    const sol = solve(puzzle);
    if (!sol) return null;
    const n = state.size;
    const want = (i) => sol[Math.floor(i / n)][i % n];
    for (let i = 0; i < state.cells.length; i++) {
      const v = state.cells[i];
      if (v !== 'empty' && v !== NAMES[want(i)]) {
        return { r: Math.floor(i / n), c: i % n, value: 'empty', reason: 'This square is wrong' };
      }
    }
    const g = state.cells.map((v) => (v === 'empty' ? -1 : NAMES.indexOf(v)));
    const d = nextDeduction(n, g);
    if (d) return { r: d.r, c: d.c, value: NAMES[d.value], reason: d.reason };
    const i = g.indexOf(-1);
    if (i === -1) return null;
    const name = NAMES[want(i)];
    return { r: Math.floor(i / n), c: i % n, value: name, reason: `Only a ${name} fits here` };
  }

  const api = { gridOf, nextDeduction, simpleSolve, difficultyScore, countSolutions, solve, hint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BinairoSolver = api;
})(this);
