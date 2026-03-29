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
    expect(dataUrl("politicians_{period}.json", 161)).toBe(
      "/data/politicians_161.json",
    );
  });
  it("builds correct URL for periods.json (no substitution needed)", () => {
    expect(dataUrl("periods.json", 161)).toBe("/data/periods.json");
  });
});

describe("dataUrl for speech files", () => {
  it("builds correct URL for party_word_freq", () => {
    expect(dataUrl("party_word_freq_{period}.json", 132)).toBe(
      "/data/party_word_freq_132.json",
    );
  });
  it("builds correct URL for party_speech_stats", () => {
    expect(dataUrl("party_speech_stats_{period}.json", 161)).toBe(
      "/data/party_speech_stats_161.json",
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
