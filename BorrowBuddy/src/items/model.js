// The shared vocabulary for items. Listings, search, and profiles all store these ids.
// Keep this file free of Firebase and React so it can be unit tested in plain Node.

export const CATEGORIES = [
  { id: "tools", label: "Tools" },
  { id: "electronics", label: "Electronics" },
  { id: "books", label: "Books" },
  { id: "kitchen", label: "Kitchen" },
  { id: "dorm", label: "Dorm & home" },
  { id: "outdoors", label: "Sports & outdoors" },
  { id: "events", label: "Party & events" },
  { id: "other", label: "Other" },
];

// To add a school, add it here. Nothing else needs to change.
export const SCHOOLS = [
  { id: "northwestern", label: "Northwestern University" },
  { id: "uchicago", label: "University of Chicago" },
  { id: "depaul", label: "DePaul University" },
  { id: "loyola", label: "Loyola University Chicago" },
  { id: "uic", label: "University of Illinois Chicago" },
];

export const DEFAULT_SCHOOL = "northwestern";

const labelOf = (options, id) => options.find((option) => option.id === id)?.label ?? "";

export const categoryLabel = (id) => labelOf(CATEGORIES, id);
export const schoolLabel = (id) => labelOf(SCHOOLS, id);

export const isCategory = (id) => CATEGORIES.some((category) => category.id === id);
export const isSchool = (id) => SCHOOLS.some((school) => school.id === id);

// Dates are stored as YYYY-MM-DD strings, so they compare correctly as plain text.
export function localDateString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isAvailable(item, today = localDateString()) {
  if (item.status !== "available") return false;
  return !item.availableTo || item.availableTo >= today;
}

// Reads filters from the URL. Unknown values are dropped so a stale link still shows items.
export function filtersFromParams(params) {
  const category = params.get("category") ?? "";
  const school = params.get("school") ?? "";
  return {
    q: params.get("q") ?? "",
    category: isCategory(category) ? category : "",
    school: isSchool(school) ? school : "",
  };
}

export function hasActiveFilters({ q, category, school }) {
  return Boolean(q.trim() || category || school);
}

export function browseUrl(filters = {}) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "school"]) {
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/browse?${search}` : "/browse";
}

function searchableText(item) {
  return [item.title, item.description, categoryLabel(item.category), schoolLabel(item.school)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Every search word has to appear somewhere, so "desk lamp" finds a "Lamp for your desk".
export function filterItems(items, { q = "", category = "", school = "" } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category && item.category !== category) return false;
    if (school && item.school !== school) return false;
    if (!words.length) return true;
    const text = searchableText(item);
    return words.every((word) => text.includes(word));
  });
}

export function newestFirst(items) {
  return [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
