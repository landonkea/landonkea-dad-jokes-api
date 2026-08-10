// Import the "z" object from the Zod library.
// Zod is a TypeScript-first schema validation library, it lets you define "rules" for data
// and then check if incoming data follows those rules. Think of it as a bouncer for your data.
import { z } from "zod";

// The fixed set of joke categories. This MUST stay in sync with the hardcoded
// <select> options in client/src/components/JokeSubmitter.tsx, previously the
// server accepted ANY string here, so a typo'd or client-drifted category (e.g.
// "Puns" vs "puns", or a category the dropdown never offered) would silently
// fragment /api/jokes/categories counts and category filters. Enforcing the
// same enum server-side keeps the two in lockstep.
export const JOKE_CATEGORIES = [
  "classic",
  "puns",
  "animals",
  "food",
  "science",
  "math",
  "smart",
  "work",
  "geography",
] as const;

export type JokeCategory = (typeof JOKE_CATEGORIES)[number];

// Defines the validation rules for joke submission data.
// When someone POSTs a new joke, this schema checks that the data is valid
// before it ever touches the database. Bad data gets rejected immediately.
// This is called "validation at the boundary", catch problems as early as possible.
export const jokeInputSchema = z.object({
  // "setup" must be a string (text) with at least 5 characters and at most 500 characters.
  // If someone sends an empty setup or one that's way too long, Zod rejects it.
  // The error messages ("Setup must be at least 5 characters") are sent back to the client.
  setup: z
    .string()
    .min(5, "Setup must be at least 5 characters")
    .max(500, "Setup must be under 500 characters"),
  // "punchline" must be a string with at least 2 characters and at most 500 characters.
  // The minimum is only 2 (not 5) because some punchlines are very short (like "Attire.").
  punchline: z
    .string()
    .min(2, "Punchline must be at least 2 characters")
    .max(500, "Punchline must be under 500 characters"),
  // "category" is optional (you don't have to provide it).
  // If provided, it must be one of the fixed JOKE_CATEGORIES values, the same
  // list the client's dropdown offers, so category counts/filters can't drift.
  // If omitted, it defaults to "classic", so every joke always has a category.
  category: z
    .enum(JOKE_CATEGORIES, {
      error: `Category must be one of: ${JOKE_CATEGORIES.join(", ")}`,
    })
    .default("classic")
    .optional(),
  // "groan_level" is optional. If provided, it must be a whole number (int) between 1 and 10.
  // If omitted, it defaults to 5 (middle of the groan scale).
  groan_level: z
    .number()
    .int()
    .min(1, "Groan level must be at least 1")
    .max(10, "Groan level must be at most 10")
    .default(5)
    .optional(),
  // "author" is optional. If provided, it must be a string with at most 100 characters.
  // If omitted, it defaults to "Anonymous Dad", a fun default for anonymous submissions.
  author: z
    .string()
    .max(100, "Author name must be under 100 characters")
    .default("Anonymous Dad")
    .optional(),
});

// Defines the validation rules for vote submission data.
// When someone POSTs a vote, this schema ensures the data is valid.
export const voteInputSchema = z.object({
  // "joke_id" must be a positive whole number (integer > 0).
  // You can't vote on a joke with ID 0 or a negative number, those don't exist.
  joke_id: z.number().int().positive("Joke ID must be a positive number"),
  // "vote_type" must be exactly "up" or "down", nothing else is allowed.
  // "z.enum" creates a whitelist of allowed values.
  // The "errorMap" provides a custom error message if the value doesn't match.
  vote_type: z.enum(["up", "down"], {
    error: "Vote type must be 'up' or 'down'",
  }),
});

// These "type" lines use Zod's "infer" feature to automatically generate TypeScript types
// from our schemas. This means the TypeScript type and the runtime validation are always in sync.
// If you change the schema, the type updates automatically, no double work!
// "JokeInput" is the TypeScript type for validated joke submission data.
export type JokeInput = z.infer<typeof jokeInputSchema>;
// "VoteInput" is the TypeScript type for validated vote submission data.
export type VoteInput = z.infer<typeof voteInputSchema>;
