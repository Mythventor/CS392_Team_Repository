// Borrowing rules shared by the screens, the data layer, and the tests.
// Plain JavaScript (no Firebase or React) so it can be unit tested in Node.
// Dates are local "YYYY-MM-DD" strings, like listing dates, so they compare as text.
import { localDateString } from "../items/model.js";

export const MAX_LOAN_DAYS = 14;
export const MESSAGE_MAX = 500;
export const PICKUP_PLACE_MAX = 120;

// Every request moves through these states. Arrows show who can move it where.
//   pending   → accepted (owner) · declined (owner) · cancelled (borrower)
//   accepted  → picked_up (either) · cancelled (either)
//   picked_up → returned (owner)
export const STATUS = {
  pending: { label: "Waiting for owner", tone: "warm" },
  accepted: { label: "Accepted", tone: "accent" },
  picked_up: { label: "Borrowed", tone: "accent" },
  returned: { label: "Returned", tone: "muted" },
  declined: { label: "Declined", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export const ACTIVE_STATUSES = ["pending", "accepted", "picked_up"];
// Accepted and borrowed loans hold the item's days so nobody else can book them.
export const HOLDING_STATUSES = ["accepted", "picked_up"];

const TRANSITIONS = {
  accept: { from: ["pending"], to: "accepted", by: ["owner"] },
  decline: { from: ["pending"], to: "declined", by: ["owner"] },
  cancel: { from: ["pending", "accepted"], to: "cancelled", by: ["owner", "borrower"] },
  pickup: { from: ["accepted"], to: "picked_up", by: ["owner", "borrower"] },
  return: { from: ["picked_up"], to: "returned", by: ["owner"] },
};

export function roleOf(request, uid) {
  if (!uid) return null;
  if (request.ownerId === uid) return "owner";
  if (request.borrowerId === uid) return "borrower";
  return null;
}

export function canDo(action, request, uid) {
  const rule = TRANSITIONS[action];
  const role = roleOf(request, uid);
  return Boolean(rule && role && rule.from.includes(request.status) && rule.by.includes(role));
}

export function nextStatus(action) {
  return TRANSITIONS[action]?.to ?? null;
}

// ----- Dates -----

function parseDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return localDateString(parseDay(value)) === value;
}

export function addDays(day, count) {
  const date = parseDay(day);
  date.setDate(date.getDate() + count);
  return localDateString(date);
}

// Every day from start to end, inclusive.
export function daysBetween(start, end) {
  const days = [];
  for (let day = start; day <= end && days.length <= 366; day = addDays(day, 1)) days.push(day);
  return days;
}

export function loanLength(start, end) {
  return daysBetween(start, end).length;
}

export function rangesOverlap(a, b) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function formatDay(day, options = { weekday: "short", month: "short", day: "numeric" }) {
  return parseDay(day).toLocaleDateString(undefined, options);
}

export function formatRange(start, end) {
  if (start === end) return formatDay(start);
  return `${formatDay(start)} – ${formatDay(end)}`;
}

// ----- Requests -----

// Checks the dates a borrower picked against the listing and existing bookings.
// `bookedDays` is a Set (or array) of "YYYY-MM-DD" strings already held by accepted loans.
export function validateRequest({ startDate, endDate, message = "" }, item, bookedDays = [], today = localDateString()) {
  const errors = {};
  const booked = new Set(bookedDays);
  if (!isDay(startDate)) errors.startDate = "Choose the first day you need it.";
  if (!isDay(endDate)) errors.endDate = "Choose the day you'll return it.";
  if (!errors.startDate && startDate < today) errors.startDate = "Choose today or a later day.";
  if (!errors.startDate && item.availableFrom && startDate < item.availableFrom) {
    errors.startDate = `This item is available from ${formatDay(item.availableFrom)}.`;
  }
  if (!errors.startDate && !errors.endDate) {
    if (endDate < startDate) errors.endDate = "The return day must be on or after the first day.";
    else if (item.availableTo && endDate > item.availableTo) errors.endDate = `This item is available through ${formatDay(item.availableTo)}.`;
    else if (loanLength(startDate, endDate) > MAX_LOAN_DAYS) errors.endDate = `You can borrow for up to ${MAX_LOAN_DAYS} days at a time.`;
    else {
      const taken = daysBetween(startDate, endDate).filter((day) => booked.has(day));
      if (taken.length) {
        errors.endDate = taken.length === 1
          ? `${formatDay(taken[0])} is already booked. Choose different dates.`
          : `${taken.length} of these days are already booked (from ${formatDay(taken[0])}). Choose different dates.`;
      }
    }
  }
  if (message.trim().length > MESSAGE_MAX) errors.message = `Keep your note under ${MESSAGE_MAX} characters.`;
  return errors;
}

// Pending requests whose dates overlap a request being accepted. They get declined automatically.
export function conflictingRequests(accepted, requests) {
  return requests.filter((other) =>
    other.id !== accepted.id
    && other.itemId === accepted.itemId
    && other.status === "pending"
    && rangesOverlap(other, accepted));
}

// Whether an accepted request can still be accepted given current bookings (excluding its own).
export function bookingConflict(request, bookedDayDocs) {
  return bookedDayDocs.some((day) => day.requestId !== request.id && day.id >= request.startDate && day.id <= request.endDate);
}

export function isOverdue(request, today = localDateString()) {
  return request.status === "picked_up" && request.endDate < today;
}

// What the UI should say about where a loan stands, from one person's point of view.
export function loanSummary(request, uid, today = localDateString()) {
  const role = roleOf(request, uid);
  const other = role === "owner" ? request.borrowerName || "The borrower" : request.ownerName || "The owner";
  switch (request.status) {
    case "pending":
      return role === "owner" ? `${other} wants to borrow this. Accept or decline.` : `Waiting for ${other} to respond.`;
    case "accepted":
      if (request.startDate > today) return `Booked. Plan the pickup with ${other}.`;
      return `Ready for pickup. Mark it picked up when the item changes hands.`;
    case "picked_up":
      if (isOverdue(request, today)) return `Overdue: it was due back ${formatDay(request.endDate)}.`;
      return role === "owner" ? `${other} has it. Due back ${formatDay(request.endDate)}.` : `Due back ${formatDay(request.endDate)}.`;
    case "returned":
      return "Returned. Thanks for sharing!";
    case "declined":
      return request.declineReason || `${role === "owner" ? "You" : other} declined this request.`;
    case "cancelled":
      return request.cancelledBy === uid ? "You cancelled this request." : `${other} cancelled this request.`;
    default:
      return "";
  }
}

// Groups for the Borrowing page. Needs-action first, history last.
export function groupLoans(requests, uid, today = localDateString()) {
  const groups = { action: [], upcoming: [], out: [], past: [] };
  for (const request of requests) {
    const role = roleOf(request, uid);
    if (request.status === "pending") (role === "owner" ? groups.action : groups.upcoming).push(request);
    else if (request.status === "accepted") (request.startDate <= today ? groups.action : groups.upcoming).push(request);
    else if (request.status === "picked_up") (isOverdue(request, today) ? groups.action : groups.out).push(request);
    else groups.past.push(request);
  }
  const byStart = (a, b) => a.startDate.localeCompare(b.startDate);
  groups.action.sort(byStart);
  groups.upcoming.sort(byStart);
  groups.out.sort((a, b) => a.endDate.localeCompare(b.endDate));
  groups.past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return groups;
}

// Requests from other people that need the owner's response.
export function pendingIncomingCount(requests, uid) {
  return requests.filter((request) => request.ownerId === uid && request.status === "pending").length;
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
  const [h, m] = clock.split(":").map(Number);
  const date = parseDay(day);
  date.setHours(h, m);
  return date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
