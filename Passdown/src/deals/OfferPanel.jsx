// The "Buy it" box on an item's page.
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { isAvailable } from "../items/model";
import { ACTIVE_STATUSES, MESSAGE_MAX, STATUS, formatPrice, offerLabel, parsePrice, validateOffer } from "./model";
import { createOffer } from "./offers";
import { useMyOffersForItem } from "./useDeals";
import "./Deals.css";

export function StatusPill({ status }) {
  const info = STATUS[status] ?? { label: status, tone: "muted" };
  return <span className={`status-pill status-${info.tone}`}>{info.label}</span>;
}

function OfferForm({ item }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const free = item.price === 0;
  const [mode, setMode] = useState("asking");
  const [values, setValues] = useState({ offer: "", message: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const seller = item.ownerName || "the seller";

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name === "offer" ? "offerPrice" : name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const offerPrice = mode === "asking" ? item.price : parsePrice(values.offer);
    const next = validateOffer({ offerPrice, message: values.message }, item);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure("");
    try {
      const id = await createOffer({ item, values: { offerPrice, message: values.message }, user, profile });
      navigate(`/deals/${id}`, { state: { sent: true } });
    } catch (error) {
      console.error("Offer failed", error);
      setFailure("Your offer couldn't be sent. The item may have just been reserved; refresh and try again.");
      setSaving(false);
    }
  }

  return (
    <form className="panel offer-panel" onSubmit={submit} noValidate>
      <div className="offer-price-row">
        <h2>{free ? "Free to a good home" : "Buy it"}</h2>
        <span className="offer-price">{formatPrice(item.price)}</span>
      </div>
      <p className="offer-hint">
        {free
          ? `Ask ${seller} for it. If they accept, it's reserved for you.`
          : `Pay ${seller} in person when you pick it up. If they accept, it's reserved for you.`}
      </p>
      <fieldset disabled={saving}>
        {!free && (
          <div className="offer-choice" role="radiogroup" aria-label="Your price">
            <label className={mode === "asking" ? "selected" : ""}>
              <input type="radio" name="mode" value="asking" checked={mode === "asking"} onChange={() => setMode("asking")} />
              Asking price, {formatPrice(item.price)}
            </label>
            <label className={mode === "offer" ? "selected" : ""}>
              <input type="radio" name="mode" value="offer" checked={mode === "offer"} onChange={() => setMode("offer")} />
              Make an offer
            </label>
          </div>
        )}
        {mode === "offer" && !free && (
          <div className="field">
            <label htmlFor="offer">Your offer</label>
            <div className="offer-input">
              <span aria-hidden="true">$</span>
              <input id="offer" name="offer" inputMode="numeric" value={values.offer} onChange={change}
                placeholder={String(Math.max(0, Math.round(item.price * 0.8)))}
                aria-invalid={Boolean(errors.offerPrice)} aria-describedby={errors.offerPrice ? "offer-error" : undefined} />
            </div>
          </div>
        )}
        {errors.offerPrice && <p className="field-error" id="offer-error">{errors.offerPrice}</p>}
        <div className="field">
          <label htmlFor="message">Message to {seller} <span className="field-optional">(optional)</span></label>
          <textarea id="message" name="message" rows={3} maxLength={MESSAGE_MAX} value={values.message} onChange={change}
            placeholder="When you could pick it up, questions about the item…" aria-invalid={Boolean(errors.message)} />
          {errors.message && <p className="field-error">{errors.message}</p>}
        </div>
        {failure && <p className="notice notice-error" role="alert">{failure}</p>}
        <button className="button button-primary button-block">
          {saving ? "Sending…" : free ? "Ask for it" : mode === "asking" ? `Buy for ${formatPrice(item.price)}` : "Send offer"}
        </button>
      </fieldset>
    </form>
  );
}

export function OfferPanel({ item }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const mine = useMyOffersForItem(item.id, user?.uid);

  if (loading) return null;
  if (item.status === "sold") return <p className="notice">This item has been sold.</p>;
  if (item.archived || (item.status !== "reserved" && !isAvailable(item))) return null;
  const reservedNotice = (
    <p className="notice">Reserved for another buyer. If that deal falls through, it goes back on sale.</p>
  );
  if (!user) {
    if (item.status === "reserved") return reservedNotice;
    return (
      <div className="panel offer-panel">
        <div className="offer-price-row">
          <h2>Want this?</h2>
          <span className="offer-price">{formatPrice(item.price)}</span>
        </div>
        <p className="offer-hint">Sign in to buy it or make an offer.</p>
        <Link className="button button-primary" to={`/signin?next=${encodeURIComponent(location.pathname)}`}>Sign in to buy</Link>
      </div>
    );
  }
  if (mine.loading) return <p className="offer-hint" role="status">Checking your offers…</p>;
  if (item.status === "reserved" && !mine.data.some((offer) => offer.status === "accepted")) return reservedNotice;
  if (!Number.isInteger(item.price)) {
    return <p className="notice">The seller hasn't set a price for this item yet.</p>;
  }

  const active = mine.data.filter((offer) => ACTIVE_STATUSES.includes(offer.status));
  return (
    <>
      {mine.error && <p className="notice notice-error" role="alert">{mine.error}</p>}
      {active.map((offer) => (
        <div className="panel offer-panel offer-existing" key={offer.id}>
          <div className="offer-existing-head">
            <h2>Your offer</h2>
            <StatusPill status={offer.status} />
          </div>
          <p>{offerLabel(offer)}</p>
          <Link className="button button-secondary" to={`/deals/${offer.id}`}>View deal</Link>
        </div>
      ))}
      {!active.length && <OfferForm item={item} />}
    </>
  );
}

// What the seller sees on their own item's page.
export function SellerDealsNote() {
  return (
    <p className="offer-hint">
      Offers on your items show up in <Link to="/deals?tab=selling">Deals</Link>.
    </p>
  );
}
