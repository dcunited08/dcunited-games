// Numberlink puzzle generator. No DOM. Used offline (make-puzzles.js) to make
// puzzles.js; also loadable in the browser (window.NumberlinkGenerator) after
// logic.js and solver.js.
//
// Method: start with every square as its own line, keep joining the ends of
// neighbouring lines at random (never letting a line run alongside itself),
// then patch up any line shorter than 3 squares. The two ends of each line
// become a pair of dots. Keep the result only if the solver finds exactly one
// way to join the pairs and fill the board.
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.NumberlinkLogic;
  const Solver = isNode ? require('./solver.js') : root.NumberlinkSolver;

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

  function neighbours(size, c) {
    const r = Math.floor(c / size);
    const col = c % size;
    const out = [];
    if (r > 0) out.push(c - size);
    if (r < size - 1) out.push(c + size);
    if (col > 0) out.push(c - 1);
    if (col < size - 1) out.push(c + 1);
    return out;
  }

  // True when two squares of the line touch without being next to each other
  // along it: such a line could take a shortcut, so the answer would not be unique.
  function touchesItself(size, line) {
    const at = new Map(line.map((c, i) => [c, i]));
    return line.some((c, i) => neighbours(size, c).some((m) => at.has(m) && Math.abs(at.get(m) - i) > 1));
  }

  const pick = (rng, list) => list[randomInt(rng, list.length)];

  // Lines (arrays of squares, each step to a neighbour) that cover the board,
  // each at least 3 squares long and never touching itself. null if it gets stuck.
  function randomCover(size, rng) {
    const N = size * size;
    if (N < 3) return null;
    let lines = Array.from({ length: N }, (_, c) => [c]);
    const owner = Array.from({ length: N }, (_, c) => lines[c]);
    // Join line ends at random until no join has worked for a while.
    for (let fails = 0; fails < N * 20;) {
      const c = randomInt(rng, N);
      const p = owner[c];
      const m = pick(rng, neighbours(size, c));
      const q = owner[m];
      const isEnd = (line, x) => line[0] === x || line[line.length - 1] === x;
      if (p === q || !isEnd(p, c) || !isEnd(q, m)) { fails++; continue; }
      const joined = (p[0] === c ? p.slice().reverse() : p).concat(q[0] === m ? q : q.slice().reverse());
      if (touchesItself(size, joined)) { fails++; continue; }
      lines = lines.filter((l) => l !== p && l !== q);
      lines.push(joined);
      joined.forEach((x) => { owner[x] = joined; });
      fails = 0;
    }
    // Patch short lines: hook one onto a neighbouring line, cutting that line
    // at the square it touches (the cut-off part becomes a line of its own).
    for (let tries = 0; tries < 500; tries++) {
      const shorts = lines.filter((l) => l.length < 3);
      if (!shorts.length) return lines;
      const s = pick(rng, shorts);
      const c = rng() < 0.5 ? s[0] : s[s.length - 1];
      const others = neighbours(size, c).filter((m) => owner[m] !== s);
      if (!others.length) continue;
      const m = pick(rng, others);
      const q = owner[m];
      const i = q.indexOf(m);
      const forward = rng() < 0.5;
      const keep = forward ? q.slice(0, i + 1) : q.slice(i).reverse();
      const rest = forward ? q.slice(i + 1) : q.slice(0, i);
      const joined = keep.concat(s[0] === c ? s : s.slice().reverse());
      if (touchesItself(size, joined) || (rest.length > 0 && rest.length < 3 && rng() < 0.7)) continue;
      lines = lines.filter((l) => l !== s && l !== q);
      for (const line of rest.length ? [joined, rest] : [joined]) {
        lines.push(line);
        line.forEach((x) => { owner[x] = line; });
      }
    }
    return null;
  }

  // Row strings with a dot at each end of each piece. Pairs are numbered in
  // reading order of their first dot.
  function puzzleFromPieces(size, pieces) {
    const ends = pieces.map((piece) => [piece[0], piece[piece.length - 1]]);
    const order = ends.map((e, i) => i).sort((a, b) => Math.min(...ends[a]) - Math.min(...ends[b]));
    const grid = Array(size * size).fill('.');
    order.forEach((piece, k) => ends[piece].forEach((c) => { grid[c] = Logic.idChar(k); }));
    return Array.from({ length: size }, (_, r) => grid.slice(r * size, r * size + size).join(''));
  }

  // One puzzle with a single answer and minPairs..maxPairs pairs, or null if
  // `restarts` tries found none. `budget` caps the solver's work per try.
  function generate(size, rng, opts = {}) {
    const { minPairs = 4, maxPairs = 5, restarts = 40, budget = 200000 } = opts;
    for (let attempt = 0; attempt < restarts; attempt++) {
      const lines = randomCover(size, rng);
      if (!lines || lines.length < minPairs || lines.length > maxPairs) continue;
      const rows = puzzleFromPieces(size, lines);
      if (Solver.countSolutions(rows, 2, budget) === 1) return rows;
    }
    return null;
  }

  const LEVELS = [
    ['easy', { size: 5, minPairs: 4, maxPairs: 5 }],
    ['medium', { size: 7, minPairs: 6, maxPairs: 8 }],
    ['hard', { size: 9, minPairs: 9, maxPairs: 12 }],
  ];

  // { easy: [rows, ...], ... } with counts[level] distinct puzzles per level.
  function buildPuzzleSet(counts, baseSeed, opts = {}) {
    const { maxAttempts = 20000 } = opts;
    const set = {};
    const seen = new Set();
    LEVELS.forEach(([level, config], index) => {
      if (!counts[level]) return;
      set[level] = [];
      for (let i = 0; set[level].length < counts[level]; i++) {
        if (i >= maxAttempts) throw new Error(`Could not find enough ${level} puzzles`);
        const rows = generate(config.size, createRng(baseSeed * 1000003 + index * 100003 + i), config);
        if (!rows || seen.has(rows.join('/'))) continue;
        seen.add(rows.join('/'));
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
// Numberlink starting puzzles: row strings, '.' for empty, 1-9 then A, B... for dots.
// Browser global: window.NumberlinkPuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.NumberlinkPuzzles = puzzles;
})(this);
`;
  }

  const api = {
    createRng, randomInt, randomCover, puzzleFromPieces, generate, buildPuzzleSet, puzzlesSource,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NumberlinkGenerator = api;
})(this);
