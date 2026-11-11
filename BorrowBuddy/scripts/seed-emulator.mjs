// Adds sample items to the local Firestore emulator. It can't touch a real project:
// the address is hard-coded to the emulator and the project id is a local "demo-" one.
const BASE = "http://127.0.0.1:8080/v1/projects/demo-borrowbuddy/databases/(default)/documents/items";

const SAMPLE_ITEMS = [
  ["drill", "Cordless power drill", "18V drill with a bit set. Great for dorm shelves.", "tools", "northwestern", "Sam Rivera", 35],
  ["projector", "Mini projector", "HDMI projector for movie nights or practice presentations.", "electronics", "northwestern", "Priya Shah", 60],
  ["calculus", "Calculus textbook", "Early Transcendentals, lightly highlighted.", "books", "northwestern", "Jordan Lee", 20],
  ["instant-pot", "6-quart pressure cooker", "Works for soups, rice, and meal prep.", "kitchen", "northwestern", "Alex Kim", 40],
  ["vacuum", "Compact vacuum", "Small enough for a dorm closet and strong enough for carpet.", "dorm", "northwestern", "Morgan Chen", 25],
  ["tent", "Two-person tent", "Light tent with a rain fly. Fits in a backpack.", "outdoors", "northwestern", "Taylor Brooks", 50],
  ["speaker", "Bluetooth party speaker", "Loud enough for a big room, with a 10-hour battery.", "events", "northwestern", "Casey Nguyen", 30],
  ["ladder", "Folding step ladder", "Three steps, folds flat for carrying.", "tools", "northwestern", "Jamie Ortiz", 0],
  ["camera", "Mirrorless camera kit", "Comes with a 35mm lens and a spare battery.", "electronics", "northwestern", "Riley Park", 300],
  ["dolly", "Moving dolly", "Handy for move-in day and carrying heavy boxes.", "other", "depaul", "Drew Patel", 0],
];

const text = (value) => ({ stringValue: value });
const now = Date.now();

for (const [index, [id, title, description, category, school, ownerName, price]] of SAMPLE_ITEMS.entries()) {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    // "Bearer owner" is how the emulator accepts admin writes that skip security rules.
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        title: text(title),
        description: text(description),
        category: text(category),
        school: text(school),
        status: text("available"),
        price: { integerValue: String(price) },
        ownerId: text(`sample-owner-${index}`),
        ownerName: text(ownerName),
        createdAt: { timestampValue: new Date(now - index * 3_600_000).toISOString() },
      },
    }),
  });
  if (!response.ok) throw new Error(`Could not add ${id}: ${response.status} ${await response.text()}`);
}

console.log(`Added ${SAMPLE_ITEMS.length} sample items to the emulator.`);
