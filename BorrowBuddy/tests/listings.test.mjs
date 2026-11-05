import { test } from "node:test";
import assert from "node:assert/strict";
import { photoError, validateListing } from "../src/items/listingModel.js";
import { isAvailable } from "../src/items/model.js";
const item = {
  title: "Calculator",
  description: "TI-84, includes charger",
  pickupArea: "University library",
  category: "electronics",
  school: "northwestern",
  condition: "Good",
  availableFrom: "2099-01-01",
  availableTo: "2099-01-07",
};
test("new listing accepts valid data and requires a photo", () => {
  assert.deepEqual(validateListing(item, { hasPhoto: true }), {});
  assert.ok(validateListing(item).photo);
});
test("rejects reversed dates, impossible dates, unknown categories and blank details", () => {
  const errors = validateListing(
    {
      ...item,
      availableFrom: "2099-02-30",
      availableTo: "2099-01-01",
      category: "fake",
      pickupArea: " ",
    },
    { hasPhoto: true },
  );
  for (const field of [
    "availableFrom",
    "availableTo",
    "category",
    "pickupArea",
  ])
    assert.ok(errors[field]);
});
test("existing listings can retain a past start but new listings cannot", () => {
  const past = { ...item, availableFrom: "2000-01-01" };
  assert.ok(validateListing(past, { hasPhoto: true }).availableFrom);
  assert.equal(
    validateListing(past, { hasPhoto: true, editing: true }).availableFrom,
    undefined,
  );
});
test("photos reject unsupported files and files over 5 MB", () => {
  assert.ok(photoError({ type: "image/svg+xml", size: 100 }));
  assert.ok(photoError({ type: "image/png", size: 6 * 1024 * 1024 }));
  assert.equal(photoError({ type: "image/jpeg", size: 1024 }), "");
});
test("archived listings never appear as available", () => {
  assert.equal(isAvailable({ status: "available", archived: true }), false);
});
