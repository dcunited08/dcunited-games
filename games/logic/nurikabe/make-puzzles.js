// Offline: node games/logic/nurikabe/make-puzzles.js  (rewrites puzzles.js)
const fs = require('node:fs');
const G = require('./generator.js');

if (require.main === module) {
  const set = G.buildPuzzleSet({ easy: 17, medium: 17, hard: 16 }, 1);
  fs.writeFileSync(`${__dirname}/puzzles.js`, G.puzzlesSource(set));
}
