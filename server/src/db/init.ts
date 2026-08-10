// Import the Pool class from the "pg" library to create database connections.
import { Pool } from "pg";
// Import our validated config object to get database credentials.
import { config } from "../config/env";
// Import the shared CREATE TABLE / CREATE INDEX SQL, also used by integration tests
// so the test schema can never silently drift from the real one.
import { SCHEMA_SQL } from "./schema";

// Define an async function that initializes the database.
// "async" lets us use "await" inside to wait for database operations to finish.
// "Promise<void>" means this function doesn't return a value, it just does work.
async function initDB(): Promise<void> {
  // Create a temporary connection pool connected to the default "postgres" database.
  // We need this admin connection because you can't create a database while connected to it.
  // Think of it like needing to stand outside a house before you can build one.
  const adminPool = new Pool({
    // The PostgreSQL username to authenticate with.
    user: config.dbUser,
    // The "postgres" database is PostgreSQL's default system database, it's always there.
    // We connect to it temporarily to create our actual application database.
    database: "postgres",
    // The database host, must match the app pool's config, otherwise this
    // admin connection tries "localhost" even when running against a
    // separate "db" container (e.g. in docker-compose) and fails to connect.
    host: config.dbHost,
    // The port PostgreSQL is listening on.
    port: config.dbPort,
    // The password to authenticate with.
    password: config.dbPassword,
  });

  // Store the desired database name in a variable for easy reference.
  const dbName = config.dbName;

  // The "try" block is where we do our work. If anything goes wrong, the "catch" block handles it.
  // The "finally" block ALWAYS runs, whether things succeeded or failed.
  // This is important because we ALWAYS want to close our admin connection when we're done.
  try {
    // This SQL query asks PostgreSQL: "Does a database with this name already exist?"
    // "SELECT 1" just picks a dummy value, we don't care about the value, we care about whether ANY rows come back.
    // "FROM pg_database" is PostgreSQL's built-in list of all databases.
    // "WHERE datname = $1" filters to only the database whose name matches our variable.
    // The $1 is a "parameter placeholder", it's replaced by [dbName] safely, preventing SQL injection attacks.
    const exists = await adminPool.query(
      // The SQL query string, $1 will be replaced by the first item in the array below.
      "SELECT 1 FROM pg_database WHERE datname = $1",
      // The array of values to safely insert into the query's placeholders.
      [dbName]
    );

    // If "exists.rows" has 0 items, that means the database does NOT exist yet.
    if (exists.rows.length === 0) {
      // Create the database! This is like building a new filing cabinet.
      // We use a template string (backticks ``) to insert the database name into the SQL.
      // NOTE: We can't use $1 here because CREATE DATABASE doesn't support parameterized names.
      // This is okay because dbName comes from our .env file, not from user input.
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      // Let the developer know the database was created successfully.
      console.log(`Database "${dbName}" created.`);
    } else {
      // The database already exists! No need to create it again.
      // This is like checking if the filing cabinet is already there before building another one.
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    // NO MATTER what happened (success or error), close the admin connection.
    // Leaving connections open wastes resources, like leaving a phone off the hook.
    await adminPool.end();
  }

  // Now that we know the database exists, create a NEW pool connected to our actual app database.
  // We can't reuse the adminPool because it's connected to "postgres", not our app database.
  const appPool = new Pool({
    // The PostgreSQL username.
    user: config.dbUser,
    // Connect to our actual application database (the one we just ensured exists).
    database: dbName,
    // The database host, same reasoning as adminPool above.
    host: config.dbHost,
    // The port PostgreSQL is listening on.
    port: config.dbPort,
    // The password to authenticate with.
    password: config.dbPassword,
  });

  try {
    // Run the shared CREATE TABLE / CREATE INDEX SQL (see db/schema.ts). Pulling it out into
    // its own module means integration tests can stand up the identical schema against a test
    // database instead of maintaining a second, easily-drifting copy of this SQL.
    await appPool.query(SCHEMA_SQL);

    // Let the developer know everything was set up successfully.
    console.log("Tables and indexes created successfully.");
  } finally {
    // Always close this connection too, we're done with it.
    await appPool.end();
  }
}

// Now we actually RUN the initDB() function we defined above.
// ".then()" runs after initDB() finishes successfully.
initDB()
  .then(() => {
    // Everything went well, print a success message.
    console.log("Database initialization complete.");
    // Exit the process with code 0. In programming, exit code 0 means "everything is fine."
    // This is like a traffic light turning green, all clear.
    process.exit(0);
  })
  // ".catch()" runs if initDB() encounters an error.
  .catch((err) => {
    // Print the error so the developer can see what went wrong.
    console.error("Database initialization failed:", err);
    // Exit with code 1. Exit code 1 means "something went wrong."
    // This is like a traffic light turning red, stop, there's a problem.
    process.exit(1);
  });
