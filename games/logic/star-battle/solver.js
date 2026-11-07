// Star Battle solver, hints and difficulty grading. No DOM. Loaded as a plain
// <script> after logic.js in the browser (exposes window.StarBattleSolver) and
// via require() in Node tests.
//
// Puzzles may be given as row-letter arrays, { size, regions } or parsed.
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.StarBattleLogic;

  // Row-by-row backtracking. cols[r] is the star column of row r. Calls
  // visit(cols) per solution; stops when visit returns true.
  function search(puzzle, visit) {
    const { size, regions } = Logic.parsePuzzle(puzzle);
    const cols = [];
    const usedCols = Array(size).fill(false);
    const usedRegions = Array(size).fill(false);
    function go(r) {
      if (r === size) return visit(cols);
      for (let c = 0; c < size; c++) {
        const reg = regions[r][c];
        if (usedCols[c] || usedRegions[reg]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        cols[r] = c;
        usedCols[c] = true;
        usedRegions[reg] = true;
        const stop = go(r + 1);
        usedCols[c] = false;
        usedRegions[reg] = false;
        if (stop) return true;
      }
      return false;
    }
    go(0);
  }

  function countSolutions(puzzle, limit = 2) {
    let n = 0;
    search(puzzle, () => { n++; return n >= limit; });
    return n;
  }

  // Star column per row (an array of N numbers), or null when unsolvable.
  function solve(puzzle) {
    let found = null;
    search(puzzle, (cols) => { found = cols.slice(); return true; });
    return found;
  }

  // One suggested change: { r, c, value, reason }.
  //   value 'empty': the player should clear this cell. Used first for a star
  //                  that is not in the solution, then for an X sitting on a
  //                  cell where the solution has a star.
  //   value 'star':  the solution has a star here and the player has not
  //                  placed it. Picks the region with the fewest open
  //                  (non-X) cells, so the hint is the most "obvious" one.
  // Returns null when the puzzle has no solution or every star is placed.
  function hint(puzzle, state) {
    const p = Logic.parsePuzzle(puzzle);
    const sol = solve(p);
    if (!sol) return null;
    const { size, regions } = p;
    const at = (r, c) => state.cells[r * size + c];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (at(r, c) === 'star' && sol[r] !== c) {
          return { r, c, value: 'empty', reason: 'This star is not part of the solution. Take it off.' };
        }
      }
    }
    for (let r = 0; r < size; r++) {
      if (at(r, sol[r]) === 'x') {
        return { r, c: sol[r], value: 'empty', reason: 'This X is wrong: the star for this row belongs here.' };
      }
    }
    const open = Array(size).fill(0);
    regions.forEach((row, r) => row.forEach((reg, c) => { if (at(r, c) !== 'x') open[reg]++; }));
    let best = null;
    for (let r = 0; r < size; r++) {
      if (at(r, sol[r]) === 'star') continue;
      const n = open[regions[r][sol[r]]];
      if (!best || n < best.n) best = { r, n };
    }
    if (!best) return null;
    const c = sol[best.r];
    return {
      r: best.r, c, value: 'star',
      reason: `This colored region has ${best.n === 1 ? 'only one open cell' : `${best.n} open cells`} left, and the star goes here.`,
    };
  }

  // Plays the puzzle like a person using only easy deductions:
  //   1. a row, column or region with a single open cell gets its star there;
  //   2. a star rules out its row, column, region and the 8 cells around it;
  //   3. a region whose open cells all sit in one row (or column) rules out
  //      the rest of that row (column), and a row (column) whose open cells
  //      all sit in one region rules out the rest of that region.
  // Returns { solved, stars, steps, confinements }; steps counts each star
  // placed and each rule 3 deduction that removed something, confinements
  // counts only the rule 3 ones.
  function difficultyScore(puzzle) {
    const { size, regions } = Logic.parsePuzzle(puzzle);
    const cand = Array.from({ length: size }, () => Array(size).fill(true));
    const rowDone = Array(size).fill(false);
    const colDone = Array(size).fill(false);
    const regDone = Array(size).fill(false);
    let stars = 0;
    let steps = 0;
    let confinements = 0;

    function place(r, c) {
      rowDone[r] = true;
      colDone[c] = true;
      regDone[regions[r][c]] = true;
      stars++;
      steps++;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (i === r || j === c || regions[i][j] === regions[r][c]
              || (Math.abs(i - r) <= 1 && Math.abs(j - c) <= 1)) cand[i][j] = false;
        }
      }
    }

    // Lines are lists of cells: every row, column and region not yet starred.
    function groups() {
      const out = [];
      for (let k = 0; k < size; k++) {
        const row = []; const col = []; const reg = [];
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            if (cand[i][j] && i === k) row.push([i, j]);
            if (cand[i][j] && j === k) col.push([i, j]);
            if (cand[i][j] && regions[i][j] === k) reg.push([i, j]);
          }
        }
        if (!rowDone[k]) out.push({ kind: 'row', cells: row });
        if (!colDone[k]) out.push({ kind: 'col', cells: col });
        if (!regDone[k]) out.push({ kind: 'reg', cells: reg });
      }
      return out;
    }

    const allSame = (cells, f) => cells.every((cell) => f(cell) === f(cells[0]));

    // Clears every open cell matching `test`, returns true if any changed.
    function eliminate(test) {
      let any = false;
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (cand[i][j] && test(i, j)) { cand[i][j] = false; any = true; }
        }
      }
      return any;
    }

    function confine(g) {
      const { kind, cells } = g;
      const [r0, c0] = cells[0];
      const reg0 = regions[r0][c0];
      if (kind === 'reg') {
        if (allSame(cells, (x) => x[0]) && eliminate((i, j) => i === r0 && regions[i][j] !== reg0)) return true;
        if (allSame(cells, (x) => x[1]) && eliminate((i, j) => j === c0 && regions[i][j] !== reg0)) return true;
        return false;
      }
      if (!allSame(cells, (x) => regions[x[0]][x[1]])) return false;
      return eliminate((i, j) => regions[i][j] === reg0 && (kind === 'row' ? i !== r0 : j !== c0));
    }

    for (;;) {
      if (stars === size) break;
      const gs = groups();
      if (gs.some((g) => g.cells.length === 0)) break; // contradiction: stuck
      const single = gs.find((g) => g.cells.length === 1);
      if (single) { place(...single.cells[0]); continue; }
      const hit = gs.find((g) => confine(g));
      if (!hit) break;
      steps++;
      confinements++;
    }
    return { solved: stars === size, stars, steps, confinements };
  }

  const api = { countSolutions, solve, hint, difficultyScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StarBattleSolver = api;
})(this);
