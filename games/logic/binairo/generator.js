// Binairo puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.BinairoGenerator) after
// logic.js and solver.js.
//
// Method: build a random full valid grid, then take clues away in random order,
// keeping the answer unique. Easy and Medium only take away clues the simple
// rules can still solve without; Hard takes away all it can and is kept only if
// the simple rules then get stuck.
(function (root) {
  const isNode = typeof require === 'function';
  const Solver = isNode ? require('./solver.js') : root.BinairoSolver;

  const SIZES = { easy: 6, medium: 8, hard: 10 };
  const EXTRA_EASY_CLUES = 4;

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

  // Every row of this size with half suns and no three of a kind.
  function rowPatterns(size) {
    const out = [];
    for (let m = 0; m < 1 << size; m++) {
      const s = m.toString(2).padStart(size, '0');
      if (!/000|111/.test(s) && [...s].filter((ch) => ch === '1').length === size / 2) out.push(s);
    }
    return out;
  }

  // A random valid full grid as row strings of '0' and '1'.
  function randomGrid(size, rng) {
    const patterns = rowPatterns(size);
    const rows = [];
    function ok() {
      const r = rows.length - 1;
      if (new Set(rows).size !== rows.length) return false;
      for (let c = 0; c < size; c++) {
        if (r >= 2 && rows[r][c] === rows[r - 1][c] && rows[r][c] === rows[r - 2][c]) return false;
        const ones = rows.filter((row) => row[c] === '1').length;
        if (ones > size / 2 || rows.length - ones > size / 2) return false;
      }
      if (r === size - 1) {
        const cols = new Set();
        for (let c = 0; c < size; c++) cols.add(rows.map((row) => row[c]).join(''));
        if (cols.size !== size) return false;
      }
      return true;
    }
    function go() {
      if (rows.length === size) return true;
      for (const p of shuffled(patterns, rng)) {
        rows.push(p);
        if (ok() && go()) return true;
        rows.pop();
      }
      return false;
    }
    go();
    return rows;
  }

  const toRows = (cells, size) =>
    Array.from({ length: size }, (_, r) => cells.slice(r * size, r * size + size).join(''));

  // A puzzle of the given level ('easy' | 'medium' | 'hard') as row strings, or
  // null if this attempt did not reach the level (hard that is too easy).
  function attempt(level, rng) {
    const size = SIZES[level];
    const full = randomGrid(size, rng).join('').split('');
    const cells = full.slice();
    const simple = level !== 'hard';
    const removed = [];
    for (const i of shuffled([...Array(size * size).keys()], rng)) {
      cells[i] = '.';
      const rows = toRows(cells, size);
      const fine = simple ? Solver.difficultyScore(rows).solved : Solver.countSolutions(rows) === 1;
      if (fine) removed.push(i);
      else cells[i] = full[i];
    }
    if (level === 'easy') removed.slice(0, EXTRA_EASY_CLUES).forEach((i) => { cells[i] = full[i]; });
    const puzzle = toRows(cells, size);
    if (level === 'hard' && Solver.difficultyScore(puzzle).solved) return null;
    return puzzle;
  }

  function generate(level, rng) {
    if (!SIZES[level]) throw new Error(`Unknown level: ${level}`);
    for (;;) {
      const p = attempt(level, rng);
      if (p) return p;
    }
  }

  // 'easy' | 'medium' | 'hard' for a unique puzzle of that kind, else null.
  function grade(puzzle) {
    const size = puzzle.length;
    const level = Object.keys(SIZES).find((k) => SIZES[k] === size);
    if (!level || Solver.countSolutions(puzzle) !== 1) return null;
    const simple = Solver.difficultyScore(puzzle).solved;
    return simple === (level !== 'hard') ? level : null;
  }

  // { easy: [...], medium: [...], hard: [...] }, no puzzle repeated.
  function buildPuzzleSet(counts, seed) {
    const rng = createRng(seed);
    const seen = new Set();
    const set = {};
    Object.keys(counts).forEach((level) => {
      set[level] = [];
      while (set[level].length < counts[level]) {
        const p = generate(level, rng);
        if (!seen.has(p.join('/'))) {
          seen.add(p.join('/'));
          set[level].push(p);
        }
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
// Binairo starting puzzles: row strings, '.' empty, '0' sun, '1' moon.
// Browser global: window.BinairoPuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.BinairoPuzzles = puzzles;
})(this);
`;
  }

  const api = {
    createRng, randomInt, randomGrid, generate, grade, buildPuzzleSet, puzzlesSource,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BinairoGenerator = api;
})(this);
