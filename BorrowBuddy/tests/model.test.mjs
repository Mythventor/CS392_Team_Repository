import assert from "node:assert/strict";
import { test } from "node:test";
import { initials, safeNextPath, validateProfile } from "../src/auth/profileModel.js";
import { browseUrl, filterItems, filtersFromParams, hasActiveFilters, isAvailable, newestFirst } from "../src/items/model.js";

const ITEMS = [
  { id: "drill", title: "Cordless Drill", description: "Comes with bits", category: "tools", school: "northwestern", createdAt: 1 },
  { id: "lamp", title: "Lamp for your desk", description: "", category: "dorm", school: "depaul", createdAt: 3 },
  { id: "book", title: "Calculus textbook", category: "books", school: "northwestern", createdAt: 2 },
];
const ids = (items) => items.map((item) => item.id);

test("search ignores case and matches title or description", () => {
  assert.deepEqual(ids(filterItems(ITEMS, { q: "DRILL" })), ["drill"]);
  assert.deepEqual(ids(filterItems(ITEMS, { q: "bits" })), ["drill"]);
});

test("every search word must match, in any order", () => {
  assert.deepEqual(ids(filterItems(ITEMS, { q: "desk lamp" })), ["lamp"]);
  assert.deepEqual(ids(filterItems(ITEMS, { q: "desk drill" })), []);
});

test("search also finds category and school names", () => {
  assert.deepEqual(ids(filterItems(ITEMS, { q: "tools" })), ["drill"]);
  assert.deepEqual(ids(filterItems(ITEMS, { q: "depaul university" })), ["lamp"]);
});

test("search, category, and school filters combine", () => {
  assert.deepEqual(ids(filterItems(ITEMS, { school: "northwestern" })), ["drill", "book"]);
  assert.deepEqual(ids(filterItems(ITEMS, { school: "northwestern", category: "books" })), ["book"]);
  assert.deepEqual(ids(filterItems(ITEMS, { school: "depaul", q: "drill" })), []);
});

test("blank searches keep every item", () => {
  assert.equal(filterItems(ITEMS, { q: "   " }).length, ITEMS.length);
  assert.equal(filterItems(ITEMS).length, ITEMS.length);
});

test("items with no optional fields can still be searched", () => {
  assert.deepEqual(ids(filterItems([{ id: "bare", status: "available" }], { q: "x" })), []);
});

test("URL filters drop unknown values", () => {
  const filters = filtersFromParams(new URLSearchParams("q=tent&category=nope&school=northwestern"));
  assert.deepEqual(filters, { q: "tent", category: "", school: "northwestern" });
  assert.equal(hasActiveFilters(filters), true);
  assert.equal(hasActiveFilters(filtersFromParams(new URLSearchParams("q=%20%20"))), false);
});

test("browse links encode search text and skip empty filters", () => {
  assert.equal(browseUrl(), "/browse");
  assert.equal(browseUrl({ q: "  " }), "/browse");
  assert.equal(browseUrl({ q: "a&b", category: "tools" }), "/browse?q=a%26b&category=tools");
});

test("only current, available items count as available", () => {
  assert.equal(isAvailable({ status: "available" }, "2026-05-10"), true);
  assert.equal(isAvailable({ status: "unavailable" }, "2026-05-10"), false);
  assert.equal(isAvailable({ status: "available", availableTo: "2026-05-10" }, "2026-05-10"), true);
  assert.equal(isAvailable({ status: "available", availableTo: "2026-05-09" }, "2026-05-10"), false);
});

test("newest items come first without changing the original list", () => {
  assert.deepEqual(ids(newestFirst(ITEMS)), ["lamp", "book", "drill"]);
  assert.equal(ITEMS[0].id, "drill");
});

test("profile validation reports each problem", () => {
  assert.deepEqual(validateProfile({ displayName: "Sam", school: "northwestern", bio: "" }), {});
  const errors = validateProfile({ displayName: "   ", school: "mars", bio: "x".repeat(281) });
  assert.deepEqual(Object.keys(errors).sort(), ["bio", "displayName", "school"]);
  assert.ok(validateProfile({ displayName: "x".repeat(61), school: "northwestern", bio: "" }).displayName);
});

test("initials use the first and last names", () => {
  assert.equal(initials("sam rivera"), "SR");
  assert.equal(initials("Sam Q Rivera"), "SR");
  assert.equal(initials("Sam"), "S");
  assert.equal(initials(""), "?");
});

test("sign-in only returns to paths on this site", () => {
  assert.equal(safeNextPath("/browse?q=tent"), "/browse?q=tent");
  for (const unsafe of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", null]) {
    assert.equal(safeNextPath(unsafe), "/");
  }
});
