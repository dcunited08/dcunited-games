const test = require('node:test');
const assert = require('node:assert/strict');
const { GRID, DIRS, createState, step } = require('./logic.js');
const { chooseMove, autoSteer } = require('./autopilot.js');

const first = () => 0;

// Builds a state from a snake (head first) heading in `dir`, with food at `food`.
function board(snake, food, dir = 'right', grid = 6) {
  return { grid, snake, dir: DIRS[dir], queue: [], food, score: 0, stepMs: 100 };
}

function nextHead(state, name) {
  return { x: state.snake[0].x + DIRS[name].x, y: state.snake[0].y + DIRS[name].y };
}

test('heads straight for food in an open line', () => {
  const s = board([{ x: 1, y: 2 }, { x: 0, y: 2 }], { x: 4, y: 2 });
  assert.equal(chooseMove(s), 'right');
});

test('turns toward food that is off to the side', () => {
  const s = board([{ x: 2, y: 2 }, { x: 1, y: 2 }], { x: 2, y: 5 });
  assert.equal(chooseMove(s), 'down');
});

test('never reverses into its own neck, even when food is behind', () => {
  const s = board([{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }], { x: 0, y: 2 });
  const move = chooseMove(s);
  assert.notEqual(move, 'left');
  assert.ok(['up', 'down', 'right'].includes(move));
});

test('steers away from a wall it would otherwise hit', () => {
  // Heading right along the top edge with the wall dead ahead.
  const s = board([{ x: 5, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 0 }], { x: 0, y: 5 });
  assert.equal(chooseMove(s), 'down');
});

test('routes around its own body to reach food', () => {
  // A wall of body sits between the head and the food on the direct route.
  const snake = [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }];
  const s = board(snake, { x: 4, y: 2 }, 'up');
  const move = chooseMove(s);
  const head = nextHead(s, move);
  assert.ok(!snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y), 'does not hit itself');
  assert.ok(head.x >= 0 && head.y >= 0 && head.x < 6 && head.y < 6, 'stays on the board');
});

test('refuses a short path to food that would trap it in a dead end', () => {
  // Food at (2,2) sits in a pocket walled in by its own body on three sides:
  //   . B B B . .
  //   . B F B . .
  //   . B H B . .     H heading left, came from (3,3)
  //   . B . . . .
  //   . B B B B .
  const snake = [
    { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }, { x: 2, y: 1 },
    { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 },
    { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 },
  ];
  const s = board(snake, { x: 2, y: 2 }, 'left');
  assert.equal(chooseMove(s), 'down');
});

test('when no food is reachable it still picks a move that keeps it alive', () => {
  const s = board([{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], null);
  const move = chooseMove(s);
  assert.ok(['up', 'down', 'right'].includes(move));
});

test('takes the only open move', () => {
  const snake = [
    { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 },
    { x: 1, y: 2 }, { x: 0, y: 2 },
  ];
  const s = board(snake, { x: 5, y: 5 }, 'down');
  // Only (0,1) is free next to the head: down (1,2) and right (2,1) are body.
  assert.equal(chooseMove(s), 'left');
});

test('returns null when there is no legal move at all', () => {
  const snake = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 2 },
  ];
  // Head at corner (0,0): up/left are walls, right (1,0) is the neck, down (0,1) is body (not the tail).
  const s = board(snake, { x: 5, y: 5 }, 'left', 6);
  assert.equal(chooseMove(s), null);
});

test('autoSteer replaces any queued turns with the chosen move', () => {
  const s = board([{ x: 1, y: 2 }, { x: 0, y: 2 }], { x: 1, y: 5 });
  s.queue.push(DIRS.up);
  autoSteer(s);
  assert.deepEqual(s.queue, [DIRS.down]);
});

test('autoSteer queues nothing when continuing straight is best', () => {
  const s = board([{ x: 1, y: 2 }, { x: 0, y: 2 }], { x: 4, y: 2 });
  autoSteer(s);
  assert.deepEqual(s.queue, []);
});

test('autoSteer leaves the state alone when trapped', () => {
  const snake = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 2 },
  ];
  const s = board(snake, { x: 5, y: 5 }, 'left');
  autoSteer(s);
  assert.deepEqual(s.queue, []);
});

test('on a full game the autopilot fills most of the board without dying', () => {
  let seed = 42;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const s = createState(GRID, random);
  let result = 'moved';
  for (let i = 0; i < 20000 && (result === 'moved' || result === 'ate'); i++) {
    autoSteer(s);
    result = step(s, random);
  }
  assert.ok(s.score >= 300, `scored ${s.score} (ended with ${result})`);
});

test('the Snake page loads the autopilot and has an autoplay toggle', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
  const logic = html.indexOf('<script src="logic.js"></script>');
  const auto = html.indexOf('<script src="autopilot.js"></script>');
  assert.ok(logic !== -1 && auto > logic, 'autopilot.js loads after logic.js');
  assert.match(html, /<button id="autoplay"[^>]*aria-pressed="false"[^>]*>Autoplay: Off<\/button>/);
});
