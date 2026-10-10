// Autoplay for Snake: picks the next direction so the snake steers itself.
// Pure functions over the state from logic.js, so they can be unit tested.
// Loaded as a plain <script> after logic.js in the browser (exposes
// window.SnakeAutopilot) and via require() in Node tests.
(function (root) {
  const { DIRS } = typeof module !== 'undefined' && module.exports
    ? require('./logic.js')
    : root.SnakeLogic;
  const NAMES = Object.keys(DIRS);

  const key = p => p.y * 1000 + p.x;
  const inBounds = (p, grid) => p.x >= 0 && p.y >= 0 && p.x < grid && p.y < grid;
  const add = (p, d) => ({ x: p.x + d.x, y: p.y + d.y });
  const same = (a, b) => !!b && a.x === b.x && a.y === b.y;

  // Cells the head can't enter next: the whole body except the tail,
  // which moves away this tick (same rule as step() in logic.js).
  function blockedSet(snake) {
    return new Set(snake.slice(0, -1).map(key));
  }

  // Shortest path (list of cells, excluding start) from `from` to `to`,
  // or null. `to` may be inside `blocked` (used to path to the tail).
  function bfs(from, to, blocked, grid) {
    const prev = new Map([[key(from), null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (same(cur, to)) {
        const path = [];
        for (let c = cur; !same(c, from); c = prev.get(key(c))) path.unshift(c);
        return path;
      }
      for (const name of NAMES) {
        const n = add(cur, DIRS[name]);
        const k = key(n);
        if (!inBounds(n, grid) || prev.has(k)) continue;
        if (blocked.has(k) && !same(n, to)) continue;
        prev.set(k, cur);
        queue.push(n);
      }
    }
    return null;
  }

  // Number of free cells reachable from `from`.
  function space(from, blocked, grid) {
    const seen = new Set([key(from)]);
    const stack = [from];
    while (stack.length) {
      const cur = stack.pop();
      for (const name of NAMES) {
        const n = add(cur, DIRS[name]);
        const k = key(n);
        if (inBounds(n, grid) && !seen.has(k) && !blocked.has(k)) {
          seen.add(k);
          stack.push(n);
        }
      }
    }
    return seen.size;
  }

  // The snake after its head moves along `path`, growing on the food.
  function follow(snake, path, food) {
    let body = snake;
    for (const cell of path) {
      body = [cell, ...body];
      if (!same(cell, food)) body.pop();
    }
    return body;
  }

  // True if, from this body, the head can still reach its own tail: chasing
  // the tail always frees up room, so the snake can't box itself in.
  function tailPath(body, grid) {
    return bfs(body[0], body[body.length - 1], blockedSet(body), grid);
  }
  const canReachTail = (body, grid) => tailPath(body, grid) !== null;

  function dirName(from, to) {
    return NAMES.find(n => same(add(from, DIRS[n]), to));
  }

  // Returns the direction name to move next, or null if every move is fatal.
  // 1. Take the shortest path to food if the snake can still reach its tail
  //    after eating. 2. Otherwise chase the tail. 3. Otherwise go where
  //    there is the most room.
  function chooseMove(state) {
    const { snake, food, grid } = state;
    const head = snake[0];
    const blocked = blockedSet(snake);

    if (food) {
      const path = bfs(head, food, blocked, grid);
      if (path && canReachTail(follow(snake, path, food), grid)) {
        return dirName(head, path[0]);
      }
    }

    let bestName = null;
    let bestScore = -1;
    for (const name of NAMES) {
      const next = add(head, DIRS[name]);
      const eats = same(next, food);
      if (!inBounds(next, grid) || blocked.has(key(next)) ||
          (eats && same(next, snake[snake.length - 1]))) continue;
      const body = follow(snake, [next], food);
      const toTail = tailPath(body, grid);
      // Any move that keeps the tail in reach beats any that doesn't. Among
      // those, take the longest way round to the tail, which leaves the most
      // room behind for food to show up on a reachable cell.
      const score = toTail
        ? grid * grid * 2 + toTail.length
        : space(next, blockedSet(body), grid);
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    }
    return bestName;
  }

  // Points the snake for its next step, replacing any queued manual turns.
  function autoSteer(state) {
    const name = chooseMove(state);
    if (!name) return;
    state.queue = DIRS[name] === state.dir ? [] : [DIRS[name]];
  }

  const api = { chooseMove, autoSteer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SnakeAutopilot = api;
})(this);
