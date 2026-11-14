// Nurikabe solver, hints and difficulty grading. No DOM. Loaded as a plain
// <script> after logic.js in the browser (exposes window.NurikabeSolver) and
// via require() in Node tests.
//
// Puzzles may be given as row-string arrays or parsed (see logic.js).
// Solutions are flat row-major arrays of booleans, true = sea.
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.NurikabeLogic;
  const { neighbors, components } = Logic;

  // Every shape of `n` connected squares that contains `start`, using only
  // squares where ok(i) is true. Redelmeier-style, each shape found once.
  function shapes(size, n, start, ok) {
    const out = [];
    const seen = new Uint8Array(size * size);
    const poly = [];
    function grow(untried) {
      while (untried.length) {
        const cell = untried.pop();
        poly.push(cell);
        if (poly.length === n) {
          out.push(poly.slice());
        } else {
          const next = untried.slice();
          const added = [];
          for (const nb of neighbors(size, cell)) {
            if (!seen[nb] && ok(nb)) { seen[nb] = 1; added.push(nb); next.push(nb); }
          }
          grow(next);
          for (const a of added) seen[a] = 0;
        }
        poly.pop();
      }
    }
    seen[start] = 1;
    grow([start]);
    return out;
  }

  // Island-by-island backtracking. Calls visit(sea) for each solution (sea is
  // a flat boolean array); stops when visit returns true.
  function search(puzzle, visit) {
    const { size, clues } = Logic.parsePuzzle(puzzle);
    // Squares the simple rules already settled (always correct) trim the search.
    const known = logicSolve(puzzle, 2).state;
    const N = size * size;
    const clueCells = [];
    clues.forEach((v, i) => { if (v) clueCells.push(i); });
    if (!clueCells.length) return;
    const near = new Uint8Array(N); // clue squares at or next to each square
    for (const c of clueCells) { near[c]++; for (const nb of neighbors(size, c)) near[nb]++; }
    const quads = [];
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) quads.push([r * size + c, r * size + c + 1, (r + 1) * size + c, (r + 1) * size + c + 1]);
    }
    const lists = clueCells.map((cell) => {
      const own = new Uint8Array(N);
      own[cell] = 1;
      for (const nb of neighbors(size, cell)) own[nb] = 1;
      return shapes(size, clues[cell], cell, (i) => near[i] - own[i] === 0 && known[i] !== SEA);
    });

    const island = new Uint8Array(N);
    const forbid = new Int32Array(N);
    const done = Array(clueCells.length).fill(false);

    function bump(shape, d) {
      for (const c of shape) {
        forbid[c] += d;
        for (const nb of neighbors(size, c)) forbid[nb] += d;
      }
    }

    // Prunes: every 2x2 needs a square that is or can still be island, and
    // the squares that must be sea must still be able to join up.
    function viable(open) {
      const can = Uint8Array.from(island);
      open.forEach((list, k) => { if (!done[k]) for (const s of list) for (const c of s) can[c] = 1; });
      for (let i = 0; i < N; i++) if (known[i] === ISLAND && !can[i]) return false;
      for (const q of quads) if (!(can[q[0]] || can[q[1]] || can[q[2]] || can[q[3]])) return false;
      let first = -1;
      let sure = 0;
      for (let i = 0; i < N; i++) if (!can[i]) { sure++; if (first < 0) first = i; }
      if (first < 0) return true;
      const seen = new Uint8Array(N);
      seen[first] = 1;
      const stack = [first];
      let reached = 1;
      while (stack.length) {
        for (const nb of neighbors(size, stack.pop())) {
          if (seen[nb] || island[nb]) continue;
          seen[nb] = 1;
          if (!can[nb]) reached++;
          stack.push(nb);
        }
      }
      return reached === sure;
    }

    function go(open, left) {
      if (!viable(open)) return false;
      if (left === 0) return visit(Array.from(island, (v) => v === 0));
      let pick = -1;
      for (let k = 0; k < open.length; k++) {
        if (!done[k] && (pick < 0 || open[k].length < open[pick].length)) pick = k;
      }
      done[pick] = true;
      let stop = false;
      for (const shape of open[pick]) {
        for (const c of shape) island[c] = 1;
        bump(shape, 1);
        const next = open.map((list, k) => (done[k] ? list : list.filter((s) => s.every((c) => forbid[c] === 0))));
        if (!next.some((list, k) => !done[k] && list.length === 0)) stop = go(next, left - 1);
        bump(shape, -1);
        for (const c of shape) island[c] = 0;
        if (stop) break;
      }
      done[pick] = false;
      return stop;
    }
    if (lists.every((l) => l.length)) go(lists, lists.length);
  }

  function countSolutions(puzzle, limit = 2) {
    let n = 0;
    search(puzzle, () => { n++; return n >= limit; });
    return n;
  }

  // The first solution (flat array, true = sea), or null.
  function solve(puzzle) {
    let found = null;
    search(puzzle, (sea) => { found = sea; return true; });
    return found;
  }

  // ---- Deductions a person can make -------------------------------------
  // Squares are 0 unknown, 1 sea, 2 island. Tier 1 rules: numbered islands
  // that touch, complete islands, squares no island can reach, islands with
  // only one way to grow, and 2x2 pools. Tier 2 adds keeping the sea in one
  // piece.
  const UNKNOWN = 0;
  const SEA = 1;
  const ISLAND = 2;

  function startState(clues) {
    return Int8Array.from(clues, (v) => (v ? ISLAND : UNKNOWN));
  }

  // List of { i, value: 'sea' | 'island', tier, reason } for squares the rules
  // force given `st`, in rule order, at most one entry per square.
  function deduce(puzzle, st, maxTier = 2) {
    const { size, clues } = Logic.parsePuzzle(puzzle);
    const N = size * size;
    const out = [];
    const taken = new Set();
    const add = (i, value, tier, reason) => {
      if (st[i] !== UNKNOWN || taken.has(i)) return;
      taken.add(i);
      out.push({ i, value, tier, reason });
    };
    const isl = components(size, (i) => st[i] === ISLAND);
    const groups = isl.list.map((cells) => {
      const numbers = cells.filter((i) => clues[i] > 0);
      return { cells, numbers: numbers.length, need: numbers.length === 1 ? clues[numbers[0]] : 0 };
    });

    for (let i = 0; i < N; i++) {
      if (st[i] !== UNKNOWN) continue;
      const touching = [...new Set(neighbors(size, i).filter((n) => st[n] === ISLAND).map((n) => isl.comp[n]))];
      if (touching.length < 2) continue;
      const gs = touching.map((k) => groups[k]);
      if (gs.reduce((a, g) => a + g.numbers, 0) >= 2) {
        add(i, 'sea', 1, 'This square touches two numbered islands, so it must be sea.');
      } else {
        const sized = gs.find((g) => g.numbers === 1);
        if (sized && gs.reduce((a, g) => a + g.cells.length, 1) > sized.need) {
          add(i, 'sea', 1, 'An island here would join groups into one that is too big, so this square is sea.');
        }
      }
    }

    for (const g of groups) {
      if (g.numbers === 1 && g.cells.length === g.need) {
        for (const c of g.cells) {
          for (const nb of neighbors(size, c)) add(nb, 'sea', 1, 'This island is complete, so the squares around it are sea.');
        }
      }
    }

    // Squares some numbered island could still grow into.
    const reach = new Uint8Array(N);
    for (const g of groups) {
      if (g.numbers !== 1 || g.cells.length >= g.need) continue;
      const mine = isl.comp[g.cells[0]];
      const dist = new Map(g.cells.map((c) => [c, 0]));
      const queue = g.cells.slice();
      for (let k = 0; k < queue.length; k++) {
        const d = dist.get(queue[k]);
        if (d + g.cells.length >= g.need) continue;
        for (const nb of neighbors(size, queue[k])) {
          if (dist.has(nb) || st[nb] === SEA) continue;
          if (st[nb] === ISLAND && isl.comp[nb] === mine) continue;
          const clash = st[nb] === ISLAND
            ? groups[isl.comp[nb]].numbers > 0
            : neighbors(size, nb).some((m) => st[m] === ISLAND && isl.comp[m] !== mine && groups[isl.comp[m]].numbers > 0);
          if (clash) continue;
          dist.set(nb, d + 1);
          queue.push(nb);
          reach[nb] = 1;
        }
      }
    }
    for (const g of groups) if (g.numbers === 1 && g.cells.length < g.need) g.cells.forEach((c) => { reach[c] = 1; });
    for (let i = 0; i < N; i++) {
      if (!reach[i]) add(i, 'sea', 1, 'No island can reach this square, so it is sea.');
    }

    for (const g of groups) {
      if (g.numbers > 1 || (g.numbers === 1 && g.cells.length >= g.need)) continue;
      const exits = new Set();
      for (const c of g.cells) for (const nb of neighbors(size, c)) if (st[nb] === UNKNOWN) exits.add(nb);
      if (exits.size !== 1) continue;
      add([...exits][0], 'island', 1, g.numbers
        ? 'This island needs more squares and this is its only way to grow, so this square is island.'
        : 'These island squares have to join a number and this is the only way, so this square is island.');
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const q = [r * size + c, r * size + c + 1, (r + 1) * size + c, (r + 1) * size + c + 1];
        const unknown = q.filter((i) => st[i] === UNKNOWN);
        if (unknown.length === 1 && q.filter((i) => st[i] === SEA).length === 3) {
          add(unknown[0], 'island', 1, 'Shading this would make a 2×2 pool, so this square is island.');
        }
      }
    }

    if (maxTier < 2) return out;

    const seaCount = N - clues.reduce((a, b) => a + b, 0);
    const seas = components(size, (i) => st[i] === SEA);
    for (const cells of seas.list) {
      if (cells.length >= seaCount) continue;
      const exits = new Set();
      for (const c of cells) for (const nb of neighbors(size, c)) if (st[nb] === UNKNOWN) exits.add(nb);
      if (exits.size === 1) add([...exits][0], 'sea', 2, 'The sea would be cut off, so this square is sea.');
    }
    return out;
  }

  // Applies deductions of up to `maxTier` until none are left. Returns
  // { solved, sea, steps, tier } where tier is the highest tier used.
  function logicSolve(puzzle, maxTier = 2) {
    const p = Logic.parsePuzzle(puzzle);
    const st = startState(p.clues);
    let steps = 0;
    let tier = 1;
    for (;;) {
      const found = deduce(p, st, maxTier);
      if (!found.length) break;
      for (const d of found) {
        st[d.i] = d.value === 'sea' ? SEA : ISLAND;
        if (d.tier > tier) tier = d.tier;
      }
      steps++;
    }
    const solved = st.every((v) => v !== UNKNOWN);
    return { solved, sea: Array.from(st, (v) => v === SEA), state: st, steps, tier };
  }

  // How hard a puzzle is for a person: tier 1 means the basic rules alone
  // solve it, tier 2 needs the sea-connection rule too, tier 3 is stuck even
  // with those. Returns { solved, tier, steps }.
  function difficultyScore(puzzle) {
    const basic = logicSolve(puzzle, 1);
    if (basic.solved) return { solved: true, tier: 1, steps: basic.steps };
    const full = logicSolve(puzzle, 2);
    if (full.solved) return { solved: true, tier: 2, steps: full.steps };
    return { solved: false, tier: 3, steps: full.steps };
  }

  // One suggested change: { r, c, value, reason }.
  //   value 'empty': a shaded square or dot that disagrees with the answer.
  //   value 'sea' / 'dot': a square the rules force (with the reason), or, if
  //                  no simple rule applies, a sea square from the answer.
  // Returns null when there is no solution or nothing is left to suggest.
  function hint(puzzle, state) {
    const p = Logic.parsePuzzle(puzzle);
    const sol = solve(p);
    if (!sol) return null;
    const { size, clues } = p;
    const at = (i) => ({ r: Math.floor(i / size), c: i % size });
    for (let i = 0; i < size * size; i++) {
      if (state.cells[i] === 'sea' && !sol[i]) {
        return { ...at(i), value: 'empty', reason: 'This square is island in the answer, so it should not be shaded.' };
      }
      if (state.cells[i] === 'dot' && sol[i]) {
        return { ...at(i), value: 'empty', reason: 'This square is sea in the answer, so it is not part of an island.' };
      }
    }
    const st = startState(clues);
    state.cells.forEach((v, i) => { if (v === 'sea') st[i] = SEA; else if (v === 'dot') st[i] = ISLAND; });
    const found = deduce(p, st, 2).filter((d) => sol[d.i] === (d.value === 'sea'));
    if (found.length) {
      const d = found[0];
      return { ...at(d.i), value: d.value === 'sea' ? 'sea' : 'dot', reason: d.reason };
    }
    for (let i = 0; i < size * size; i++) {
      if (sol[i] && state.cells[i] === 'empty') return { ...at(i), value: 'sea', reason: 'This square is sea in the answer.' };
    }
    return null;
  }

  const api = { countSolutions, solve, deduce, logicSolve, difficultyScore, hint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NurikabeSolver = api;
})(this);
