# landonkea-dad-jokes-api - Design & Workflow

## High-Level Overview

```mermaid
graph TB
    subgraph "Client (React)"
        A[App.tsx] --> B[JokeCard]
        A --> C[JokeList]
        A --> D[JokeSubmitter]
        A --> E[StatsPanel]
        A --> F[ModerationQueue]
    end

    subgraph "Server (Express)"
        G[index.ts] --> H[routes/jokes.ts]
        H --> I[db/pool.ts]
        H --> J[validation/jokeSchema.ts]
        H --> K[middleware/]
    end

    subgraph "Database"
        I --> L[(PostgreSQL)]
        L --> M[jokes table]
        L --> N[votes table]
    end

    B -->|HTTP| H
    C -->|HTTP| H
    D -->|HTTP| H
    E -->|HTTP| H
    F -->|HTTP| H
```

## API Request Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Express Server
    participant DB as PostgreSQL

    B->>S: GET /api/jokes/random
    S->>DB: SELECT * FROM jokes ORDER BY RANDOM() LIMIT 1
    DB-->>S: Random joke
    S-->>B: JSON response
    B->>B: Display joke
    B->>S: POST /api/jokes/vote
    S->>DB: INSERT INTO votes
    DB-->>S: Vote recorded
    S-->>B: Vote count updated
```

## Moderation Flow

```mermaid
flowchart TD
    A[User submits joke] --> B[POST /api/jokes]
    B --> C[status: pending]
    C --> D[Not visible publicly]
    D --> E[Admin opens Moderate tab]
    E --> F{Approve or Reject?}
    F -->|Approve| G[status: approved]
    F -->|Reject| H[status: rejected]
    G --> I[Visible in Browse/Random]
    H --> J[Hidden from public]
```

## File Relationships

| File | Purpose | Used By |
|------|---------|---------|
| `server/src/index.ts` | Server entry | Node.js |
| `server/src/routes/jokes.ts` | API routes | Express |
| `server/src/db/pool.ts` | DB connection | Routes |
| `server/src/db/init.ts` | Create tables | `npm run db:init` |
| `server/src/db/seed.ts` | Seed jokes | `npm run db:seed` |
| `client/src/App.tsx` | Main UI | Vite |
| `client/src/hooks/useJokes.ts` | API calls | Components |
| `docker-compose.yml` | Container setup | Docker |

## draw.io

[Open in draw.io](https://app.diagrams.net/#RDad%20jokes%20architecture)
