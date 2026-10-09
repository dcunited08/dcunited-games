# dcunited-games
Games that run in the browser

Open `index.html` to see the list of games. Each game lives in `games/<name>/index.html` as plain HTML, CSS and JavaScript with no build step, so you can open it straight from disk.

## Games
- [Snake](games/snake/index.html): arrow keys or WASD to move, Space or P to pause, swipe on touch screens.

## Playing online

Every push to `main` publishes the repo to GitHub Pages at
https://dcunited08.github.io/dcunited-games/ via `.github/workflows/pages.yml`.
The root `index.html` is the landing page; each game lives in `games/<name>/index.html`
and is reachable at `/games/<name>/`.

One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
