const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gamesDir = path.join(root, 'games');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const sharedCss = read('games', 'shared.css');
const home = read('index.html');
const games = fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(gamesDir, d.name, 'index.html')))
  .map((d) => d.name);

test('shared.css defines the Sky theme colors', () => {
  const rootBlock = sharedCss.match(/:root\s*\{([^}]*)\}/);
  assert.ok(rootBlock, 'shared.css has a :root block');
  for (const name of ['--bg', '--panel', '--text', '--muted', '--accent', '--on-accent', '--line']) {
    assert.match(rootBlock[1], new RegExp(`${name}\\s*:`), `${name} is defined`);
  }
  assert.match(rootBlock[1], /--bg:\s*#f2f8ff/i);
});

test('the back button uses the theme accent', () => {
  const rule = sharedCss.match(/\.back-link\s*\{([^}]*)\}/)[1];
  assert.match(rule, /background:\s*var\(--accent\)/);
  assert.match(rule, /color:\s*var\(--on-accent\)/);
});

test('home page loads the shared theme and keeps no colors of its own', () => {
  assert.match(home, /<link rel="stylesheet" href="games\/shared\.css">/);
  assert.doesNotMatch(home, /--bg\s*:/);
  assert.doesNotMatch(home, /#10141a/i);
});

for (const name of games) {
  const html = read('games', name, 'index.html');

  test(`${name}: takes its page colors from the shared theme`, () => {
    assert.doesNotMatch(html, /--bg\s*:/);
    assert.doesNotMatch(html, /#10141a/i);
  });

  test(`home page has a card for ${name} linking to its page`, () => {
    const card = new RegExp(`<a class="game-card" href="games/${name}/index\\.html"`);
    assert.match(home, card);
  });
}
