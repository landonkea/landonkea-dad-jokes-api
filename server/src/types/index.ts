// This file defines "shapes" of data used throughout the app.
// Think of these like blueprints, they tell TypeScript what each piece of data looks like,
// so if you make a typo like "punchlnie" instead of "punchline", TypeScript catches it for you.

// This is the shape of a single joke as it lives in the database.
// Every joke has all of these fields, nothing is optional here.
export interface Joke {
  // A unique number that identifies this joke (like a student ID number).
  // Every joke gets a different number so we can find it later.
  id: number;
  // The "setup" is the first part of the joke, the part that sets up the punchline.
  // For example: "I'm afraid for the calendar."
  setup: string;
  // The "punchline" is the funny payoff at the end of the joke.
  // For example: "Its days are numbered."
  punchline: string;
  // The category tells you what kind of joke it is, like "puns", "animals", or "science".
  // This is just a regular word (a string), not a number or true/false value.
  category: string;
  // How cringeworthy/groan-worthy is this joke on a scale of 1 to 10?
  // 1 means "that's clever" and 10 means "everyone groans and walks away."
  groan_level: number;
  // How many people gave this joke a thumbs-up (liked it).
  // Starts at 0 and goes up every time someone upvotes it.
  upvotes: number;
  // How many people gave this joke a thumbs-down (disliked it).
  // Starts at 0 and goes up every time someone downvotes it.
  downvotes: number;
  // The date and time when this joke was first added to the database.
  // JavaScript's built-in Date type holds both date and time.
  created_at: Date;
  // The name of the person who submitted this joke (like "Dad #1").
  author: string;
  // Moderation status. New public submissions start "pending" and only appear in the
  // public API once an admin approves them via POST /:id/approve. Rows created before
  // this column existed (and anything inserted directly, like seed data) default to
  // "approved". "rejected" jokes are kept (not deleted) so the moderation queue has a
  // record of what was turned down and why.
  status: "pending" | "approved" | "rejected";
}

// This is the shape of data that someone sends when they want to CREATE a new joke.
// Notice some fields have a "?" after them, that means they're optional (you don't have to provide them).
// Think of it like an order form where some fields are required and some are optional.
export interface JokeInput {
  // The setup part of the joke, this is REQUIRED (no "?").
  // You can't have a joke without a setup.
  setup: string;
  // The punchline part of the joke, also REQUIRED.
  // You can't have a joke without a punchline.
  punchline: string;
  // The category is optional ("?"). If you don't pick one, it defaults to "classic".
  // Like if a form asks "what type of food?" and you skip it, it picks "pizza" for you.
  category?: string;
  // The groan level is optional. If you don't provide it, it defaults to 5 (middle of the road).
  groan_level?: number;
  // The author is optional. If you don't say who wrote it, it defaults to "Anonymous Dad".
  author?: string;
}

// This is the shape of data someone sends when they want to UPVOTE or DOWNVOTE a joke.
// It's a small payload, just two pieces of information.
export interface VotePayload {
  // Which joke are we voting on? This is the joke's ID number from the database.
  joke_id: number;
  // Are we giving a thumbs-up ("up") or thumbs-down ("down")?
  // The quotes around "up" | "down" mean it MUST be exactly one of those two words, nothing else.
  vote_type: "up" | "down";
}

// This is the STANDARD shape that every API response follows.
// The <T> is a "generic", it's a placeholder that can be replaced with any type.
// For example, ApiResponse<Joke> means "a response that contains Joke data."
// Think of it like a envelope: the envelope always looks the same (success, data, error),
// but what's inside (the "data" part) can be different depending on the situation.
export interface ApiResponse<T> {
  // Did the request work? "true" means everything went well, "false" means something went wrong.
  success: boolean;
  // The actual data we're sending back. This is optional ("?") because if there's an error,
  // there might not be any data to send back.
  data?: T;
  // A human-readable error message. This is also optional because if the request was successful,
  // there's no error message to send.
  error?: string;
  // Pagination metadata, only present on list endpoints (like GET /api/jokes) that support
  // page/limit/offset query params. Lets the client render "page 2 of 5" style UI and know
  // whether there are more results to fetch.
  pagination?: {
    page: number;
    limit: number;
    offset: number;
    total: number;
    total_pages: number;
  };
}

// This is the shape of the data you get back from the "/api/jokes/stats" endpoint.
// It's a summary/dashboard of all the joke data in the database.
export interface StatsResponse {
  // How many jokes are in the database in total?
  total_jokes: number;
  // How many total votes (upvotes + downvotes) have been cast across all jokes?
  total_votes: number;
  // The average groan level of all jokes, rounded to 1 decimal place.
  // If joke A is groan level 7 and joke B is groan level 9, the average would be 8.0.
  avg_groan_level: number;
  // The joke with the most upvotes. This could be "null" if there are no jokes at all.
  // "null" means "nothing here", like an empty box.
  most_upvoted: Joke | null;
  // An array (list) of objects, where each object tells you a category name and how many jokes are in it.
  // For example: [{ category: "puns", count: 5 }, { category: "animals", count: 3 }]
  category_counts: { category: string; count: number }[];
  // How many submissions are currently sitting in the moderation queue (status = 'pending').
  pending_count: number;
}
