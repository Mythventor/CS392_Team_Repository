import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUsername, usernameToAuthEmail, validateUsername } from "../src/username.js";

test("usernames are normalized case-insensitively", () => {
  assert.equal(normalizeUsername("  Teacher_7 "), "teacher_7");
  assert.equal(
    usernameToAuthEmail("Teacher_7"),
    usernameToAuthEmail("teacher_7"),
  );
});

test("usernames allow 3-24 letters, numbers, underscores, and hyphens", () => {
  assert.equal(validateUsername("abc"), true);
  assert.equal(validateUsername("Teacher_7"), true);
  assert.equal(validateUsername("a".repeat(24)), true);
  assert.equal(validateUsername("ab"), false);
  assert.equal(validateUsername("a".repeat(25)), false);
  assert.equal(validateUsername("teacher.name"), false);
  assert.equal(validateUsername("teacher name"), false);
});

test("invalid usernames cannot be converted into auth identifiers", () => {
  assert.throws(() => usernameToAuthEmail("two words"), /Username must be/);
});
