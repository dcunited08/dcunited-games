// Light Up puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.LightUpGenerator) after
// logic.js and solver.js.
//
// Method: scatter walls in a pattern that looks the same turned upside down,
// place bulbs until every white square is lit, write the true bulb count on
// every wall, then take numbers away one at a time for as long as the answer
// stays unique and the puzzle stays within its level.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.LightUpLogic;
  const Solver = isNode ? require('./solver.js') : root.LightUpSolver;

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

  // Flat array of booleans (true = wall), the same when turned 180 degrees,
  // with a wall density somewhere between 18% and 27%.
  function randomWalls(size, rng) {
    const total = size * size;
    const density = 0.18 + rng() * 0.09;
    const walls = Array(total).fill(false);
    for (let i = 0; i < Math.ceil(total / 2); i++) {
      if (rng() < density) {
        walls[i] = true;
        walls[total - 1 - i] = true;
      }
    }
    return walls;
  }

  // A set of cell indexes holding bulbs so that every white cell is lit and no
  // two bulbs see each other: visit white cells in random order and give a
  // bulb to each one that is still dark.
  function randomBulbs(size, walls, rng) {
    const rows = Array.from({ length: size }, (_, r) =>
      walls.slice(r * size, (r + 1) * size).map((w) => (w ? '#' : '.')).join(''));
    const puzzle = Logic.parsePuzzle(rows);
    const lit = Array(size * size).fill(false);
    const bulbs = new Set();
    const whites = walls.map((w, i) => i).filter((i) => !walls[i]);
    for (const i of shuffled(whites, rng)) {
      if (lit[i]) continue;
      bulbs.add(i);
      for (const j of Logic.lineOfSight(puzzle, i)) lit[j] = true;
    }
    return bulbs;
  }

  // Row strings with every wall numbered by its adjacent bulbs. A wall with no
  // white neighbor stays a plain '#'.
  function numberedRows(size, walls, bulbs) {
    const rows = [];
    for (let r = 0; r < size; r++) {
      let row = '';
      for (let c = 0; c < size; c++) {
        const i = r * size + c;
        if (!walls[i]) { row += '.'; continue; }
        let open = 0;
        let count = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= size || nc >= size || walls[nr * size + nc]) continue;
          open++;
          if (bulbs.has(nr * size + nc)) count++;
        }
        row += open ? String(count) : '#';
      }
      rows.push(row);
    }
    return rows;
  }

  // 'easy': the simple rules light every square; 'medium': simple rules plus
  // a few try-it-both-ways steps do; 'hard': it takes many of those steps
  // (HARD_LOOKAHEADS or more) or they still get stuck.
  const HARD_LOOKAHEADS = 8;
  function grade(puzzle) {
    const d = Solver.difficultyScore(puzzle);
    if (d.simple) return 'easy';
    return d.solved && d.lookaheads < HARD_LOOKAHEADS ? 'medium' : 'hard';
  }

  const RANK = { easy: 0, medium: 1, hard: 2 };

  // Takes numbers off (one at a time, in random order) while the answer stays
  // unique and the puzzle is no harder than `level`.
  function trimClues(rows, level, rng) {
    let cur = rows.map((r) => r.split(''));
    const clues = [];
    cur.forEach((row, r) => row.forEach((ch, c) => { if (/[0-4]/.test(ch)) clues.push([r, c]); }));
    for (const [r, c] of shuffled(clues, rng)) {
      const saved = cur[r][c];
      cur[r][c] = '#';
      const candidate = cur.map((row) => row.join(''));
      if (Solver.countSolutions(candidate) !== 1 || RANK[grade(candidate)] > RANK[level]) cur[r][c] = saved;
    }
    return cur.map((row) => row.join(''));
  }

  // A puzzle (array of row strings) with exactly one solution and the given
  // level. Throws when no attempt works out.
  function generate(size, level, rng, maxAttempts = 400) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const walls = randomWalls(size, rng);
      const full = numberedRows(size, walls, randomBulbs(size, walls, rng));
      if (Solver.countSolutions(full) !== 1 || RANK[grade(full)] > RANK[level]) continue;
      const rows = trimClues(full, level, rng);
      if (grade(rows) === level) return rows;
    }
    throw new Error(`Could not generate a ${level} ${size}x${size} puzzle`);
  }

  const LEVELS = [['easy', 7], ['medium', 8], ['hard', 10]];

  // { easy: [rows...], medium: [...], hard: [...] } with sizes 7, 8 and 10.
  // Deterministic for a given baseSeed. Puzzles are unique-answer, graded to
  // match their level, and never repeated.
  function buildPuzzleSet(counts, baseSeed = 1, maxTries = 20000) {
    const set = {};
    const seen = new Set();
    LEVELS.forEach(([level, size], index) => {
      set[level] = [];
      for (let i = 0; set[level].length < counts[level]; i++) {
        if (i >= maxTries) throw new Error(`Could not find enough ${level} puzzles`);
        const rng = createRng(baseSeed * 1000003 + index * 100003 + i);
        let rows;
        try { rows = generate(size, level, rng, 5); } catch (e) { continue; }
        const key = rows.join('/');
        if (seen.has(key)) continue;
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
// Light Up starting puzzles: row strings, '.' white, '#' wall, '0'-'4' numbered wall.
// Browser global: window.LightUpPuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.LightUpPuzzles = puzzles;
})(this);
`;
  }

  const api = {
    HARD_LOOKAHEADS, createRng, randomInt, randomWalls, randomBulbs, numberedRows, grade, generate,
    buildPuzzleSet, puzzlesSource,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LightUpGenerator = api;
})(this);
