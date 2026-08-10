// Import React and useState for tracking what the user has typed so far.
import React, { useState } from "react";

// Define the props SearchBox accepts from its parent (App.tsx).
interface SearchBoxProps {
  value?: string;                              // The currently active search term (undefined means "no search")
  onChange: (query: string | undefined) => void; // Callback fired when the user submits a new search term
}

// SearchBox renders a text input + submit button for searching jokes by setup/punchline text.
// It's a controlled "submit on Enter/click" search rather than search-as-you-type, so we don't
// fire a request on every keystroke, the parent only re-fetches once the user is done typing.
export const SearchBox: React.FC<SearchBoxProps> = ({ value, onChange }) => {
  // draft holds what's currently typed in the box, which may differ from the "committed"
  // search term (value) until the user presses Enter or clicks the search button.
  const [draft, setDraft] = useState(value || "");

  // Commit the current draft as the active search term. An empty/whitespace-only draft
  // clears the search entirely (passes undefined, same as "no filter").
  const submit = () => {
    const trimmed = draft.trim();
    onChange(trimmed === "" ? undefined : trimmed);
  };

  // Clear both the draft and the active search term.
  const clear = () => {
    setDraft("");
    onChange(undefined);
  };

  return (
    <div className="search-box">
      <input
        type="text"
        className="search-box-input"
        placeholder="🔍 Search setups & punchlines (typos okay!)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <button type="button" className="btn btn-secondary search-box-btn" onClick={submit}>
        Search
      </button>
      {/* Only show the clear button once a search is actually active. */}
      {value && (
        <button type="button" className="btn btn-secondary search-box-btn" onClick={clear}>
          Clear
        </button>
      )}
    </div>
  );
};
