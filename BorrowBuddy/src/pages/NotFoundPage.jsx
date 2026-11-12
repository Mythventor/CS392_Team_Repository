import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="container simple-page">
      <h1>We can't find that page</h1>
      <p>The link may be old, or the page may have moved.</p>
      <Link to="/" className="button button-primary">Go home</Link>
    </div>
  );
}
