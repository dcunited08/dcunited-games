// Snake game rules, kept free of DOM and canvas so they can be unit tested.
// Loaded as a plain <script> in the browser (exposes window.SnakeLogic, which
// also works from file://) and via require() in Node tests.
(function (root) {
  const GRID = 20;
  const START_STEP_MS = 140;
  const MIN_STEP_MS = 60;
  const SPEEDUP_MS = 4;
  const MAX_QUEUED_TURNS = 3;
  const SWIPE_MIN_PX = 20;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  function createState(grid = GRID, random = Math.random) {
    const mid = Math.floor(grid / 2);
    const snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
    return {
      grid,
      snake,
      dir: DIRS.right,
      queue: [],
      food: placeFood(snake, grid, random),
      score: 0,
      stepMs: START_STEP_MS,
    };
  }

  function placeFood(snake, grid, random = Math.random) {
    const free = [];
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    return free.length ? free[Math.floor(random() * free.length)] : null;
  }

  // Queue turns so two quick key presses within one tick both register,
  // and reject any turn that would reverse into the snake's own neck.
  function queueTurn(state, name) {
    const next = DIRS[name];
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    if (!next || next === last || (next.x === -last.x && next.y === -last.y)) return false;
    if (state.queue.length >= MAX_QUEUED_TURNS) return false;
    state.queue.push(next);
    return true;
  }

  // Advances one tick. Returns 'moved', 'ate', 'dead' or 'won'.
  function step(state, random = Math.random) {
    if (state.queue.length) state.dir = state.queue.shift();
    const { snake, dir, food, grid } = state;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const eating = food && head.x === food.x && head.y === food.y;
    // The tail moves away this tick unless we're growing, so it's safe to enter.
    const body = eating ? snake : snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= grid || head.y >= grid ||
        body.some(s => s.x === head.x && s.y === head.y)) {
      return 'dead';
    }
    snake.unshift(head);
    if (!eating) {
      snake.pop();
      return 'moved';
    }
    state.score++;
    state.stepMs = Math.max(MIN_STEP_MS, state.stepMs - SPEEDUP_MS);
    state.food = placeFood(snake, grid, random);
    return state.food ? 'ate' : 'won';
  }

  function swipeDirection(dx, dy, minPx = SWIPE_MIN_PX) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < minPx) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  const api = {
    GRID, DIRS, START_STEP_MS, MIN_STEP_MS, SPEEDUP_MS,
    createState, placeFood, queueTurn, step, swipeDirection,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SnakeLogic = api;
})(this);
