// Adds sample items to the local Firestore emulator. It can't touch a real project:
// the address is hard-coded to the emulator and the project id is a local "demo-" one.
const BASE = "http://127.0.0.1:8080/v1/projects/demo-borrowbuddy/databases/(default)/documents/items";

const SAMPLE_ITEMS = [
  ["drill", "Cordless power drill", "18V drill with a bit set. Great for dorm shelves.", "tools", "north", "Sam Rivera"],
  ["projector", "Mini projector", "HDMI projector for movie nights or practice presentations.", "electronics", "south", "Priya Shah"],
  ["calculus", "Calculus textbook", "Early Transcendentals, lightly highlighted.", "books", "east", "Jordan Lee"],
  ["instant-pot", "6-quart pressure cooker", "Works for soups, rice, and meal prep.", "kitchen", "west", "Alex Kim"],
  ["vacuum", "Compact vacuum", "Small enough for a dorm closet and strong enough for carpet.", "dorm", "north", "Morgan Chen"],
  ["tent", "Two-person tent", "Light tent with a rain fly. Fits in a backpack.", "outdoors", "downtown", "Taylor Brooks"],
  ["speaker", "Bluetooth party speaker", "Loud enough for a big room, with a 10-hour battery.", "events", "south", "Casey Nguyen"],
  ["ladder", "Folding step ladder", "Three steps, folds flat for carrying.", "tools", "east", "Jamie Ortiz"],
  ["camera", "Mirrorless camera kit", "Comes with a 35mm lens and a spare battery.", "electronics", "north", "Riley Park"],
  ["dolly", "Moving dolly", "Handy for move-in day and carrying heavy boxes.", "other", "west", "Drew Patel"],
];

const text = (value) => ({ stringValue: value });
const now = Date.now();

for (const [index, [id, title, description, category, campus, ownerName]] of SAMPLE_ITEMS.entries()) {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    // "Bearer owner" is how the emulator accepts admin writes that skip security rules.
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        title: text(title),
        description: text(description),
        category: text(category),
        campus: text(campus),
        status: text("available"),
        ownerId: text(`sample-owner-${index}`),
        ownerName: text(ownerName),
        createdAt: { timestampValue: new Date(now - index * 3_600_000).toISOString() },
      },
    }),
  });
  if (!response.ok) throw new Error(`Could not add ${id}: ${response.status} ${await response.text()}`);
}

console.log(`Added ${SAMPLE_ITEMS.length} sample items to the emulator.`);
