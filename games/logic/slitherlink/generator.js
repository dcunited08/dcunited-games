// Slitherlink puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.SlitherlinkGenerator).
//
// Method: grow a random blob of cells (connected, no holes, no diagonal-only
// touching) so its border is one loop; read every clue off that loop; then drop
// clues in random order while the answer stays unique (for easy and medium,
// while the solver's rules alone can still finish it).
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.SlitherlinkLogic;
  const Solver = isNode ? require('./solver.js') : root.SlitherlinkSolver;

  // mulberry32: small seeded PRNG, returns floats in [0, 1).
  function createRng(seed) {
    let a = seed >>> 0;
    return function rng() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const randomInt = (rng, n) => Math.floor(rng() * n);

  function shuffled(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomInt(rng, i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // `inside` is a flat row-major array of booleans. The grid is treated as
  // surrounded by outside cells.
  function isLoopRegion(rows, cols, inside) {
    const at = (r, c) => r >= 0 && c >= 0 && r < rows && c < cols && inside[r * cols + c];
    let count = 0;
    let first = -1;
    inside.forEach((v, i) => { if (v) { count++; if (first < 0) first = i; } });
    if (count === 0) return false;
    // No 2x2 window with two diagonal insides and two diagonal outsides (a dot with 4 lines).
    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const a = at(r, c);
        const b = at(r, c + 1);
        const d = at(r + 1, c);
        const e = at(r + 1, c + 1);
        if (a === e && b === d && a !== b) return false;
      }
    }
    const flood = (start, want, rMin, rMax, cMin, cMax) => {
      const seen = new Set([start]);
      const stack = [start];
      const w = cMax - cMin + 1;
      while (stack.length) {
        const k = stack.pop();
        const r = Math.floor(k / w) + rMin;
        const c = (k % w) + cMin;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < rMin || nr > rMax || nc < cMin || nc > cMax || at(nr, nc) !== want) continue;
          const nk = (nr - rMin) * w + (nc - cMin);
          if (!seen.has(nk)) { seen.add(nk); stack.push(nk); }
        }
      }
      return seen.size;
    };
    // Inside is one blob.
    if (flood(first, true, 0, rows - 1, 0, cols - 1) !== count) return false;
    // Outside (including a ring around the grid) is one blob, so there are no holes.
    const total = (rows + 2) * (cols + 2);
    return flood(0, false, -1, rows, -1, cols) === total - count;
  }

  // Grow a region cell by cell from a random start until it covers about
  // `fraction` of the grid, keeping it a valid loop region.
  function growRegion(rows, cols, rng, fraction) {
    const target = Math.max(2, Math.round(rows * cols * fraction));
    const inside = new Array(rows * cols).fill(false);
    inside[randomInt(rng, rows * cols)] = true;
    let size = 1;
    while (size < target) {
      const frontier = [];
      inside.forEach((v, i) => {
        if (v) return;
        const r = Math.floor(i / cols);
        const c = i % cols;
        const next = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
        if (next.some(([nr, nc]) => nr >= 0 && nc >= 0 && nr < rows && nc < cols && inside[nr * cols + nc])) frontier.push(i);
      });
      let added = false;
      for (const i of shuffled(frontier, rng)) {
        inside[i] = true;
        if (isLoopRegion(rows, cols, inside)) { added = true; break; }
        inside[i] = false;
      }
      if (!added) break;
      size++;
    }
    return inside;
  }

  // Edges are lines where the inside/outside status of the two sides differ.
  function answerLines(p, inside) {
    return p.edgeC.map((cells) => (cells.length === 1 ? inside[cells[0]] : inside[cells[0]] !== inside[cells[1]]));
  }

  // Number of answer lines around every cell.
  function cluesFor(p, inside) {
    const lines = answerLines(p, inside);
    return p.cellE.map((es) => es.filter((e) => lines[e]).length);
  }

  const toRows = (p, clues) => {
    const out = [];
    for (let r = 0; r < p.rows; r++) {
      out.push(clues.slice(r * p.cols, (r + 1) * p.cols).map((n) => (n < 0 ? '.' : String(n))).join(''));
    }
    return out;
  };

  // Hard puzzles are only kept if the solver proves them unique within this many steps.
  const SEARCH_BUDGET = 400;

  // Level settings: whether the rules alone must solve it, how big a share of
  // the region, and the chance that a clue is kept even though it could go.
  const SETTINGS = {
    easy: { propagation: true, fraction: [0.45, 0.6], keep: 0.3 },
    medium: { propagation: true, fraction: [0.4, 0.6], keep: 0.1 },
    hard: { propagation: false, fraction: [0.4, 0.6], keep: 0 },
  };

  // { puzzle: rows, lines: answer flags } with a unique answer.
  function generate(rows, cols, rng, level) {
    const cfg = SETTINGS[level];
    for (;;) {
      const [lo, hi] = cfg.fraction;
      const inside = growRegion(rows, cols, rng, lo + rng() * (hi - lo));
      const base = Logic.parsePuzzle(new Array(rows).fill('.'.repeat(cols)));
      const lines = answerLines(base, inside);
      const clues = cluesFor(base, inside);
      if (clues.some((n) => n > 3)) continue;
      const accept = (list) => {
        const rowsOut = toRows(base, list);
        return cfg.propagation ? Solver.solvesByPropagation(rowsOut) : Solver.countSolutions(rowsOut, 2, SEARCH_BUDGET) === 1;
      };
      if (!accept(clues)) continue;
      for (const i of shuffled(clues.map((_, k) => k), rng)) {
        if (rng() < cfg.keep) continue;
        const saved = clues[i];
        clues[i] = -1;
        if (!accept(clues)) clues[i] = saved;
      }
      return { puzzle: toRows(base, clues), lines };
    }
  }

  const LEVELS = [['easy', 5], ['medium', 7], ['hard', 9]];

  // { easy: [rows...], medium: [...], hard: [...] } sized 5, 7 and 9.
  // Deterministic for a given baseSeed, and no puzzle repeats.
  function buildPuzzleSet(counts, baseSeed = 1) {
    const set = {};
    const seen = new Set();
    LEVELS.forEach(([level, size], index) => {
      set[level] = [];
      for (let i = 0; set[level].length < counts[level]; i++) {
        if (i > 5000) throw new Error(`Could not find enough ${level} puzzles`);
        const { puzzle } = generate(size, size, createRng(baseSeed * 1000003 + index * 100003 + i), level);
        const key = puzzle.join('/');
        if (seen.has(key)) continue;
        seen.add(key);
        set[level].push(puzzle);
      }
    });
    return set;
  }

  // Text of puzzles.js for a set made by buildPuzzleSet.
  function puzzlesSource(set) {
    const lines = Object.keys(set).map((level) => {
      const rows = set[level].map((p) => `    ${JSON.stringify(p)},`).join('\n');
      return `  ${level}: [\n${rows}\n  ],`;
    });
    return `// Generated by make-puzzles.js, do not edit by hand.
// Slitherlink starting puzzles: row strings, '.' = no clue, '0'-'3' = clue.
// Browser global: window.SlitherlinkPuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.SlitherlinkPuzzles = puzzles;
})(this);
`;
  }

  const api = {
    createRng, randomInt, shuffled, isLoopRegion, growRegion, answerLines, cluesFor,
    generate, buildPuzzleSet, puzzlesSource,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SlitherlinkGenerator = api;
})(this);
