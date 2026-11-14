// Numberlink solver. No DOM. Loaded as a plain <script> after logic.js in the
// browser (exposes window.NumberlinkSolver) and via require() in Node tests.
//
// A solution joins every pair with a path and fills every square. The search
// grows the paths one step at a time from the first dot of each pair, always
// extending the path whose end has the fewest choices, and prunes whenever:
//  - a path end has nowhere to go,
//  - an empty square has fewer than two neighbours that could ever touch it,
//  - a group of empty squares cannot be reached by any unfinished path end, or
//  - an unfinished pair's far dot is cut off from its path end.
(function (root) {
  const Logic = typeof require === 'function' ? require('./logic.js') : root.NumberlinkLogic;

  // Calls onSolution(paths) for each solution (paths: array parallel to ids)
  // until it returns true or the search is exhausted.
  function search(puzzle, onSolution, maxNodes = Infinity) {
    const p = Logic.parsePuzzle(puzzle);
    const n = p.size;
    const N = n * n;
    const K = p.ids.length;
    const adj = [];
    for (let c = 0; c < N; c++) {
      const r = Math.floor(c / n);
      const col = c % n;
      const list = [];
      if (r > 0) list.push(c - n);
      if (r < n - 1) list.push(c + n);
      if (col > 0) list.push(c - 1);
      if (col < n - 1) list.push(c + 1);
      adj.push(list);
    }
    const goalOf = new Int16Array(N).fill(-1); // pair whose far dot this is
    const occ = new Int16Array(N).fill(-1);    // pair occupying the square
    const head = new Int32Array(K);
    const finished = new Uint8Array(K);
    const paths = [];
    p.ids.forEach((id, k) => {
      const [a, b] = p.dots[id];
      head[k] = a;
      occ[a] = k;
      goalOf[b] = k;
      paths.push([a]);
    });
    let filled = K;
    let open = K;
    const comp = new Int16Array(N);
    const queue = new Int32Array(N);
    const forcedTo = new Int32Array(K);
    let stop = false;
    let nodes = 0;
    let aborted = false;

    // A square an unfinished path could still step onto, as seen from `from`.
    const free = (c) => occ[c] === -1;

    function rec() {
      if (++nodes > maxNodes) { aborted = true; stop = true; }
      if (stop) return;
      if (open === 0) {
        if (filled === N && onSolution(paths)) stop = true;
        return;
      }
      forcedTo.fill(-1);
      // Squares that could still be part of some path: empty squares, plus far dots not yet reached.
      for (let c = 0; c < N; c++) {
        if (!free(c)) continue;
        const g = goalOf[c];
        let avail = 0;
        let headNb = -1;
        let headNb2 = -1;
        for (const q of adj[c]) {
          if (free(q)) avail++;
          else if (!finished[occ[q]] && head[occ[q]] === q) {
            avail++;
            if (g === -1 || occ[q] === g) { if (headNb === -1) headNb = occ[q]; else headNb2 = occ[q]; }
          }
        }
        if (g === -1) {
          if (avail < 2) return;
          if (avail === 2) {
            // both neighbours must join this square; a head next to it must step here
            if (headNb !== -1) {
              if (forcedTo[headNb] !== -1 && forcedTo[headNb] !== c) return;
              forcedTo[headNb] = c;
            }
            if (headNb2 !== -1) {
              if (forcedTo[headNb2] !== -1 && forcedTo[headNb2] !== c) return;
              forcedTo[headNb2] = c;
            }
            if (headNb !== -1 && headNb2 !== -1) return; // two paths cannot meet on one square
          }
        } else {
          // the far dot is entered from an empty neighbour or from its own path end
          let access = 0;
          let own = false;
          for (const q of adj[c]) {
            if (free(q) && goalOf[q] === -1) access++;
            else if (occ[q] === g && head[g] === q) { access++; own = true; }
          }
          if (access === 0) return;
          if (access === 1 && own) {
            if (forcedTo[g] !== -1 && forcedTo[g] !== c) return;
            forcedTo[g] = c;
          }
        }
      }
      // Groups of free squares: each must touch an unfinished path end, and every
      // unfinished far dot's group must touch its own path end.
      comp.fill(-1);
      let groups = 0;
      const touched = [];
      for (let c = 0; c < N; c++) {
        if (!free(c) || comp[c] !== -1) continue;
        let qh = 0;
        let qt = 0;
        queue[qt++] = c;
        comp[c] = groups;
        let touches = false;
        while (qh < qt) {
          const x = queue[qh++];
          for (const q of adj[x]) {
            if (free(q)) {
              if (comp[q] === -1) { comp[q] = groups; queue[qt++] = q; }
            } else if (!finished[occ[q]] && head[occ[q]] === q) touches = true;
          }
        }
        if (!touches) return;
        touched.push(groups);
        groups++;
      }
      let best = -1;
      let bestOpts = null;
      for (let k = 0; k < K; k++) {
        if (finished[k]) continue;
        const h = head[k];
        const goal = p.dots[p.ids[k]][1];
        const opts = [];
        for (const q of adj[h]) {
          if (free(q) && (goalOf[q] === -1 || goalOf[q] === k)) opts.push(q);
        }
        // the far dot's group must be next to this path end
        const gc = comp[goal];
        if (!adj[h].some((q) => q === goal || comp[q] === gc)) return;
        let list = opts;
        if (forcedTo[k] !== -1) {
          if (!opts.includes(forcedTo[k])) return;
          list = [forcedTo[k]];
        }
        if (!list.length) return;
        if (best === -1 || list.length < bestOpts.length) { best = k; bestOpts = list; }
      }
      const k = best;
      const from = head[k];
      const goalCell = p.dots[p.ids[k]][1];
      for (const q of bestOpts) {
        occ[q] = k;
        head[k] = q;
        paths[k].push(q);
        filled++;
        const reached = q === goalCell;
        if (reached) { finished[k] = 1; open--; }
        rec();
        if (reached) { finished[k] = 0; open++; }
        filled--;
        paths[k].pop();
        head[k] = from;
        occ[q] = -1;
        if (stop) return;
      }
    }
    rec();
    return { p, aborted };
  }

  // Number of solutions, counting up to `limit`. With maxNodes, a search that
  // runs out of budget gives up and answers at least 2 ("too many or too slow").
  function countSolutions(puzzle, limit = 2, maxNodes = Infinity) {
    let count = 0;
    const { aborted } = search(puzzle, () => { count++; return count >= limit; }, maxNodes);
    return aborted ? Math.max(count, limit, 2) : count;
  }

  // The first solution as { id: [cells from one dot to the other] }, or null.
  function solve(puzzle) {
    let found = null;
    const { p } = search(puzzle, (paths) => { found = paths.map((path) => path.slice()); return true; });
    if (!found) return null;
    const out = {};
    p.ids.forEach((id, k) => { out[id] = found[k]; });
    return out;
  }

  // Up to `limit` solutions, each { id: [cells] }. Used by the generator to see
  // where an ambiguous puzzle can go two ways.
  function allSolutions(puzzle, limit = 2, maxNodes = Infinity) {
    const found = [];
    const { ids } = Logic.parsePuzzle(puzzle);
    search(puzzle, (paths) => {
      const sol = {};
      ids.forEach((id, k) => { sol[id] = paths[k].slice(); });
      found.push(sol);
      return found.length >= limit;
    }, maxNodes);
    return found;
  }

  const api = { countSolutions, solve, allSolutions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NumberlinkSolver = api;
})(this);
