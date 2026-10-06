import { describe, expect, it } from "vitest";
import { uraiMetadata } from "@/lib/extension/metadata-urai";

describe("uraiMetadata", () => {
  it("membaca JSON kontrak", () => {
    const hasil = uraiMetadata('{"title":"Green hills","description":"Rolling hills.","keywords":["hills","sunset"]}');
    expect(hasil).toEqual({ title: "Green hills", description: "Rolling hills.", keywords: ["hills", "sunset"] });
  });

  it("menoleransi pagar markdown dan teks di sekitar JSON", () => {
    const hasil = uraiMetadata('Here you go:\n```json\n{"title":"A","description":"B","keywords":["c"]}\n```');
    expect(hasil?.title).toBe("A");
  });

  it("membuang keyword kosong, bukan string, dan duplikat tanpa mengubah urutan", () => {
    const hasil = uraiMetadata('{"title":"A","description":"B","keywords":["sun"," ",3,"Sky","sun","sky"]}');
    expect(hasil?.keywords).toEqual(["sun", "Sky"]);
  });

  it("null kalau bukan JSON atau judul dan keyword kosong", () => {
    expect(uraiMetadata("Sorry, I cannot help with that.")).toBeNull();
    expect(uraiMetadata('{"title":"","description":"B","keywords":[]}')).toBeNull();
    expect(uraiMetadata('{"title":"A", "keywords": [')).toBeNull();
  });
});
