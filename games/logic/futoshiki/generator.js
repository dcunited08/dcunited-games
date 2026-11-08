// Futoshiki puzzle generator: a seeded random Latin square, every sign and
// every given, then clues are taken away one at a time while the answer stays
// unique (and, for Easy and Medium, solvable by simple logic).
// Node-only in practice (the page loads the pre-built puzzles.js).
(function (root) {
  const L = typeof require === 'function' ? require('./logic.js') : root.FutoshikiLogic;
  const S = typeof require === 'function' ? require('./solver.js') : root.FutoshikiSolver;

  // order: 'givens-first' removes givens before signs (few givens left);
  // otherwise all clues are shuffled together. minGivens / minSigns stop removing clues; hard needs at most maxGivens givens and a puzzle simple logic cannot finish.
  const LEVELS = {
    easy: { size: 5, simple: true, minGivens: 5, minSigns: 7, order: 'mixed' },
    medium: { size: 6, simple: true, minGivens: 3, minSigns: 6, order: 'mixed' },
    hard: { size: 7, simple: false, maxGivens: 4, minGivens: 0, minSigns: 0, order: 'givens-first' },
  };

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Random Latin square by backtracking over shuffled digits.
  function randomLatinSquare(n, rng) {
    const grid = new Array(n * n).fill(0);
    function fill(i) {
      if (i === n * n) return true;
      const r = Math.floor(i / n), c = i % n;
      for (const d of shuffle(Array.from({ length: n }, (_, k) => k + 1), rng)) {
        let ok = true;
        for (let k = 0; k < n && ok; k++) if (grid[r * n + k] === d || grid[k * n + c] === d) ok = false;
        if (!ok) continue;
        grid[i] = d;
        if (fill(i + 1)) return true;
      }
      grid[i] = 0;
      return false;
    }
    fill(0);
    return grid;
  }

  const countClues = (p) => ({
    givens: p.givens.split('').filter((ch) => ch !== '.').length,
    signs: (p.h + p.v).split('').filter((ch) => ch !== '.').length,
  });

  function build(n, sol, givens, h, v, level) {
    return {
      difficulty: level, size: n,
      givens: givens.map((d) => (d ? String(d) : '.')).join(''),
      h: h.join(''), v: v.join(''), solution: sol.join(''),
    };
  }

  function attempt(seed, level) {
    const cfg = LEVELS[level], n = cfg.size, rng = makeRng(seed);
    const sol = randomLatinSquare(n, rng);
    const givens = sol.slice();
    const h = [], v = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) h.push(sol[r * n + c] < sol[r * n + c + 1] ? '<' : '>');
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) v.push(sol[r * n + c] < sol[(r + 1) * n + c] ? '<' : '>');

    const gTokens = givens.map((_, i) => ({ g: i }));
    const sTokens = [];
    h.forEach((_, i) => sTokens.push({ h: i }));
    v.forEach((_, i) => sTokens.push({ v: i }));
    const order = cfg.order === 'givens-first'
      ? shuffle(gTokens, rng).concat(shuffle(sTokens, rng))
      : shuffle(gTokens.concat(sTokens), rng);

    let givenCount = n * n, signCount = h.length + v.length;
    for (const t of order) {
      let undo;
      if (t.g !== undefined) {
        if (givenCount <= cfg.minGivens) continue;
        const old = givens[t.g]; givens[t.g] = 0; givenCount--;
        undo = () => { givens[t.g] = old; givenCount++; };
      } else {
        if (signCount <= cfg.minSigns) continue;
        const arr = t.h !== undefined ? h : v, k = t.h !== undefined ? t.h : t.v, old = arr[k];
        arr[k] = '.'; signCount--;
        undo = () => { arr[k] = old; signCount++; };
      }
      const p = L.normalisePuzzle(Object.assign({ id: 'x' }, build(n, sol, givens, h, v, level)));
      const ok = S.countSolutions(p) === 1 && (!cfg.simple || S.simpleSolve(p).solved);
      if (!ok) undo();
    }
    return build(n, sol, givens, h, v, level);
  }

  // Hard puzzles should not fall to simple logic; try a few seeds and keep the first that doesn't.
  function generatePuzzle(seed, level) {
    const cfg = LEVELS[level];
    let best = null;
    for (let k = 0; k < 20; k++) {
      const raw = attempt(seed + k * 7919, level);
      if (cfg.simple) return raw;
      best = best || raw;
      const p = L.normalisePuzzle(Object.assign({ id: 'x' }, raw));
      if (countClues(raw).givens <= cfg.maxGivens && !S.simpleSolve(p).solved) return raw;
    }
    return best;
  }

  const api = { LEVELS, makeRng, shuffle, randomLatinSquare, countClues, generatePuzzle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FutoshikiGenerator = api;
})(typeof self !== 'undefined' ? self : this);
