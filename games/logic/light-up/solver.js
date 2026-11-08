// Light Up solver, hints and difficulty grading. No DOM. Loaded as a plain
// <script> after logic.js in the browser (exposes window.LightUpSolver) and
// via require() in Node tests.
//
// Puzzles may be given as row-string arrays or parsed.
//
// Inside, a search state holds one status per cell: UNKNOWN, BULB or NO_BULB
// (walls are NO_BULB from the start) plus which cells are already lit.
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.LightUpLogic;

  const UNKNOWN = 0;
  const BULB = 1;
  const NO_BULB = 2;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function createContext(puzzle) {
    const p = Logic.parsePuzzle(puzzle);
    const n = p.size * p.size;
    const sees = [];
    const whites = [];
    const walls = [];
    for (let i = 0; i < n; i++) {
      sees.push(Logic.lineOfSight(p, i));
      if (!p.wall[i]) {
        whites.push(i);
      } else if (p.num[i] >= 0) {
        const nbrs = [];
        for (const [dr, dc] of DIRS) {
          const r = Math.floor(i / p.size) + dr;
          const c = (i % p.size) + dc;
          if (r >= 0 && c >= 0 && r < p.size && c < p.size && !p.wall[r * p.size + c]) nbrs.push(r * p.size + c);
        }
        walls.push({ i, n: p.num[i], nbrs });
      }
    }
    return { p, n, sees, whites, walls };
  }

  function newState(ctx) {
    const v = new Int8Array(ctx.n);
    ctx.p.wall.forEach((w, i) => { if (w) v[i] = NO_BULB; });
    return { v, lit: new Uint8Array(ctx.n), bad: false, stop: false };
  }

  const clone = (st) => ({ v: st.v.slice(), lit: st.lit.slice(), bad: false, stop: false });

  // Sets cell i to BULB or NO_BULB. A bulb rules out every other cell it
  // lights. Marks the state bad on a contradiction.
  function assign(ctx, st, i, value) {
    const cur = st.v[i];
    if (cur === value) return;
    if (cur !== UNKNOWN) { st.bad = true; return; }
    st.v[i] = value;
    if (value === NO_BULB) return;
    for (const j of ctx.sees[i]) {
      st.lit[j] = 1;
      if (j !== i && st.v[j] === UNKNOWN) st.v[j] = NO_BULB;
    }
  }

  // Each rule applies every deduction it finds and returns true if it changed
  // anything. `step(i, value, reason)` is optional; when it returns true the
  // run stops (used to hand out one hint).
  function put(ctx, st, step, i, value, reason) {
    assign(ctx, st, i, value);
    if (step && step(i, value, reason())) st.stop = true;
  }

  // A numbered wall with exactly as many open squares as it still needs.
  function ruleWallNeedsAll(ctx, st, step) {
    let changed = false;
    for (const w of ctx.walls) {
      let bulbs = 0;
      let open = 0;
      for (const j of w.nbrs) {
        if (st.v[j] === BULB) bulbs++;
        else if (st.v[j] === UNKNOWN) open++;
      }
      if (bulbs > w.n || bulbs + open < w.n) { st.bad = true; return false; }
      if (open === 0 || bulbs + open !== w.n) continue;
      for (const j of w.nbrs) {
        if (st.v[j] !== UNKNOWN) continue;
        put(ctx, st, step, j, BULB, () => `This ${w.n} needs bulbs in all its open squares.`);
        changed = true;
        if (st.stop || st.bad) return changed;
      }
    }
    return changed;
  }

  // A dark square that only one square can still light.
  function ruleOnlyWay(ctx, st, step) {
    let changed = false;
    for (const w of ctx.whites) {
      if (st.lit[w]) continue;
      let only = -1;
      let count = 0;
      for (const j of ctx.sees[w]) {
        if (st.v[j] === UNKNOWN) { only = j; count++; }
      }
      if (count === 0) { st.bad = true; return false; }
      if (count !== 1) continue;
      const size = ctx.p.size;
      put(ctx, st, step, only, BULB, () => (only === w
        ? 'Nothing else can light this square, so it needs its own bulb.'
        : `Only this square can light the dark square at row ${Math.floor(w / size) + 1}, column ${(w % size) + 1}.`));
      changed = true;
      if (st.stop || st.bad) return changed;
    }
    return changed;
  }

  // A numbered wall that already has all its bulbs: its other neighbors are dots.
  function ruleWallDone(ctx, st, step) {
    let changed = false;
    for (const w of ctx.walls) {
      let bulbs = 0;
      let open = 0;
      for (const j of w.nbrs) {
        if (st.v[j] === BULB) bulbs++;
        else if (st.v[j] === UNKNOWN) open++;
      }
      if (open === 0 || bulbs !== w.n) continue;
      for (const j of w.nbrs) {
        if (st.v[j] !== UNKNOWN) continue;
        put(ctx, st, step, j, NO_BULB, () => (w.n === 0
          ? 'A 0 has no bulbs next to it, so this square is a dot.'
          : `This ${w.n} already has its bulbs, so the rest are dots.`));
        changed = true;
      }
      if (st.stop) return changed;
    }
    return changed;
  }

  const RULES = [ruleWallNeedsAll, ruleOnlyWay, ruleWallDone];

  // Applies the simple rules until nothing changes. False on a contradiction.
  function run(ctx, st, step) {
    for (;;) {
      let changed = false;
      for (const rule of RULES) {
        if (rule(ctx, st, step)) changed = true;
        if (st.bad || st.stop) break;
      }
      if (st.bad) return false;
      if (st.stop || !changed) return true;
    }
  }

  const allLit = (ctx, st) => ctx.whites.every((w) => st.lit[w]);

  // Depth-first search. Branches on the dark square with the fewest ways to
  // light it. visit(st) returns true to stop. Returns true if stopped.
  function search(ctx, st, visit) {
    if (!run(ctx, st, null)) return false;
    let best = null;
    for (const w of ctx.whites) {
      if (st.lit[w]) continue;
      const cands = ctx.sees[w].filter((j) => st.v[j] === UNKNOWN);
      if (!best || cands.length < best.length) best = cands;
    }
    if (!best) return visit(st);
    for (let k = 0; k < best.length; k++) {
      const child = clone(st);
      for (let m = 0; m < k; m++) assign(ctx, child, best[m], NO_BULB);
      assign(ctx, child, best[k], BULB);
      if (!child.bad && search(ctx, child, visit)) return true;
    }
    return false;
  }

  const bulbsOf = (ctx, st) => ctx.whites.filter((i) => st.v[i] === BULB);

  function countSolutions(puzzle, limit = 2) {
    const ctx = createContext(puzzle);
    let n = 0;
    search(ctx, newState(ctx), () => { n++; return n >= limit; });
    return n;
  }

  // Sorted indexes of the bulbs in the answer, or null when unsolvable.
  function solve(puzzle) {
    const ctx = createContext(puzzle);
    let found = null;
    search(ctx, newState(ctx), (st) => { found = bulbsOf(ctx, st); return true; });
    return found;
  }

  // One suggested change: { r, c, value, reason }.
  //   value 'empty': the player should clear this cell. Used first, for a bulb
  //                  that is not in the answer or a dot sitting on a bulb square.
  //   value 'bulb' / 'dot': the next thing the simple rules can prove from the
  //                  marks on the board; bulbs are offered before dots.
  //                  If no simple rule applies, a bulb from the answer.
  // Returns null when the puzzle has no solution or every bulb is placed.
  function hint(puzzle, state) {
    const ctx = createContext(puzzle);
    const sol = solve(ctx.p);
    if (!sol) return null;
    const size = ctx.p.size;
    const at = (i) => ({ r: Math.floor(i / size), c: i % size });
    const inAnswer = new Set(sol);
    for (let i = 0; i < ctx.n; i++) {
      if (state.cells[i] === 'bulb' && !inAnswer.has(i)) {
        return { ...at(i), value: 'empty', reason: 'This bulb is not part of the solution. Take it off.' };
      }
    }
    for (let i = 0; i < ctx.n; i++) {
      if (state.cells[i] === 'dot' && inAnswer.has(i)) {
        return { ...at(i), value: 'empty', reason: 'This dot is wrong: a bulb belongs here.' };
      }
    }
    const missing = sol.filter((i) => state.cells[i] !== 'bulb');
    if (!missing.length) return null;

    const st = newState(ctx);
    state.cells.forEach((v, i) => {
      if (v === 'bulb') assign(ctx, st, i, BULB);
      else if (v === 'dot') assign(ctx, st, i, NO_BULB);
    });
    let found = null;
    run(ctx, st, (i, value, reason) => { found = { i, value, reason }; return true; });
    if (found) {
      return { ...at(found.i), value: found.value === BULB ? 'bulb' : 'dot', reason: found.reason };
    }
    return { ...at(missing[0]), value: 'bulb', reason: 'This square has a bulb in the answer.' };
  }

  // How hard a puzzle is to do by reasoning, without guessing:
  //   simple:     the simple rules alone light every square;
  //   solved:     simple rules plus trying one square both ways (a bulb here
  //               leads to a contradiction, so it is a dot, and the reverse)
  //               light every square;
  //   lookaheads: how many squares needed that try-it-both-ways step.
  function difficultyScore(puzzle) {
    const ctx = createContext(puzzle);
    const st = newState(ctx);
    run(ctx, st, null);
    if (allLit(ctx, st) && !st.bad) return { simple: true, solved: true, lookaheads: 0 };
    let lookaheads = 0;
    for (let progress = true; progress && !st.bad && !allLit(ctx, st);) {
      progress = false;
      for (const i of ctx.whites) {
        if (st.v[i] !== UNKNOWN) continue;
        for (const [tried, forced] of [[BULB, NO_BULB], [NO_BULB, BULB]]) {
          const trial = clone(st);
          assign(ctx, trial, i, tried);
          if (!trial.bad && run(ctx, trial, null)) continue;
          assign(ctx, st, i, forced);
          run(ctx, st, null);
          lookaheads++;
          progress = true;
          break;
        }
        if (st.bad) break;
      }
    }
    return { simple: false, solved: !st.bad && allLit(ctx, st), lookaheads };
  }

  const api = { countSolutions, solve, hint, difficultyScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LightUpSolver = api;
})(this);
