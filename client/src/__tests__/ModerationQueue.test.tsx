// Tests for components/ModerationQueue.tsx, the admin panel that lists jokes awaiting
// moderation and lets an admin approve or reject each one. No real server here (that's
// covered by the server-side integration tests); instead we stub global.fetch so we can
// exercise the component's request-building, loading/error states, and optimistic list
// updates in isolation, the same way real client code would hit the API.
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ModerationQueue } from "../components/ModerationQueue";

// A minimal pending joke fixture matching the shape the server would return.
function pendingJoke(overrides: Partial<{ id: number; setup: string }> = {}) {
  return {
    id: overrides.id ?? 1,
    setup: overrides.setup ?? "Why did the scarecrow win an award?",
    punchline: "He was outstanding in his field.",
    category: "classic",
    groan_level: 5,
    upvotes: 0,
    downvotes: 0,
    author: "Test Dad",
    created_at: new Date().toISOString(),
    status: "pending" as const,
  };
}

describe("ModerationQueue", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("prompts for an admin token before fetching anything", () => {
    render(<ModerationQueue />);
    expect(screen.getByText(/Enter the admin token above/i)).toBeInTheDocument();
  });

  it("fetches and displays the pending queue once a token is submitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: [pendingJoke({ id: 1, setup: "Queued joke A" })],
        pagination: { page: 1, limit: 20, offset: 0, total: 1, total_pages: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModerationQueue />);
    fireEvent.change(screen.getByLabelText(/Admin Token/i), { target: { value: "secret-token" } });
    fireEvent.click(screen.getByRole("button", { name: /Load Queue/i }));

    await waitFor(() => expect(screen.getByText("Queued joke A")).toBeInTheDocument());

    // The request must include the token as the x-admin-token header, and must hit
    // the /pending endpoint (not the public listing).
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/jokes/pending");
    expect(options.headers["x-admin-token"]).toBe("secret-token");
  });

  it("shows the server's error message when the token is rejected", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, error: "Missing or invalid x-admin-token header." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModerationQueue />);
    fireEvent.change(screen.getByLabelText(/Admin Token/i), { target: { value: "wrong-token" } });
    fireEvent.click(screen.getByRole("button", { name: /Load Queue/i }));

    await waitFor(() =>
      expect(screen.getByText(/Missing or invalid x-admin-token header/i)).toBeInTheDocument()
    );
  });

  it("removes a joke from the list after it's approved", async () => {
    const fetchMock = vi
      .fn()
      // Initial queue load
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [pendingJoke({ id: 5, setup: "About to be approved" })],
          pagination: { page: 1, limit: 20, offset: 0, total: 1, total_pages: 1 },
        }),
      })
      // The approve call
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { ...pendingJoke({ id: 5, setup: "About to be approved" }), status: "approved" },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<ModerationQueue />);
    fireEvent.change(screen.getByLabelText(/Admin Token/i), { target: { value: "secret-token" } });
    fireEvent.click(screen.getByRole("button", { name: /Load Queue/i }));

    await waitFor(() => expect(screen.getByText("About to be approved")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Approve/i }));

    await waitFor(() => expect(screen.queryByText("About to be approved")).not.toBeInTheDocument());

    // The approve request hit the right endpoint with the token header.
    const [approveUrl, approveOptions] = fetchMock.mock.calls[1];
    expect(approveUrl).toContain("/api/jokes/5/approve");
    expect(approveOptions.method).toBe("POST");
    expect(approveOptions.headers["x-admin-token"]).toBe("secret-token");
  });
});
