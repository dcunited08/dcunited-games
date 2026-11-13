// Offline: node games/logic/logic-grid/make-puzzles.js  (rewrites puzzles.js)
const fs = require('node:fs');
const G = require('./generator.js');

function build() {
  return G.buildPuzzleSet({ easy: 17, medium: 17, hard: 16 }, 1);
}

if (require.main === module) {
  fs.writeFileSync(`${__dirname}/puzzles.js`, G.puzzlesSource(build()));
}

module.exports = { build };
