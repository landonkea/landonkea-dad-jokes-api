// We need these types from Express to define the parameters of our error handler function.
// "Request" represents the incoming HTTP request (like a letter someone sent to the server).
// "Response" represents the outgoing HTTP response (like the reply we send back).
// "NextFunction" is a special function that, when called, passes control to the NEXT middleware in line.
import { Request, Response, NextFunction } from "express";

// We import our ApiResponse type so our error responses follow the same format
// as all our other API responses (success, data, error). Consistency is important!
import { ApiResponse } from "../types";

// This is a special "error handler" middleware function.
// Express recognizes this as an error handler because it has FOUR parameters (err, req, res, next).
// Regular middleware only has THREE. This is how Express knows "this one handles errors."
// Think of it like a safety net, if anything goes wrong in a route above,
// Express catches the error and sends it here.
export function errorHandler(
  // The error that was thrown, this contains information about what went wrong.
  err: Error,
  // The request that caused the error. We prefix it with "_" to say "we acknowledge this parameter exists
  // but we don't use it in this function." It's required by Express's signature but not needed here.
  _req: Request,
  // The response object, this is how we send data back to whoever made the request.
  res: Response,
  // The "next" function. In error handlers, we don't call it because we're already sending the response.
  // But it MUST be listed here or Express won't recognize this as an error handler.
  _next: NextFunction
): void {
  // Log the error message to the server's console so the developer can see what happened.
  // This is like writing it in a logbook for debugging later.
  console.error("Unhandled error:", err.message);

  // Build a response object that follows our standard ApiResponse format.
  // "success: false" tells the client "something went wrong."
  // "error" contains the actual error message so the client knows WHAT went wrong.
  const response: ApiResponse<null> = {
    success: false,
    // If the error has a message, use it. If not (somehow), fall back to a generic message.
    // The "||" means "or", use the first truthy value.
    error: err.message || "Internal server error",
  };

  // Send the response with HTTP status code 500.
  // 500 means "Internal Server Error", it's the generic "something broke on the server" code.
  // Think of HTTP status codes like a restaurant's system:
  //   200 = "Here's your food" (success)
  //   404 = "We don't have that dish" (not found)
  //   500 = "The kitchen caught fire" (server error)
  // ".json(response)" sends the response object as JSON (JavaScript Object Notation),
  // which is the standard format for sending data over the web.
  res.status(500).json(response);
}
