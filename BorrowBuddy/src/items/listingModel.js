import { isCategory, isSchool, localDateString } from "./model.js";
export const CONDITIONS = ["Like new", "Good", "Fair"];
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export function photoError(file) {
  if (!file) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Choose a JPG, PNG or WebP photo.";
  return file.size > MAX_PHOTO_BYTES ? "Choose a photo smaller than 5 MB." : "";
}
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateListing(
  values,
  { editing = false, hasPhoto = false } = {},
) {
  const errors = {};
  for (const [key, max] of [
    ["title", 80],
    ["description", 2000],
    ["pickupArea", 120],
  ]) {
    if (!values[key]?.trim() || values[key].trim().length > max)
      errors[key] =
        `Enter ${key === "pickupArea" ? "a pickup area" : `a ${key}`} (up to ${max} characters).`;
  }
  if (!isCategory(values.category)) errors.category = "Choose a category.";
  if (!isSchool(values.school)) errors.school = "Choose a school.";
  if (!CONDITIONS.includes(values.condition))
    errors.condition = "Choose the item condition.";
  if (!validDate(values.availableFrom))
    errors.availableFrom = "Choose a valid start date.";
  else if (!editing && values.availableFrom < localDateString())
    errors.availableFrom = "Choose today or a future date.";
  if (
    !validDate(values.availableTo) ||
    values.availableTo < values.availableFrom ||
    values.availableTo < localDateString()
  )
    errors.availableTo =
      "Choose an end date on or after the start date and today.";
  if (!hasPhoto) errors.photo = "Add a photo of your item.";
  return errors;
}
