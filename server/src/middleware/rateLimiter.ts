// Import the rateLimit function from the "express-rate-limit" library.
// Rate limiting is like a bouncer at a club, it limits how many requests each visitor can make.
// This protects the server from being overwhelmed by too many requests (accidental or malicious).
import rateLimit from "express-rate-limit";

// Create a general-purpose rate limiter for all /api routes.
// This limits each IP address to 100 requests per 15-minute window.
export const apiLimiter = rateLimit({
  // "windowMs" defines the time window in milliseconds.
  // 15 minutes × 60 seconds × 1000 milliseconds = 900,000 ms.
  windowMs: 15 * 60 * 1000, // 15 minutes
  // "max" is the maximum number of requests allowed from a single IP within the window.
  // After 100 requests, subsequent requests get a 429 (Too Many Requests) response.
  max: 100,
  // "message" is the JSON response sent when someone exceeds the rate limit.
  // Instead of a generic error, we send a friendly, on-brand message.
  message: {
    success: false,
    error: "Too many requests. Take a breath and try again in a few minutes.",
  },
  // "standardHeaders: true" uses the standard RateLimit-* headers in responses.
  // These headers tell the client how many requests they have left and when the window resets.
  standardHeaders: true,
  // "legacyHeaders: false" disables the older X-RateLimit-* headers.
  // We use the modern standard headers instead to avoid duplicate headers.
  legacyHeaders: false,
});

// Create a stricter rate limiter specifically for the voting endpoint.
// Voting is a more "expensive" operation (it writes to the database), so we limit it more.
// This prevents someone from spamming votes to manipulate joke rankings.
export const voteLimiter = rateLimit({
  // Same 15-minute time window as the general limiter.
  windowMs: 15 * 60 * 1000,
  // Only 30 votes allowed per IP per 15 minutes, much stricter than the 100 general requests.
  max: 30,
  // A humorous error message that fits the dad joke theme.
  message: {
    success: false,
    error: "Slow down on the voting. Even democracies have limits.",
  },
});
