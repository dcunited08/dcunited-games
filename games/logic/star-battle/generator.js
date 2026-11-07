// Star Battle puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.StarBattleGenerator) after
// logic.js and solver.js.
//
// Method: pick a random non-touching star placement, grow one region out from
// each star until the grid is full, then keep it only if it has exactly one
// solution, nudging border cells between regions to try to make it unique.
(function (root) {
  const Solver = typeof require === 'function' ? require('./solver.js') : root.StarBattleSolver;

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

  // Star column per row: a permutation where consecutive rows are not
  // adjacent columns (so no stars touch). null if none exists.
  function randomPlacement(size, rng) {
    const cols = [];
    const used = Array(size).fill(false);
    function go(r) {
      if (r === size) return true;
      for (const c of shuffled([...Array(size).keys()], rng)) {
        if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
        cols[r] = c;
        used[c] = true;
        if (go(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    return go(0) ? cols : null;
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Grows region r from star r by repeatedly taking a random empty cell that
  // touches an assigned one.
  function growRegions(size, stars, rng) {
    const grid = Array.from({ length: size }, () => Array(size).fill(-1));
    stars.forEach((c, r) => { grid[r][c] = r; });
    for (let left = size * size - size; left > 0; left--) {
      const options = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (grid[r][c] !== -1) continue;
          for (const [dr, dc] of DIRS) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nc >= 0 && nr < size && nc < size && grid[nr][nc] !== -1) {
              options.push([r, c, grid[nr][nc]]);
            }
          }
        }
      }
      const [r, c, id] = options[randomInt(rng, options.length)];
      grid[r][c] = id;
    }
    return grid;
  }

  function connected(grid, size, id) {
    const cells = [];
    grid.forEach((row, r) => row.forEach((v, c) => { if (v === id) cells.push([r, c]); }));
    const seen = new Set([cells[0].join()]);
    const stack = [cells[0]];
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nc >= 0 && nr < size && nc < size && grid[nr][nc] === id && !seen.has(`${nr},${nc}`)) {
          seen.add(`${nr},${nc}`);
          stack.push([nr, nc]);
        }
      }
    }
    return seen.size === cells.length;
  }

  const toRows = (grid) => grid.map((row) => row.map((id) => String.fromCharCode(65 + id)).join(''));

  // Moves a random non-star border cell into a neighboring region if the
  // region it leaves stays in one piece. Returns an undo function, or null if
  // nothing could move.
  function nudge(grid, size, stars, rng) {
    const moves = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (stars[r] === c) continue;
        for (const [dr, dc] of DIRS) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < size && nc < size && grid[nr][nc] !== grid[r][c]) {
            moves.push([r, c, grid[nr][nc]]);
          }
        }
      }
    }
    for (const [r, c, id] of shuffled(moves, rng)) {
      const from = grid[r][c];
      grid[r][c] = id;
      if (connected(grid, size, from)) return () => { grid[r][c] = from; };
      grid[r][c] = from;
    }
    return null;
  }

  const SOLUTION_CAP = 200;

  // A puzzle (array of row strings) with exactly one solution. Hill climbs by
  // nudging border cells, keeping a nudge unless it adds solutions.
  function generate(size, rng, maxAttempts = 200) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const stars = randomPlacement(size, rng);
      if (!stars) break;
      const grid = growRegions(size, stars, rng);
      let count = Solver.countSolutions(toRows(grid), SOLUTION_CAP);
      for (let step = 0; step < 150 && count > 1; step++) {
        const undo = nudge(grid, size, stars, rng);
        if (!undo) break;
        const next = Solver.countSolutions(toRows(grid), SOLUTION_CAP);
        if (next > count) undo();
        else count = next;
      }
      if (count === 1) return toRows(grid);
    }
    throw new Error(`Could not generate a unique ${size}x${size} puzzle`);
  }

  // 'easy': easy deductions alone solve it with at most 2 confinement steps;
  // 'medium': they solve it but need more; 'hard': they get stuck.
  function grade(puzzle) {
    const d = Solver.difficultyScore(puzzle);
    if (!d.solved) return 'hard';
    return d.confinements <= EASY_MAX_CONFINEMENTS ? 'easy' : 'medium';
  }
  const EASY_MAX_CONFINEMENTS = 2;

  const LEVELS = [['easy', 6], ['medium', 8], ['hard', 9]];

  // { easy: [rows...], medium: [...], hard: [...] } with sizes 6, 8 and 9.
  // Deterministic for a given baseSeed. Puzzles are unique-answer, graded to
  // match their level, and never repeated.
  function buildPuzzleSet(counts, baseSeed = 1) {
    const set = {};
    const seen = new Set();
    LEVELS.forEach(([level, size], index) => {
      set[level] = [];
      for (let i = 0; set[level].length < counts[level]; i++) {
        if (i > 20000) throw new Error(`Could not find enough ${level} puzzles`);
        const rows = generate(size, createRng(baseSeed * 1000003 + index * 100003 + i));
        const key = rows.join('/');
        if (seen.has(key) || grade(rows) !== level) continue;
        seen.add(key);
        set[level].push(rows);
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
// Star Battle starting puzzles: row strings, one letter per region.
// Browser global: window.StarBattlePuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.StarBattlePuzzles = puzzles;
})(this);
`;
  }

  const api = {
    createRng, randomInt, randomPlacement, generate, grade, buildPuzzleSet, puzzlesSource,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarBattleGenerator = api;
})(this);
