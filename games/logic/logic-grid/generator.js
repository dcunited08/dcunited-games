// Logic Grid generator (used offline by make-puzzles.js): seeded random solution,
// a pool of true clues, then add clues until the solver finds exactly one
// solution and drop every clue that turns out not to be needed.
// Browser: window.LogicGridGenerator. Node: require('./generator.js').
(function (root) {
  const isNode = typeof require === 'function';
  const Logic = isNode ? require('./logic.js') : root.LogicGridLogic;
  const Solver = isNode ? require('./solver.js') : root.LogicGridSolver;

  // n categories (People is the first) of k items each; `house` = one of them is the ordered House row.
  const LEVELS = {
    easy: { n: 3, k: 4, house: false },
    medium: { n: 4, k: 4, house: true },
    hard: { n: 4, k: 5, house: true },
  };

  // How often each clue type is drawn while building a puzzle. Hard barely uses
  // direct "is" clues, so the player has to combine relational clues.
  const WEIGHTS = {
    easy: { is: 3, not: 3, or: 3 },
    medium: { is: 2, not: 2, or: 2, next: 2, left: 1.5, before: 1.5 },
    hard: { is: 0.3, not: 1.5, or: 2, next: 2.5, left: 2, before: 2.5 },
  };
  // Clues of earlier types are tried first when dropping redundant ones.
  const DROP_ORDER = ['is', 'not', 'or', 'before', 'left', 'next'];
  const MAX_CLUES = { easy: 14, medium: 18, hard: 24 };

  // mulberry32
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

  function shuffle(rng, arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = randomInt(rng, i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // A puzzle without clues: categories, items, and a random solution.
  function skeleton(level, rng) {
    const { n, k, house } = LEVELS[level];
    const kinds = shuffle(rng, Object.keys(Logic.THEMES)).slice(0, n - 1 - (house ? 1 : 0));
    const people = { name: 'People', kind: 'people', items: shuffle(rng, Logic.NAMES).slice(0, k).map((w) => ({ w, e: '' })) };
    const others = kinds.map((kind) => ({
      name: Logic.THEMES[kind].name,
      kind,
      items: shuffle(rng, Logic.THEMES[kind].items).slice(0, k).map((it) => ({ w: it.w, e: it.e })),
    }));
    if (house) {
      others.push({ name: 'House', kind: 'house', ordered: true, items: Array.from({ length: k }, (_, i) => ({ w: String(i + 1), e: '' })) });
    }
    const cats = [people, ...shuffle(rng, others)];
    const ident = Array.from({ length: k }, (_, i) => i);
    const solution = cats.map((_, c) => (c === 0 ? ident : shuffle(rng, ident)));
    return { cats, solution, clues: [] };
  }

  // Every true clue the level allows, grouped by type.
  function cluePool(puzzle) {
    const { cats } = puzzle;
    const k = cats[0].items.length;
    const who = (c, i) => Logic.personOf(puzzle, c, i);
    const house = cats.findIndex((c) => c.ordered);
    const pool = { is: [], not: [], or: [] };
    for (let c1 = 0; c1 < cats.length; c1++) {
      for (let c2 = c1 + 1; c2 < cats.length; c2++) {
        for (let i = 0; i < k; i++) {
          for (let j = 0; j < k; j++) {
            const t = who(c1, i) === who(c2, j) ? 'is' : 'not';
            pool[t].push({ t, a: [c1, i], b: [c2, j] });
          }
        }
      }
    }
    for (let c1 = 0; c1 < cats.length; c1++) {
      for (let c2 = 0; c2 < cats.length; c2++) {
        if (c1 === c2) continue;
        for (let i = 0; i < k; i++) {
          for (let j = 0; j < k; j++) {
            for (let l = j + 1; l < k; l++) {
              if (who(c1, i) === who(c2, j) || who(c1, i) === who(c2, l)) pool.or.push({ t: 'or', a: [c1, i], b: [c2, j], c: [c2, l] });
            }
          }
        }
      }
    }
    if (house >= 0) {
      Object.assign(pool, { next: [], left: [], before: [] });
      const refs = [];
      cats.forEach((_, c) => { if (c !== house) for (let i = 0; i < k; i++) refs.push([c, i]); });
      const h = (ref) => puzzle.solution[house][who(ref[0], ref[1])];
      refs.forEach((x, xi) => refs.forEach((y, yi) => {
        if (xi === yi) return;
        if (xi < yi && Math.abs(h(x) - h(y)) === 1) pool.next.push({ t: 'next', a: x, b: y });
        if (h(x) + 1 === h(y)) pool.left.push({ t: 'left', a: x, b: y });
        if (h(x) < h(y)) pool.before.push({ t: 'before', a: x, b: y });
      }));
    }
    return pool;
  }

  // Draw clues of random types (by weight), each clue at most once.
  function clueSequence(rng, pool, level) {
    const buckets = {};
    Object.keys(pool).forEach((t) => { buckets[t] = shuffle(rng, pool[t]); });
    const out = [];
    for (;;) {
      const types = Object.keys(buckets).filter((t) => buckets[t].length);
      if (!types.length) return out;
      let r = rng() * types.reduce((s, t) => s + WEIGHTS[level][t], 0);
      let pick = types[types.length - 1];
      for (const t of types) { r -= WEIGHTS[level][t]; if (r < 0) { pick = t; break; } }
      out.push(buckets[pick].pop());
    }
  }

  function attempt(level, rng) {
    const base = skeleton(level, rng);
    const seq = clueSequence(rng, cluePool(base), level);
    const unique = (clues) => Solver.countSolutions({ ...base, clues }, 2) === 1;
    let clues = seq.slice(0, 3);
    let next = 3;
    while (!unique(clues)) {
      if (next >= seq.length) return null;
      clues = clues.concat(seq[next++]);
    }
    // Drop any clue that is not needed, trying the most revealing types first.
    const order = clues.map((c, i) => i).sort((x, y) => DROP_ORDER.indexOf(clues[x].t) - DROP_ORDER.indexOf(clues[y].t));
    const keep = new Set(clues.map((_, i) => i));
    for (const i of order) {
      keep.delete(i);
      if (!unique(clues.filter((_, j) => keep.has(j)))) keep.add(i);
    }
    clues = clues.filter((_, j) => keep.has(j));
    return clues.length <= MAX_CLUES[level] ? { ...base, clues } : null;
  }

  // One complete puzzle for `level`, fully determined by `seed`.
  function generate(level, seed) {
    for (let tries = 0; ; tries++) {
      const p = attempt(level, createRng(seed * 1000003 + tries * 7919));
      if (p) return p;
    }
  }

  // { easy: [...], medium: [...], hard: [...] } with counts per level. No two puzzles are equal.
  function buildPuzzleSet(counts, seed) {
    const set = {};
    const seen = new Set();
    Object.keys(LEVELS).forEach((level, li) => {
      set[level] = [];
      for (let i = 0; i < (counts[level] || 0); i++) {
        for (let bump = 0; ; bump++) {
          const p = generate(level, seed * 100000 + li * 1000 + i + 1 + bump * 50000);
          const sig = JSON.stringify(p);
          if (seen.has(sig)) continue;
          seen.add(sig);
          set[level].push(p);
          break;
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
// Logic Grid starting puzzles: { cats, solution, clues } (see generator.js).
// Browser global: window.LogicGridPuzzles.
(function (root) {
  const puzzles = {
${lines.join('\n')}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = puzzles;
  else root.LogicGridPuzzles = puzzles;
})(this);
`;
  }

  const api = { LEVELS, createRng, randomInt, shuffle, skeleton, cluePool, generate, buildPuzzleSet, puzzlesSource };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LogicGridGenerator = api;
})(this);
