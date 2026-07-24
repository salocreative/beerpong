# Beer Pong Event Platform

Live tournament board for a King-of-the-Hill beer pong night: registration via QR, TV big screen, mobile status, and an unlisted admin desk.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Supabase (Postgres + Realtime + Storage)
- HashRouter for GitHub Pages
- No auth — admin is `#/admin`

## Setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Copy `.env.example` → `.env` and fill in:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Install and run:

```bash
npm install
npm run dev
```

## Routes

| Route | Purpose |
|---|---|
| `#/` | Big screen display |
| `#/register?event=<id>` | Team registration (QR target) |
| `#/status` | Mobile leaderboard / queue / rules |
| `#/admin` | Desk control (unlisted) |

## Night-of flow

1. Open `#/admin` → create event → print/show the registration QR.
2. Teams register on phones.
3. Run the physical “first to sink” seeding game offline.
4. In **Registration & Seeding**, order teams and hit **Start tournament**.
5. On **Live**, click the winner after each game (only write path during play).
6. Toggle timer / end times in **Settings** as needed. **End event** freezes results.

## Deploy (GitHub Pages)

1. Add repository secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. Push to `main` — the workflow builds and publishes the `gh-pages` branch.
3. Repo Settings → Pages → **Deploy from a branch** → Branch: **`gh-pages`** / `/ (root)`.

Site URL: `https://<user>.github.io/beerpong/`

`vite.config.ts` sets `base: '/beerpong/'`. Change that if the repo name differs.

Manual deploy alternative:

```bash
npm run deploy
```

## Notes

- Timers are visual only — they never auto-pick a winner.
- Score = wins only. Estimated cans = `games_played * 2` (display only).
- Match/queue transitions go through `start_tournament` and `complete_match` RPCs.
- End night with `end_event` (pauses timers). Wipe teams/matches with `reset_event`.
