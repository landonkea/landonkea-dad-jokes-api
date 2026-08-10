// Builds and exports the configured Express app, WITHOUT starting it listening on a port.
// Split out of index.ts so integration tests (see __tests__/*.integration.test.ts) can import
// the exact same app, middleware, routers, error handler and all, via supertest, instead of
// re-declaring a partial copy that could drift from what actually runs in production.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import fs from "fs";
import jokesRouter from "./routes/jokes";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";

const app = express();

// Security headers on every response.
app.use(helmet());
// Allow the React frontend (or anyone) to call this API cross-origin.
app.use(cors());
// Gzip response bodies.
app.use(compression());
// Parse JSON request bodies.
app.use(express.json());
// Rate limit all /api routes.
app.use("/api", apiLimiter);
// Mount the jokes routes.
app.use("/api/jokes", jokesRouter);

// Health check endpoint.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "alive",
    message: "The server is running, much like my dad's mouth at the dinner table.",
    uptime: process.uptime(),
  });
});

// Serve the built React client (client/dist), if present. In the production Docker image
// this directory is copied in alongside the compiled server (see Dockerfile) so one process
// serves both the API and the static frontend. In local dev the client normally runs via
// its own Vite dev server instead, so client/dist may not exist, in that case we simply
// skip static serving rather than crashing.
const clientDistPath = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  // SPA fallback: any GET request that isn't for a static asset or an /api/* route should
  // still return index.html so client-side routing works on a hard refresh / deep link.
  // Implemented as plain middleware (not an app.get("*") route) to sidestep Express 5's
  // path-to-regexp v8 requiring named wildcards for "*" route patterns.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// Catch-all error handler, must be registered last.
app.use(errorHandler);

export default app;
