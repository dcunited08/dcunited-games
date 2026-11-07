const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const gamesDir = path.join(root, 'games');
const games = fs.readdirSync(gamesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(gamesDir, d.name, 'index.html')))
  .map((d) => d.name);

test('there is at least one game page', () => {
  assert.ok(games.length > 0);
});

test('the shared back link stylesheet exists', () => {
  const css = fs.readFileSync(path.join(gamesDir, 'shared.css'), 'utf8');
  assert.match(css, /\.back-link\s*\{/);
});

for (const name of games) {
  const html = fs.readFileSync(path.join(gamesDir, name, 'index.html'), 'utf8');

  test(`${name}: has a prominent "All games" back link to the main page`, () => {
    assert.match(html, /<a class="back-link" href="\.\.\/\.\.\/index\.html">← All games<\/a>/);
  });

  test(`${name}: loads the shared stylesheet`, () => {
    assert.match(html, /<link rel="stylesheet" href="\.\.\/shared\.css">/);
  });

  test(`${name}: back link comes before the game content`, () => {
    const link = html.indexOf('class="back-link"');
    assert.ok(link !== -1 && link < html.indexOf('<h1'));
  });
}

// Fit-to-screen layout: every playable game (not the logic hub) uses a
// board-area + panel structure so board and controls fit without scrolling.
for (const name of games.filter((g) => g !== 'logic')) {
  const html = fs.readFileSync(path.join(gamesDir, name, 'index.html'), 'utf8');

  test(`${name}: has a board-area and a panel wrapper`, () => {
    assert.match(html, /<div class="board-area">/);
    assert.match(html, /<div class="panel">/);
  });

  test(`${name}: CSS sizes the board from its container and uses dvh`, () => {
    assert.match(html, /container-type:\s*size/);
    assert.match(html, /100dvh/);
  });

  test(`${name}: back link sits inside the panel, before the h1 and the board-area`, () => {
    const panel = html.indexOf('<div class="panel">');
    const link = html.indexOf('class="back-link"');
    const h1 = html.indexOf('<h1');
    const area = html.indexOf('<div class="board-area">');
    assert.ok(panel !== -1 && panel < link);
    assert.ok(link < h1);
    assert.ok(link < area);
  });
}
