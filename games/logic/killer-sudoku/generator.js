// Killer Sudoku puzzle generator, free of DOM. Loaded as a plain <script>
// (window.KillerGenerator) or via require() in Node. Everything is driven by a
// seeded PRNG so output is repeatable. Grid is 81 cells, index r*9+c.
(function (root) {
  const Solver = typeof module !== 'undefined' && module.exports ? require('./solver.js') : root.KillerSolver;

  // Cage-size weights (index = size) and limits per difficulty.
  const LEVELS = {
    easy: { weights: [0, 0, 45, 40, 15], max: 4, minSize: 1, givens: [6, 10], maxGivens: 14 },
    medium: { weights: [0, 0, 35, 35, 22, 8], max: 5, minSize: 2, givens: [0, 0], maxGivens: 3 },
    hard: { weights: [0, 0, 20, 30, 27, 17, 6], max: 6, minSize: 2, givens: [0, 0], maxGivens: 6 },
  };
  const NODE_BUDGET = 150000;

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

  // Full random sudoku by randomised backtracking.
  function randomSolution(rng) {
    const grid = new Array(81).fill(0);
    function ok(i, d) {
      const r = Math.floor(i / 9), c = i % 9;
      for (let k = 0; k < 9; k++) {
        if (grid[r * 9 + k] === d || grid[k * 9 + c] === d) return false;
      }
      const br = r - (r % 3), bc = c - (c % 3);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (grid[(br + a) * 9 + bc + b] === d) return false;
      return true;
    }
    function fill(i) {
      if (i === 81) return true;
      for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
        if (ok(i, d)) {
          grid[i] = d;
          if (fill(i + 1)) return true;
          grid[i] = 0;
        }
      }
      return false;
    }
    fill(0);
    return grid;
  }

  function pickSize(level, rng) {
    const total = level.weights.reduce((a, b) => a + b, 0);
    let x = rng() * total;
    for (let s = 0; s < level.weights.length; s++) {
      x -= level.weights[s];
      if (x < 0) return s;
    }
    return level.max;
  }

  const makeCage = (cells, solution) => ({ sum: cells.reduce((s, i) => s + solution[i], 0), cells });

  // One attempt at carving; returns cages or null when stranded cells can't be absorbed.
  function carve(solution, rng, level) {
    const owner = new Array(81).fill(-1);
    const groups = [];
    for (const start of shuffle([...Array(81).keys()], rng)) {
      if (owner[start] >= 0) continue;
      const cells = [start];
      owner[start] = groups.length;
      const target = pickSize(level, rng);
      while (cells.length < target) {
        const opts = [];
        for (const c of cells) {
          for (const n of neighbours(c)) {
            if (owner[n] < 0 && !cells.some((x) => solution[x] === solution[n]) && !opts.includes(n)) opts.push(n);
          }
        }
        if (!opts.length) break;
        const pick = opts[randInt(rng, opts.length)];
        owner[pick] = groups.length;
        cells.push(pick);
      }
      groups.push(cells);
    }
    // Merge cages that are too small into a neighbour.
    for (let g = 0; g < groups.length; g++) {
      while (groups[g] && groups[g].length < level.minSize) {
        let merged = false;
        for (const c of shuffle(groups[g], rng)) {
          for (const n of shuffle(neighbours(c), rng)) {
            const h = owner[n];
            if (h === g) continue;
            const target = groups[h];
            if (target.length + groups[g].length > level.max) continue;
            if (groups[g].some((x) => target.some((y) => solution[x] === solution[y]))) continue;
            target.push(...groups[g]);
            groups[g].forEach((x) => { owner[x] = h; });
            groups[g] = null;
            merged = true;
            break;
          }
          if (merged) break;
        }
        if (!merged) return null;
      }
    }
    return groups.filter(Boolean).map((cells) => makeCage(cells.sort((a, b) => a - b), solution));
  }

  function makeCages(solution, rng, difficulty) {
    const level = LEVELS[difficulty];
    for (let tries = 0; tries < 500; tries++) {
      const cages = carve(solution, rng, level);
      if (cages) return cages;
    }
    throw new Error('could not carve cages');
  }

  function isConnected(cells) {
    const set = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]];
    while (stack.length) {
      for (const n of neighbours(stack.pop())) {
        if (set.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
      }
    }
    return seen.size === set.size;
  }

  // Splits a cage into two connected parts each of at least minSize cells, or null.
  function splitCage(cage, solution, rng, minSize) {
    const n = cage.cells.length;
    if (n < minSize * 2) return null;
    for (let tries = 0; tries < 40; tries++) {
      const want = minSize + randInt(rng, n - 2 * minSize + 1);
      const part = [cage.cells[randInt(rng, n)]];
      while (part.length < want) {
        const opts = [];
        for (const c of part) {
          for (const nb of neighbours(c)) if (cage.cells.includes(nb) && !part.includes(nb) && !opts.includes(nb)) opts.push(nb);
        }
        part.push(opts[randInt(rng, opts.length)]);
      }
      const rest = cage.cells.filter((c) => !part.includes(c));
      if (isConnected(rest)) {
        return [makeCage(part.sort((a, b) => a - b), solution), makeCage(rest, solution)];
      }
    }
    return null;
  }

  // Splits cages where solutions disagree, or adds givens, until the puzzle has
  // exactly one solution. Returns the puzzle or null if more than maxGivens are needed.
  function fixUniqueness(puzzle, solution, rng, difficulty, maxGivens) {
    const level = LEVELS[difficulty];
    let cages = puzzle.cages.slice();
    const givens = Object.assign({}, puzzle.givens);
    for (let step = 0; step < 300; step++) {
      const cur = { cages, givens };
      const sols = Solver.solutions(cur, 2, NODE_BUDGET);
      if (sols.length === 1) return cur;
      // sols is [] when the budget ran out; then treat the largest cages as ambiguous.
      let differ = [];
      if (sols.length === 2) {
        for (let i = 0; i < 81; i++) if (sols[0][i] !== sols[1][i]) differ.push(i);
      }
      const cageIdx = cages
        .map((cg, k) => k)
        .filter((k) => differ.length === 0 || cages[k].cells.some((c) => differ.includes(c)))
        .sort((a, b) => cages[b].cells.length - cages[a].cells.length);
      let split = null, at = -1;
      for (const k of cageIdx) {
        split = splitCage(cages[k], solution, rng, level.minSize);
        if (split) { at = k; break; }
      }
      if (split) {
        cages = cages.slice(0, at).concat(split, cages.slice(at + 1));
        continue;
      }
      if (Object.keys(givens).length >= maxGivens) return null;
      const pool = differ.length ? differ.filter((c) => !(c in givens)) : [];
      const cell = pool.length ? pool[randInt(rng, pool.length)] : randInt(rng, 81);
      givens[cell] = solution[cell];
    }
    return null;
  }

  function addGivens(givens, solution, rng, count) {
    const out = Object.assign({}, givens);
    for (const cell of shuffle([...Array(81).keys()], rng)) {
      if (Object.keys(out).length >= count) break;
      out[cell] = solution[cell];
    }
    return out;
  }

  function generatePuzzle(seed, difficulty) {
    const level = LEVELS[difficulty];
    if (!level) throw new Error('unknown difficulty: ' + difficulty);
    const rng = mulberry32(seed);
    const solution = randomSolution(rng);
    // Prefer no extra givens beyond the level's starting ones; relax on late attempts.
    for (let attempt = 0; attempt < 40; attempt++) {
      const cages = makeCages(solution, rng, difficulty);
      const startGivens = level.givens[1] > 0
        ? addGivens({}, solution, rng, level.givens[0] + randInt(rng, level.givens[1] - level.givens[0] + 1))
        : {};
      const allowed = attempt < 25 ? Object.keys(startGivens).length + (difficulty === 'hard' ? 0 : 1) : level.maxGivens;
      const fixed = fixUniqueness({ cages, givens: startGivens }, solution, rng, difficulty, allowed);
      if (fixed) {
        return { id: difficulty + '-' + seed, difficulty, cages: fixed.cages, givens: fixed.givens, solution };
      }
    }
    // Last resort: singleton-free cages plus as many givens as needed.
    const cages = makeCages(solution, rng, difficulty);
    const fixed = fixUniqueness({ cages, givens: {} }, solution, rng, difficulty, 81);
    return { id: difficulty + '-' + seed, difficulty, cages: fixed.cages, givens: fixed.givens, solution };
  }

  const api = { mulberry32, randomSolution, makeCages, splitCage, fixUniqueness, generatePuzzle, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KillerGenerator = api;
})(this);
