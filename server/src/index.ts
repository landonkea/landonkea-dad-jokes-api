// Entry point: loads environment variables, then starts the configured Express app
// (built in app.ts) listening on the configured port.
import dotenv from "dotenv";

// Call dotenv.config() to load all variables from the .env file into process.env.
// This must happen before importing "./app" or "./config/env", since both read
// process.env at import time.
dotenv.config();

// Import the configured app AFTER dotenv.config() has run.
import app from "./app";
// Import our config object, it contains validated environment variables like port number.
import { config } from "./config/env";

// Start the server and listen for incoming connections on the configured port (default 3001).
app.listen(config.port, () => {
  console.log(`Dad Jokes API running on http://localhost:${config.port}`);
  console.log(`Warning: Joke density may cause involuntary groaning.`);
});
