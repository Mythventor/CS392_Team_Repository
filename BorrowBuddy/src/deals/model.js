// Buying and selling rules shared by the screens, the data layer, and the tests.
// Plain JavaScript (no Firebase or React) so it can be unit tested in Node.
// Prices are whole US dollars; 0 means the item is free.

export const MAX_PRICE = 10000;
export const MESSAGE_MAX = 500;
export const PICKUP_PLACE_MAX = 120;

// Every offer moves through these states. Arrows show who can move it where.
//   pending  → accepted (seller) · declined (seller) · cancelled (buyer)
//   accepted → sold (seller) · cancelled (either)
// Accepting reserves the item for that buyer, so it can't be sold to anyone else.
export const STATUS = {
  pending: { label: "Waiting for seller", tone: "warm" },
  accepted: { label: "Accepted", tone: "accent" },
  sold: { label: "Sold", tone: "muted" },
  declined: { label: "Declined", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export const ACTIVE_STATUSES = ["pending", "accepted"];

const TRANSITIONS = {
  accept: { from: ["pending"], to: "accepted", by: ["seller"] },
  decline: { from: ["pending"], to: "declined", by: ["seller"] },
  cancel: { from: ["pending", "accepted"], to: "cancelled", by: ["seller", "buyer"] },
  sell: { from: ["accepted"], to: "sold", by: ["seller"] },
};

export function roleOf(offer, uid) {
  if (!uid) return null;
  if (offer.sellerId === uid) return "seller";
  if (offer.buyerId === uid) return "buyer";
  return null;
}

export function canDo(action, offer, uid) {
  const rule = TRANSITIONS[action];
  const role = roleOf(offer, uid);
  if (!rule || !role || !rule.from.includes(offer.status) || !rule.by.includes(role)) return false;
  // Pending offers are withdrawn by the buyer; the seller declines instead.
  if (action === "cancel" && offer.status === "pending" && role !== "buyer") return false;
  return true;
}

export function nextStatus(action) {
  return TRANSITIONS[action]?.to ?? null;
}

// ----- Prices -----

export function formatPrice(price) {
  if (price === 0) return "Free";
  if (!Number.isInteger(price)) return "Price not set";
  return `$${price.toLocaleString("en-US")}`;
}

export function isPrice(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_PRICE;
}

// Turns form text ("25", "$25", " 0 ") into a whole-dollar price, or null.
export function parsePrice(text) {
  const clean = String(text ?? "").trim().replace(/^\$/, "");
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return isPrice(value) ? value : null;
}

// ----- Offers -----

export function validateOffer({ offerPrice, message = "" }, item) {
  const errors = {};
  if (!Number.isInteger(item.price)) {
    errors.offerPrice = "The seller hasn't set a price yet. Send them a message instead.";
  } else if (offerPrice === null || offerPrice === undefined || !isPrice(offerPrice)) {
    errors.offerPrice = "Enter your offer in whole dollars.";
  } else if (offerPrice > item.price) {
    errors.offerPrice = `The asking price is ${formatPrice(item.price)}; offer that or less.`;
  }
  if (message.trim().length > MESSAGE_MAX) errors.message = `Keep your note under ${MESSAGE_MAX} characters.`;
  return errors;
}

export function offerLabel(offer) {
  if (offer.offerPrice === 0) return "Free";
  if (offer.offerPrice === offer.listPrice) return `${formatPrice(offer.offerPrice)} (asking price)`;
  return `${formatPrice(offer.offerPrice)} offer (asking ${formatPrice(offer.listPrice)})`;
}

// Pending offers on the same item, other than this one. Declined once the item is sold.
export function otherPendingOffers(offer, offers) {
  return offers.filter((other) => other.id !== offer.id && other.itemId === offer.itemId && other.status === "pending");
}

// Whether the seller can accept this offer, given the item as it is now.
export function acceptBlocker(offer, item) {
  if (!item) return "This listing no longer exists.";
  if (item.status === "reserved") return "This item is reserved for another buyer. Cancel that deal before accepting this offer.";
  if (item.status === "sold") return "This item has already been sold.";
  if (item.archived || item.status !== "available") return "This listing isn't available. Relist it before accepting.";
  return "";
}

// What the UI should say about where a deal stands, from one person's point of view.
export function dealSummary(offer, uid) {
  const role = roleOf(offer, uid);
  const other = role === "seller" ? offer.buyerName || "The buyer" : offer.sellerName || "The seller";
  switch (offer.status) {
    case "pending":
      return role === "seller" ? `${other} wants to buy this. Accept or decline.` : `Waiting for ${other} to respond.`;
    case "accepted":
      return role === "seller"
        ? `Reserved for ${other}. Meet up, get paid, then mark it sold.`
        : `${other} accepted. Meet up, pay in person, and pick it up.`;
    case "sold":
      return role === "seller" ? `Sold to ${other}.` : `You bought this from ${other}.`;
    case "declined":
      return offer.declineReason || `${role === "seller" ? "You" : other} declined this offer.`;
    case "cancelled":
      return offer.cancelledBy === uid ? "You cancelled this." : `${other} cancelled this.`;
    default:
      return "";
  }
}

// Groups for the Deals page. Needs-action first, history last.
export function groupDeals(offers, uid) {
  const groups = { action: [], active: [], waiting: [], past: [] };
  for (const offer of offers) {
    const role = roleOf(offer, uid);
    if (offer.status === "pending") (role === "seller" ? groups.action : groups.waiting).push(offer);
    else if (offer.status === "accepted") groups.active.push(offer);
    else groups.past.push(offer);
  }
  const newest = (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0);
  for (const key of Object.keys(groups)) groups[key].sort(newest);
  return groups;
}

// Offers from other people that need the seller's response.
export function pendingIncomingCount(offers, uid) {
  return offers.filter((offer) => offer.sellerId === uid && offer.status === "pending").length;
}

// ----- Pickup plan -----

export function validatePickup({ place, time }) {
  const errors = {};
  if (!place?.trim()) errors.place = "Where should you meet?";
  else if (place.trim().length > PICKUP_PLACE_MAX) errors.place = `Keep it under ${PICKUP_PLACE_MAX} characters.`;
  if (!time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) errors.time = "When should you meet?";
  return errors;
}

export function formatPickupTime(time) {
  const [day, clock] = time.split("T");
  const [y, mo, d] = day.split("-").map(Number);
  const [h, m] = clock.split(":").map(Number);
  return new Date(y, mo - 1, d, h, m).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
