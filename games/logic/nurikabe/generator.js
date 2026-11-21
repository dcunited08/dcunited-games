// Nurikabe puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.NurikabeGenerator) after
// logic.js and solver.js.
//
// Method: grow random non-touching islands until they fill part of the board,
// patch any 2x2 pools by growing islands, keep boards whose sea is one piece,
// then put each island's number on a random square of it and keep the puzzle
// only if it has exactly one solution.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.NurikabeLogic;
  const Solver = isNode ? require('./solver.js') : root.NurikabeSolver;
  const { neighbors, components } = Logic;

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
  const pick = (rng, list) => list[randomInt(rng, list.length)];

  const clueChar = (n) => (n.toString(36).toUpperCase());

  // Random valid answer: { owner, sizes } where owner[i] is the island id of
  // square i or -1 for sea. Returns null when this attempt fails.
  function randomAnswer(size, rng, maxIsland, fill) {
    const N = size * size;
    const owner = Array(N).fill(-1);
    const sizes = [];
    const wanted = Math.round(N * fill);
    let total = 0;

    const seaOk = () => components(size, (i) => owner[i] === -1).list.length === 1;
    // Gives square i to island id unless that would cut the sea in two.
    function take(i, id) {
      owner[i] = id;
      if (seaOk()) return true;
      owner[i] = -1;
      return false;
    }
    const nearIsland = (i, except) => neighbors(size, i).some((n) => owner[n] !== -1 && owner[n] !== except);
    function plant() {
      const spots = [];
      for (let i = 0; i < N; i++) if (owner[i] === -1 && !nearIsland(i, -2)) spots.push(i);
      if (!spots.length) return false;
      const id = sizes.length;
      const goal = 1 + Math.floor(rng() * rng() * maxIsland);
      let placed = false;
      for (let k = 0; k < 8 && !placed; k++) placed = take(pick(rng, spots), id);
      if (!placed) return false;
      sizes.push(1);
      total++;
      while (sizes[id] < goal && total < wanted) {
        const options = [];
        for (let i = 0; i < N; i++) {
          if (owner[i] === id) for (const n of neighbors(size, i)) if (owner[n] === -1 && !nearIsland(n, id)) options.push(n);
        }
        if (!options.length) break;
        let grew = false;
        for (let k = 0; k < 6 && !grew; k++) grew = take(pick(rng, options), id);
        if (!grew) break;
        sizes[id]++;
        total++;
      }
      return true;
    }
    while (total < wanted && plant());

    // Patch pools: grow a neighbouring island into the pool, else plant a 1.
    for (let guard = 0; guard < N; guard++) {
      const pool = [];
      for (let r = 0; r < size - 1 && !pool.length; r++) {
        for (let c = 0; c < size - 1 && !pool.length; c++) {
          const q = [r * size + c, r * size + c + 1, (r + 1) * size + c, (r + 1) * size + c + 1];
          if (q.every((i) => owner[i] === -1)) pool.push(...q);
        }
      }
      if (!pool.length) break;
      // Moves that fill a pool square: join the one island it touches, or
      // become a new island of 1 when it touches none.
      const moves = [];
      for (const i of pool) {
        const ids = new Set(neighbors(size, i).map((n) => owner[n]).filter((o) => o !== -1));
        if (ids.size === 0) moves.push([i, -1]);
        else if (ids.size === 1 && sizes[[...ids][0]] < maxIsland + 2) moves.push([i, [...ids][0]]);
      }
      let fixed = false;
      while (moves.length && !fixed) {
        const [i, id] = moves.splice(randomInt(rng, moves.length), 1)[0];
        fixed = take(i, id === -1 ? sizes.length : id);
        if (fixed) { if (id === -1) sizes.push(1); else sizes[id]++; }
      }
      if (!fixed) return null;
    }
    const sea = components(size, (i) => owner[i] === -1);
    if (sea.list.length !== 1) return null;
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const i = r * size + c;
        if ([i, i + 1, i + size, i + size + 1].every((k) => owner[k] === -1)) return null;
      }
    }
    return { owner, sizes };
  }

  // Row strings with one number per island, on a random square of it.
  function clueRows(size, answer, rng) {
    const rows = Array.from({ length: size }, () => Array(size).fill('.'));
    answer.sizes.forEach((n, id) => {
      const cells = [];
      answer.owner.forEach((o, i) => { if (o === id) cells.push(i); });
      const i = pick(rng, cells);
      rows[Math.floor(i / size)][i % size] = clueChar(n);
    });
    return rows.map((row) => row.join(''));
  }

  const SOLUTION_CAP = 2;
  const LEVEL_OPTIONS = {
    easy: { size: 6, maxIsland: 5 },
    medium: { size: 8, maxIsland: 6 },
    hard: { size: 10, maxIsland: 8 },
  };

  // A puzzle (array of row strings) with exactly one solution, or throws.
  function generate(size, rng, maxIsland = 6, maxAttempts = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const answer = randomAnswer(size, rng, maxIsland, 0.3 + rng() * 0.15);
      if (!answer) continue;
      for (let tries = 0; tries < 10; tries++) {
        const rows = clueRows(size, answer, rng);
        if (Solver.logicSolve(rows, 2).solved || Solver.countSolutions(rows, SOLUTION_CAP) === 1) return rows;
      }
    }
    throw new Error(`Could not generate a unique ${size}x${size} puzzle`);
  }

  // 'easy': the basic deductions (touching islands, complete islands,
  // unreachable squares, islands with one way out) solve it; 'medium': it
  // also needs 2x2 pools / keeping the sea connected; 'hard': those rules
  // get stuck.
  function grade(puzzle) {
    const d = Solver.difficultyScore(puzzle);
    return d.tier === 1 ? 'easy' : d.tier === 2 ? 'medium' : 'hard';
  }

  const LEVELS = ['easy', 'medium', 'hard'];

  // { easy: [rows...], medium: [...], hard: [...] } with sizes 6, 8 and 10.
  // Deterministic for a given baseSeed. Puzzles are unique-answer, graded to
  // match their level, and never repeated.
  function buildPuzzleSet(counts, baseSeed = 1) {
    const set = {};
    const seen = new Set();
    LEVELS.forEach((level, index) => {
      set[level] = [];
      const { size, maxIsland } = LEVEL_OPTIONS[level];
      for (let i = 0; set[level].length < counts[level]; i++) {
        if (i > 200000) throw new Error(`Could not find enough ${level} puzzles`);
        const rows = generate(size, createRng(baseSeed * 1000003 + index * 100003 + i), maxIsland);
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
// Nurikabe starting puzzles: row strings, '.' blank, numbers 1-9 then A=10, B=11 ...
// Browser global: window.NurikabePuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.NurikabePuzzles = puzzles;
})(this);
`;
  }

  const api = {
    createRng, randomInt, randomAnswer, clueRows, generate, grade, buildPuzzleSet, puzzlesSource, LEVEL_OPTIONS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NurikabeGenerator = api;
})(this);
