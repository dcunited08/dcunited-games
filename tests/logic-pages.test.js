const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const logicDir = path.join(root, 'games', 'logic');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

// Returns a list of problems with a puzzle page's HTML (empty when fine).
function checkPuzzlePage(html) {
  const problems = [];
  const need = (needle, label) => { if (!html.includes(needle)) problems.push(`missing ${label}`); };
  need('<link rel="stylesheet" href="../../shared.css">', 'shared.css link');
  need('<link rel="stylesheet" href="../logic.css">', 'logic.css link');
  need('<a class="back-link" href="../index.html">← Logic puzzles</a>', 'back link to the Logic hub');
  need('<a class="home-link" href="../../../index.html">All games</a>', 'home link');
  const h1 = html.indexOf('<h1');
  for (const cls of ['back-link', 'home-link']) {
    const at = html.indexOf(`class="${cls}"`);
    if (at === -1 || h1 === -1 || at > h1) problems.push(`${cls} must come before the <h1>`);
  }
  if (/--bg\s*:/.test(html)) problems.push('defines --bg');
  return problems;
}

const goodPage = `<!doctype html><html><head>
<link rel="stylesheet" href="../../shared.css">
<link rel="stylesheet" href="../logic.css">
</head><body>
<nav class="crumbs">
  <a class="back-link" href="../index.html">← Logic puzzles</a>
  <a class="home-link" href="../../../index.html">All games</a>
</nav>
<h1>Puzzle</h1></body></html>`;

test('checkPuzzlePage accepts a correct page', () => {
  assert.deepEqual(checkPuzzlePage(goodPage), []);
});

test('checkPuzzlePage flags each kind of problem', () => {
  assert.ok(checkPuzzlePage(goodPage.replace('../logic.css', 'x.css')).some((p) => /logic\.css/.test(p)));
  assert.ok(checkPuzzlePage(goodPage.replace('../../shared.css', 'x.css')).some((p) => /shared\.css/.test(p)));
  assert.ok(checkPuzzlePage(goodPage.replace('← Logic puzzles', 'Back')).some((p) => /back link/.test(p)));
  assert.ok(checkPuzzlePage(goodPage.replace('>All games<', '>Home<')).some((p) => /home link/.test(p)));
  assert.ok(checkPuzzlePage(goodPage.replace('<h1>Puzzle</h1>', '')).length > 0);
  const late = goodPage.replace('<h1>Puzzle</h1>', '').replace('<nav', '<h1>x</h1><nav');
  assert.ok(checkPuzzlePage(late).some((p) => /before the <h1>/.test(p)));
  const noLinks = goodPage.replace(/<nav[\s\S]*<\/nav>/, '');
  assert.ok(checkPuzzlePage(noLinks).some((p) => /before the <h1>/.test(p)));
  assert.ok(checkPuzzlePage(goodPage.replace('</head>', '<style>:root{--bg: red}</style></head>')).includes('defines --bg'));
});

test('logic hub exists, links home and loads the shared theme', () => {
  const hub = read('games', 'logic', 'index.html');
  assert.match(hub, /<a class="back-link" href="\.\.\/\.\.\/index\.html">← All games<\/a>/);
  assert.match(hub, /<link rel="stylesheet" href="\.\.\/shared\.css">/);
  assert.match(hub, /<ul class="grid">/);
  assert.doesNotMatch(hub, /--bg\s*:/);
});

test('home page has a single Logic puzzles card', () => {
  const home = read('index.html');
  assert.match(home, /<a class="game-card" href="games\/logic\/index\.html"/);
  assert.match(home, /Logic puzzles/);
  assert.equal((home.match(/games\/logic\//g) || []).length, 1);
});

test('logic.css defines the shared puzzle styles', () => {
  const css = read('games', 'logic', 'logic.css');
  for (const sel of ['.crumbs', '.home-link', '.puzzle-board', '.cell', '.cell.selected', '.cell.given', '.cell.error', '.toolbar', '.tool', '.numpad', '.key', '.status']) {
    const escaped = sel.replace(/\./g, '\\.');
    assert.match(css, new RegExp(`${escaped}[^{]*\\{`), `${sel} rule`);
  }
  assert.doesNotMatch(css, /--bg\s*:/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /user-select:\s*none/);
});

const hub = read('games', 'logic', 'index.html');
const puzzles = fs.readdirSync(logicDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(logicDir, d.name, 'index.html')))
  .map((d) => d.name);

for (const name of puzzles) {
  const html = read('games', 'logic', name, 'index.html');
  test(`logic/${name}: page head and top links follow the layout contract`, () => {
    assert.deepEqual(checkPuzzlePage(html), []);
  });
  test(`logic/${name}: has a card on the Logic hub`, () => {
    assert.ok(hub.includes(`<a class="game-card" href="${name}/index.html"`));
  });
}
