# dcunited-games
Games that run in the browser

Open `index.html` to see the list of games. Each game lives in `games/<name>/index.html` as plain HTML, CSS and JavaScript with no build step, so you can open it straight from disk.

## Games
- [Snake](games/snake/index.html): arrow keys or WASD to move, Space or P to pause, swipe on touch screens.

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
