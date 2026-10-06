import { describe, expect, it } from "vitest";
import { PAGE_SIZE, mergePage, pageCount, pageHref, parsePage } from "@/lib/pagination";

describe("parsePage", () => {
  it("default ke 1 untuk nilai kosong, nol, negatif, atau bukan angka", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-3")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });

  it("membulatkan ke bawah dan memakai nilai pertama dari array", () => {
    expect(parsePage("3.7")).toBe(3);
    expect(parsePage(["4", "9"])).toBe(4);
  });
});

describe("pageCount", () => {
  it("minimal satu halaman, bahkan saat kosong", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });
});

describe("mergePage", () => {
  const a = [{ d: 10 }, { d: 7 }, { d: 3 }];
  const b = [{ d: 9 }, { d: 8 }, { d: 1 }];
  const byDesc = (x: { d: number }, y: { d: number }) => y.d - x.d;

  it("menggabung dua daftar terurut lalu memotong jendela halaman", () => {
    expect(mergePage(a, b, byDesc, 1, 2).map((r) => r.d)).toEqual([10, 9]);
    expect(mergePage(a, b, byDesc, 2, 2).map((r) => r.d)).toEqual([8, 7]);
    expect(mergePage(a, b, byDesc, 3, 2).map((r) => r.d)).toEqual([3, 1]);
  });
});

describe("pageHref", () => {
  it("mempertahankan parameter lain dan membuang parameter untuk halaman 1", () => {
    expect(pageHref("/finance", { beli: "3" }, "poin", 2)).toBe("/finance?beli=3&poin=2");
    expect(pageHref("/finance", { beli: "3", poin: "2" }, "poin", 1)).toBe("/finance?beli=3");
    expect(pageHref("/riwayat-metadata", {}, "hal", 1)).toBe("/riwayat-metadata");
  });
});
