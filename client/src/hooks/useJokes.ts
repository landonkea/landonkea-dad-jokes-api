// The base URL for all API requests. Using "/api" means requests go to the same server that serves the page.
// This avoids hardcoding a domain like "http://localhost:3000" and works in both development and production.
const API_BASE = "/api";

// Define the shape of a Joke object so TypeScript can check that we use joke properties correctly everywhere.
// This is like a contract that says "every Joke must have these fields with these types."
export interface Joke {
  id: number;           // A unique number that identifies this joke in the database
  setup: string;        // The first part of the joke, the setup line that builds anticipation
  punchline: string;    // The second part, the funny payoff line
  category: string;     // What kind of joke this is (e.g., "puns", "animals", "classic")
  groan_level: number;  // A rating from 1-10 of how groan-worthy the joke is
  upvotes: number;      // How many times people have voted this joke up
  downvotes: number;    // How many times people have voted this joke down
  created_at: string;   // The date/time the joke was submitted, as a string
  author: string;       // The name (or alias) of who submitted the joke
  status: "pending" | "approved" | "rejected"; // Moderation state, only "approved" jokes are publicly visible
}

// Define a generic wrapper for all API responses. The API always sends back success, data, and sometimes error.
// The <T> means this interface can hold any data type, we specify the type when we use it.
export interface ApiResponse<T> {
  success: boolean;  // Whether the request succeeded (true) or failed (false)
  data?: T;          // The actual response data (only present if success is true). The "?" means it's optional.
  error?: string;    // An error message (only present if success is false). The "?" means it's optional.
  // Pagination metadata, only present on list endpoints (like GET /api/jokes) that
  // support page/limit/offset query params.
  pagination?: {
    page: number;
    limit: number;
    offset: number;
    total: number;
    total_pages: number;
  };
}

// The shape returned by fetchJokesPage(): the jokes for the requested page, plus the
// pagination metadata needed to render "page X of Y" / Prev / Next controls.
export interface JokesPage {
  jokes: Joke[];
  pagination: NonNullable<ApiResponse<Joke[]>["pagination"]>;
}

// Fetch a single random joke from the server.
// This is an "async" function so we can use "await" to wait for the server's response.
export async function fetchRandomJoke(): Promise<Joke> {
  // Send a GET request to /api/jokes/random. The server picks a random joke and sends it back.
  const res = await fetch(`${API_BASE}/jokes/random`);
  // Convert the raw response body (which is JSON text) into a JavaScript object we can work with
  const json: ApiResponse<Joke> = await res.json();
  // If the API reported failure or didn't include data, throw an error with the server's message
  if (!json.success || !json.data) throw new Error(json.error || "Failed to fetch joke");
  // Return just the joke data from the response wrapper
  return json.data;
}

// Fetch multiple jokes with optional filters for category, sort order, and how many to return.
// The params object is optional, you can call fetchJokes() with no arguments to get all jokes.
export async function fetchJokes(params?: {
  category?: string;  // Optional: only return jokes in this category
  sort?: string;      // Optional: how to order the results (e.g., "groan", "oldest")
  limit?: number;     // Optional: maximum number of jokes to return
}): Promise<Joke[]> {
  // Create a URLSearchParams object to build a query string like "?category=puns&sort=groan"
  const searchParams = new URLSearchParams();
  // Only add the category parameter if one was provided (avoids sending empty params)
  if (params?.category) searchParams.set("category", params.category);
  // Only add the sort parameter if one was provided
  if (params?.sort) searchParams.set("sort", params.sort);
  // Only add the limit parameter if one was provided, converting the number to a string
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  // Send a GET request to /api/jokes with our query string appended
  const res = await fetch(`${API_BASE}/jokes?${searchParams.toString()}`);
  // Parse the JSON response. ApiResponse<Joke[]> means the data field will be an array of Jokes.
  const json: ApiResponse<Joke[]> = await res.json();
  // Throw an error if the request failed or returned no data
  if (!json.success || !json.data) throw new Error(json.error || "Failed to fetch jokes");
  // Return the array of jokes
  return json.data;
}

// Fetch a single PAGE of jokes, along with pagination metadata (total count, total pages).
// Use this instead of fetchJokes() when you need to render pager controls (Prev/Next, "page
// X of Y"), the plain fetchJokes() above discards the pagination info the server sends back.
export async function fetchJokesPage(params?: {
  category?: string;  // Optional: only return jokes in this category
  sort?: string;      // Optional: how to order the results (e.g., "groan", "oldest")
  q?: string;          // Optional: fuzzy/substring search term (matches setup or punchline)
  page?: number;       // Optional: 1-indexed page number
  limit?: number;      // Optional: how many jokes per page (server caps this at 100)
}): Promise<JokesPage> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", params.page.toString());
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  const res = await fetch(`${API_BASE}/jokes?${searchParams.toString()}`);
  const json: ApiResponse<Joke[]> = await res.json();
  if (!json.success || !json.data || !json.pagination) {
    throw new Error(json.error || "Failed to fetch jokes");
  }
  return { jokes: json.data, pagination: json.pagination };
}

// Fetch the list of all joke categories and how many jokes are in each one.
// Returns an array of objects like [{ category: "puns", count: 5 }, { category: "animals", count: 3 }]
export async function fetchCategories(): Promise<{ category: string; count: number }[]> {
  // Send a GET request to the categories endpoint
  const res = await fetch(`${API_BASE}/jokes/categories`);
  // Parse the JSON response into our typed structure
  const json: ApiResponse<{ category: string; count: number }[]> = await res.json();
  // Throw an error if the request failed
  if (!json.success || !json.data) throw new Error(json.error || "Failed to fetch categories");
  // Return the array of category objects
  return json.data;
}

// Send a vote (up or down) for a specific joke.
// This uses POST instead of GET because we're sending data to the server, not just requesting it.
export async function voteJoke(jokeId: number, voteType: "up" | "down"): Promise<Joke> {
  // Send a POST request to /api/jokes/vote with the joke ID and vote type in the request body
  const res = await fetch(`${API_BASE}/jokes/vote`, {
    method: "POST",                                    // POST means we're creating/submitting data
    headers: { "Content-Type": "application/json" },  // Tell the server we're sending JSON data
    // Convert our JavaScript object into a JSON string for the request body
    body: JSON.stringify({ joke_id: jokeId, vote_type: voteType }),
  });
  // Parse the response, which should contain the updated joke with new vote counts
  const json: ApiResponse<Joke> = await res.json();
  // Throw an error if the vote didn't go through
  if (!json.success || !json.data) throw new Error(json.error || "Failed to vote");
  // Return the updated joke with its new vote counts
  return json.data;
}

// Submit a brand new joke to the API. All fields except setup and punchline are optional with defaults on the server.
export async function submitJoke(joke: {
  setup: string;        // The setup line of the joke (required)
  punchline: string;    // The punchline of the joke (required)
  category?: string;    // Optional category, defaults to "classic" if not provided
  groan_level?: number; // Optional groan rating from 1-10, defaults to 5
  author?: string;      // Optional author name, defaults to "Anonymous Dad"
}): Promise<Joke> {
  // Send a POST request to /api/jokes with the joke data in the body
  const res = await fetch(`${API_BASE}/jokes`, {
    method: "POST",                                    // POST because we're creating a new resource
    headers: { "Content-Type": "application/json" },  // Tell the server the body is JSON
    body: JSON.stringify(joke),                        // Convert the joke object to a JSON string
  });
  // Parse the response, which should contain the newly created joke (with an id assigned by the server)
  const json: ApiResponse<Joke> = await res.json();
  // Throw an error if the submission failed
  if (!json.success || !json.data) throw new Error(json.error || "Failed to submit joke");
  // Return the newly created joke
  return json.data;
}

// Fetch overall statistics about the joke database, total jokes, votes, averages, and category breakdowns.
export async function fetchStats(): Promise<{
  total_jokes: number;                              // How many jokes exist in the database
  total_votes: number;                              // How many total votes have been cast
  avg_groan_level: number;                          // The average groan level across all jokes
  most_upvoted: Joke | null;                        // The single most upvoted joke, or null if no votes yet
  category_counts: { category: string; count: number }[];  // How many jokes are in each category
  pending_count: number;                            // How many submissions are awaiting moderation
}> {
  // Send a GET request to the stats endpoint
  const res = await fetch(`${API_BASE}/jokes/stats`);
  // Parse the JSON response with the full stats type definition repeated here for TypeScript
  const json: ApiResponse<{
    total_jokes: number;
    total_votes: number;
    avg_groan_level: number;
    most_upvoted: Joke | null;
    category_counts: { category: string; count: number }[];
    pending_count: number;
  }> = await res.json();
  // Throw an error if the stats request failed
  if (!json.success || !json.data) throw new Error(json.error || "Failed to fetch stats");
  // Return the stats object
  return json.data;
}

// ============================================================
// Moderation queue, admin-only endpoints (require an x-admin-token header)
// ============================================================

// The shape returned by fetchPendingJokes(): the pending jokes for the requested
// page, plus pagination metadata, mirroring fetchJokesPage() above.
export interface PendingJokesPage {
  jokes: Joke[];
  pagination: NonNullable<ApiResponse<Joke[]>["pagination"]>;
}

// Fetch a page of jokes awaiting moderation. Requires a valid admin token, the
// server rejects this with 401 (or 503 if ADMIN_TOKEN isn't configured server-side)
// otherwise.
export async function fetchPendingJokes(adminToken: string, page = 1, limit = 20): Promise<PendingJokesPage> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", page.toString());
  searchParams.set("limit", limit.toString());
  const res = await fetch(`${API_BASE}/jokes/pending?${searchParams.toString()}`, {
    headers: { "x-admin-token": adminToken },
  });
  const json: ApiResponse<Joke[]> = await res.json();
  if (!json.success || !json.data || !json.pagination) {
    throw new Error(json.error || "Failed to fetch the moderation queue");
  }
  return { jokes: json.data, pagination: json.pagination };
}

// Approve a pending joke, making it publicly visible and eligible for voting.
export async function approveJoke(id: number, adminToken: string): Promise<Joke> {
  const res = await fetch(`${API_BASE}/jokes/${id}/approve`, {
    method: "POST",
    headers: { "x-admin-token": adminToken },
  });
  const json: ApiResponse<Joke> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || "Failed to approve joke");
  return json.data;
}

// Reject a pending joke. The row is kept (status becomes "rejected") rather than deleted.
export async function rejectJoke(id: number, adminToken: string): Promise<Joke> {
  const res = await fetch(`${API_BASE}/jokes/${id}/reject`, {
    method: "POST",
    headers: { "x-admin-token": adminToken },
  });
  const json: ApiResponse<Joke> = await res.json();
  if (!json.success || !json.data) throw new Error(json.error || "Failed to reject joke");
  return json.data;
}
