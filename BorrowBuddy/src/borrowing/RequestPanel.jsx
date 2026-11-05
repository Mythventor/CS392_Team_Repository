// The "Request to borrow" box on an item's page.
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { isAvailable, localDateString } from "../items/model";
import { ACTIVE_STATUSES, MAX_LOAN_DAYS, MESSAGE_MAX, STATUS, addDays, formatRange, loanLength, validateRequest } from "./model";
import { createRequest } from "./requests";
import { useBookedDays, useMyRequestsForItem } from "./useLoans";
import "./Borrowing.css";

// Collapses booked days into readable ranges: ["Nov 10 – Nov 12", "Nov 20"].
function bookedRanges(days) {
  const sorted = [...days].sort();
  const ranges = [];
  for (const day of sorted) {
    const last = ranges.at(-1);
    if (last && addDays(last.end, 1) === day) last.end = day;
    else ranges.push({ start: day, end: day });
  }
  return ranges.map((range) => formatRange(range.start, range.end));
}

export function StatusPill({ status }) {
  const info = STATUS[status] ?? { label: status, tone: "muted" };
  return <span className={`status-pill status-${info.tone}`}>{info.label}</span>;
}

function RequestForm({ item, bookedDays }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const today = localDateString();
  const earliest = item.availableFrom && item.availableFrom > today ? item.availableFrom : today;
  const [values, setValues] = useState({ startDate: "", endDate: "", message: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const upcoming = bookedDays.filter((day) => day >= today);

  function change(event) {
    const { name, value } = event.target;
    setValues((current) => {
      const next = { ...current, [name]: value };
      // Picking a start after the current end moves the end along with it.
      if (name === "startDate" && value && (!current.endDate || current.endDate < value)) next.endDate = value;
      return next;
    });
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    const next = validateRequest(values, item, bookedDays, today);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFailure("");
    try {
      const id = await createRequest({ item, values, user, profile });
      navigate(`/loans/${id}`, { state: { sent: true } });
    } catch (error) {
      console.error("Request failed", error);
      setFailure("Your request couldn't be sent. Check the dates and try again.");
      setSaving(false);
    }
  }

  const days = values.startDate && values.endDate && values.endDate >= values.startDate
    ? loanLength(values.startDate, values.endDate) : 0;

  return (
    <form className="panel borrow-panel" onSubmit={submit} noValidate>
      <h2>Request to borrow</h2>
      <p className="borrow-hint">Pick the days you need it, up to {MAX_LOAN_DAYS} days. {item.ownerName || "The owner"} will accept or decline.</p>
      <fieldset disabled={saving}>
        <div className="borrow-dates">
          <div className="field">
            <label htmlFor="startDate">First day</label>
            <input id="startDate" name="startDate" type="date" value={values.startDate} min={earliest}
              max={item.availableTo || undefined} onChange={change}
              aria-invalid={Boolean(errors.startDate)} aria-describedby={errors.startDate ? "startDate-error" : undefined} />
            {errors.startDate && <p className="field-error" id="startDate-error">{errors.startDate}</p>}
          </div>
          <div className="field">
            <label htmlFor="endDate">Return by</label>
            <input id="endDate" name="endDate" type="date" value={values.endDate} min={values.startDate || earliest}
              max={item.availableTo || undefined} onChange={change}
              aria-invalid={Boolean(errors.endDate)} aria-describedby={errors.endDate ? "endDate-error" : undefined} />
            {errors.endDate && <p className="field-error" id="endDate-error">{errors.endDate}</p>}
          </div>
        </div>
        {days > 0 && <p className="borrow-length">{days} {days === 1 ? "day" : "days"}</p>}
        {upcoming.length > 0 && (
          <p className="borrow-booked"><strong>Already booked:</strong> {bookedRanges(upcoming).join(", ")}</p>
        )}
        <div className="field">
          <label htmlFor="message">Note to {item.ownerName || "the owner"} <span className="field-optional">(optional)</span></label>
          <textarea id="message" name="message" rows={3} maxLength={MESSAGE_MAX} value={values.message} onChange={change}
            placeholder="What it's for, when you could pick it up…" aria-invalid={Boolean(errors.message)} />
          {errors.message && <p className="field-error">{errors.message}</p>}
        </div>
        {failure && <p className="notice notice-error" role="alert">{failure}</p>}
        <button className="button button-primary button-block">{saving ? "Sending…" : "Send request"}</button>
      </fieldset>
    </form>
  );
}

export function RequestPanel({ item }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const booked = useBookedDays(item.id);
  const mine = useMyRequestsForItem(item.id, user?.uid);

  if (item.archived || !isAvailable(item)) return null;
  if (loading) return null;
  if (!user) {
    return (
      <div className="panel borrow-panel">
        <h2>Want to borrow this?</h2>
        <p className="borrow-hint">Sign in to request it for the days you need.</p>
        <Link className="button button-primary" to={`/signin?next=${encodeURIComponent(location.pathname)}`}>Sign in to request</Link>
      </div>
    );
  }
  if (booked.loading || mine.loading) return <p className="borrow-hint" role="status">Checking availability…</p>;

  const active = mine.data.filter((request) => ACTIVE_STATUSES.includes(request.status));
  return (
    <>
      {booked.error && <p className="notice notice-error" role="alert">{booked.error}</p>}
      {active.map((request) => (
        <div className="panel borrow-panel borrow-existing" key={request.id}>
          <div className="borrow-existing-head">
            <h2>Your request</h2>
            <StatusPill status={request.status} />
          </div>
          <p>{formatRange(request.startDate, request.endDate)}</p>
          <Link className="button button-secondary" to={`/loans/${request.id}`}>View request</Link>
        </div>
      ))}
      {!active.length && <RequestForm item={item} bookedDays={booked.data.map((day) => day.id)} />}
    </>
  );
}

// What the owner sees on their own item's page.
export function OwnerLoansNote() {
  return (
    <p className="borrow-hint">
      Requests for your items show up in <Link to="/loans?tab=lending">Loans</Link>.
    </p>
  );
}
