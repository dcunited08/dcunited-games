// Calcudoku generator (Node only): seeded random Latin square, carved into cages,
// signs chosen from the answer, kept only when the solver finds exactly one solution.
const { countSolutions } = require('./solver.js');

// sizes: cage sizes to draw from (repeat a size to make it more likely).
const LEVELS = {
  easy: { size: 4, ops: ['+', '-'], sizes: [1, 2, 2, 2, 3, 3], maxSize: 3, maxSingles: 3 },
  medium: { size: 5, ops: ['+', '-', '*', '/'], sizes: [1, 2, 2, 2, 3, 3, 3], maxSize: 3, maxSingles: 3 },
  hard: { size: 6, ops: ['+', '-', '*', '/'], sizes: [2, 2, 3, 3, 3, 4, 4], maxSize: 4, maxSingles: 2 },
};

// Small seeded generator (mulberry32): same seed, same numbers.
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Random Latin square by backtracking: n*n numbers 1..n, row by row.
function randomLatin(rng, n) {
  const g = new Array(n * n).fill(0);
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
  function go(pos) {
    if (pos === n * n) return true;
    const r = Math.floor(pos / n), c = pos % n;
    for (const d of shuffle(rng, Array.from({ length: n }, (_, k) => k + 1))) {
      const bit = 1 << (d - 1);
      if ((rows[r] | cols[c]) & bit) continue;
      g[pos] = d; rows[r] |= bit; cols[c] |= bit;
      if (go(pos + 1)) return true;
      g[pos] = 0; rows[r] &= ~bit; cols[c] &= ~bit;
    }
    return false;
  }
  go(0);
  return g;
}

function neighbours(n, i) {
  const r = Math.floor(i / n), c = i % n, out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

// Splits the grid into connected cages (arrays of cell indexes) that obey the level's limits.
function carveCages(rng, cfg) {
  const n = cfg.size;
  for (;;) {
    const owner = new Array(n * n).fill(-1);
    const cages = [];
    for (const start of shuffle(rng, Array.from({ length: n * n }, (_, i) => i))) {
      if (owner[start] >= 0) continue;
      const want = pick(rng, cfg.sizes);
      const cells = [start];
      owner[start] = cages.length;
      while (cells.length < want) {
        const open = [];
        for (const i of cells) for (const j of neighbours(n, i)) if (owner[j] < 0 && !open.includes(j)) open.push(j);
        if (!open.length) break;
        const next = pick(rng, open);
        owner[next] = cages.length;
        cells.push(next);
      }
      cages.push(cells);
    }
    // Fold extra single cells into a neighbouring cage that has room.
    for (const one of shuffle(rng, cages.filter((c) => c.length === 1))) {
      if (one.length !== 1) continue;
      if (cages.filter((c) => c.length === 1).length <= cfg.maxSingles) break;
      const options = neighbours(n, one[0]).map((j) => cages[owner[j]]).filter((c) => c.length < cfg.maxSize);
      if (!options.length) continue;
      const into = pick(rng, options);
      into.push(one[0]);
      owner[one[0]] = owner[into[0]];
      one.length = 0;
    }
    const result = cages.filter((c) => c.length > 0);
    if (result.filter((c) => c.length === 1).length <= cfg.maxSingles) {
      return result.map((c) => c.slice().sort((a, b) => a - b));
    }
  }
}

// Chooses a sign for each cage from the answer. Returns [{ op, target, cells }].
function assignOps(rng, cageCells, solution, cfg) {
  return cageCells.map((cells) => {
    const vals = cells.map((i) => solution[i]);
    if (cells.length === 1) return { op: '', target: vals[0], cells };
    let options = cfg.ops.filter((op) => op === '+' || op === '*' || cells.length === 2);
    options = options.filter((op) => op !== '/' || Math.max(...vals) % Math.min(...vals) === 0);
    if (cells.length > 2) options = options.filter((op) => op === '+' || op === '*');
    const op = pick(rng, options);
    let target;
    if (op === '+') target = vals.reduce((a, b) => a + b, 0);
    else if (op === '*') target = vals.reduce((a, b) => a * b, 1);
    else if (op === '-') target = Math.abs(vals[0] - vals[1]);
    else target = Math.max(...vals) / Math.min(...vals);
    return { op, target, cells };
  });
}

// A puzzle with exactly one solution: { difficulty, size, cages, solution: number[] }.
function generatePuzzle(seed, level) {
  const cfg = LEVELS[level];
  if (!cfg) throw new Error('Unknown level: ' + level);
  const rng = makeRng(seed);
  for (;;) {
    const solution = randomLatin(rng, cfg.size);
    for (let tries = 0; tries < 40; tries++) {
      const cages = assignOps(rng, carveCages(rng, cfg), solution, cfg);
      const puzzle = { difficulty: level, size: cfg.size, cages, solution };
      if (countSolutions(puzzle) === 1) return puzzle;
    }
  }
}

module.exports = { LEVELS, makeRng, shuffle, randomLatin, carveCages, assignOps, generatePuzzle };
