# Rules for Claude in this repo

These rules apply to every Claude session working on this repository.

## Pull requests

- **Claude never merges a pull request, under any circumstances.** Not on "go", "ship it", "merge it", or anything that seems like approval. Claude only opens PRs; Daniel (`dcunited08`) merges every one himself.
- Don't enable auto-merge either, and don't push directly to `main` (it requires PRs).
- Before saying a PR is done, check it for merge conflicts against `main` and resolve them (merge `main` into the branch).
- When the PR is ready (tests pass, no conflicts), mark it **Ready for review** instead of leaving it as a draft.

## Tests (always TDD)

- Write a failing test first, then the code that makes it pass.
- Keep game logic in plain JS modules separate from rendering (for example `games/snake/logic.js` next to `games/snake/index.html`) so it can be tested without a browser.
- Use Node's built-in test runner (`node --test`) with no extra dependencies. Run `npm test`, which also enforces coverage.
- CI (`.github/workflows/test.yml`) fails if line, branch or function coverage drops below the thresholds in `package.json` (currently 90%). New games must be covered too.

## Games

- Each game lives in `games/<name>/index.html` as plain HTML, CSS and JavaScript, with no build step.
- The root `index.html` lists every game; add new games there.
- Every game page must include a visible link back to the main games page (root `index.html`) using a relative link such as `../../index.html`, so it works on GitHub Pages.
