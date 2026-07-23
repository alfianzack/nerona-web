import { describe, expect, it } from "vitest";
import { sniffImageMime } from "@/lib/orders";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "ascii"),
]);

describe("sniffImageMime", () => {
  it("detects real image types from magic bytes", () => {
    expect(sniffImageMime(PNG)).toBe("image/png");
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(WEBP)).toBe("image/webp");
  });

  it("rejects a spoofed file whose bytes are not an image", () => {
    // e.g. an HTML/script payload uploaded with a claimed image Content-Type.
    const html = Buffer.from("<script>alert(1)</script>", "utf8");
    expect(sniffImageMime(html)).toBeNull();
  });

  it("rejects content too short to identify", () => {
    expect(sniffImageMime(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});
