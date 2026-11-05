import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Icon } from "../components/icons";
import { ItemCard, ItemGridSkeleton } from "../components/ItemCard";
import { browseUrl, CATEGORIES } from "../items/model";
import { useAvailableItems } from "../items/useAvailableItems";
import "./HomePage.css";

const STEPS = [
  { title: "Find it nearby", text: "Search what students on your campus are lending, or filter by category." },
  { title: "Ask to borrow", text: "Pick the dates you need it and send the owner a request." },
  { title: "Pick up and return", text: "Agree on a meetup, use it, and bring it back when you're done." },
];

const HERO_TILES = ["tools", "books", "electronics", "outdoors", "kitchen", "events"];

function HeroSearch() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <form
      className="hero-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        navigate(browseUrl({ q }));
      }}
    >
      <Icon name="search" size={20} />
      <input
        type="search"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Try “drill” or “projector”"
        aria-label="Search items"
      />
      <button type="submit" className="button button-primary">Search</button>
    </form>
  );
}

function RecentItems() {
  const { items, loading, error } = useAvailableItems();

  if (loading) return <ItemGridSkeleton />;
  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  if (!items.length) {
    return (
      <div className="empty-state">
        <h3>Nothing listed yet</h3>
        <p>Got something you don't use every day? Be the first to lend it.</p>
        <Link to="/list" className="button button-primary">List an item</Link>
      </div>
    );
  }
  return (
    <div className="item-grid">
      {items.slice(0, 8).map((item) => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}

export function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <h1>Why buy it when someone on campus has one?</h1>
            <p className="hero-lede">
              Borrow tools, textbooks, gear, and more from the students around you.
            </p>
            <HeroSearch />
          </div>
          <div className="hero-art" aria-hidden="true">
            {HERO_TILES.map((name) => (
              <div className="hero-tile" data-tile={name} key={name}>
                <Icon name={name} size={38} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container home-section" aria-labelledby="categories-heading">
        <h2 id="categories-heading">Browse by category</h2>
        <ul className="category-grid">
          {CATEGORIES.map((category) => (
            <li key={category.id}>
              <Link to={browseUrl({ category: category.id })} className="category-tile">
                <Icon name={category.id} size={24} />
                <span>{category.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container home-section" aria-labelledby="recent-heading">
        <div className="section-heading">
          <h2 id="recent-heading">Recently listed</h2>
          <Link to="/browse" className="text-link">
            See everything <Icon name="arrow" size={16} />
          </Link>
        </div>
        <RecentItems />
      </section>

      <section className="container home-section" aria-labelledby="how-heading">
        <h2 id="how-heading">How it works</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-number" aria-hidden="true">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container home-section">
        <div className="home-cta">
          <div>
            <h2>Got something sitting in your closet?</h2>
            <p>Lend it to someone who needs it this week.</p>
          </div>
          <Link to={user ? "/list" : "/signin?next=/list"} className="button button-light">
            List an item
          </Link>
        </div>
      </section>
    </>
  );
}
