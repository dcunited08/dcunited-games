// Hashi puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.HashiGenerator) after
// logic.js and solver.js.
//
// Method: start from one island and repeatedly step out from a random island
// in a straight line to a free cell, laying a bridge of 1 or 2 and putting a
// new island at the end. Then add a few extra bridges between islands that
// already see each other, number each island with its bridge total, and keep
// the board only if it has exactly one solution.
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.HashiLogic;
  const Solver = typeof require === 'function' ? require('./solver.js') : root.HashiSolver;

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

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // One random layout: rows of island numbers, or null if it came out badly
  // (an island with more than 8 bridges).
  function layout(size, target, rng) {
    const isl = [];                       // { r, c, n }
    const cellOwner = new Map();          // "r,c" -> 'i' + index or 'b'
    const bridges = [];                   // { a, b, count }
    const key = (r, c) => `${r},${c}`;
    const free = (r, c) => r >= 0 && c >= 0 && r < size && c < size && !cellOwner.has(key(r, c));
    const addIsland = (r, c) => { isl.push({ r, c, n: 0 }); cellOwner.set(key(r, c), 'i'); return isl.length - 1; };
    const touchesIsland = (r, c, except) => DIRS.some(([dr, dc]) =>
      isl.some((o, i) => i !== except && o.r === r + dr && o.c === c + dc));

    addIsland(randomInt(rng, size), randomInt(rng, size));
    for (let tries = 0; isl.length < target && tries < 400; tries++) {
      const from = randomInt(rng, isl.length);
      const [dr, dc] = DIRS[randomInt(rng, 4)];
      const len = 2 + randomInt(rng, 4);
      const path = [];
      let ok = true;
      for (let k = 1; k <= len && ok; k++) {
        const r = isl[from].r + dr * k;
        const c = isl[from].c + dc * k;
        if (free(r, c)) path.push([r, c]); else ok = false;
      }
      if (path.length < 1) continue;
      const end = path[path.length - 1];
      if (touchesIsland(end[0], end[1], from)) continue;
      const to = addIsland(end[0], end[1]);
      path.slice(0, -1).forEach(([r, c]) => cellOwner.set(key(r, c), 'b'));
      bridges.push({ a: from, b: to, count: 1 + (rng() < 0.4 ? 1 : 0) });
    }

    // Extra bridges between islands that already see each other.
    const draft = Logic.parsePuzzle(Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => (isl.some((o) => o.r === r && o.c === c) ? '1' : '.')).join('')));
    const idx = (r, c) => isl.findIndex((o) => o.r === r && o.c === c);
    draft.edges.forEach((e) => {
      const a = idx(draft.islands[e.a].r, draft.islands[e.a].c);
      const b = idx(draft.islands[e.b].r, draft.islands[e.b].c);
      if (bridges.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) return;
      if (e.cells.some(([r, c]) => cellOwner.has(key(r, c))) || rng() < 0.45) return;
      e.cells.forEach(([r, c]) => cellOwner.set(key(r, c), 'b'));
      bridges.push({ a, b, count: 1 + (rng() < 0.3 ? 1 : 0) });
    });

    bridges.forEach((x) => { isl[x.a].n += x.count; isl[x.b].n += x.count; });
    if (isl.some((o) => o.n > 8)) return null;
    const grid = Array.from({ length: size }, () => Array(size).fill('.'));
    isl.forEach((o) => { grid[o.r][o.c] = String(o.n); });
    return { rows: grid.map((row) => row.join('')), islands: isl.length };
  }

  // { size, minIslands, maxIslands } -> rows of a puzzle with exactly one solution.
  function generate(spec, rng, maxAttempts = 3000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const target = spec.minIslands + randomInt(rng, spec.maxIslands - spec.minIslands + 1);
      const made = layout(spec.size, target, rng);
      if (!made || made.islands < spec.minIslands || made.islands > spec.maxIslands) continue;
      if (Solver.countSolutions(made.rows) === 1) return made.rows;
    }
    throw new Error(`Could not generate a unique ${spec.size}x${spec.size} puzzle`);
  }

  // Hard puzzles need more than plain deduction: some guessing or connectivity reasoning.
  const isHardEnough = (rows) => !Solver.analyze(rows).solved;

  const LEVELS = [
    ['easy', { size: 7, minIslands: 8, maxIslands: 12 }],
    ['medium', { size: 9, minIslands: 14, maxIslands: 20 }],
    ['hard', { size: 11, minIslands: 22, maxIslands: 30 }],
  ];

  // { easy: [rows...], medium: [...], hard: [...] }. Deterministic for a given
  // baseSeed. Puzzles are unique-answer, never repeated, and hard ones need
  // more than plain deduction.
  function buildPuzzleSet(counts, baseSeed = 1) {
    const set = {};
    const seen = new Set();
    LEVELS.forEach(([level, spec], index) => {
      set[level] = [];
      for (let i = 0; set[level].length < counts[level]; i++) {
        if (i > 20000) throw new Error(`Could not find enough ${level} puzzles`);
        const rows = generate(spec, createRng(baseSeed * 1000003 + index * 100003 + i));
        const key = rows.join('/');
        if (seen.has(key) || (level === 'hard' && !isHardEnough(rows))) continue;
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
// Hashi starting puzzles: row strings, '.' is water, 1-8 an island.
// Browser global: window.HashiPuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.HashiPuzzles = puzzles;
})(this);
`;
  }

  const api = { createRng, randomInt, shuffled, generate, isHardEnough, buildPuzzleSet, puzzlesSource, LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HashiGenerator = api;
})(this);
