import {
  sortParties,
  sortPresentParties,
  normalizePartyName,
  getPartyColor,
  getPartyShortLabel,
  truncateText,
  PARTY_COLORS,
  PARTY_ORDER,
  FALLBACK_COLOR,
  NO_FACTION_LABEL,
  VOTE_NUMERIC,
  FILTER_ACCENT,
  FILTER_ACCENT_LIGHT,
  FILTER_BORDER,
  FILTER_BG_INPUT,
} from "@/lib/constants";

describe("sortParties", () => {
  it("sorts known parties by PARTY_ORDER", () => {
    const input = ["FDP", "SPD", "CDU/CSU", "AfD"];
    expect(sortParties(input)).toEqual(["CDU/CSU", "SPD", "AfD", "FDP"]);
  });

  it("puts unknown parties before fraktionslos", () => {
    const input = ["fraktionslos", "Piraten", "SPD"];
    const sorted = sortParties(input);
    expect(sorted.indexOf("SPD")).toBeLessThan(sorted.indexOf("Piraten"));
    expect(sorted.indexOf("Piraten")).toBeLessThan(
      sorted.indexOf("fraktionslos"),
    );
  });

  it("sorts unknown parties alphabetically among themselves", () => {
    const input = ["Zeta", "Alpha", "Mitte"];
    expect(sortParties(input)).toEqual(["Alpha", "Mitte", "Zeta"]);
  });

  it("handles empty array", () => {
    expect(sortParties([])).toEqual([]);
  });

  it("handles single party", () => {
    expect(sortParties(["SPD"])).toEqual(["SPD"]);
  });

  it("does not mutate the input array", () => {
    const input = ["FDP", "SPD"];
    sortParties(input);
    expect(input).toEqual(["FDP", "SPD"]);
  });
});

describe("sortPresentParties", () => {
  it("deduplicates and sorts parties in display order", () => {
    expect(
      sortPresentParties(["SPD", "Piraten", "SPD", "CDU/CSU", "fraktionslos"]),
    ).toEqual(["CDU/CSU", "SPD", "Piraten", "fraktionslos"]);
  });
});

describe("party helpers", () => {
  it("normalizes raw party names", () => {
    expect(normalizePartyName("BÜNDNIS 90/\u00adDIE GRÜNEN")).toBe(
      "BÜNDNIS 90/DIE GRÜNEN",
    );
  });

  it("resolves colors for raw party names", () => {
    expect(getPartyColor("BÜNDNIS 90/\u00adDIE GRÜNEN")).toBe(
      PARTY_COLORS["BÜNDNIS 90/DIE GRÜNEN"],
    );
  });

  it("resolves short labels for raw party names", () => {
    expect(getPartyShortLabel("Die Linke")).toBe("Linke");
  });
});

describe("truncateText", () => {
  it("returns the string unchanged when within limit", () => {
    expect(truncateText("hello", 10)).toBe("hello");
  });

  it("truncates and adds ellipsis when exceeding limit", () => {
    expect(truncateText("abcdefghij", 5)).toBe("abcde\u2026");
  });

  it("returns exact-length strings unchanged", () => {
    expect(truncateText("abcde", 5)).toBe("abcde");
  });

  it("handles empty string", () => {
    expect(truncateText("", 5)).toBe("");
  });
});

describe("constant integrity", () => {
  it("PARTY_COLORS has an entry for every PARTY_ORDER item", () => {
    for (const party of PARTY_ORDER) {
      expect(PARTY_COLORS[party]).toBeDefined();
    }
  });

  it("FALLBACK_COLOR is a valid hex color", () => {
    expect(FALLBACK_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("NO_FACTION_LABEL appears in PARTY_ORDER", () => {
    expect(PARTY_ORDER).toContain(NO_FACTION_LABEL);
  });

  it("VOTE_NUMERIC maps all vote types to numbers", () => {
    expect(VOTE_NUMERIC.yes).toBe(3);
    expect(VOTE_NUMERIC.no).toBe(1);
    expect(VOTE_NUMERIC.abstain).toBe(2);
    expect(VOTE_NUMERIC.no_show).toBe(0);
  });

  it("filter tokens are non-empty strings", () => {
    expect(FILTER_ACCENT).toBeTruthy();
    expect(FILTER_ACCENT_LIGHT).toBeTruthy();
    expect(FILTER_BORDER).toBeTruthy();
    expect(FILTER_BG_INPUT).toBeTruthy();
  });
});
