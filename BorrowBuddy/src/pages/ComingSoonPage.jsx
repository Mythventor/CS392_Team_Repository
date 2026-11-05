import { Link } from "react-router-dom";

export function ComingSoonPage({ title, message }) {
  return (
    <div className="container simple-page">
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to="/browse" className="button button-primary">Browse items</Link>
    </div>
  );
}
