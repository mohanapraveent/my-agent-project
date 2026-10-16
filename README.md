# Pulse Lock

A compact, one-mechanic reflex game. A ring expands outward from the center of the
stage; a glowing band marks a target radius. Click/tap the stage or press **Space**
the instant the ring sits inside the band — the closer to dead-center, the more
points. Eight pulses per round, then it's over. Save your name to the durable
high-score table and play again.

## How scoring works

Each of the 8 pulses places a target band at a random radius and width (bands
narrow slightly as rounds progress, and the ring speeds up). The moment you lock
in, the game measures the distance between the ring's current radius and the
exact center of that band:

- Locking exactly on the band's center scores **100** points for that pulse.
- Scores fall off linearly the farther off-center the lock is, down to 0 at the
  band's edges.
- Locking outside the band, or letting the ring pulse all the way out without
  locking at all, scores **0** for that pulse.

Total score is the sum across all 8 pulses (max **800**). The number shown at the
end of the round is exactly the number saved to the leaderboard — the client
computes it from the same rule the server validates against (0-800, integer),
so displayed and saved results always match.

## Run it

From this directory:

```bash
npm install
npm start
```

This starts the server in the foreground on `PORT` (default `3000`). Open
`http://localhost:3000/` to play.

## Persistence

Scores are stored durably in `data/scores.json` on disk (created on first run,
written via a temp-file-then-rename so a crash mid-write can't corrupt the
file). The file survives server restarts; nothing is kept only in memory.

## API

- `GET /api/config` — round count and scoring bounds used by the client.
- `GET /api/scores` — top 10 scores, highest first.
- `POST /api/scores` — body `{ "name": string (1-20 chars), "score": integer (0-800) }`.
  Returns `201` with the saved entry and the refreshed leaderboard, or `400` with
  a clear `error` message for a missing/invalid field (non-string name, empty or
  over-length name, non-integer score, or score outside the valid range).

All API responses include open CORS headers (including the `OPTIONS` preflight)
so the page can call the API from a sandboxed, cross-origin embed. No cookies,
`localStorage`, or other browser storage are used — all game state lives either
transiently in page memory during play or durably on the server once a score is
saved.

## Hosting notes

- Every asset and API call the page makes is a relative URL (`style.css`,
  `game.js`, `api/scores`, …), so the game works unmodified both at the site
  root and behind a reverse proxy path prefix (e.g. `/proxy/<port>/`), and when
  embedded at `/play/app/` under a sandboxed, opaque-origin iframe.
- The page needs no cookies, auth headers, or other origin-bound browser
  storage, matching a host that strips `Cookie`/`Authorization`/`Set-Cookie`.
- The name-save form uses `submit` + `event.preventDefault()` + `fetch`
  (compatible with a sandbox that allows forms but blocks native navigation),
  and the Save button disables itself during the request and after a
  successful save so repeated clicks or Enter presses cannot create duplicate
  leaderboard entries; a failed save re-enables the button for a deliberate
  retry.
- Space-to-lock is ignored while an input/textarea has focus, so typing a name
  never accidentally triggers gameplay.

## What's deliberately out of scope (reserved for a later Lab 3 change)

Additional stages/modes, difficulty select, and audio are intentionally not
included — this build is one short, complete round around one mechanic, per the
baseline request.
