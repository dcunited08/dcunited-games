const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GRID, DIRS, START_STEP_MS, MIN_STEP_MS, SPEEDUP_MS,
  createState, placeFood, queueTurn, step, swipeDirection,
} = require('./logic.js');

// Always picks the first free cell, so food placement is predictable.
const first = () => 0;

function stateWith(overrides) {
  return { ...createState(GRID, first), ...overrides };
}

test('createState puts a 3-long snake in the middle heading right', () => {
  const s = createState(GRID, first);
  const mid = GRID / 2;
  assert.deepEqual(s.snake, [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }]);
  assert.equal(s.dir, DIRS.right);
  assert.deepEqual(s.queue, []);
  assert.equal(s.score, 0);
  assert.equal(s.stepMs, START_STEP_MS);
  assert.deepEqual(s.food, { x: 0, y: 0 });
});

test('placeFood never lands on the snake', () => {
  const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  assert.deepEqual(placeFood(snake, 2, first), { x: 0, y: 1 });
  assert.deepEqual(placeFood(snake, 2, () => 0.99), { x: 1, y: 1 });
});

test('placeFood returns null when the board is full', () => {
  const snake = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  assert.equal(placeFood(snake, 2, first), null);
});

test('step moves the snake one cell without growing', () => {
  const s = stateWith({ food: { x: 0, y: 0 } });
  const head = s.snake[0];
  assert.equal(step(s, first), 'moved');
  assert.equal(s.snake.length, 3);
  assert.deepEqual(s.snake[0], { x: head.x + 1, y: head.y });
  assert.equal(s.score, 0);
});

test('eating food grows the snake, scores, speeds up and moves the food', () => {
  const s = stateWith({});
  s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
  assert.equal(step(s, first), 'ate');
  assert.equal(s.snake.length, 4);
  assert.equal(s.score, 1);
  assert.equal(s.stepMs, START_STEP_MS - SPEEDUP_MS);
  assert.deepEqual(s.food, { x: 0, y: 0 });
});

test('speed never drops below the minimum step', () => {
  const s = stateWith({ stepMs: MIN_STEP_MS });
  s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
  step(s, first);
  assert.equal(s.stepMs, MIN_STEP_MS);
});

test('hitting a wall ends the game', () => {
  for (const [name, head] of [
    ['right', { x: GRID - 1, y: 5 }],
    ['left', { x: 0, y: 5 }],
    ['up', { x: 5, y: 0 }],
    ['down', { x: 5, y: GRID - 1 }],
  ]) {
    const s = stateWith({ snake: [head], dir: DIRS[name], food: { x: 10, y: 10 } });
    assert.equal(step(s, first), 'dead', name);
  }
});

test('running into its own body ends the game', () => {
  // Head at (2,2) moving down into (2,3), which is body.
  const snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }];
  const s = stateWith({ snake, dir: DIRS.down, food: { x: 10, y: 10 } });
  assert.equal(step(s, first), 'dead');
});

test('the head may move into the cell the tail is leaving', () => {
  // A 4-long loop: head at (1,1), tail at (1,2) directly below.
  const snake = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
  const s = stateWith({ snake, dir: DIRS.down, food: { x: 10, y: 10 } });
  assert.equal(step(s, first), 'moved');
  assert.deepEqual(s.snake[0], { x: 1, y: 2 });
});

test('but not when eating, since the tail stays put', () => {
  const snake = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }];
  const s = stateWith({ snake, dir: DIRS.down, food: { x: 1, y: 2 } });
  assert.equal(step(s, first), 'dead');
});

test('filling the board wins the game', () => {
  // 2x2 board, snake fills 3 cells, food in the last one.
  const s = {
    ...createState(2, first),
    snake: [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
    dir: DIRS.right,
    food: { x: 1, y: 1 },
  };
  assert.equal(step(s, first), 'won');
  assert.equal(s.food, null);
  assert.equal(s.score, 1);
});

test('queueTurn applies a turn on the next step', () => {
  const s = stateWith({ food: { x: 0, y: 0 } });
  const head = s.snake[0];
  assert.equal(queueTurn(s, 'up'), true);
  step(s, first);
  assert.equal(s.dir, DIRS.up);
  assert.deepEqual(s.snake[0], { x: head.x, y: head.y - 1 });
});

test('queueTurn rejects reversing into the neck', () => {
  const s = stateWith({});
  assert.equal(queueTurn(s, 'left'), false);
  assert.deepEqual(s.queue, []);
});

test('queueTurn rejects repeating the current direction', () => {
  const s = stateWith({});
  assert.equal(queueTurn(s, 'right'), false);
});

test('two quick turns both register, checked against the queued one', () => {
  const s = stateWith({});
  assert.equal(queueTurn(s, 'up'), true);
  assert.equal(queueTurn(s, 'down'), false, 'down reverses the queued up');
  assert.equal(queueTurn(s, 'left'), true);
  assert.deepEqual(s.queue, [DIRS.up, DIRS.left]);
});

test('the turn queue holds at most three turns', () => {
  const s = stateWith({});
  for (const d of ['up', 'left', 'down', 'right']) queueTurn(s, d);
  assert.deepEqual(s.queue, [DIRS.up, DIRS.left, DIRS.down]);
});

test('swipeDirection picks the dominant axis and ignores short swipes', () => {
  assert.equal(swipeDirection(50, 10), 'right');
  assert.equal(swipeDirection(-50, 10), 'left');
  assert.equal(swipeDirection(10, 50), 'down');
  assert.equal(swipeDirection(10, -50), 'up');
  assert.equal(swipeDirection(5, 5), null);
});
