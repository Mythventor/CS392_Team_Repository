import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acceptBlocker,
  canDo,
  dealSummary,
  formatPrice,
  groupDeals,
  nextStatus,
  offerLabel,
  otherPendingOffers,
  parsePrice,
  pendingIncomingCount,
  validateOffer,
  validatePickup,
} from "../src/deals/model.js";

const offer = (overrides = {}) => ({
  id: "o1", itemId: "lamp", sellerId: "sam", buyerId: "alex", sellerName: "Sam", buyerName: "Alex",
  listPrice: 20, offerPrice: 15, status: "pending", createdAt: 1, ...overrides,
});

test("prices are whole dollars from free to $10,000", () => {
  assert.equal(parsePrice("25"), 25);
  assert.equal(parsePrice(" $40 "), 40);
  assert.equal(parsePrice("0"), 0);
  assert.equal(parsePrice("12.50"), null);
  assert.equal(parsePrice("-5"), null);
  assert.equal(parsePrice("10001"), null);
  assert.equal(parsePrice(""), null);
  assert.equal(formatPrice(0), "Free");
  assert.equal(formatPrice(1200), "$1,200");
  assert.equal(formatPrice(undefined), "Price not set");
});

test("an offer can be the asking price or less, never more", () => {
  const item = { price: 20 };
  assert.deepEqual(validateOffer({ offerPrice: 20 }, item), {});
  assert.deepEqual(validateOffer({ offerPrice: 12 }, item), {});
  assert.match(validateOffer({ offerPrice: 25 }, item).offerPrice, /asking price is \$20/);
  assert.ok(validateOffer({ offerPrice: null }, item).offerPrice);
  assert.ok(validateOffer({ offerPrice: 10, message: "x".repeat(501) }, item).message);
  assert.ok(validateOffer({ offerPrice: 0 }, {}).offerPrice);
  assert.deepEqual(validateOffer({ offerPrice: 0 }, { price: 0 }), {});
});

test("offer labels show free, asking-price and lower offers clearly", () => {
  assert.equal(offerLabel(offer({ offerPrice: 0, listPrice: 0 })), "Free");
  assert.equal(offerLabel(offer({ offerPrice: 20 })), "$20 (asking price)");
  assert.equal(offerLabel(offer()), "$15 offer (asking $20)");
});

test("only the right person can move an offer to the next step", () => {
  assert.equal(canDo("accept", offer(), "sam"), true);
  assert.equal(canDo("accept", offer(), "alex"), false);
  assert.equal(canDo("decline", offer(), "sam"), true);
  assert.equal(canDo("cancel", offer(), "alex"), true);
  assert.equal(canDo("cancel", offer(), "sam"), false);
  assert.equal(canDo("cancel", offer({ status: "accepted" }), "sam"), true);
  assert.equal(canDo("cancel", offer({ status: "accepted" }), "alex"), true);
  assert.equal(canDo("sell", offer({ status: "accepted" }), "sam"), true);
  assert.equal(canDo("sell", offer({ status: "accepted" }), "alex"), false);
  assert.equal(canDo("sell", offer(), "sam"), false);
  assert.equal(canDo("cancel", offer({ status: "sold" }), "sam"), false);
  assert.equal(canDo("accept", offer(), "stranger"), false);
  assert.equal(nextStatus("sell"), "sold");
});

test("a seller can accept only while the item is available", () => {
  assert.equal(acceptBlocker(offer(), { status: "available" }), "");
  assert.match(acceptBlocker(offer(), { status: "reserved" }), /reserved for another buyer/);
  assert.match(acceptBlocker(offer(), { status: "sold" }), /already been sold/);
  assert.match(acceptBlocker(offer(), { status: "unavailable", archived: true }), /isn't available/);
  assert.match(acceptBlocker(offer(), null), /no longer exists/);
});

test("selling an item finds the other pending offers to decline", () => {
  const sold = offer({ status: "accepted" });
  const others = [
    offer({ id: "o2" }),
    offer({ id: "o3", status: "declined" }),
    offer({ id: "o4", itemId: "desk" }),
  ];
  assert.deepEqual(otherPendingOffers(sold, [sold, ...others]).map((o) => o.id), ["o2"]);
});

test("deals are grouped by what needs attention, newest first", () => {
  const deals = [
    offer({ id: "incoming", createdAt: 1 }),
    offer({ id: "incoming2", createdAt: 5 }),
    offer({ id: "mine", sellerId: "jo", buyerId: "sam" }),
    offer({ id: "reserved", status: "accepted" }),
    offer({ id: "done", status: "sold" }),
  ];
  const groups = groupDeals(deals, "sam");
  assert.deepEqual(groups.action.map((o) => o.id), ["incoming2", "incoming"]);
  assert.deepEqual(groups.waiting.map((o) => o.id), ["mine"]);
  assert.deepEqual(groups.active.map((o) => o.id), ["reserved"]);
  assert.deepEqual(groups.past.map((o) => o.id), ["done"]);
  assert.equal(pendingIncomingCount(deals, "sam"), 2);
});

test("the deal summary is written from each person's point of view", () => {
  assert.match(dealSummary(offer(), "sam"), /Alex wants to buy/);
  assert.match(dealSummary(offer(), "alex"), /Waiting for Sam/);
  assert.match(dealSummary(offer({ status: "accepted" }), "alex"), /pay in person/);
  assert.match(dealSummary(offer({ status: "sold" }), "sam"), /Sold to Alex/);
  assert.match(dealSummary(offer({ status: "cancelled", cancelledBy: "alex" }), "sam"), /Alex cancelled/);
});

test("a pickup plan needs a place and a time", () => {
  assert.deepEqual(validatePickup({ place: "Norris front desk", time: "2026-06-10T15:30" }), {});
  assert.ok(validatePickup({ place: " ", time: "2026-06-10T15:30" }).place);
  assert.ok(validatePickup({ place: "Norris", time: "" }).time);
});
