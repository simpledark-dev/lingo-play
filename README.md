# LingoPlay (frontend demo)

A Playok-style multiplayer lobby for language learning (Vietnamese speakers learning English).
This version is frontend only: every other "player" is a simulated bot and all state lives in the browser.

## Run

```bash
npm install
npm run dev      # http://localhost:5183
npm run build    # type-check + production build
```

## What is in the demo

- Login screen with **Play as guest** (random name, 1200 rating).
- Lobby: live room list with filters and search, Quick Play, Create Room, online players (All / Friends / Top Players).
- Two games: **Vocabulary Battle** (multiple choice) and **Listening Rush** (dictation with the browser's text-to-speech).
  Topic, level, rounds, seconds per round and seats are chosen when creating a room.
- Quick reactions in every room (no live chat).
- Ratings (multiplayer Elo), titles from Rookie to Grandmaster, "N more to reach the next title", rankings page.
- Player stats popup (rating, global rank, win rate, streak, skill ratings, rating history, recent games), challenge and add friend.
- Daily Challenge, Learn, Community and Pro are placeholders that say "coming soon".
- Lobby music plays on lobby screens only and fades out inside a room.

## How the simulation works

`src/sim` runs a small world of about 230 bots:

- `seed.ts` creates the bots and the guest. `engine.ts` moves the world forward: bots come online and go offline,
  open rooms, take seats, watch games, invite the human and accept friend requests.
- `rooms.ts` is the game state machine (waiting, countdown, question, reveal, results) plus bot answers and reactions.
- `actions.ts` is everything the human can do. `store.ts` holds the world, saves it to `localStorage`
  (`lingoplay.world.v1`) and replays the time that passed while the tab was closed, so rooms and ratings carry on
  across refreshes. After more than 25 minutes away the lobby is re-dealt instead of replayed.

To start from a clean world, clear the site's local storage.

## Content

- `src/data/vocab.ts`: 180 words (6 topics x 3 levels) with Vietnamese meanings.
- `src/data/sentences.ts`: 180 dictation sentences (6 topics x 3 levels).

## Assets

- `public/assets/logo.png`, `lobby-banner.png`, `side-banner.png`, `game-bg.jpg` come from the `references` folder.
- Icons are `lucide-react` SVGs; rank shields, flags and avatars are drawn in code (`src/ui`). No emoji are used as icons.
- Lobby music candidates by Kevin MacLeod (incompetech.com), licensed under Creative Commons Attribution 4.0:
  - `public/assets/music/lobby.mp3`: "Wallpaper" (current track)
  - `public/assets/music/lobby-time.mp3`: "Lobby Time"
  - `public/assets/music/airport-lounge.mp3`: "Airport Lounge"
  - `public/assets/music/local-forecast-elevator.mp3`: "Local Forecast - Elevator"
  To test a candidate, change the filename passed to `new Audio(...)` in `src/audio/audio.ts`.
