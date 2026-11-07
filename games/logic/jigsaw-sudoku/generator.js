// Jigsaw Sudoku puzzle generator, free of DOM. Loaded as a plain <script>
// (window.JigsawGenerator) or via require() in Node. Everything is driven by a
// seeded PRNG so output is repeatable. Grid is 81 cells, index r*9+c.
(function (root) {
  const Solver = typeof module !== 'undefined' && module.exports ? require('./solver.js') : root.JigsawSolver;

  // Target number of givens per difficulty.
  const TARGETS = { easy: 36, medium: 30, hard: 26 };
  const LAYOUT_NODES = 20000;
  const UNIQUE_NODES = 200000;
  const SWAPS = 150;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const randInt = (rng, n) => Math.floor(rng() * n);
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(rng, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function neighbours(i) {
    const r = Math.floor(i / 9), c = i % 9, out = [];
    if (r > 0) out.push(i - 9);
    if (r < 8) out.push(i + 9);
    if (c > 0) out.push(i - 1);
    if (c < 8) out.push(i + 1);
    return out;
  }

  // Are all cells of region k (in `regions`) one connected piece?
  function regionConnected(regions, k) {
    let start = -1, total = 0;
    for (let i = 0; i < 81; i++) if (regions[i] === k) { total++; if (start < 0) start = i; }
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      for (const j of neighbours(i)) if (regions[j] === k && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
    return seen.size === total;
  }

  // Nine wiggly shapes of nine cells: start from the 3x3 boxes and keep swapping
  // a pair of touching cells between two neighbouring shapes while both stay in one piece.
  function makeRegions(rng) {
    const regions = Array.from({ length: 81 }, (_, i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3));
    let done = 0;
    for (let tries = 0; done < SWAPS && tries < SWAPS * 20; tries++) {
      const a = randInt(rng, 81);
      const nb = neighbours(a).filter((j) => regions[j] !== regions[a]);
      if (!nb.length) continue;
      const A = regions[a], B = regions[nb[randInt(rng, nb.length)]];
      // b: a cell of B that touches A, so each shape gives and takes a border cell.
      const cand = [];
      for (let j = 0; j < 81; j++) if (regions[j] === B && neighbours(j).some((x) => regions[x] === A)) cand.push(j);
      const b = cand[randInt(rng, cand.length)];
      regions[a] = B; regions[b] = A;
      if (regionConnected(regions, A) && regionConnected(regions, B)) done++;
      else { regions[a] = A; regions[b] = B; }
    }
    return regions;
  }

  // A random shape layout plus a full solution for it, or null when none was
  // found inside the node budget (some layouts have no solution at all).
  function makeLayout(rng, maxNodes = LAYOUT_NODES) {
    const regions = makeRegions(rng);
    const solution = Solver.solve(regions, new Array(81).fill(0), maxNodes, rng);
    return solution ? { regions, solution } : null;
  }

  // Removes givens in random order while the answer stays unique, down to `target`.
  function dig(regions, solution, target, rng) {
    const givens = solution.slice();
    let count = 81;
    for (const i of shuffle([...Array(81).keys()], rng)) {
      if (count <= target) break;
      const keep = givens[i];
      givens[i] = 0;
      if (Solver.countSolutions(regions, givens, 2, UNIQUE_NODES) === 1) count--;
      else givens[i] = keep;
    }
    return givens;
  }

  function generatePuzzle(seed, level) {
    if (!(level in TARGETS)) throw new Error('unknown level ' + level);
    const rng = mulberry32(seed);
    let layout = null;
    while (!layout) layout = makeLayout(rng);
    const givens = dig(layout.regions, layout.solution, TARGETS[level], rng);
    return { difficulty: level, regions: layout.regions, givens, solution: layout.solution };
  }

  const api = { mulberry32, neighbours, makeRegions, makeLayout, generatePuzzle, TARGETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.JigsawGenerator = api;
})(this);
