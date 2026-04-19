# 40 Greatest Innovations – Ordering Game

A web-based card-ordering game where players arrange the 40 greatest innovations of all time in chronological order.

## Gameplay

1. **Deck** — all 40 invention cards start here, shuffled.
2. **Board** — 40 numbered slots (#1 = oldest, #40 = newest). Drag or click a card to place it.
3. **Later** — a holding area for cards you want to come back to.
4. When ready, press **Check Answers** to score your board (scored only on submit — no hints during play).

### Controls

| Action | How |
|---|---|
| Select a card | Click it |
| Place selected card | Click an empty or occupied slot |
| Swap two placed cards | Click one → click the other (or drag) |
| Save for Later | Select card → click "Save for Later" in the action bar |
| Return to Deck | Select card → click "Return to Deck" |
| Drag & drop | Drag any card to a slot, the Later zone, or the Deck zone |
| Touch drag | Tap & hold, then drag to destination |
| Cancel selection | Press Escape, or click "✕ Cancel" |

## Running locally

```bash
npm install
npm start        # serves http://localhost:3000
```

## Running tests

```bash
npm test         # pure state-management unit tests, no browser needed
```

## Extracting card images (optional — pre-extracted PNGs are committed)

```bash
npm install sharp    # one-time
node scripts/extract-cards.js
```

## Deploying to Netlify

The `netlify.toml` configures the `public/` folder as the publish directory.  
Push to your connected repository and Netlify will deploy automatically.

## Architecture

```
public/
  index.html          — single-page app shell
  css/styles.css      — all styles (responsive, 3-column layout)
  js/
    data.js           — 40-card dataset (name, year, id)
    game.js           — pure state machine (GameState class)
    app.js            — UI rendering, drag-and-drop, touch support
  images/cards/       — 40 extracted card PNGs (badge & year masked)
scripts/
  extract-cards.js    — Node.js script that generates card images from source JPEG
tests/
  game.test.mjs       — unit tests for GameState
```

## Game rules summary

- Score is revealed **only after pressing Check Answers**.
- Cards in the **Later** zone do not count as placed; move them to the board before submitting.
- A card may be moved freely at any time before submission.
- After submission the board is frozen; press **Play Again** to restart with a fresh shuffle.

## Source

Card rankings from *The 40 Greatest Innovations of All Time* (Startup Guide / NT).
