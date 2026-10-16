# dcunited-games
Games that run in the browser

Open `index.html` to see the list of games. Each game lives in `games/<name>/index.html` as plain HTML, CSS and JavaScript with no build step, so you can open it straight from disk.

## Games
- [Snake](games/snake/index.html): arrow keys or WASD to move, Space or P to pause, swipe on touch screens, T (or the Autoplay button) to let the snake steer itself.
- [Chickens vs Pigs](games/chickens-vs-pigs/index.html): checkers on the farm. Play a friend on one device or the computer (Easy, Medium, Hard). Tap a piece, then where it goes; jumps are required, and reaching the far row crowns a Rooster or a Boar.
- [Wars of the Roses](games/wars-of-the-roses/index.html): tic tac toe as York (white rose) vs Lancaster (red rose). Play a friend or the computer (Easy, Medium, Hard) through a best-of-5 campaign of named battles, first to 3 wins the crown (or a level finish gives the Tudor rose), or fight a single battle. Arrow keys and Enter or Space also work.

## Tests

Game rules live in plain JS modules next to each game (for example `games/snake/logic.js`), separate from the canvas and DOM code, and are tested with Node's built-in test runner. No dependencies to install:

```
npm test        # or: node --test
```

`npm test` also measures coverage of the game logic and fails if line, branch or function coverage drops below 90% (thresholds live in `package.json`). Tests and the coverage check run on every pull request and push to `main` via `.github/workflows/test.yml`, and the coverage table shows up in the run's summary.

## Playing online

Every push to `main` publishes the repo to GitHub Pages at
https://dcunited08.github.io/dcunited-games/ via `.github/workflows/pages.yml`.
The root `index.html` is the landing page; each game lives in `games/<name>/index.html`
and is reachable at `/games/<name>/`.

One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
