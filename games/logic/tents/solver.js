// Tents and Trees solver, hints and difficulty grading. No DOM. Loaded as a
// plain <script> after logic.js in the browser (exposes window.TentsSolver) and
// via require() in Node tests.
//
// Puzzles may be given as { grid, rows, cols } or parsed. Tent answers are
// sorted arrays of cell indexes (r * size + c).
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.TentsLogic;

  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const AROUND = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  // Cells where a tent could ever go: not a tree, with a tree orthogonally beside it.
  function candidateList(p) {
    const out = [];
    for (let i = 0; i < p.size * p.size; i++) {
      if (!p.trees[i] && Logic.adjacentTrees(p, i).length) out.push(i);
    }
    return out;
  }

  // Row-by-row backtracking. Calls visit(tents) per solution (tents is a
  // sorted list of cell indexes); stops when visit returns true.
  function search(puzzle, visit) {
    const p = Logic.parsePuzzle(puzzle);
    const n = p.size;
    const treeTotal = p.trees.filter(Boolean).length;
    const sum = (list) => list.reduce((a, b) => a + b, 0);
    if (sum(p.rows) !== treeTotal || sum(p.cols) !== treeTotal) return;

    const isCand = Array(n * n).fill(false);
    candidateList(p).forEach((i) => { isCand[i] = true; });
    // below[r][c]: candidate cells in column c from row r down.
    const below = Array.from({ length: n + 1 }, () => Array(n).fill(0));
    for (let r = n - 1; r >= 0; r--) {
      for (let c = 0; c < n; c++) below[r][c] = below[r + 1][c] + (isCand[r * n + c] ? 1 : 0);
    }
    const colLeft = p.cols.slice();
    const placed = []; // tent indexes so far, in row order
    const rowTents = []; // tent columns per row

    const placedSet = new Set();

    // Can every tree in rows < r be given its own tent among those placed?
    // (A tent in row r reaches up to row r - 1.)
    function treesOk(r) {
      const tentOwner = new Map();
      const give = (tree, seen) => {
        const tr = Math.floor(tree / n);
        const tc = tree % n;
        for (const [dr, dc] of ORTHO) {
          const t = (tr + dr) * n + tc + dc;
          if (tr + dr < 0 || tc + dc < 0 || tc + dc >= n || !placedSet.has(t) || seen.has(t)) continue;
          seen.add(t);
          if (!tentOwner.has(t) || give(tentOwner.get(t), seen)) { tentOwner.set(t, tree); return true; }
        }
        return false;
      };
      for (let i = 0; i < r * n; i++) if (p.trees[i] && !give(i, new Set())) return false;
      return true;
    }

    function place(r, c0, left, prev, go) {
      // Choose `left` more columns >= c0 for row r.
      if (left === 0) return go();
      for (let c = c0; c < n; c++) {
        if (!isCand[r * n + c] || colLeft[c] === 0) continue;
        if (prev.some((pc) => Math.abs(pc - c) <= 1)) continue;
        rowTents[r].push(c);
        colLeft[c]--;
        placed.push(r * n + c);
        placedSet.add(r * n + c);
        const stop = place(r, c + 2, left - 1, prev, go);
        placedSet.delete(r * n + c);
        placed.pop();
        colLeft[c]++;
        rowTents[r].pop();
        if (stop) return true;
      }
      return false;
    }

    function go(r) {
      if (r === n) {
        if (colLeft.some((v) => v !== 0)) return false;
        return visit(placed.slice());
      }
      rowTents[r] = [];
      const prev = r > 0 ? rowTents[r - 1] : [];
      return place(r, 0, p.rows[r], prev, () => {
        for (let c = 0; c < n; c++) if (colLeft[c] > below[r + 1][c]) return false;
        if (!treesOk(r)) return false;
        return go(r + 1);
      });
    }
    go(0);
  }

  // Runs the search and keeps the answers that also have a one-to-one tree/tent pairing.
  function eachSolution(puzzle, visit) {
    const p = Logic.parsePuzzle(puzzle);
    search(p, (tents) => {
      const state = { size: p.size, cells: Array(p.size * p.size).fill('empty') };
      tents.forEach((i) => { state.cells[i] = 'tent'; });
      return Logic.pairTrees(p, state) ? visit(tents) : false;
    });
  }

  function countSolutions(puzzle, limit = 2) {
    let found = 0;
    eachSolution(puzzle, () => { found++; return found >= limit; });
    return found;
  }

  // The tent cells of the first solution, or null.
  function solve(puzzle) {
    let answer = null;
    eachSolution(puzzle, (tents) => { answer = tents; return true; });
    return answer;
  }

  // --- Deduction engine -------------------------------------------------
  // marks[i]: 0 unknown, 1 tent, 2 grass. Cells that can never hold a tent
  // (trees, or no tree beside them) count as grass without being reported.
  // nextDeduction returns the first move a person could work out, as
  // { i, value: 'tent' | 'grass', reason }, or null. tier 1 uses the plain
  // rules; tier 2 adds "grass where a cell touches every spot for a tree's tent".
  function nextDeduction(puzzle, marks, tier) {
    const p = Logic.parsePuzzle(puzzle);
    const n = p.size;
    const cand = Array(n * n).fill(false);
    candidateList(p).forEach((i) => { cand[i] = true; });
    const open = (i) => marks[i] === 0 && cand[i];
    const lines = [];
    for (let k = 0; k < n; k++) {
      lines.push({ name: 'row', cells: [...Array(n).keys()].map((c) => k * n + c), want: p.rows[k] });
      lines.push({ name: 'column', cells: [...Array(n).keys()].map((r) => r * n + k), want: p.cols[k] });
    }

    for (const line of lines) {
      const have = line.cells.filter((i) => marks[i] === 1).length;
      const free = line.cells.filter(open);
      if (!free.length) continue;
      if (have === line.want) {
        return { i: free[0], value: 'grass', reason: `This ${line.name} already has all its tents, so the rest is grass.` };
      }
      if (have + free.length === line.want) {
        return { i: free[0], value: 'tent', reason: `This ${line.name} needs ${line.want - have} more and has just ${free.length} open spot${free.length === 1 ? '' : 's'}, so they are all tents.` };
      }
    }

    for (let i = 0; i < n * n; i++) {
      if (marks[i] !== 1) continue;
      const r = Math.floor(i / n);
      const c = i % n;
      for (const [dr, dc] of AROUND) {
        if (r + dr < 0 || c + dc < 0 || r + dr >= n || c + dc >= n) continue;
        const j = (r + dr) * n + c + dc;
        if (open(j)) return { i: j, value: 'grass', reason: 'Tents never touch, not even at the corners, so this next to a tent is grass.' };
      }
    }

    const spots = (tree) => {
      const r = Math.floor(tree / n);
      const c = tree % n;
      const out = [];
      for (const [dr, dc] of ORTHO) {
        if (r + dr < 0 || c + dc < 0 || r + dr >= n || c + dc >= n) continue;
        const j = (r + dr) * n + c + dc;
        if (!p.trees[j] && marks[j] !== 2) out.push(j);
      }
      return out;
    };
    const lonely = []; // trees with no tent beside them yet
    for (let t = 0; t < n * n; t++) {
      if (!p.trees[t]) continue;
      const options = spots(t);
      if (options.some((j) => marks[j] === 1)) continue;
      lonely.push(options);
      const unknown = options.filter(open);
      if (options.length === 1 && unknown.length === 1) {
        return { i: unknown[0], value: 'tent', reason: 'This tree has only one spot left for its tent.' };
      }
    }

    if (tier >= 2) {
      for (const options of lonely) {
        if (options.length < 2) continue;
        for (let i = 0; i < n * n; i++) {
          if (!open(i) || options.includes(i)) continue;
          const r = Math.floor(i / n);
          const c = i % n;
          const touches = (j) => Math.abs(Math.floor(j / n) - r) <= 1 && Math.abs((j % n) - c) <= 1;
          if (options.every(touches)) {
            return { i, value: 'grass', reason: 'Whichever spot this tree uses for its tent, that tent would touch this cell, so it is grass.' };
          }
        }
      }
    }
    return null;
  }

  // Plays from a blank board with deductions only. Returns
  // { solved, tier, steps }: tier is the highest rule set needed (1 or 2).
  function difficultyScore(puzzle) {
    const p = Logic.parsePuzzle(puzzle);
    const marks = Array(p.size * p.size).fill(0);
    let steps = 0;
    let tier = 1;
    for (;;) {
      let d = nextDeduction(p, marks, 1);
      if (!d) {
        d = nextDeduction(p, marks, 2);
        if (d) tier = 2;
      }
      if (!d) break;
      marks[d.i] = d.value === 'tent' ? 1 : 2;
      steps++;
    }
    const tents = marks.filter((v) => v === 1).length;
    return { solved: tents === p.trees.filter(Boolean).length && Logic.isSolved(p, {
      size: p.size, cells: marks.map((v) => (v === 1 ? 'tent' : 'empty')),
    }), tier, steps };
  }

  const gradeOf = (d) => (!d.solved ? 'hard' : d.tier === 1 ? 'easy' : 'medium');
  const grade = (puzzle) => gradeOf(difficultyScore(puzzle));

  // A move for the player's board. { r, c, value, reason } where value is
  // 'tent', 'grass' or 'empty' (take a wrong mark off). Null when the puzzle
  // has no solution or the board already matches it.
  function hint(puzzle, state) {
    const p = Logic.parsePuzzle(puzzle);
    const sol = solve(p);
    if (!sol) return null;
    const n = p.size;
    const rc = (i) => ({ r: Math.floor(i / n), c: i % n });
    for (let i = 0; i < n * n; i++) {
      if (state.cells[i] === 'tent' && !sol.includes(i)) {
        return { ...rc(i), value: 'empty', reason: 'This tent is not part of the solution. Take it off.' };
      }
      if (state.cells[i] === 'grass' && sol.includes(i)) {
        return { ...rc(i), value: 'empty', reason: 'This grass is wrong: a tent belongs here. Take it off.' };
      }
    }
    const marks = state.cells.map((v) => (v === 'tent' ? 1 : v === 'grass' ? 2 : 0));
    const d = nextDeduction(p, marks, 2);
    if (d) return { ...rc(d.i), value: d.value, reason: d.reason };
    for (let i = 0; i < n * n; i++) {
      if (state.cells[i] === 'empty' && !p.trees[i] && sol.includes(i)) {
        return { ...rc(i), value: 'tent', reason: 'This one takes some thinking, but a tent goes here.' };
      }
    }
    for (let i = 0; i < n * n; i++) {
      if (state.cells[i] === 'empty' && !p.trees[i] && !sol.includes(i)) {
        const why = Logic.adjacentTrees(p, i).length ? 'This one takes some thinking, but there is no tent here.' : 'There is no tree beside this cell, so no tent can go here.';
        return { ...rc(i), value: 'grass', reason: why };
      }
    }
    return null;
  }

  const api = { candidateList, countSolutions, solve, nextDeduction, difficultyScore, gradeOf, grade, hint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TentsSolver = api;
})(this);
