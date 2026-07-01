import { describe, expect, it } from "vitest";

import {
  PHOTO_UPLOAD_MAX_BATCH,
  validatePhotoBatch,
} from "./compress-image";

describe("compress-image", () => {
  it("rejects batches larger than 20 files", () => {
    const files = Array.from({ length: PHOTO_UPLOAD_MAX_BATCH + 1 }, (_, index) =>
      new File(["x"], `photo-${index}.jpg`, { type: "image/jpeg" }),
    );

    expect(validatePhotoBatch(files)).toMatch(/20 images/);
  });

  it("rejects unsupported file types", () => {
    const files = [new File(["x"], "notes.txt", { type: "text/plain" })];

    expect(validatePhotoBatch(files)).toMatch(/not a supported image type/);
  });
});
