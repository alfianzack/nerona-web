import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    metadataLog: {
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import {
  normalizeKeywords,
  recordMetadataLog,
  getMetadataLogStats,
  listMetadataLogsForUser,
  listAllMetadataLogs,
} from "@/lib/metadata-log";
import { prisma } from "@/lib/prisma";

const create = prisma.metadataLog.create as any;
const count = prisma.metadataLog.count as any;
const groupBy = prisma.metadataLog.groupBy as any;
const findMany = prisma.metadataLog.findMany as any;

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ id: "log1" });
});

describe("normalizeKeywords", () => {
  it("joins an array into one comma-separated string", () => {
    expect(normalizeKeywords(["kucing", "lucu", "hewan"])).toEqual({
      text: "kucing, lucu, hewan",
      count: 3,
    });
  });

  it("re-normalizes spacing in a comma string", () => {
    expect(normalizeKeywords("kucing,lucu ,  hewan")).toEqual({
      text: "kucing, lucu, hewan",
      count: 3,
    });
  });

  it("drops case-insensitive duplicates but keeps the first spelling", () => {
    expect(normalizeKeywords(["Kucing", "kucing", "KUCING", "lucu"])).toEqual({
      text: "Kucing, lucu",
      count: 2,
    });
  });

  it("treats blank input as zero keywords, not one empty one", () => {
    expect(normalizeKeywords("")).toEqual({ text: "", count: 0 });
    expect(normalizeKeywords(",, ,")).toEqual({ text: "", count: 0 });
    expect(normalizeKeywords(null)).toEqual({ text: "", count: 0 });
  });

  it("truncates at a keyword boundary, never mid-word", () => {
    const long = Array.from({ length: 600 }, (_, i) => `keyword-panjang-${i}`);
    const result = normalizeKeywords(long);
    expect(result.text.length).toBeLessThanOrEqual(4000);
    expect(result.text.endsWith(",")).toBe(false);
    // Setiap potongan harus utuh — tidak ada yang terpotong di tengah.
    for (const part of result.text.split(", ")) {
      expect(long).toContain(part);
    }
    expect(result.count).toBe(result.text.split(", ").length);
  });
});

describe("recordMetadataLog", () => {
  it("stores the joined keyword string and its count", async () => {
    await recordMetadataLog({
      userId: "u1",
      marketplace: "Adobe",
      pageUrl: "https://contributor.stock.adobe.com/id/uploads",
      title: "Cute cat illustration",
      keywords: ["cat", "cute"],
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        marketplace: "adobe",
        pageUrl: "https://contributor.stock.adobe.com/id/uploads",
        title: "Cute cat illustration",
        keywords: "cat, cute",
        keywordCount: 2,
      },
    });
  });

  it("returns null without writing when there is nothing to record", async () => {
    expect(await recordMetadataLog({ userId: "u1", marketplace: "adobe", pageUrl: "", title: "", keywords: "" })).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("still records when only keywords came through", async () => {
    await recordMetadataLog({ userId: "u1", marketplace: "", pageUrl: "", title: "", keywords: "cat" });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ marketplace: "unknown", keywords: "cat", keywordCount: 1 }),
    });
  });

  it("truncates an over-long URL instead of rejecting the row", async () => {
    await recordMetadataLog({
      userId: "u1",
      marketplace: "adobe",
      pageUrl: "https://x.com/" + "a".repeat(900),
      title: "T",
      keywords: "k",
    });
    expect(create.mock.calls[0][0].data.pageUrl.length).toBe(500);
  });
});

describe("scoping", () => {
  it("filters by user for a tenant and not at all for admin", async () => {
    count.mockResolvedValue(0);
    groupBy.mockResolvedValue([]);

    await getMetadataLogStats("u1");
    expect(count.mock.calls[0][0].where).toEqual({ userId: "u1" });

    vi.clearAllMocks();
    count.mockResolvedValue(0);
    groupBy.mockResolvedValue([]);
    await getMetadataLogStats(null);
    expect(count.mock.calls[0][0].where).toEqual({});
  });

  it("includes the owner only in the admin listing", async () => {
    findMany.mockResolvedValue([]);
    await listMetadataLogsForUser("u1", 10);
    expect(findMany.mock.calls[0][0].include).toBeUndefined();
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: "u1" });

    await listAllMetadataLogs(10);
    expect(findMany.mock.calls[1][0].where).toBeUndefined();
    expect(findMany.mock.calls[1][0].include).toEqual({
      user: { select: { email: true, name: true } },
    });
  });
});
