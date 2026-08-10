// Import the core React library plus two hooks: useState for managing state, useCallback for memoizing functions
import React, { useState, useCallback } from "react";
// Import the Header component, displays the site title and tagline at the top of the page
import { Header } from "./components/Header";
// Import the JokeCard component, shows a single random joke with voting and punchline reveal
import { JokeCard } from "./components/JokeCard";
// Import the JokeList component, displays a scrollable list of jokes with filtering and sorting
import { JokeList } from "./components/JokeList";
// Import the CategoryPicker component, renders category filter buttons so users can narrow jokes by type
import { CategoryPicker } from "./components/CategoryPicker";
// Import the SearchBox component, a text search for finding jokes by setup/punchline content
import { SearchBox } from "./components/SearchBox";
// Import the JokeSubmitter component, renders a form where users can submit their own dad jokes
import { JokeSubmitter } from "./components/JokeSubmitter";
// Import the StatsPanel component, displays statistics and analytics about all the jokes
import { StatsPanel } from "./components/StatsPanel";
// Import the ModerationQueue component, the admin-only panel for approving/rejecting submissions
import { ModerationQueue } from "./components/ModerationQueue";
// Import the Particles component, renders floating emoji particles in the background for visual flair
import { Particles } from "./components/Particles";
// Import the Marquee component, a scrolling ticker at the top that shows joke setups and punchlines
import { Marquee } from "./components/Marquee";
// Import the ThemeToggle component, a button that switches between dark and light mode
import { ThemeToggle } from "./components/ThemeToggle";

// Define a TypeScript type that can only be one of these five tab names, prevents typos and gives autocomplete
type Tab = "random" | "browse" | "submit" | "stats" | "moderate";

// Create an object that maps each tab name to a funny tagline shown below the nav bar
// Record<Tab, string> means "an object where every key is a Tab and every value is a string"
const TAB_TAGLINES: Record<Tab, string> = {
  random: "Roll the dice of dad humor",
  browse: "The entire encyclopedia of groans",
  submit: "Unleash your inner father figure",
  stats: "How many people have suffered?",
  moderate: "Where dad jokes go to be judged",
};

// Define the App component as a React Functional Component (React.FC)
const App: React.FC = () => {
  // activeTab stores which tab is currently selected. "random" is the default.
  const [activeTab, setActiveTab] = useState<Tab>("random");
  // selectedCategory stores which category filter is active. undefined means "show all".
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  // sortBy stores which sort option is selected. undefined means default sorting.
  const [sortBy, setSortBy] = useState<string | undefined>();
  // searchQuery stores the active search term. undefined means "no search filter".
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  // listKey is a counter we increment to force JokeList to remount and re-fetch data.
  const [listKey, setListKey] = useState(0);

  // useCallback memoizes this function so it doesn't get recreated on every render.
  // Called after a joke is submitted successfully to refresh the list.
  const handleJokeSubmitted = useCallback(() => {
    // Increment listKey by 1. React sees the new key and destroys + recreates JokeList.
    setListKey((prev) => prev + 1);
  }, []); // Empty dependency array means this function is created once and never changes

  // Define an array of tab configuration objects, each with an id, display label, and emoji.
  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "random", label: "Random Joke", emoji: "🎲" },
    { id: "browse", label: "Browse Jokes", emoji: "📚" },
    { id: "submit", label: "Submit Joke", emoji: "✍️" },
    { id: "stats", label: "Stats", emoji: "📊" },
    { id: "moderate", label: "Moderate", emoji: "🕵️" },
  ];

  // Return the JSX that makes up the entire page
  return (
    <div className="app">
      {/* Render floating emoji particles in the background for visual flair */}
      <Particles />
      {/* Theme toggle button in the top-right corner */}
      <ThemeToggle />
      {/* Render the site header with the title "Dad Jokes API" */}
      <Header />
      {/* Render the scrolling ticker of joke setup→punchline pairs */}
      <Marquee />

      {/* The navigation bar that holds all the tab buttons */}
      <nav className="tab-nav">
        {/* Loop through each tab config and create a button for it */}
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-emoji">{tab.emoji}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* A paragraph showing a funny tagline that changes depending on which tab is active */}
      <p style={{
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: "0.85rem",
        fontStyle: "italic",
        marginTop: "-20px",
        marginBottom: "28px",
      }}>
        {TAB_TAGLINES[activeTab]}
      </p>

      {/* The main content area where different tab views are conditionally rendered */}
      <main className="main-content">
        {/* Only render JokeCard (random joke view) if the "random" tab is active */}
        {activeTab === "random" && <JokeCard />}

        {/* Only render the browse section if the "browse" tab is active */}
        {activeTab === "browse" && (
          <div className="browse-section">
            {/* Search box, searches setup/punchline text (typo-tolerant) via ?q= */}
            <SearchBox value={searchQuery} onChange={setSearchQuery} />
            {/* Category filter buttons, pass current selection and setter to update it */}
            <CategoryPicker
              selected={selectedCategory}
              onChange={setSelectedCategory}
            />
            {/* A row of controls for sorting the joke list */}
            <div className="sort-controls">
              <label>Sort by: </label>
              {/* Dropdown for choosing how to sort jokes. Disabled while searching, a
                  search always orders by relevance (see routes/jokes.ts). */}
              <select
                value={sortBy || ""}
                onChange={(e) => setSortBy(e.target.value || undefined)}
                disabled={!!searchQuery}
              >
                <option value="">Top Voted</option>
                <option value="groan">Most Groans</option>
                <option value="oldest">Oldest First</option>
                <option value="controversial">Most Controversial</option>
              </select>
              {searchQuery && (
                <span style={{ fontSize: "0.8rem", fontStyle: "italic" }}>
                  (sorted by best match while searching)
                </span>
              )}
            </div>
            {/* The list of jokes. Key forces React to remount when any filter changes. */}
            <JokeList
              key={`${selectedCategory}-${sortBy}-${searchQuery}-${listKey}`}
              category={selectedCategory}
              sort={sortBy}
              q={searchQuery}
            />
          </div>
        )}

        {/* Only render the joke submission form if the "submit" tab is active */}
        {activeTab === "submit" && (
          <JokeSubmitter onJokeSubmitted={handleJokeSubmitted} />
        )}

        {/* Only render the stats dashboard if the "stats" tab is active */}
        {activeTab === "stats" && <StatsPanel />}

        {/* Only render the moderation queue if the "moderate" tab is active */}
        {activeTab === "moderate" && <ModerationQueue />}
      </main>

      {/* The footer at the bottom of the page */}
      <footer className="footer">
        <p>
          Built with 💀 and an unhealthy obsession with puns | Dad Jokes API v1.0
        </p>
        <p className="footer-sub">
          No dads were harmed in the making of this website. Their pride, however,
          is a different story. Side effects include: snorting, crying, and
          involuntary "ba dum tss" sounds.
        </p>
      </footer>
    </div>
  );
};

// Export the App component as the default export so main.tsx can import it
export default App;
