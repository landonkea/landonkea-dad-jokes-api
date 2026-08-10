// Idempotent startup helper: seeds the database ONLY if the "jokes" table is currently
// empty. This is what runs automatically when the container starts (see Dockerfile CMD),
// so a fresh docker-compose volume gets sample data, but restarting an already-seeded
// stack doesn't wipe out votes/edits by re-running seed.ts's DELETE-then-INSERT logic.
import { Pool } from "pg";
import { config } from "../config/env";
import { seedDB } from "./seed";

async function seedIfEmpty(): Promise<void> {
  const pool = new Pool({
    user: config.dbUser,
    database: config.dbName,
    host: config.dbHost,
    port: config.dbPort,
    password: config.dbPassword,
  });

  let count: number;
  try {
    const result = await pool.query("SELECT COUNT(*) FROM jokes");
    count = parseInt(result.rows[0].count, 10);
  } finally {
    await pool.end();
  }

  if (count === 0) {
    console.log("Jokes table is empty, seeding sample data.");
    await seedDB();
  } else {
    console.log(`Jokes table already has ${count} row(s), skipping seed.`);
  }
}

seedIfEmpty()
  .then(() => {
    console.log("Seed-if-empty check complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed-if-empty check failed:", err);
    process.exit(1);
  });
