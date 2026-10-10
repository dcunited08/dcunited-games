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
