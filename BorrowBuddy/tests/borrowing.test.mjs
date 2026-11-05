import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LOAN_DAYS,
  addDays,
  bookingConflict,
  canDo,
  conflictingRequests,
  daysBetween,
  groupLoans,
  isDay,
  isOverdue,
  loanSummary,
  nextStatus,
  pendingIncomingCount,
  rangesOverlap,
  validatePickup,
  validateRequest,
} from "../src/borrowing/model.js";

const TODAY = "2026-11-05";
const item = { id: "drill", availableFrom: "2026-11-01", availableTo: "2026-12-31" };
const request = (overrides = {}) => ({
  id: "r1", itemId: "drill", ownerId: "sam", borrowerId: "alex", ownerName: "Sam", borrowerName: "Alex",
  startDate: "2026-11-10", endDate: "2026-11-12", status: "pending", ...overrides,
});

test("date helpers handle month ends, leap days and invalid dates", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.deepEqual(daysBetween("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.equal(isDay("2026-02-30"), false);
  assert.equal(isDay("2026-11-05"), true);
  assert.equal(isDay("11/05/2026"), false);
});

test("ranges that share even one day overlap; back-to-back ranges do not", () => {
  assert.equal(rangesOverlap({ startDate: "2026-11-10", endDate: "2026-11-12" }, { startDate: "2026-11-12", endDate: "2026-11-14" }), true);
  assert.equal(rangesOverlap({ startDate: "2026-11-10", endDate: "2026-11-12" }, { startDate: "2026-11-13", endDate: "2026-11-14" }), false);
});

test("a request must be in the future, inside the listing's dates, at most 14 days, and not on booked days", () => {
  const ok = { startDate: "2026-11-10", endDate: "2026-11-12" };
  assert.deepEqual(validateRequest(ok, item, [], TODAY), {});
  assert.ok(validateRequest({ ...ok, startDate: "2026-11-04" }, item, [], TODAY).startDate);
  assert.ok(validateRequest({ ...ok, endDate: "2026-11-09" }, item, [], TODAY).endDate);
  assert.ok(validateRequest({ startDate: "2026-12-30", endDate: "2027-01-02" }, item, [], TODAY).endDate);
  assert.ok(validateRequest({ startDate: "2026-11-10", endDate: addDays("2026-11-10", MAX_LOAN_DAYS) }, item, [], TODAY).endDate);
  assert.deepEqual(validateRequest({ startDate: "2026-11-10", endDate: addDays("2026-11-10", MAX_LOAN_DAYS - 1) }, item, [], TODAY), {});
  assert.match(validateRequest(ok, item, ["2026-11-11"], TODAY).endDate, /already booked/);
  assert.ok(validateRequest({ ...ok, message: "x".repeat(501) }, item, [], TODAY).message);
  assert.ok(validateRequest({ startDate: "", endDate: "" }, item, [], TODAY).startDate);
});

test("only the right person can move a request to the next step", () => {
  assert.equal(canDo("accept", request(), "sam"), true);
  assert.equal(canDo("accept", request(), "alex"), false);
  assert.equal(canDo("decline", request(), "sam"), true);
  assert.equal(canDo("cancel", request(), "alex"), true);
  assert.equal(canDo("cancel", request({ status: "accepted" }), "sam"), true);
  assert.equal(canDo("cancel", request({ status: "picked_up" }), "alex"), false);
  assert.equal(canDo("pickup", request({ status: "accepted" }), "alex"), true);
  assert.equal(canDo("pickup", request(), "sam"), false);
  assert.equal(canDo("return", request({ status: "picked_up" }), "sam"), true);
  assert.equal(canDo("return", request({ status: "picked_up" }), "alex"), false);
  assert.equal(canDo("accept", request(), "stranger"), false);
  assert.equal(nextStatus("pickup"), "picked_up");
});

test("accepting a request finds overlapping pending requests to decline and detects booked days", () => {
  const accepted = request();
  const others = [
    request({ id: "r2", startDate: "2026-11-12", endDate: "2026-11-15" }),
    request({ id: "r3", startDate: "2026-11-13", endDate: "2026-11-15" }),
    request({ id: "r4", startDate: "2026-11-11", endDate: "2026-11-11", status: "cancelled" }),
    request({ id: "r5", itemId: "tent" }),
  ];
  assert.deepEqual(conflictingRequests(accepted, [accepted, ...others]).map((r) => r.id), ["r2"]);
  assert.equal(bookingConflict(accepted, [{ id: "2026-11-11", requestId: "other" }]), true);
  assert.equal(bookingConflict(accepted, [{ id: "2026-11-11", requestId: "r1" }]), false);
  assert.equal(bookingConflict(accepted, [{ id: "2026-11-13", requestId: "other" }]), false);
});

test("loans are grouped by what needs attention, and overdue loans are flagged", () => {
  const loans = [
    request({ id: "incoming" }),
    request({ id: "mine", ownerId: "jo", borrowerId: "sam" }),
    request({ id: "today", status: "accepted", startDate: TODAY, endDate: "2026-11-07" }),
    request({ id: "later", status: "accepted", startDate: "2026-11-20", endDate: "2026-11-21" }),
    request({ id: "out", status: "picked_up", startDate: "2026-11-03", endDate: "2026-11-08" }),
    request({ id: "late", status: "picked_up", startDate: "2026-11-01", endDate: "2026-11-03" }),
    request({ id: "done", status: "returned" }),
  ];
  const groups = groupLoans(loans, "sam", TODAY);
  assert.deepEqual(groups.action.map((r) => r.id), ["late", "today", "incoming"]);
  assert.deepEqual(groups.upcoming.map((r) => r.id), ["mine", "later"]);
  assert.deepEqual(groups.out.map((r) => r.id), ["out"]);
  assert.deepEqual(groups.past.map((r) => r.id), ["done"]);
  assert.equal(isOverdue(loans[5], TODAY), true);
  assert.equal(pendingIncomingCount(loans, "sam"), 1);
});

test("the status summary is written from each person's point of view", () => {
  assert.match(loanSummary(request(), "sam", TODAY), /Alex wants to borrow/);
  assert.match(loanSummary(request(), "alex", TODAY), /Waiting for Sam/);
  assert.match(loanSummary(request({ status: "picked_up", endDate: "2026-11-01" }), "alex", TODAY), /Overdue/);
  assert.match(loanSummary(request({ status: "cancelled", cancelledBy: "alex" }), "alex", TODAY), /You cancelled/);
  assert.match(loanSummary(request({ status: "cancelled", cancelledBy: "alex" }), "sam", TODAY), /Alex cancelled/);
});

test("a pickup plan needs a place and a time", () => {
  assert.deepEqual(validatePickup({ place: "Main library entrance", time: "2026-11-10T15:30" }), {});
  assert.ok(validatePickup({ place: " ", time: "2026-11-10T15:30" }).place);
  assert.ok(validatePickup({ place: "Library", time: "" }).time);
});
