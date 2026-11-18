const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,24}$/;
const USERNAME_EMAIL_DOMAIN = "accounts.here-attendance.invalid";

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export function validateUsername(username) {
  return USERNAME_PATTERN.test(username.trim());
}

export function usernameToAuthEmail(username) {
  const normalizedUsername = normalizeUsername(username);
  if (!validateUsername(normalizedUsername)) {
    throw new Error("Username must be 3–24 characters and use only letters, numbers, underscores, or hyphens.");
  }
  return `${normalizedUsername}@${USERNAME_EMAIL_DOMAIN}`;
}
