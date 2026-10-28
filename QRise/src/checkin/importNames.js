// Turns an uploaded spreadsheet or text file into a list of people's names.
// Supported: .xlsx (first sheet), .csv, .tsv, and .txt (one name per line).
import { cleanName, normalizeName } from "./model.js";

export const ACCEPTED_FILES = ".xlsx,.csv,.tsv,.txt";
export const MAX_ROSTER = 500;

const FULL_NAME = /^(full ?name|name|names|students?|attendees?|participants?|roster|student ?name|attendee ?name|participant ?name|member ?name|guest ?name|person|preferred ?name|display ?name|姓名|名字)$/i;
const NAMEISH = /\b(names?|students?|attendees?|participants?|members?|guests?|person|people|roster)\b|姓名|名字/i;
const NOT_A_NAME_HEADER = /user ?name|login|e-?mail|id\b|file ?name|team ?name|course ?name|event ?name|class ?name/i;
const FIRST = /^(first|first ?name|given ?name|forename|名)$/i;
const LAST = /^(last|last ?name|surname|family ?name|姓)$/i;

// Minimal CSV/TSV parser that handles quoted fields, escaped quotes, and newlines in quotes.
export function parseDelimited(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t"
    : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  return String(value).trim();
}

// How much a cell looks like a person's name, from 0 (no) to 1 (yes).
function nameLikeness(text) {
  if (!text) return 0;
  if (/@|https?:|www\./i.test(text)) return 0;
  if (!/\p{L}/u.test(text)) return 0;
  if ((text.match(/\d/g)?.length ?? 0) > 1) return 0;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 5 || text.length > 60) return 0;
  return words.length >= 2 ? 1 : 0.6;
}

function isNameValue(text) {
  return nameLikeness(text) > 0;
}

function uniqueNames(values) {
  const seen = new Set();
  const names = [];
  for (const value of values) {
    // "Lee, Ana" → "Ana Lee", so imported names match what people type when checking in.
    const name = cleanName(value).replace(/^([^,]+),\s*([^,]+)$/u, "$2 $1");
    if (!isNameValue(name)) continue;
    const key = normalizeName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

// Returns the candidate columns and which one looks most like a list of names.
export function analyzeRows(rawRows) {
  const rows = rawRows.map((row) => row.map(cellText)).filter((row) => row.some(Boolean));
  if (!rows.length) return { columns: [], suggested: null };
  const width = Math.max(...rows.map((row) => row.length));

  // A single column with no header (e.g. a .txt list) is just names.
  const header = rows[0];
  const looksLikeHeader = width > 1
    ? header.some((cell) => NAMEISH.test(cell) || FIRST.test(cell) || LAST.test(cell) || /e-?mail|id|year|grade|section/i.test(cell))
    : FULL_NAME.test(header[0]) || NAMEISH.test(header[0]);
  const body = looksLikeHeader ? rows.slice(1) : rows;
  const label = (i) => (looksLikeHeader && header[i]) ? header[i] : `Column ${String.fromCharCode(65 + (i % 26))}`;

  const columns = [];
  for (let i = 0; i < width; i += 1) {
    const values = body.map((row) => row[i] ?? "");
    const filled = values.filter(Boolean);
    if (!filled.length) continue;
    const names = uniqueNames(values);
    const likeness = filled.reduce((sum, v) => sum + nameLikeness(v), 0) / filled.length;
    let score = likeness;
    const head = looksLikeHeader ? header[i] ?? "" : "";
    if (FULL_NAME.test(head)) score += 3;
    else if (NAMEISH.test(head) && !NOT_A_NAME_HEADER.test(head)) score += 2;
    if (NOT_A_NAME_HEADER.test(head)) score -= 2;
    columns.push({ id: String(i), label: label(i), names, score });
  }

  const firstIndex = looksLikeHeader ? header.findIndex((cell) => FIRST.test(cell)) : -1;
  const lastIndex = looksLikeHeader ? header.findIndex((cell) => LAST.test(cell)) : -1;
  if (firstIndex >= 0 && lastIndex >= 0) {
    const names = uniqueNames(body.map((row) => `${row[firstIndex] ?? ""} ${row[lastIndex] ?? ""}`));
    columns.unshift({ id: `${firstIndex}+${lastIndex}`, label: `${header[firstIndex]} + ${header[lastIndex]}`, names, score: 3.5 });
  }

  const usable = columns.filter((column) => column.names.length);
  const best = [...usable].sort((a, b) => b.score - a.score)[0] ?? null;
  return { columns: usable.map(({ id, label, names }) => ({ id, label, names })), suggested: best?.id ?? null };
}

export async function readNamesFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xls")) throw new Error("Old .xls files aren't supported. Save the file as .xlsx or .csv and try again.");
  if (lower.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    let rows;
    try { rows = await readSheet(file); }
    catch { throw new Error("This spreadsheet couldn't be read. Make sure it's a valid .xlsx file."); }
    return analyzeRows(rows);
  }
  if (/\.(csv|tsv|txt)$/.test(lower) || file.type.startsWith("text/")) {
    return analyzeRows(parseDelimited(await file.text()));
  }
  throw new Error("Choose a .xlsx, .csv, .tsv, or .txt file.");
}

// Splits names into those to add and those already expected (by roster or members).
export function newNamesOnly(names, existingNames) {
  const existing = new Set(existingNames.map(normalizeName));
  const fresh = [];
  const duplicates = [];
  for (const name of names) (existing.has(normalizeName(name)) ? duplicates : fresh).push(name);
  return { fresh, duplicates };
}
