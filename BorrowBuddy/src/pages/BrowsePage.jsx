import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/icons";
import { ItemCard, ItemGridSkeleton } from "../components/ItemCard";
import { CATEGORIES, filterItems, filtersFromParams, hasActiveFilters, SCHOOLS } from "../items/model";
import { useAvailableItems } from "../items/useAvailableItems";
import "./BrowsePage.css";

function Results({ items, filtered, loading, error, onClear }) {
  if (loading) return <ItemGridSkeleton count={8} />;
  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  if (!items.length) {
    return (
      <div className="empty-state">
        <h3>Nothing listed yet</h3>
        <p>Moving out or decluttering? Be the first to pass something down.</p>
        <Link to="/list" className="button button-primary">List an item</Link>
      </div>
    );
  }
  if (!filtered.length) {
    return (
      <div className="empty-state">
        <h3>No items match</h3>
        <p>Try another word, or look across every category and school.</p>
        <button type="button" className="button button-secondary" onClick={onClear}>Clear filters</button>
      </div>
    );
  }
  return (
    <div className="item-grid">
      {filtered.map((item) => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const { items, loading, error } = useAvailableItems();
  const filtered = filterItems(items, filters);
  const active = hasActiveFilters(filters);

  // Filters live in the URL, so refreshing or sharing a link keeps the same results.
  function setFilter(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  return (
    <div className="container browse">
      <h1>Browse items</h1>

      <div className="browse-controls">
        <div className="browse-row">
          <label className="browse-search">
            <Icon name="search" size={20} />
            <span className="visually-hidden">Search items</span>
            <input
              type="search"
              value={filters.q}
              onChange={(event) => setFilter("q", event.target.value)}
              placeholder="Search items"
            />
          </label>
          <label className="browse-school">
            <span className="visually-hidden">School</span>
            <select value={filters.school} onChange={(event) => setFilter("school", event.target.value)}>
              <option value="">All schools</option>
              {SCHOOLS.map((school) => <option key={school.id} value={school.id}>{school.label}</option>)}
            </select>
          </label>
        </div>

        <div className="chips" role="group" aria-label="Category">
          <button
            type="button"
            className="chip"
            aria-pressed={!filters.category}
            onClick={() => setFilter("category", "")}
          >
            All
          </button>
          {CATEGORIES.map((category) => (
            <button
              type="button"
              className="chip"
              key={category.id}
              aria-pressed={filters.category === category.id}
              onClick={() => setFilter("category", category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="browse-summary">
        <p role="status">
          {!loading && !error && `${filtered.length} ${filtered.length === 1 ? "item" : "items"} available`}
        </p>
        {active && filtered.length > 0 && (
          <button type="button" className="text-link" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        )}
      </div>

      <Results
        items={items}
        filtered={filtered}
        loading={loading}
        error={error}
        onClear={() => setParams({}, { replace: true })}
      />
    </div>
  );
}
