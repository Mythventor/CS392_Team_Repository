import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRows, newNamesOnly, parseDelimited } from "../src/checkin/importNames.js";

const pick = (analysis) => analysis.columns.find((c) => c.id === analysis.suggested);

test("CSV parsing handles quotes, commas inside quotes, blank lines, BOM, and tabs", () => {
  assert.deepEqual(parseDelimited('﻿Name,Note\r\n"Lee, Ana","said ""hi"""\r\n\r\nBen,\n'),
    [["Name", "Note"], ["Lee, Ana", 'said "hi"'], [""], ["Ben", ""]]);
  assert.deepEqual(parseDelimited("Name\tEmail\nAna Lee\ta@x.edu"), [["Name", "Email"], ["Ana Lee", "a@x.edu"]]);
});

test("a header named Name/Full name is chosen over email and ID columns", () => {
  const analysis = analyzeRows([["ID", "Email", "Full Name"], ["1", "a@x.edu", "Ana Lee"], ["2", "b@x.edu", "Ben Ortiz"]]);
  assert.equal(pick(analysis).label, "Full Name");
  assert.deepEqual(pick(analysis).names, ["Ana Lee", "Ben Ortiz"]);
  assert.ok(!analysis.columns.some((c) => c.label === "Email"));
});

test("first and last name columns are combined, duplicates removed, and blank rows skipped", () => {
  const analysis = analyzeRows([["Student ID", "First Name", "Last Name"], [1001, "Ana", "Lee"], [1002, "ana", "lee"], [null, null, null], [1003, "Cara", "Wu"]]);
  assert.equal(pick(analysis).label, "First Name + Last Name");
  assert.deepEqual(pick(analysis).names, ["Ana Lee", "Cara Wu"]);
});

test("a plain list with no header is read as names, and 'Last, First' is flipped", () => {
  assert.deepEqual(pick(analyzeRows(parseDelimited("Ana Lee\nBen Ortiz\n\nCara Wu\n"))).names, ["Ana Lee", "Ben Ortiz", "Cara Wu"]);
  assert.deepEqual(pick(analyzeRows([["Attendees"], ["Lee, Ana"], ["Wu, Cara"]])).names, ["Ana Lee", "Cara Wu"]);
});

test("without name headers, the column whose values look most like names wins", () => {
  const analysis = analyzeRows([["Ana Lee", "a@x.edu", "2027"], ["Ben Ortiz", "b@x.edu", "2026"]]);
  assert.deepEqual(pick(analysis).names, ["Ana Lee", "Ben Ortiz"]);
});

test("names already expected are separated out case-insensitively", () => {
  assert.deepEqual(newNamesOnly(["Ana Lee", "Ben", "Cara"], ["ana  lee", "Dev"]), { fresh: ["Ben", "Cara"], duplicates: ["Ana Lee"] });
});
