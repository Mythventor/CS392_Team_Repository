import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  CATEGORIES,
  SCHOOLS,
  DEFAULT_SCHOOL,
  categoryLabel,
  schoolLabel,
  localDateString,
  isAvailable,
} from "../items/model";
import { CONDITIONS, photoError, validateListing } from "../items/listingModel";
import {
  archiveListing,
  saveListing,
  watchItem,
  watchMyItems,
} from "../items/listings";
import { ItemCard } from "../components/ItemCard";
import { Icon } from "../components/icons";
import { OfferPanel, SellerDealsNote } from "../deals/OfferPanel";
import { formatPrice } from "../deals/model";
import "./AccountPages.css";
import "./ListingPages.css";

function useItem(id) {
  const [state, setState] = useState({
    id: null,
    loading: true,
    item: null,
    error: "",
  });
  useEffect(() => {
    if (!id) return;
    return watchItem(
      id,
      (item) => setState({ id, item, loading: false, error: "" }),
      () =>
        setState({
          id,
          item: null,
          loading: false,
          error: "Could not load this item. Refresh to try again.",
        }),
    );
  }, [id]);
  return state.id === id ? state : { item: null, loading: true, error: "" };
}
function AccountRequired({ children }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <p className="container listing-page" role="status">
        Loading your account…
      </p>
    );
  if (!user)
    return (
      <Navigate
        to={`/signin?next=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  if (error)
    return (
      <p className="container listing-page notice-error" role="alert">
        {error}
      </p>
    );
  return children;
}
function ItemState({ loading, error }) {
  return (
    <div className="container listing-page">
      <p role={error ? "alert" : "status"}>
        {loading ? "Loading item…" : error || "This item could not be found."}
      </p>
      <Link to="/browse">Back to browse</Link>
    </div>
  );
}
function ListingForm({ item }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    title: item?.title || "",
    description: item?.description || "",
    category: item?.category || "",
    school: item?.school || profile?.school || DEFAULT_SCHOOL,
    condition: item?.condition || "Good",
    pickupArea: item?.pickupArea || "",
    price: Number.isInteger(item?.price) ? String(item.price) : "",
    availableTo: item?.availableTo || "",
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function change(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const next = validateListing(values, {
      hasPhoto: Boolean(file || item?.photoURL),
    });
    setErrors(next);
    if (Object.keys(next).length) {
      setFailure("Please check the highlighted fields.");
      return;
    }
    setSaving(true);
    setFailure("");
    try {
      const id = await saveListing({ item, values, file, user, profile });
      navigate(`/items/${id}`, { state: { saved: true } });
    } catch (error) {
      console.error("Listing save failed", error);
      setFailure(
        error.code?.startsWith("photo/")
          ? error.message
          : "Your listing could not be saved. Your changes are still here; please try again.",
      );
      setSaving(false);
    }
  }
  function field(name, label, options = {}) {
    const props = {
      id: name,
      name,
      value: values[name],
      onChange: change,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
      required: !options.optional,
    };
    return (
      <div className="field" key={name}>
        <label htmlFor={name}>{label}</label>
        {options.choices ? (
          <select {...props}>
            <option value="">Choose {label.toLowerCase()}</option>
            {options.choices.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        ) : options.multiline ? (
          <textarea {...props} rows={5} maxLength={options.max} />
        ) : (
          <input
            {...props}
            type={options.type || "text"}
            maxLength={options.max}
            min={options.min}
            inputMode={options.inputMode}
            placeholder={options.placeholder}
          />
        )}
        {options.hint && <p className="field-hint">{options.hint}</p>}
        {errors[name] && (
          <p className="field-error" id={`${name}-error`}>
            {errors[name]}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="container listing-page listing-editor">
      <Link to="/my-listings">My listings</Link>
      <h1>{item ? "Edit your listing" : "Pass it down."}</h1>
      <p className="listing-intro">
        Sell what you no longer need to students at your school, or give it away
        for free. Buyers pay you in person when they pick it up.
      </p>
      <form className="panel listing-form" onSubmit={submit} noValidate>
        <fieldset disabled={saving}>
          <div className="field">
            <label htmlFor="photo">Item photo</label>
            <p className="field-hint">One JPG, PNG or WebP, up to 5 MB.</p>
            {(preview || item?.photoURL) && (
              <img
                className="listing-preview"
                src={preview || item.photoURL}
                alt="Your item preview"
              />
            )}
            <input
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={Boolean(errors.photo)}
              aria-describedby="photo-error"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (!selected) return;
                const message = photoError(selected);
                setErrors((current) => ({ ...current, photo: message }));
                if (!message) {
                  setFile(selected);
                  setPreview(URL.createObjectURL(selected));
                } else event.target.value = "";
              }}
            />
            <p className="field-error" id="photo-error">
              {errors.photo}
            </p>
          </div>
          {field("title", "Title", { max: 80 })}
          {field("description", "Description", { max: 2000, multiline: true })}
          <div className="listing-fields">
            {field("category", "Category", { choices: CATEGORIES })}
            {field("condition", "Condition", {
              choices: CONDITIONS.map((id) => ({ id, label: id })),
            })}
          </div>
          {field("school", "School", { choices: SCHOOLS })}
          {field("pickupArea", "General pickup area", { max: 120 })}
          <p className="field-hint">
            This is public. Use a campus building or neighborhood, not your home
            address.
          </p>
          <div className="listing-fields">
            {field("price", "Price in dollars", {
              inputMode: "numeric",
              max: 6,
              placeholder: "e.g. 25",
              hint: "Whole dollars. Enter 0 to give it away for free.",
            })}
            {field("availableTo", "Pick up by (optional)", {
              type: "date",
              optional: true,
              min: localDateString(),
              hint: "Moving out? Add the last day buyers can collect it.",
            })}
          </div>
          {failure && (
            <p className="notice notice-error" role="alert">
              {failure}
            </p>
          )}
          <div className="listing-actions">
            <button className="button button-primary" disabled={saving}>
              {saving ? "Saving…" : item ? "Save changes" : "Publish listing"}
            </button>
            <Link
              className="button button-secondary"
              to={item ? `/items/${item.id}` : "/my-listings"}
            >
              Cancel
            </Link>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
function listingStatus(item) {
  if (item.archived) return "Archived";
  if (item.status === "sold") return "Sold";
  if (item.status === "reserved") return "Reserved for a buyer";
  return isAvailable(item) ? "Available" : "Unavailable / past pick-up date";
}
export function CreateListingPage() {
  return (
    <AccountRequired>
      <ListingForm />
    </AccountRequired>
  );
}
function EditListing() {
  const { id } = useParams();
  const state = useItem(id);
  const { user } = useAuth();
  if (state.loading || state.error || !state.item)
    return <ItemState {...state} />;
  if (state.item.ownerId !== user.uid)
    return (
      <div className="container listing-page">
        <h1>This listing belongs to another student.</h1>
        <Link to={`/items/${id}`}>View item</Link>
      </div>
    );
  if (state.item.archived)
    return (
      <div className="container listing-page">
        <h1>This listing is archived.</h1>
        <Link to="/my-listings">My listings</Link>
      </div>
    );
  return <ListingForm item={state.item} key={id} />;
}
export function EditListingPage() {
  return (
    <AccountRequired>
      <EditListing />
    </AccountRequired>
  );
}
export function ItemDetailPage() {
  const { id } = useParams();
  const state = useItem(id);
  const { user } = useAuth();
  const location = useLocation();
  if (state.loading || state.error || !state.item)
    return <ItemState {...state} />;
  const { item } = state;
  const owner = user?.uid === item.ownerId;
  return (
    <div className="container listing-page">
      <Link to="/browse">Back to browse</Link>
      {location.state?.saved && (
        <p className="notice" role="status">
          Your listing has been saved.
        </p>
      )}
      <div className="listing-detail">
        <div className="listing-detail-photo">
          {item.photoURL ? (
            <img src={item.photoURL} alt={item.title} />
          ) : (
            <Icon name={item.category} size={80} />
          )}
        </div>
        <section>
          <p className="listing-eyebrow">{categoryLabel(item.category)}</p>
          <h1>{item.title}</h1>
          <p className="listing-price">{formatPrice(item.price)}</p>
          <p className="listing-status">{listingStatus(item)}</p>
          <p className="listing-description">
            {item.description || "No description provided."}
          </p>
          <dl className="listing-facts">
            <dt>Condition</dt>
            <dd>{item.condition || "Not specified"}</dd>
            <dt>School</dt>
            <dd>{schoolLabel(item.school)}</dd>
            <dt>Pickup area</dt>
            <dd>{item.pickupArea || "Arrange with the seller"}</dd>
            <dt>Pick up by</dt>
            <dd>{item.availableTo || "Ask the seller"}</dd>
            <dt>Payment</dt>
            <dd>In person, at pickup</dd>
            <dt>Sold by</dt>
            <dd>{item.ownerName || "A student"}</dd>
          </dl>
          {owner ? (
            <div className="listing-actions">
              {!item.archived && item.status !== "sold" && (
                <Link
                  className="button button-primary"
                  to={`/items/${id}/edit`}
                >
                  Edit listing
                </Link>
              )}
              <Link className="button button-secondary" to="/my-listings">
                My listings
              </Link>
              <SellerDealsNote />
            </div>
          ) : (
            <OfferPanel item={item} />
          )}
        </section>
      </div>
    </div>
  );
}
function MyListings() {
  const { user } = useAuth();
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(
    () =>
      watchMyItems(
        user.uid,
        (items) => setState({ items, loading: false, error: "" }),
        () =>
          setState({
            items: [],
            loading: false,
            error: "Could not load your listings. Refresh to try again.",
          }),
      ),
    [user.uid],
  );
  async function archive(id) {
    setBusy(true);
    setMessage("");
    try {
      await archiveListing(id);
      setConfirm(null);
      setMessage("Listing archived. It no longer appears in browse.");
    } catch {
      setMessage("Could not archive this listing. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container listing-page">
      <div className="listing-heading">
        <div>
          <h1>My listings</h1>
          <p className="listing-intro">Manage the things you are selling.</p>
        </div>
        <Link className="button button-primary" to="/list">
          Sell an item
        </Link>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {state.loading ? (
        <p role="status">Loading listings…</p>
      ) : state.error ? (
        <p role="alert">{state.error}</p>
      ) : !state.items.length ? (
        <div className="empty-state">
          <h2>Your first listing starts here.</h2>
          <p>
            A mini fridge, a desk lamp, last semester’s textbook—someone nearby could use it.
          </p>
          <Link to="/list" className="button button-primary">
            Sell an item
          </Link>
        </div>
      ) : (
        <div className="item-grid">
          {state.items.map((item) => (
            <section key={item.id} className="managed-listing">
              <ItemCard item={item} />
              <p className="listing-status">{listingStatus(item)}</p>
              {item.status === "reserved" && (
                <p className="field-hint">
                  Reserved for a buyer. Open <Link to="/deals?tab=selling">Deals</Link> to finish
                  or call off the sale.
                </p>
              )}
              {!item.archived && item.status !== "reserved" && item.status !== "sold" &&
                (confirm === item.id ? (
                  <div className="archive-confirm">
                    <p>
                      Archive “{item.title}”? It will disappear from browse. Its
                      record will be kept.
                    </p>
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => archive(item.id)}
                    >
                      {busy ? "Archiving…" : "Confirm archive"}
                    </button>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => setConfirm(null)}
                    >
                      Keep listing
                    </button>
                  </div>
                ) : (
                  <div className="listing-actions">
                    <Link
                      to={`/items/${item.id}/edit`}
                      className="button button-secondary"
                    >
                      Edit
                    </Link>
                    <button
                      className="text-link"
                      onClick={() => setConfirm(item.id)}
                    >
                      Archive
                    </button>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
export function MyListingsPage() {
  return (
    <AccountRequired>
      <MyListings />
    </AccountRequired>
  );
}
