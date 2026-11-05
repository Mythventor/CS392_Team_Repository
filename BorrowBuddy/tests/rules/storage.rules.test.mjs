import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, deleteObject, getBytes } from "firebase/storage";
import { readFileSync } from "node:fs";
import { before, after, test } from "node:test";
let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-borrowbuddy",
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});
after(() => env.cleanup());
test("only the owner can upload and delete a photo; public can read", async () => {
  const path = "items/owner/calculator/photo";
  const owner = env.authenticatedContext("owner").storage();
  const other = env.authenticatedContext("other").storage();
  await assertSucceeds(
    uploadBytes(ref(owner, path), new Uint8Array([1]), {
      contentType: "image/png",
    }),
  );
  await assertSucceeds(
    getBytes(ref(env.unauthenticatedContext().storage(), path)),
  );
  await assertFails(
    uploadBytes(
      ref(other, "items/owner/calculator/other"),
      new Uint8Array([1]),
      { contentType: "image/png" },
    ),
  );
  await assertFails(deleteObject(ref(other, path)));
  await assertSucceeds(deleteObject(ref(owner, path)));
});
test("rejects unsupported and oversized uploads", async () => {
  const storage = env.authenticatedContext("owner").storage();
  await assertFails(
    uploadBytes(ref(storage, "items/owner/x/svg"), new Uint8Array([1]), {
      contentType: "image/svg+xml",
    }),
  );
  await assertFails(
    uploadBytes(
      ref(storage, "items/owner/x/big"),
      new Uint8Array(5 * 1024 * 1024 + 1),
      { contentType: "image/jpeg" },
    ),
  );
});
