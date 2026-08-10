# Dad Jokes API

> *"Where every punchline is a groan-worthy masterpiece."*

A full-stack web application built with **React**, **Node.js/Express**, **TypeScript**, and **PostgreSQL**. Nearly zero hardcoded HTML, almost everything is dynamically generated with JavaScript. The theme? The most groan-inducing, eye-rolling, "dad is that you?" humor on the internet.

---

## Table of Contents

- [What This Project Is](#what-this-project-is)
- [How It Works (High-Level)](#how-it-works-high-level)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [File-by-File Explanation](#file-by-file-explanation)
- [API Endpoints](#api-endpoints)
- [How the Pieces Connect](#how-the-pieces-connect)
- [Production Features](#production-features)
- [Docker](#docker)
- [CI/CD](#cicd)
- [Common Issues](#common-issues)
- [What's Next (Testing)](#whats-next-testing)

---

## What This Project Is

This is a website where you can:

1. **Get a random dad joke** and reveal its punchline
2. **Browse jokes** by category (puns, animals, food, science, etc.)
3. **Vote** on jokes (👍 or 👎)
4. **Submit your own** dad jokes
5. **See stats** about all the jokes in the database

It has a flashy dark theme with animations, confetti, floating emojis, and neon colors.

---

## How It Works (High-Level)

```
┌─────────────────────┐        HTTP requests         ┌─────────────────────┐
│                     │   ───────────────────────►   │                     │
│   YOUR BROWSER      │   GET /api/jokes/random      │   NODE.JS SERVER    │
│   (React Frontend)  │   ◄───────────────────────   │   (Express + TS)    │
│   localhost:5173    │        JSON response         │   localhost:3001    │
│                     │                               │                     │
└─────────────────────┘                               └─────────┬───────────┘
                                                                │
                                                       SQL queries
                                                                │
                                                       ┌────────▼───────────┐
                                                       │                    │
                                                       │   POSTGRESQL DB    │
                                                       │   dad_jokes        │
                                                       │   tables: jokes,   │
                                                       │   votes            │
                                                       └────────────────────┘
```

- **Your browser** runs React (the UI). When you click "Reveal Punchline", the UI sends a request to the server.
- **The server** (Node.js + Express) receives the request, asks PostgreSQL for data, and sends it back as JSON.
- **PostgreSQL** stores all the jokes and votes. It's like a filing cabinet for jokes.

---

## Tech Stack

| Layer | Technology | What It Does |
|-------|-----------|-------------|
| **Frontend** | React 18 + TypeScript | Builds the user interface you see and click on |
| **Build Tool** | Vite | Blazing-fast dev server that compiles your React code |
| **Backend** | Node.js + Express | Receives requests from the browser, talks to the database |
| **Language** | TypeScript | JavaScript with type safety, catches errors before they happen |
| **Database** | PostgreSQL | Stores all jokes, votes, and categories |
| **Styling** | Pure CSS | All visual design, no CSS frameworks needed |

---

## Getting Started

### Prerequisites

You need these installed on your computer:

- **Node.js** (v18 or newer): [Download here](https://nodejs.org)
- **PostgreSQL**: [Download here](https://www.postgresql.org/download/)
- A code editor like **VS Code**: [Download here](https://code.visualstudio.com)

### Step 1: Open a terminal

On Mac: press `Cmd + Space`, type "Terminal", press Enter.

### Step 2: Navigate to the project

```bash
cd /path/to/dad-jokes-api
```

### Step 3: Install everything

```bash
npm run setup
```

This installs all the JavaScript packages the project needs. It takes about 30 seconds.

### Step 4: Start PostgreSQL

```bash
# Mac (Homebrew)
brew services start postgresql

# Windows: it usually starts automatically
# Linux
sudo systemctl start postgresql
```

### Step 5: Create the database

```bash
npm run db:init
```

This creates the "dad_jokes" database and its tables (like building empty shelves in a library).

### Step 6: Fill it with jokes

```bash
npm run db:seed
```

This puts 30 pre-written dad jokes into the database (like filling those shelves with books).

### Step 7: Start the app

```bash
npm run start
```

### Step 8: Open your browser

Go to **http://localhost:5173**, enjoy the groans!

---

## Project Structure

```
dad-jokes-api/                    ← Root folder
│
├── package.json                  ← Root scripts (setup, start, etc.)
├── .gitignore                    ← Tells git which files to ignore
├── README.md                     ← This file you're reading right now
├── TESTING.md                    ← Testing guide
├── Dockerfile                    ← Docker build configuration
├── docker-compose.yml            ← Docker Compose for app + database
├── .github/
│   └── workflows/
│       └── ci.yml                ← GitHub Actions CI/CD pipeline
│
├── server/                       ← Backend (Node.js + Express)
│   ├── package.json              ← Server dependencies
│   ├── tsconfig.json             ← TypeScript configuration for server
│   ├── .env                      ← Secret database connection settings
│   ├── .env.example              ← Template for .env (safe to share)
│   └── src/
│       ├── index.ts              ← Server entry point (starts everything)
│       ├── types/
│       │   └── index.ts          ← TypeScript type definitions
│       ├── config/
│       │   └── env.ts            ← Environment variable validation
│       ├── db/
│       │   ├── pool.ts           ← Database connection manager
│       │   ├── init.ts           ← Creates database + tables
│       │   └── seed.ts           ← Fills database with sample jokes
│       ├── routes/
│       │   └── jokes.ts          ← API route handlers
│       ├── validation/
│       │   └── jokeSchema.ts     ← Zod validation schemas
│       └── middleware/
│           ├── errorHandler.ts   ← Catches and handles errors
│           └── rateLimiter.ts    ← Rate limiting middleware
│
└── client/                       ← Frontend (React + TypeScript)
    ├── package.json              ← Client dependencies
    ├── tsconfig.json             ← TypeScript configuration for client
    ├── tsconfig.node.json        ← TypeScript config for Vite
    ├── vite.config.ts            ← Vite build tool configuration
    ├── index.html                ← The single HTML page React lives inside
    └── src/
        ├── main.tsx              ← Client entry point (mounts React)
        ├── App.tsx               ← Main app component (tab navigation)
        ├── vite-env.d.ts         ← Vite type declarations
        ├── styles/
        │   └── global.css        ← All visual styling
        ├── hooks/
        │   ├── useJokes.ts       ← Functions to talk to the server API
        │   ├── useRandomJoke.ts  ← Hook that fetches random jokes
        │   └── useTheme.ts       ← Dark/light theme hook
        └── components/
            ├── Header.tsx         ← Top banner with title
            ├── JokeCard.tsx       ← Main random joke display card
            ├── JokeList.tsx       ← Scrollable list of jokes
            ├── CategoryPicker.tsx ← Category filter buttons
            ├── JokeSubmitter.tsx  ← Form to submit new jokes
            ├── StatsPanel.tsx     ← Dashboard with statistics
            ├── Particles.tsx      ← Floating emoji background
            ├── Marquee.tsx        ← Scrolling joke ticker
            ├── Confetti.tsx       ← Confetti animation
            ├── Toast.tsx          ← Pop-up notification messages
            ├── ErrorBoundary.tsx  ← Catches component tree errors
            ├── ThemeToggle.tsx    ← Dark/light theme toggle button
            └── Skeleton.tsx       ← Shimmer loading placeholders
```

---

## File-by-File Explanation

### Root Level

#### `package.json`
The "control panel" for the whole project. Defines:
- **`scripts`**: Commands you can run (`npm run setup`, `npm run start`, etc.)
- **`concurrently`**: Lets the server and client run at the same time

#### `.gitignore`
Tells git "don't track these files." We ignore `node_modules/` (huge, regenerated), `.env` (has passwords), and `.DS_Store` (macOS junk).

---

### Server Files (`server/`)

#### `server/src/index.ts`: The Server's Front Door
This is where the server starts. It:
1. Creates an Express app (like opening a restaurant)
2. Enables CORS (lets the browser connect)
3. Reads `.env` for settings
4. Connects the jokes routes (the menu)
5. Starts listening on port 3001

#### `server/src/types/index.ts`: The Blueprints
Defines what a "joke" looks like in TypeScript. Think of it as a form template:
- `id`: A unique number
- `setup`: The first part of the joke
- `punchline`: The funny ending
- `category`: What type of joke (puns, animals, etc.)
- `groan_level`: How cringe-worthy (1-10)
- `upvotes`/`downvotes`: How many people liked/disliked it

#### `server/src/db/pool.ts`: Database Connection
Creates a connection to PostgreSQL. Think of `pool` as a taxi stand, it keeps a few database connections ready so you don't have to wait for a new one each time.

#### `server/src/db/init.ts`: Database Setup Script
Run once with `npm run db:init`. It:
1. Connects to PostgreSQL
2. Creates the "dad_jokes" database if it doesn't exist
3. Creates the `jokes` table (where jokes live)
4. Creates the `votes` table (where votes live)
5. Adds indexes (like a book's index for faster lookups)

#### `server/src/db/seed.ts`: Fills Database with Jokes
Run once with `npm run db:seed`. Puts 30 pre-written dad jokes into the database with random vote counts.

#### `server/src/routes/jokes.ts`: The API Menu
Defines all the URLs the server responds to:

| URL | What It Does |
|-----|-------------|
| `GET /api/jokes` | List all **approved** jokes |
| `GET /api/jokes/random` | Get one random **approved** joke |
| `GET /api/jokes/categories` | List all categories (approved jokes only) |
| `GET /api/jokes/stats` | Get statistics (approved jokes only, plus `pending_count`) |
| `GET /api/jokes/pending` 🔒 | List jokes awaiting moderation (admin only) |
| `GET /api/jokes/:id` | Get one specific **approved** joke |
| `POST /api/jokes` | Submit a new joke, lands as `status: "pending"`, not yet public |
| `POST /api/jokes/vote` | Upvote or downvote (approved jokes only) |
| `POST /api/jokes/:id/approve` 🔒 | Approve a pending joke, making it public (admin only) |
| `POST /api/jokes/:id/reject` 🔒 | Reject a pending joke, kept in the DB, stays non-public (admin only) |
| `DELETE /api/jokes/:id` 🔒 | Delete a joke (admin only) |

🔒 = requires the `x-admin-token` header to match the server's `ADMIN_TOKEN` env var.

**Moderation queue:** every joke submitted via `POST /api/jokes` starts as `status: "pending"`
and is invisible to the public API until an admin approves it. This closes the old gap where
any submission (including spam) went straight to the live, votable joke list. See
`client/src/components/ModerationQueue.tsx` for the admin review UI (the "Moderate" tab).

#### `server/src/middleware/errorHandler.ts`: The Safety Net
Catches any errors that crash the server and returns a friendly message instead of a blank screen.

---

### Client Files (`client/`)

#### `client/src/main.tsx`: React's Starting Line
Tells React "find the `<div id="root">` in index.html and put the App component inside it."

#### `client/src/App.tsx`: The Main Controller
Decides which tab is active and renders the right component:
- "Random Joke" tab → `JokeCard`
- "Browse" tab → `CategoryPicker` + `JokeList`
- "Submit" tab → `JokeSubmitter`
- "Stats" tab → `StatsPanel`
- "Moderate" tab → `ModerationQueue` (admin-token-gated review of pending submissions)

Also renders `Particles` (floating emojis) and `Marquee` (scrolling ticker) in the background.

#### `client/src/hooks/useJokes.ts`: The Server Messenger
Contains functions that talk to the server. When the UI says "get me a random joke," this file makes the actual HTTP request:
- `fetchRandomJoke()` → GET `/api/jokes/random`
- `fetchJokes()` → GET `/api/jokes`
- `voteJoke()` → POST `/api/jokes/vote`
- `submitJoke()` → POST `/api/jokes`
- `fetchStats()` → GET `/api/jokes/stats`
- `fetchPendingJokes()` → GET `/api/jokes/pending` (admin)
- `approveJoke()` / `rejectJoke()` → POST `/api/jokes/:id/approve` / `/api/jokes/:id/reject` (admin)

#### `client/src/hooks/useRandomJoke.ts`: The Random Joke Hook
A custom React hook that:
1. Fetches a random joke when the component loads
2. Tracks loading/error states
3. Provides a `refresh()` function to get a new joke

#### Components

| Component | What It Renders |
|-----------|----------------|
| `Header.tsx` | The big title at the top with neon gradient text |
| `JokeCard.tsx` | The main joke display, setup, punchline reveal, voting, confetti |
| `JokeList.tsx` | A scrollable list of jokes you can click to expand |
| `CategoryPicker.tsx` | Buttons to filter jokes by category |
| `JokeSubmitter.tsx` | A form to submit new jokes with a groan-level slider |
| `StatsPanel.tsx` | A dashboard showing total jokes, votes, categories |
| `Particles.tsx` | Floating emoji animations in the background |
| `Marquee.tsx` | A horizontally scrolling ticker of joke one-liners |
| `Confetti.tsx` | Fires colorful confetti pieces on screen |
| `Toast.tsx` | Pop-up notification messages at the bottom of the screen |

#### `client/src/styles/global.css`: All the Visual Magic
Every pixel of styling lives here: the dark neon theme, animations, glassmorphism cards, responsive layout, floating particles, and confetti. Over 1400 lines of pure CSS.

---

## How the Pieces Connect

### A Typical User Interaction:

1. You open `localhost:5173` in your browser
2. React loads `main.tsx` → `App.tsx` → `Header` + `JokeCard`
3. `JokeCard` calls `useRandomJoke()` hook
4. The hook calls `fetchRandomJoke()` from `useJokes.ts`
5. That function makes an HTTP request to `localhost:3001/api/jokes/random`
6. The Express server receives it, runs a SQL query: `SELECT * FROM jokes ORDER BY RANDOM() LIMIT 1`
7. PostgreSQL returns a random joke
8. The server sends it back as JSON
9. The hook receives it, React re-renders the joke on screen
10. You click "Reveal the Punchline", this is pure UI, no server needed
11. You click 👍, the UI calls `voteJoke()` → sends POST to server → server updates the database

---

## Production Features

### Error Boundary (Client)
`client/src/components/ErrorBoundary.tsx` catches JavaScript errors anywhere in the component tree, preventing a single broken component from crashing the entire app. Shows a styled fallback UI with a reload button.

### Rate Limiting (Server)
`server/src/middleware/rateLimiter.ts` protects the API from abuse:
- **General API**: 100 requests per 15 minutes per IP
- **Voting**: 30 votes per 15 minutes per IP (stricter limit)

### Input Validation (Server)
`server/src/validation/jokeSchema.ts` uses Zod to validate all incoming data:
- Joke submissions: setup (5-500 chars), punchline (2-500 chars), category, groan level (1-10), author
- Votes: joke_id (positive integer), vote_type ("up" or "down")
- Rejects bad data early with helpful error messages

### Dark/Light Theme Toggle (Client)
`client/src/components/ThemeToggle.tsx` lets users switch between dark and light themes. Preference is saved to localStorage and persists across sessions.

### Skeleton Loading (Client)
`client/src/components/Skeleton.tsx` shows shimmer placeholders while content loads, better UX than a spinner because it shows the shape of incoming content.

### Environment Validation (Server)
`server/src/config/env.ts` validates that all required environment variables are set at startup. Fails fast with a clear error instead of mysterious crashes later.

---

## Docker

### Quick Start with Docker Compose
```bash
docker-compose up --build
```

This starts PostgreSQL and the app together. The app will be available at `http://localhost:3001`.

### Standalone Docker Build
```bash
docker build -t dad-jokes-api .
docker run -e DB_HOST=host.docker.internal dad-jokes-api
```

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push to `main`/`dev` and on PRs to `main`:
- Spins up a PostgreSQL 16 service container
- Installs and tests both server and client
- Uses Node.js 20

---

## Common Issues

### "Connection refused" when running `db:init`
PostgreSQL isn't running. Start it with `brew services start postgresql` (Mac).

### "Role 'postgres' does not exist"
Homebrew PostgreSQL uses your Mac username, not "postgres." Check the `.env` file has `DB_USER=landonkea` (your username).

### Port 5173 already in use
Another process is using that port. Kill it with:
```bash
kill $(lsof -t -i:5173)
```

### "Module not found" errors
Run `npm run setup` again to reinstall dependencies.

---

## What's Next (Testing)

Planned testing additions:

- **Unit Tests**: Test individual functions in isolation (e.g., "does `fetchRandomJoke` return a joke?")
- **Integration Tests**: Test that components work together (e.g., "does voting update the count?")
- **TDD (Test-Driven Development)**: Write tests first, then write code to pass them
- **BDD (Behavior-Driven Development)**: Write tests in plain English that non-coders can read

Testing frameworks to be added:
- **Jest** + **React Testing Library** (frontend)
- **Vitest** (Vite-native testing)
- **Supertest** (API endpoint testing)
- **Cypress** or **Playwright** (end-to-end browser testing)

---

## License

Do whatever you want with it. Just don't tell your kids these jokes at bedtime, they'll never sleep.
