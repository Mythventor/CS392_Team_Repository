import { useState } from "react";
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/icons";
import {
  MESSAGE_MAX,
  acceptBlocker,
  canDo,
  dealSummary,
  formatPickupTime,
  formatPrice,
  groupDeals,
  offerLabel,
  roleOf,
  validatePickup,
} from "../deals/model";
import {
  acceptOffer,
  cancelOffer,
  confirmPickup,
  declineOffer,
  markSold,
  proposePickup,
  sendMessage,
} from "../deals/offers";
import { StatusPill } from "../deals/OfferPanel";
import { useLiveItem, useMessages, useMyDeals, useOffer } from "../deals/useDeals";
import "../deals/Deals.css";
import "./AccountPages.css";

function SignedInOnly({ children }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <p className="container deals-page" role="status">Loading your account…</p>;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (error) return <p className="container deals-page notice-error" role="alert">{error}</p>;
  return children;
}

function ItemThumb({ deal, size = 64 }) {
  return (
    <div className="deal-thumb" style={{ width: size, height: size }}>
      {deal.itemPhotoURL ? <img src={deal.itemPhotoURL} alt="" loading="lazy" /> : <Icon name="other" size={size * 0.45} />}
    </div>
  );
}

// ----- /deals -----

function DealCard({ deal, uid }) {
  const role = roleOf(deal, uid);
  const other = role === "seller" ? deal.buyerName : deal.sellerName;
  return (
    <li>
      <Link to={`/deals/${deal.id}`} className="deal-card">
        <ItemThumb deal={deal} />
        <div className="deal-card-body">
          <div className="deal-card-top">
            <h3>{deal.itemTitle}</h3>
            <StatusPill status={deal.status} />
          </div>
          <p className="deal-card-meta">
            {offerLabel(deal)} · {role === "seller" ? `Buyer: ${other}` : `From ${other}`}
          </p>
          <p className="deal-card-summary">{dealSummary(deal, uid)}</p>
        </div>
      </Link>
    </li>
  );
}

const GROUPS = [
  ["action", "Needs your answer"],
  ["active", "Reserved"],
  ["waiting", "Waiting on the seller"],
  ["past", "History"],
];

function Deals() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "selling" ? "selling" : "buying";
  const { data, loading, error } = useMyDeals(user.uid);
  const selling = data.filter((deal) => deal.sellerId === user.uid);
  const buying = data.filter((deal) => deal.buyerId === user.uid);
  const shown = tab === "selling" ? selling : buying;
  const groups = groupDeals(shown, user.uid);
  const waiting = selling.filter((deal) => deal.status === "pending").length;

  return (
    <div className="container deals-page">
      <h1>Deals</h1>
      <p className="deals-intro">Offers, pickups and sales for everything you buy and sell.</p>
      <div className="deal-tabs" role="tablist" aria-label="Deals">
        <button role="tab" type="button" aria-selected={tab === "buying"} onClick={() => setParams({}, { replace: true })}>
          Buying <span className="deal-tab-count">{buying.length}</span>
        </button>
        <button role="tab" type="button" aria-selected={tab === "selling"} onClick={() => setParams({ tab: "selling" }, { replace: true })}>
          Selling {waiting > 0 ? <span className="deal-tab-count deal-tab-alert" aria-label={`${waiting} waiting`}>{waiting}</span> : <span className="deal-tab-count">{selling.length}</span>}
        </button>
      </div>
      <div role="tabpanel">
        {loading ? <p role="status">Loading deals…</p>
          : error ? <p className="notice notice-error" role="alert">{error}</p>
            : !shown.length ? (
              <div className="empty-state">
                <h2>{tab === "selling" ? "No offers on your items yet." : "You haven't made any offers yet."}</h2>
                <p>{tab === "selling" ? "When someone wants to buy one of your listings, it shows up here." : "Find something on Browse and buy it or make an offer."}</p>
                <Link to={tab === "selling" ? "/list" : "/browse"} className="button button-primary">{tab === "selling" ? "Sell an item" : "Browse items"}</Link>
              </div>
            ) : GROUPS.filter(([key]) => groups[key].length).map(([key, title]) => (
              <section key={key} className="deal-group" aria-labelledby={`group-${key}`}>
                <h2 id={`group-${key}`}>{title} <span className="deal-group-count">{groups[key].length}</span></h2>
                <ul className="deal-list">
                  {groups[key].map((deal) => <DealCard key={deal.id} deal={deal} uid={user.uid} />)}
                </ul>
              </section>
            ))}
      </div>
    </div>
  );
}

export function DealsPage() {
  return <SignedInOnly><Deals /></SignedInOnly>;
}

// ----- /deals/:id -----

function formatStamp(millis) {
  return new Date(millis).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Timeline({ deal }) {
  const steps = [
    ["Offer made", deal.createdAt],
    ["Accepted", deal.acceptedAt],
    ["Sold", deal.soldAt],
  ];
  const ended = deal.status === "declined" ? ["Declined", deal.declinedAt] : deal.status === "cancelled" ? ["Cancelled", deal.cancelledAt] : null;
  const shown = ended ? [...steps.filter(([, at]) => at), ended] : steps;
  return (
    <ol className="deal-timeline">
      {shown.map(([label, at]) => (
        <li key={label} className={at ? "done" : ""}>
          <span className="deal-timeline-dot" aria-hidden="true" />
          <span>{label}</span>
          <time>{at ? formatStamp(at) : "—"}</time>
        </li>
      ))}
    </ol>
  );
}

function Actions({ deal, uid }) {
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });
  const seller = roleOf(deal, uid) === "seller";
  const item = useLiveItem(seller && deal.status === "pending" ? deal.itemId : null);
  const blocker = seller && deal.status === "pending" && !item.loading ? acceptBlocker(deal, item.data) : "";

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
        text: error.code === "deal/stale" ? error.message : "That didn't work. Please try again.",
        error: true,
      });
    } finally {
      setBusy("");
    }
  }

  const buttons = [];
  if (canDo("accept", deal, uid)) {
    buttons.push(
      <button key="accept" className="button button-primary" disabled={Boolean(busy) || Boolean(blocker) || item.loading}
        onClick={() => run("accept", () => acceptOffer(deal), () => "Accepted. The item is now reserved for this buyer.")}>
        {busy === "accept" ? "Accepting…" : "Accept offer"}
      </button>,
    );
  }
  if (canDo("decline", deal, uid) && confirming !== "decline") {
    buttons.push(<button key="decline" className="button button-secondary" disabled={Boolean(busy)} onClick={() => setConfirming("decline")}>Decline</button>);
  }
  if (canDo("sell", deal, uid)) {
    buttons.push(
      <button key="sell" className="button button-primary" disabled={Boolean(busy)}
        onClick={() => run("sell", () => markSold(deal, uid),
          (declined) => declined ? `Marked as sold. ${declined} other ${declined === 1 ? "offer was" : "offers were"} declined automatically.` : "Marked as sold. Congrats on the sale!")}>
        {busy === "sell" ? "Saving…" : "Mark as sold"}
      </button>,
    );
  }
  if (canDo("cancel", deal, uid) && confirming !== "cancel") {
    buttons.push(
      <button key="cancel" className="text-link deal-cancel" disabled={Boolean(busy)} onClick={() => setConfirming("cancel")}>
        {deal.status === "pending" ? "Withdraw offer" : "Call off deal"}
      </button>,
    );
  }

  return (
    <div className="deal-actions-wrap">
      {blocker && <p className="notice notice-error">{blocker}</p>}
      {buttons.length > 0 && <div className="deal-actions">{buttons}</div>}
      {confirming === "decline" && (
        <div className="deal-confirm">
          <div className="field">
            <label htmlFor="decline-reason">Reason <span className="field-optional">(optional, shown to the buyer)</span></label>
            <input id="decline-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Too low, but I'd take $18" />
          </div>
          <div className="deal-actions">
            <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => run("decline", () => declineOffer(deal, reason), () => "Offer declined.")}>
              {busy === "decline" ? "Declining…" : "Decline offer"}
            </button>
            <button className="text-link" onClick={() => setConfirming("")}>Keep it</button>
          </div>
        </div>
      )}
      {confirming === "cancel" && (
        <div className="deal-confirm">
          <p>{deal.status === "pending" ? "Withdraw this offer?" : "Call off this deal? The item goes back on sale for everyone."}</p>
          <div className="deal-actions">
            <button className="button button-secondary" disabled={Boolean(busy)} onClick={() => run("cancel", () => cancelOffer(deal, uid), () => "Cancelled.")}>
              {busy === "cancel" ? "Cancelling…" : deal.status === "pending" ? "Withdraw offer" : "Call off deal"}
            </button>
            <button className="text-link" onClick={() => setConfirming("")}>Keep it</button>
          </div>
        </div>
      )}
      {message.text && <p className={`notice${message.error ? " notice-error" : ""}`} role={message.error ? "alert" : "status"}>{message.text}</p>}
    </div>
  );
}

function PickupPlan({ deal, uid }) {
  const plan = deal.pickup;
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ place: plan?.place ?? "", time: plan?.time ?? "", note: plan?.note ?? "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const canPlan = deal.status === "accepted";
  if (!canPlan && !plan) return null;

  async function save(event) {
    event.preventDefault();
    const next = validatePickup(values);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFailure("");
    try {
      await proposePickup(deal, uid, values);
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
    try { await confirmPickup(deal, uid); }
    catch (error) { console.error(error); setFailure("Couldn't confirm. Please try again."); }
    finally { setBusy(false); }
  }

  const otherName = roleOf(deal, uid) === "seller" ? deal.buyerName : deal.sellerName;
  return (
    <section className="panel deal-section" aria-labelledby="pickup-title">
      <h2 id="pickup-title">Pickup plan</h2>
      {editing || (!plan && canPlan) ? (
        <form onSubmit={save} noValidate>
          {!plan && !editing && <p className="offer-hint">Suggest where and when to meet. {otherName} confirms it.</p>}
          <div className="pickup-fields">
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
          <div className="deal-actions">
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
            <div className="deal-actions">
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

function Messages({ deal, uid }) {
  const { profile, user } = useAuth();
  const { data, loading, error } = useMessages(deal.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const otherName = roleOf(deal, uid) === "seller" ? deal.buyerName : deal.sellerName;

  async function send(event) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setFailure("");
    try {
      await sendMessage(deal.id, { uid, name: profile?.displayName || user.displayName, text });
      setText("");
    } catch (err) {
      console.error("Message failed", err);
      setFailure("Your message wasn't sent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel deal-section" aria-labelledby="messages-title">
      <h2 id="messages-title">Messages</h2>
      {loading ? <p role="status">Loading messages…</p> : error ? <p role="alert">{error}</p> : (
        <ol className="message-list" aria-live="polite">
          {deal.message && (
            <li className={deal.buyerId === uid ? "mine" : ""}>
              <span className="message-meta">{deal.buyerName} · with the offer</span>
              <p>{deal.message}</p>
            </li>
          )}
          {data.map((m) => (
            <li key={m.id} className={m.senderId === uid ? "mine" : ""}>
              <span className="message-meta">{m.senderId === uid ? "You" : m.senderName} · {formatStamp(m.createdAt)}</span>
              <p>{m.text}</p>
            </li>
          ))}
          {!deal.message && !data.length && <li className="message-empty">No messages yet. Say hi to {otherName}.</li>}
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

function DealDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data: deal, loading, error } = useOffer(id);

  if (loading) return <p className="container deals-page" role="status">Loading deal…</p>;
  if (error || !deal) {
    return (
      <div className="container deals-page">
        <p role="alert">{error || "This deal doesn't exist, or it isn't one of yours."}</p>
        <Link to="/deals">Back to deals</Link>
      </div>
    );
  }
  const role = roleOf(deal, user.uid);
  const otherName = role === "seller" ? deal.buyerName : deal.sellerName;

  return (
    <div className="container deals-page deal-detail">
      <Link to={`/deals${role === "seller" ? "?tab=selling" : ""}`}>← All deals</Link>
      {location.state?.sent && deal.status === "pending" && <p className="notice" role="status">Offer sent! {deal.sellerName} will get back to you.</p>}
      <div className="deal-hero">
        <ItemThumb deal={deal} size={96} />
        <div>
          <p className="listing-eyebrow">{role === "seller" ? "Offer on your item" : "Your offer"}</p>
          <h1><Link to={`/items/${deal.itemId}`}>{deal.itemTitle}</Link></h1>
          <div className="deal-hero-status">
            <StatusPill status={deal.status} />
            <span>{dealSummary(deal, user.uid)}</span>
          </div>
        </div>
      </div>

      <div className="deal-columns">
        <div>
          <section className="panel deal-section" aria-labelledby="details-title">
            <h2 id="details-title" className="visually-hidden">Details</h2>
            <dl className="listing-facts">
              <dt>Price</dt><dd>{deal.offerPrice === deal.listPrice ? formatPrice(deal.offerPrice) : `${formatPrice(deal.offerPrice)} offered · asking ${formatPrice(deal.listPrice)}`}</dd>
              <dt>Payment</dt><dd>In person at pickup (cash, Venmo, etc.)</dd>
              <dt>{role === "seller" ? "Buyer" : "Seller"}</dt>
              <dd className="deal-person"><Avatar name={otherName} size={26} /> {otherName}</dd>
              {deal.declineReason && <><dt>Reason</dt><dd>{deal.declineReason}</dd></>}
            </dl>
            <Actions deal={deal} uid={user.uid} />
          </section>
          <PickupPlan key={`${deal.pickup?.place}|${deal.pickup?.time}`} deal={deal} uid={user.uid} />
          <Messages deal={deal} uid={user.uid} />
        </div>
        <aside className="panel deal-section" aria-labelledby="timeline-title">
          <h2 id="timeline-title">Timeline</h2>
          <Timeline deal={deal} />
        </aside>
      </div>
    </div>
  );
}

export function DealDetailPage() {
  return <SignedInOnly><DealDetail /></SignedInOnly>;
}
