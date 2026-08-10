// Import React and two hooks: useEffect for fetching data on mount, useState for storing it
import React, { useEffect, useState } from "react";
// Import the API function that fetches all categories and their joke counts
import { fetchCategories } from "../hooks/useJokes";

// Define the props that CategoryPicker accepts from its parent component
interface CategoryPickerProps {
  selected?: string;  // The currently selected category (undefined means "all categories")
  onChange: (category: string | undefined) => void;  // A callback function to tell the parent when the user picks a category
}

// The CategoryPicker component renders a row of filter buttons, one for "All" and one per category.
export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  selected,  // Which category is currently active
  onChange,   // Function to call when the user clicks a category button
}) => {
  // Store the list of categories fetched from the server. Each entry has a name and a count of jokes in it.
  // Starts as an empty array while we wait for the fetch.
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);

  // Fetch the categories from the server when the component first mounts.
  // The empty dependency array [] means this only runs once.
  useEffect(() => {
    fetchCategories()
      .then(setCategories)   // On success, store the fetched categories in state
      .catch(console.error);  // On failure, log the error to the browser console
  }, []); // No dependencies: run once on mount

  return (
    <div className="category-picker">
      <h3 className="category-title">🗂️ Pick Your Pun Category</h3>
      <div className="category-buttons">
        <button
          className={`category-btn ${!selected ? "active" : ""}`}
          onClick={() => onChange(undefined)}
        >
          All Groans
        </button>
        {categories.map((cat) => (
          <button
            key={cat.category}
            className={`category-btn ${selected === cat.category ? "active" : ""}`}
            onClick={() => onChange(cat.category)}
          >
            {cat.category} ({cat.count})
          </button>
        ))}
      </div>
    </div>
  );
};
