// End-to-end test of the app's core loop: land on the site, read a joke, reveal the
// punchline, and vote on it, driving a real Chromium browser against the real Vite dev
// server, the real Express API, and a real (freshly reseeded) Postgres database. Every
// other suite in this project stops short of this: Vitest/RTL mock fetch, and Supertest
// talks to the API directly without a browser or any rendered UI in between.
import { test, expect } from "@playwright/test";

test.describe("viewing and voting on a joke", () => {
  test("reveals the punchline and casts an upvote that increments the count", async ({ page }) => {
    await page.goto("/");

    // The "Random Joke" tab is the default view, it should already show a setup line
    // without any navigation.
    const jokeCard = page.locator(".joke-card").first();
    await expect(jokeCard).toBeVisible();
    await expect(jokeCard.locator(".joke-setup p")).not.toBeEmpty();

    // The punchline is hidden until revealed.
    await expect(jokeCard.locator(".joke-punchline")).toHaveCount(0);
    await jokeCard.getByRole("button", { name: /Reveal the Punchline/i }).click();
    await expect(jokeCard.locator(".punchline-text")).not.toBeEmpty();

    // Read the upvote count before voting so the assertion isn't hardcoded to whichever
    // joke the random seed happens to land on.
    const upvoteButton = jokeCard.locator("button.upvote");
    const beforeText = await upvoteButton.innerText();
    const beforeCount = Number(beforeText.replace(/\D/g, ""));

    await upvoteButton.click();

    // The count goes up by exactly one, and the button disables itself so this browser
    // can't vote twice on the same joke.
    await expect(upvoteButton).toHaveText(new RegExp(`${beforeCount + 1}$`));
    await expect(upvoteButton).toBeDisabled();

    // A success toast confirms the vote round-tripped through the real API.
    await expect(page.getByText(/good taste in dad jokes/i)).toBeVisible();
  });

  test("browsing the joke list shows multiple seeded jokes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Browse Jokes/i }).click();

    // The exact markup of JokeList isn't load-bearing here, just that seeded jokes render.
    await expect(page.locator(".browse-section")).toBeVisible();
    await expect(page.getByText(/impasta|scarecrow|calendar/i).first()).toBeVisible();
  });
});
