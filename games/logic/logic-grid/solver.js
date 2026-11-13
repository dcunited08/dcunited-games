// Logic Grid solver: backtracking that assigns one category's permutation at a
// time and checks each clue as soon as every category it needs is assigned.
// Browser: window.LogicGridSolver. Node: require('./solver.js').
(function (root) {
  const RELATIONAL = { next: true, left: true, before: true };

  function permutations(k) {
    const out = [];
    const cur = [];
    const used = new Array(k).fill(false);
    (function rec() {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = 0; i < k; i++) {
        if (used[i]) continue;
        used[i] = true; cur.push(i); rec(); cur.pop(); used[i] = false;
      }
    }());
    return out;
  }

  const houseCat = (puzzle) => puzzle.cats.findIndex((c) => c.ordered);

  // Categories a clue needs before it can be checked.
  function needed(puzzle, clue) {
    const set = new Set([clue.a[0], clue.b[0]]);
    if (clue.c) set.add(clue.c[0]);
    if (RELATIONAL[clue.t]) set.add(houseCat(puzzle));
    return set;
  }

  // Turns a clue into f(inv, perm) -> boolean, where inv[cat][item] is the
  // person holding that item and perm[cat][person] is the item they hold.
  function compile(puzzle, clue) {
    const [ac, ai] = clue.a;
    const [bc, bi] = clue.b;
    const hc = houseCat(puzzle);
    const house = (inv, perm, cat, item) => perm[hc][inv[cat][item]];
    switch (clue.t) {
      case 'is': return (inv) => inv[ac][ai] === inv[bc][bi];
      case 'not': return (inv) => inv[ac][ai] !== inv[bc][bi];
      case 'or': {
        const [cc, ci] = clue.c;
        return (inv) => inv[ac][ai] === inv[bc][bi] || inv[ac][ai] === inv[cc][ci];
      }
      case 'next': return (inv, perm) => Math.abs(house(inv, perm, ac, ai) - house(inv, perm, bc, bi)) === 1;
      case 'left': return (inv, perm) => house(inv, perm, ac, ai) + 1 === house(inv, perm, bc, bi);
      default: return (inv, perm) => house(inv, perm, ac, ai) < house(inv, perm, bc, bi);
    }
  }

  // Is this clue true in the puzzle's own solution (or the one given)?
  function holds(puzzle, clue, solution) {
    const sol = solution || puzzle.solution;
    const inv = sol.map((perm) => { const r = []; perm.forEach((item, person) => { r[item] = person; }); return r; });
    return compile(puzzle, clue)(inv, sol);
  }

  // Assign categories in the order that lets clues be checked earliest.
  function assignmentOrder(puzzle, needs) {
    const order = [0];
    const left = [];
    for (let c = 1; c < puzzle.cats.length; c++) left.push(c);
    while (left.length) {
      let best = 0;
      let bestScore = -1;
      left.forEach((c, idx) => {
        const has = new Set([...order, c]);
        let score = 0;
        needs.forEach((n) => {
          if (!n.has(c)) return;
          score += [...n].every((x) => has.has(x)) ? 100 : 1;
        });
        if (score > bestScore) { bestScore = score; best = idx; }
      });
      order.push(left.splice(best, 1)[0]);
    }
    return order;
  }

  // Walks the search tree. Calls onSolution(perm) for each solution until it
  // returns true (stop). Returns nothing.
  function search(puzzle, onSolution) {
    const n = puzzle.cats.length;
    const k = puzzle.cats[0].items.length;
    const perms = permutations(k);
    const invs = perms.map((p) => { const r = []; p.forEach((item, person) => { r[item] = person; }); return r; });
    const needs = puzzle.clues.map((c) => needed(puzzle, c));
    const order = assignmentOrder(puzzle, needs);
    // Clues grouped by the step at which their last category gets assigned.
    const at = order.map(() => []);
    puzzle.clues.forEach((clue, i) => {
      const step = Math.max(...[...needs[i]].map((c) => order.indexOf(c)));
      at[step].push(compile(puzzle, clue));
    });
    const perm = new Array(n);
    const inv = new Array(n);
    perm[0] = perms[0];   // people: the identity
    inv[0] = invs[0];
    if (!at[0].every((f) => f(inv, perm))) return;

    function rec(step) {
      if (step === n) return onSolution(perm);
      const cat = order[step];
      for (let i = 0; i < perms.length; i++) {
        perm[cat] = perms[i];
        inv[cat] = invs[i];
        if (!at[step].every((f) => f(inv, perm))) continue;
        if (rec(step + 1)) return true;
      }
      return false;
    }
    rec(1);
  }

  function countSolutions(puzzle, limit = 2) {
    let count = 0;
    search(puzzle, () => { count++; return count >= limit; });
    return count;
  }

  function solve(puzzle) {
    let found = null;
    search(puzzle, (perm) => { found = perm.map((p) => p.slice()); return true; });
    return found;
  }

  const api = { permutations, holds, countSolutions, solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LogicGridSolver = api;
})(this);
