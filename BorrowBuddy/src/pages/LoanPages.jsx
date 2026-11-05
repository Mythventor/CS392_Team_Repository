import { useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/icons";
import { localDateString } from "../items/model";
import {
  MESSAGE_MAX,
  bookingConflict,
  canDo,
  formatPickupTime,
  formatRange,
  groupLoans,
  isOverdue,
  loanLength,
  loanSummary,
  roleOf,
  validatePickup,
} from "../borrowing/model";
import {
  acceptRequest,
  cancelRequest,
  confirmPickup,
  declineRequest,
  markPickedUp,
  markReturned,
  proposePickup,
  sendMessage,
} from "../borrowing/requests";
import { StatusPill } from "../borrowing/RequestPanel";
import { useBookedDays, useLoan, useMessages, useMyLoans } from "../borrowing/useLoans";
import "../borrowing/Borrowing.css";
import "./AccountPages.css";

function SignedInOnly({ children }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <p className="container loans-page" role="status">Loading your account…</p>;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (error) return <p className="container loans-page notice-error" role="alert">{error}</p>;
  return children;
}

function ItemThumb({ loan, size = 64 }) {
  return (
    <div className="loan-thumb" style={{ width: size, height: size }}>
      {loan.itemPhotoURL ? <img src={loan.itemPhotoURL} alt="" loading="lazy" /> : <Icon name="other" size={size * 0.45} />}
    </div>
  );
}

// ----- /loans -----

function LoanCard({ loan, uid, today }) {
  const role = roleOf(loan, uid);
  const other = role === "owner" ? loan.borrowerName : loan.ownerName;
  return (
    <li>
      <Link to={`/loans/${loan.id}`} className="loan-card">
        <ItemThumb loan={loan} />
        <div className="loan-card-body">
          <div className="loan-card-top">
            <h3>{loan.itemTitle}</h3>
            {isOverdue(loan, today) ? <span className="status-pill status-danger">Overdue</span> : <StatusPill status={loan.status} />}
          </div>
          <p className="loan-card-meta">
            {formatRange(loan.startDate, loan.endDate)} · {role === "owner" ? `Borrower: ${other}` : `From ${other}`}
          </p>
          <p className="loan-card-summary">{loanSummary(loan, uid, today)}</p>
        </div>
      </Link>
    </li>
  );
}

const GROUPS = [
  ["action", "Needs your attention"],
  ["out", "Out right now"],
  ["upcoming", "Coming up"],
  ["past", "History"],
];

function Loans() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "lending" ? "lending" : "borrowing";
  const { data, loading, error } = useMyLoans(user.uid);
  const today = localDateString();
  const lending = data.filter((loan) => loan.ownerId === user.uid);
  const borrowing = data.filter((loan) => loan.borrowerId === user.uid);
  const shown = tab === "lending" ? lending : borrowing;
  const groups = groupLoans(shown, user.uid, today);
  const waiting = lending.filter((loan) => loan.status === "pending").length;

  return (
    <div className="container loans-page">
      <h1>Loans</h1>
      <p className="loans-intro">Requests, pickups and returns for everything you borrow and lend.</p>
      <div className="loan-tabs" role="tablist" aria-label="Loans">
        <button role="tab" type="button" aria-selected={tab === "borrowing"} onClick={() => setParams({}, { replace: true })}>
          Borrowing <span className="loan-tab-count">{borrowing.length}</span>
        </button>
        <button role="tab" type="button" aria-selected={tab === "lending"} onClick={() => setParams({ tab: "lending" }, { replace: true })}>
          Lending {waiting > 0 ? <span className="loan-tab-count loan-tab-alert" aria-label={`${waiting} waiting`}>{waiting}</span> : <span className="loan-tab-count">{lending.length}</span>}
        </button>
      </div>
      <div role="tabpanel">
        {loading ? <p role="status">Loading loans…</p>
          : error ? <p className="notice notice-error" role="alert">{error}</p>
            : !shown.length ? (
              <div className="empty-state">
                <h2>{tab === "lending" ? "No requests for your items yet." : "You haven't borrowed anything yet."}</h2>
                <p>{tab === "lending" ? "When someone asks to borrow one of your listings, it shows up here." : "Find something on Browse and request the days you need it."}</p>
                <Link to={tab === "lending" ? "/list" : "/browse"} className="button button-primary">{tab === "lending" ? "List an item" : "Browse items"}</Link>
              </div>
            ) : GROUPS.filter(([key]) => groups[key].length).map(([key, title]) => (
              <section key={key} className="loan-group" aria-labelledby={`group-${key}`}>
                <h2 id={`group-${key}`}>{title} <span className="loan-group-count">{groups[key].length}</span></h2>
                <ul className="loan-list">
                  {groups[key].map((loan) => <LoanCard key={loan.id} loan={loan} uid={user.uid} today={today} />)}
                </ul>
              </section>
            ))}
      </div>
    </div>
  );
}

export function LoansPage() {
  return <SignedInOnly><Loans /></SignedInOnly>;
}

// ----- /loans/:id -----

function formatStamp(millis) {
  return new Date(millis).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Timeline({ loan }) {
  const steps = [
    ["Requested", loan.createdAt],
    ["Accepted", loan.acceptedAt],
    ["Picked up", loan.pickedUpAt],
    ["Returned", loan.returnedAt],
  ];
  const ended = loan.status === "declined" ? ["Declined", loan.declinedAt] : loan.status === "cancelled" ? ["Cancelled", loan.cancelledAt] : null;
  const shown = ended ? [...steps.filter(([, at]) => at), ended] : steps;
  return (
    <ol className="loan-timeline">
      {shown.map(([label, at]) => (
        <li key={label} className={at ? "done" : ""}>
          <span className="loan-timeline-dot" aria-hidden="true" />
          <span>{label}</span>
          <time>{at ? formatStamp(at) : "—"}</time>
        </li>
      ))}
    </ol>
  );
}

function Actions({ loan, uid, booked }) {
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });
  const conflict = loan.status === "pending" && bookingConflict(loan, booked);
  const today = localDateString();

  async function run(action, work, done) {
    setBusy(action);
    setMessage({ text: "", error: false });
    try {
      const result = await work();
      setConfirming("");
      if (done) setMessage({ text: done(result), error: false });
    } catch (error) {
      console.error(`Could not ${action}`, error);
      setMessage({
        text: error.code === "booking/conflict" ? "Some of these days were just booked for another loan, so this request can't be accepted."
          : error.code === "booking/stale" ? "This request was already answered. The page now shows its latest status."
            : "That didn't work. Please try again.",
        error: true,
      });
    } finally {
      setBusy("");
    }
  }

  const buttons = [];
  if (canDo("accept", loan, uid)) {
    buttons.push(
      <button key="accept" className="button button-primary" disabled={Boolean(busy) || conflict}
        onClick={() => run("accept", () => acceptRequest(loan, uid),
          (declined) => declined ? `Accepted. ${declined} overlapping ${declined === 1 ? "request was" : "requests were"} declined automatically.` : "Accepted. These days are now booked.")}>
        {busy === "accept" ? "Accepting…" : "Accept"}
      </button>,
    );
  }
  if (canDo("decline", loan, uid)) {
    buttons.push(confirming === "decline" ? null : (
      <button key="decline" className="button button-secondary" disabled={Boolean(busy)} onClick={() => setConfirming("decline")}>Decline</button>
    ));
  }
  if (canDo("pickup", loan, uid)) {
    buttons.push(
      <button key="pickup" className="button button-primary" disabled={Boolean(busy)}
        onClick={() => run("pickup", () => markPickedUp(loan, uid), () => "Marked as picked up.")}>
        {busy === "pickup" ? "Saving…" : loan.ownerId === uid ? "Mark as handed over" : "Mark as picked up"}
      </button>,
    );
  }
  if (canDo("return", loan, uid)) {
    buttons.push(
      <button key="return" className="button button-primary" disabled={Boolean(busy)}
        onClick={() => run("return", () => markReturned(loan), () => "Return confirmed. Thanks for lending!")}>
        {busy === "return" ? "Saving…" : "Confirm it's returned"}
      </button>,
    );
  }
  if (canDo("cancel", loan, uid) && confirming !== "cancel") {
    buttons.push(
      <button key="cancel" className="text-link loan-cancel" disabled={Boolean(busy)} onClick={() => setConfirming("cancel")}>
        {loan.status === "pending" ? "Withdraw request" : "Cancel loan"}
      </button>,
    );
  }

  return (
    <div className="loan-actions-wrap">
      {conflict && <p className="notice notice-error">Some of these days are already booked for another loan. Decline this request or ask the borrower for different dates.</p>}
      {loan.status === "accepted" && loan.startDate < today && <p className="notice">The loan was due to start {formatRange(loan.startDate, loan.startDate)}. Mark the pickup once the item changes hands, or cancel if it isn't happening.</p>}
      {buttons.some(Boolean) && <div className="loan-actions">{buttons}</div>}
      {confirming === "decline" && (
        <div className="loan-confirm">
          <div className="field">
            <label htmlFor="decline-reason">Reason <span className="field-optional">(optional, shown to the borrower)</span></label>
            <input id="decline-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. I need it that weekend" />
          </div>
          <div className="loan-actions">
            <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => run("decline", () => declineRequest(loan, reason), () => "Request declined.")}>
              {busy === "decline" ? "Declining…" : "Decline request"}
            </button>
            <button className="text-link" onClick={() => setConfirming("")}>Keep it</button>
          </div>
        </div>
      )}
      {confirming === "cancel" && (
        <div className="loan-confirm">
          <p>{loan.status === "pending" ? "Withdraw this request?" : "Cancel this loan? The days become available to others again."}</p>
          <div className="loan-actions">
            <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => run("cancel", () => cancelRequest(loan, uid), () => "Cancelled.")}>
              {busy === "cancel" ? "Cancelling…" : loan.status === "pending" ? "Withdraw request" : "Cancel loan"}
            </button>
            <button className="text-link" onClick={() => setConfirming("")}>Keep it</button>
          </div>
        </div>
      )}
      {message.text && <p className={`notice${message.error ? " notice-error" : ""}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
    </div>
  );
}

function PickupPlan({ loan, uid }) {
  const plan = loan.pickup;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ place: plan?.place ?? "", time: plan?.time ?? `${loan.startDate}T12:00`, note: plan?.note ?? "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const canPlan = ["accepted", "picked_up"].includes(loan.status);
  if (!canPlan && !plan) return null;

  async function save(event) {
    event.preventDefault();
    const next = validatePickup(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFailure("");
    try {
      await proposePickup(loan, uid, values);
      setEditing(false);
    } catch (error) {
      console.error("Could not save pickup plan", error);
      setFailure("The plan couldn't be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setFailure("");
    try { await confirmPickup(loan, uid); }
    catch (error) { console.error(error); setFailure("Couldn't confirm. Please try again."); }
    finally { setBusy(false); }
  }

  const otherName = roleOf(loan, uid) === "owner" ? loan.borrowerName : loan.ownerName;
  return (
    <section className="panel loan-section" aria-labelledby="pickup-title">
      <h2 id="pickup-title">Pickup plan</h2>
      {editing || (!plan && canPlan) ? (
        <form onSubmit={save} noValidate>
          {!plan && !editing && <p className="borrow-hint">Suggest where and when to meet. {otherName} confirms it.</p>}
          <div className="borrow-dates">
            <div className="field">
              <label htmlFor="pickup-place">Where</label>
              <input id="pickup-place" value={values.place} maxLength={120} placeholder="e.g. Main library entrance"
                onChange={(e) => setValues({ ...values, place: e.target.value })} aria-invalid={Boolean(errors.place)} />
              {errors.place && <p className="field-error">{errors.place}</p>}
            </div>
            <div className="field">
              <label htmlFor="pickup-time">When</label>
              <input id="pickup-time" type="datetime-local" value={values.time}
                onChange={(e) => setValues({ ...values, time: e.target.value })} aria-invalid={Boolean(errors.time)} />
              {errors.time && <p className="field-error">{errors.time}</p>}
            </div>
          </div>
          <div className="field">
            <label htmlFor="pickup-note">Note <span className="field-optional">(optional)</span></label>
            <input id="pickup-note" value={values.note} maxLength={200} placeholder="e.g. I'll be wearing a red jacket"
              onChange={(e) => setValues({ ...values, note: e.target.value })} />
          </div>
          {failure && <p className="notice notice-error" role="alert">{failure}</p>}
          <div className="loan-actions">
            <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : plan ? "Suggest this instead" : "Suggest plan"}</button>
            {plan && <button type="button" className="text-link" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
        </form>
      ) : (
        <>
          <dl className="listing-facts pickup-facts">
            <dt>Where</dt><dd>{plan.place}</dd>
            <dt>When</dt><dd>{formatPickupTime(plan.time)}</dd>
            {plan.note && <><dt>Note</dt><dd>{plan.note}</dd></>}
          </dl>
          <p className={`pickup-state${plan.confirmedBy ? " confirmed" : ""}`}>
            {plan.confirmedBy ? "✓ Both of you agreed on this plan."
              : plan.proposedBy === uid ? `Waiting for ${otherName} to confirm.` : `${otherName} suggested this plan.`}
          </p>
          {failure && <p className="notice notice-error" role="alert">{failure}</p>}
          {canPlan && (
            <div className="loan-actions">
              {!plan.confirmedBy && plan.proposedBy !== uid && (
                <button className="button button-primary" disabled={busy} onClick={confirm}>{busy ? "Confirming…" : "Confirm plan"}</button>
              )}
              <button className="text-link" onClick={() => { setValues({ place: plan.place, time: plan.time, note: plan.note }); setEditing(true); }}>
                Suggest a change
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Messages({ loan, uid }) {
  const { profile, user } = useAuth();
  const { data, loading, error } = useMessages(loan.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const otherName = roleOf(loan, uid) === "owner" ? loan.borrowerName : loan.ownerName;

  async function send(event) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setFailure("");
    try {
      await sendMessage(loan.id, { uid, name: profile?.displayName || user.displayName, text });
      setText("");
    } catch (err) {
      console.error("Message failed", err);
      setFailure("Your message wasn't sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel loan-section" aria-labelledby="messages-title">
      <h2 id="messages-title">Messages</h2>
      {loading ? <p role="status">Loading messages…</p> : error ? <p role="alert">{error}</p> : (
        <ol className="message-list" aria-live="polite">
          {loan.message && (
            <li className={loan.borrowerId === uid ? "mine" : ""}>
              <span className="message-meta">{loan.borrowerName} · with the request</span>
              <p>{loan.message}</p>
            </li>
          )}
          {data.map((m) => (
            <li key={m.id} className={m.senderId === uid ? "mine" : ""}>
              <span className="message-meta">{m.senderId === uid ? "You" : m.senderName} · {formatStamp(m.createdAt)}</span>
              <p>{m.text}</p>
            </li>
          ))}
          {!loan.message && !data.length && <li className="message-empty">No messages yet. Say hi to {otherName}.</li>}
        </ol>
      )}
      <form className="message-form" onSubmit={send}>
        <label htmlFor="message-text" className="visually-hidden">Message to {otherName}</label>
        <input id="message-text" value={text} maxLength={MESSAGE_MAX * 2} onChange={(e) => setText(e.target.value)} placeholder={`Message ${otherName}…`} />
        <button className="button button-primary" disabled={busy || !text.trim()}>{busy ? "Sending…" : "Send"}</button>
      </form>
      {failure && <p className="notice notice-error" role="alert">{failure}</p>}
    </section>
  );
}

function LoanDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data: loan, loading, error } = useLoan(id);
  const booked = useBookedDays(loan?.itemId);
  const today = localDateString();

  if (loading) return <p className="container loans-page" role="status">Loading request…</p>;
  if (error || !loan) {
    return (
      <div className="container loans-page">
        <p role="alert">{error || "This request doesn't exist, or it isn't one of yours."}</p>
        <Link to="/loans">Back to loans</Link>
      </div>
    );
  }
  const role = roleOf(loan, user.uid);
  const otherName = role === "owner" ? loan.borrowerName : loan.ownerName;
  const days = loanLength(loan.startDate, loan.endDate);

  return (
    <div className="container loans-page loan-detail">
      <Link to={`/loans${role === "owner" ? "?tab=lending" : ""}`}>← All loans</Link>
      {location.state?.sent && loan.status === "pending" && <p className="notice" role="status">Request sent! {loan.ownerName} will get back to you.</p>}
      <div className="loan-hero">
        <ItemThumb loan={loan} size={96} />
        <div>
          <p className="listing-eyebrow">{role === "owner" ? "Request for your item" : "Your request"}</p>
          <h1><Link to={`/items/${loan.itemId}`}>{loan.itemTitle}</Link></h1>
          <div className="loan-hero-status">
            {isOverdue(loan, today) ? <span className="status-pill status-danger">Overdue</span> : <StatusPill status={loan.status} />}
            <span>{loanSummary(loan, user.uid, today)}</span>
          </div>
        </div>
      </div>

      <div className="loan-columns">
        <div>
          <section className="panel loan-section" aria-labelledby="details-title">
            <h2 id="details-title" className="visually-hidden">Details</h2>
            <dl className="listing-facts">
              <dt>Dates</dt><dd>{formatRange(loan.startDate, loan.endDate)} <span className="field-optional">({days} {days === 1 ? "day" : "days"})</span></dd>
              <dt>{role === "owner" ? "Borrower" : "Owner"}</dt>
              <dd className="loan-person"><Avatar name={otherName} size={26} /> {otherName}</dd>
              {loan.declineReason && <><dt>Reason</dt><dd>{loan.declineReason}</dd></>}
            </dl>
            <Actions loan={loan} uid={user.uid} booked={booked.data} />
          </section>
          <PickupPlan key={`${loan.pickup?.place}|${loan.pickup?.time}`} loan={loan} uid={user.uid} />
          <Messages loan={loan} uid={user.uid} />
        </div>
        <aside className="panel loan-section" aria-labelledby="timeline-title">
          <h2 id="timeline-title">Timeline</h2>
          <Timeline loan={loan} />
        </aside>
      </div>
    </div>
  );
}

export function LoanDetailPage() {
  return <SignedInOnly><LoanDetail /></SignedInOnly>;
}
