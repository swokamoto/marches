# Marches

A web app for running **West Marches** tabletop RPG campaigns — the kind where a large group of friends share one living world, play in different combinations, and every session leaves a permanent mark on the map.

Built as a full-stack portfolio project using Node.js, TypeScript, PostgreSQL, and server-rendered HTML.

**[Live demo →](https://marches.fly.dev)**

---

## Background

West Marches is a format where a big group (10–20+ people) all share one campaign world. There's no fixed group and no set schedule — players organise their own sessions, pick who's coming, and head out into the wilderness. When they come back, whatever happened in their session is now part of the world: the monster is dead, the dungeon is looted, the village burned down.

Keeping track of all that across multiple game masters and dozens of players, using just a shared Google Doc, gets messy fast. Marches is a purpose-built tool to manage it properly.

---

## What it does

**Campaigns** — Create a campaign, share an invite code, and everyone who joins gets the right level of access based on their role (admin, GM, or player).

**The world map** — GMs track locations, how they connect, and what state they're in. A forest clearing might start as "unexplored", become "active" once players find it, and end up "ruined" after a battle. Locations can be nested (the dungeon is inside the forest, the throne room is inside the dungeon).

**NPCs and artifacts** — Key characters and objects have their own pages, tracking their current status, description, and where they were last seen.

**Characters** — Players create and manage their own characters within a campaign. GMs can view all characters; players see their own.

**Expeditions** — Before a session, a GM proposes an expedition: where they're going, who's invited, what they're after. The app checks for conflicts — if two GMs are both planning to visit the same location or interact with the same NPC, everyone gets a warning before anyone commits.

**Sessions and reports** — After playing, the GM writes up what happened as a structured report. World changes (new discoveries, NPCs killed, routes opened) get logged and feed into the timeline. Players can add their own private notes.

**Journal** — Anyone can write journal entries attached to any location, NPC, artifact, character, or session. Public entries are visible to the whole campaign; private ones are just for you. GMs can pin notable entries.

**Activity feed** — A live feed of recent campaign actions on the campaign homepage. GM-sensitive entries (new NPCs, locations, artifacts) are hidden from players until the GM is ready to reveal them.

**Timeline** — A chronological view of everything that has happened in the campaign world, ordered by in-game date.

---

## Tech stack

| | |
|---|---|
| **Language** | TypeScript (strict mode) |
| **Backend** | Node.js 22, Express 5 |
| **Database** | PostgreSQL 16, Drizzle ORM |
| **Frontend** | Server-rendered HTML (Nunjucks templates), Tailwind CSS v4, HTMX |
| **Auth** | Session-based login, bcrypt password hashing, CSRF protection |
| **Deployment** | Docker, Fly.io |

There's no React or other frontend framework. Pages are rendered on the server and sent as HTML. HTMX handles the small interactive bits — loading journal entries inline, swapping status badges without a full page reload — without needing a separate API layer.

---

## Technical highlights

**Conflict detection** — Before a GM commits to an expedition, the app queries all scheduled and active expeditions in the same campaign and checks for overlapping targets (locations, NPCs, artifacts). Conflicts surface as warnings so GMs can coordinate before anyone shows up to a location someone else is already running.

**Role-based access control** — Every request goes through middleware that resolves the current user's campaign membership (admin / GM / player / observer). Route handlers and templates use this to gate actions: players can't create locations or NPCs, only GMs can publish session reports, only admins can change campaign settings.

**Visibility system** — GMs create entities (locations, NPCs, artifacts) that are hidden from players until explicitly revealed. The activity feed filters based on role, so players don't see events that would spoil unrevealed content.

**Auth and security** — Session-based login with bcrypt password hashing, CSRF token validation on all state-changing requests, and rate limiting on auth endpoints.

**Integration tests against a real database** — The service layer has integration tests that spin up a dedicated PostgreSQL container, run migrations, and execute queries against actual data. No mocks. This catches things like constraint violations and query edge cases that in-memory stubs miss.

**Data model** — 22 tables, 8 enums, and a self-referential location hierarchy (locations can be nested arbitrarily deep) managed through Drizzle ORM with a typed schema.

---

## Project structure

```
src/
├── routes/      # One file per resource (campaigns, locations, npcs, sessions…)
├── services/    # All database queries and business logic
├── middleware/  # Auth guards, campaign loading, flash messages
└── db/          # Schema (22 tables), migrations, Drizzle client

views/
├── layouts/     # Base HTML shell shared by all pages
├── pages/       # One template per page
└── partials/    # Reusable components (status badges, journal list, etc.)
```

---

## Running locally

You'll need Docker and Node.js 22.

```bash
git clone https://github.com/swokamoto/marches
cd marches
npm install

# Start the database
docker compose up db -d

# Set up environment variables
cp .env.example .env
# Open .env and set SESSION_SECRET to any long random string

# Apply the database schema
npm run db:migrate

# Start the dev server
npm run dev
```

The app will be running at `http://localhost:3000`.

---

## Testing

```bash
# Unit tests (no database required)
npm test

# Integration tests (requires Docker)
docker compose up test-db -d
npm run test:integration
```

Unit tests cover pure utility functions (`slugify`, `calcCampaignDay`) and route input validation rules. Integration tests run against a real PostgreSQL instance (`marches_test` on port 5433) and cover the auth, campaign, and location service layers end-to-end.

The integration test database is managed by Docker (`test-db` service) and uses an in-memory volume so it stays clean between runs. Migrations are applied automatically before the test suite starts.

---

## Deployment

Configured for [Fly.io](https://fly.io) with a managed Postgres database.

```bash
fly auth login
fly launch --no-deploy
fly postgres create
fly postgres attach <pg-app-name>
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"
fly deploy
```

The Docker build compiles TypeScript, bundles CSS, and produces a lean production image. Database migrations run automatically when the container starts.

---

## About

Built by [Scott Okamoto](https://scott-portfolio-azure.vercel.app/) — [GitHub](https://github.com/swokamoto) · [LinkedIn](https://www.linkedin.com/in/sokamoto/)

---

## License

MIT
