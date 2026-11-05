import { Link } from "react-router-dom";
import { campusLabel, categoryLabel } from "../items/model";
import { Icon } from "./icons";
import "./ItemCard.css";

export function ItemCard({ item }) {
  const campus = campusLabel(item.campus);
  return (
    <article className="item-card">
      <Link to={`/items/${item.id}`} className="item-card-link">
        <div className="item-card-media" data-category={item.category}>
          {item.photoURL
            ? <img src={item.photoURL} alt="" loading="lazy" />
            : <Icon name={item.category} size={44} />}
        </div>
        <div className="item-card-body">
          <p className="item-card-category">{categoryLabel(item.category) || "Other"}</p>
          <h3>{item.title}</h3>
          {campus && (
            <p className="item-card-meta">
              <Icon name="pin" size={15} />
              <span>{campus}</span>
            </p>
          )}
          {item.ownerName && <p className="item-card-owner">Lent by {item.ownerName}</p>}
        </div>
      </Link>
    </article>
  );
}

export function ItemGridSkeleton({ count = 4 }) {
  return (
    <div className="item-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="item-card item-card-skeleton" key={index}>
          <div className="item-card-media" />
          <div className="item-card-body">
            <span />
            <span />
          </div>
        </div>
      ))}
    </div>
  );
}
