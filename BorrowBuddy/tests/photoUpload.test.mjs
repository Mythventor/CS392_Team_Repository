import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadPhoto, discardUpload } from "../src/items/photoUpload.js";
const config = { cloudName: "test-cloud", uploadPreset: "listings" };
const file = new File(["image"], "photo.png", { type: "image/png" });
const result = {
  secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/photo.png",
  public_id: "photo",
  delete_token: "temporary-token",
};
test("uploads images using only the public preset and returns a verified delivery URL", async () => {
  const uploaded = await uploadPhoto(file, config, async (url, options) => {
    assert.equal(
      url,
      "https://api.cloudinary.com/v1_1/test-cloud/image/upload",
    );
    assert.equal(options.body.get("upload_preset"), "listings");
    assert.equal(options.body.get("file").name, "photo.png");
    assert.deepEqual([...options.body.keys()], ["file", "upload_preset"]);
    return new Response(JSON.stringify(result));
  });
  assert.equal(uploaded.photoURL, result.secure_url);
  assert.equal(uploaded.photoPublicId, "photo");
});
test("missing config and invalid photos fail before contacting Cloudinary", async () => {
  const request = () => {
    throw new Error("Should not be called");
  };
  await assert.rejects(uploadPhoto(file, {}, request), /not configured/);
  await assert.rejects(
    uploadPhoto(
      new File(["x"], "x.svg", { type: "image/svg+xml" }),
      config,
      request,
    ),
    /JPG/,
  );
});
test("handles network errors, non-JSON errors, and unexpected hosts", async () => {
  await assert.rejects(
    uploadPhoto(file, config, async () => {
      throw new Error("offline");
    }),
    /interrupted/,
  );
  await assert.rejects(
    uploadPhoto(
      file,
      config,
      async () => new Response("rate limited", { status: 429 }),
    ),
    /failed/,
  );
  await assert.rejects(
    uploadPhoto(
      file,
      config,
      async () =>
        new Response(
          JSON.stringify({
            ...result,
            secure_url: "https://example.com/photo",
          }),
        ),
    ),
    /invalid/,
  );
  await assert.rejects(
    uploadPhoto(
      file,
      config,
      async () =>
        new Response(
          JSON.stringify({
            ...result,
            secure_url: "https://res.cloudinary.com/other/image/upload/photo",
          }),
        ),
    ),
    /invalid/,
  );
});
test("failed-save cleanup uses only a short-lived delete token", async () => {
  let calls = 0;
  await discardUpload({}, config, async () => {
    calls++;
  });
  await discardUpload(
    { deleteToken: "temporary-token" },
    config,
    async (url, options) => {
      calls++;
      assert.equal(
        url,
        "https://api.cloudinary.com/v1_1/test-cloud/delete_by_token",
      );
      assert.equal(options.body.get("token"), "temporary-token");
      return new Response("{}");
    },
  );
  assert.equal(calls, 1);
});
