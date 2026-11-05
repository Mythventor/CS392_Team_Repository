// Profile rules that do not depend on Firebase or React.
import { isSchool } from "../items/model.js";

export const NAME_MAX = 60;
export const BIO_MAX = 280;

export function validateProfile({ displayName, school, bio }) {
  const errors = {};
  const name = displayName.trim();
  if (!name) errors.displayName = "Add the name other students will see.";
  else if (name.length > NAME_MAX) errors.displayName = `Keep your name to ${NAME_MAX} characters.`;
  if (!isSchool(school)) errors.school = "Choose your school.";
  if (bio.trim().length > BIO_MAX) errors.bio = `Keep your bio to ${BIO_MAX} characters.`;
  return errors;
}

export function initials(name) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Only follow same-site paths after sign-in, so a crafted link can't send people elsewhere.
export function safeNextPath(next) {
  if (typeof next !== "string" || !/^\/(?![/\\])/.test(next)) return "/";
  return next;
}
