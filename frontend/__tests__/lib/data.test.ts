import { stripSoftHyphen, dataUrl, fetchData } from "@/lib/data";

describe("stripSoftHyphen", () => {
  it("removes soft-hyphen and normalizes GRÜNEN party name", () => {
    expect(stripSoftHyphen("BÜNDNIS 90/\u00adDIE GRÜNEN")).toBe("Grüne");
    expect(stripSoftHyphen("BÜNDNIS 90/DIE GRÜNEN")).toBe("Grüne");
  });
  it("leaves strings without soft-hyphen unchanged", () => {
    expect(stripSoftHyphen("SPD")).toBe("SPD");
  });
  it("handles empty string", () => {
    expect(stripSoftHyphen("")).toBe("");
  });
});

describe("dataUrl", () => {
  it("builds correct URL for a period-specific file", () => {
    expect(dataUrl("politicians.json", 161)).toBe("/data/161/politicians.json");
  });
  it("builds correct URL with a different period", () => {
    expect(dataUrl("embeddings.json", 20)).toBe("/data/20/embeddings.json");
  });
});

describe("dataUrl for speech files", () => {
  it("builds correct URL for party_word_freq", () => {
    expect(dataUrl("party_word_freq.json", 132)).toBe(
      "/data/132/party_word_freq.json",
    );
  });
  it("builds correct URL for party_speech_stats", () => {
    expect(dataUrl("party_speech_stats.json", 161)).toBe(
      "/data/161/party_speech_stats.json",
    );
  });
});

describe("fetchData", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns parsed JSON on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, name: "test" }),
    });
    const data = await fetchData<{ id: number; name: string }>(
      "/data/test.json",
    );
    expect(data).toEqual({ id: 1, name: "test" });
    expect(global.fetch).toHaveBeenCalledWith("/data/test.json");
  });

  it("throws on non-200 response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(fetchData("/data/missing.json")).rejects.toThrow(
      "Failed to fetch /data/missing.json: 404",
    );
  });

  it("throws on network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    await expect(fetchData("/data/test.json")).rejects.toThrow("Network error");
  });
});
