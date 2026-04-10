// Hardcoded Bundestag seat distribution per wahlperiode.
// Parties listed in political L→R order — this determines angular position in the hemicycle.
export interface PartySeats {
  party: string;
  seats: number;
}

export const BUNDESTAG_SEATS: Record<number, PartySeats[]> = {
  // Political L→R order within each period
  20: [
    { party: "Die Linke", seats: 28 },
    { party: "Grüne", seats: 117 },
    { party: "SPD", seats: 207 },
    { party: "CDU/CSU", seats: 196 },
    { party: "FDP", seats: 90 },
    { party: "AfD", seats: 76 },
    { party: "BSW", seats: 10 }, // as of 2026-04-06 (formed mid-period from Die Linke split)
    { party: "fraktionslos", seats: 9 }, // as of 2026-04-06 (changes throughout the period)
  ],
  21: [
    { party: "Die Linke", seats: 64 },
    { party: "Grüne", seats: 85 },
    { party: "SPD", seats: 120 },
    { party: "CDU/CSU", seats: 208 },
    { party: "AfD", seats: 150 },
    { party: "fraktionslos", seats: 3 }, // as of 2026-04-06 (changes throughout the period)
  ],
};

/** Total seats for a given wahlperiode, or 0 if unknown. */
export function getTotalSeats(wahlperiode: number): number {
  return (BUNDESTAG_SEATS[wahlperiode] ?? []).reduce((s, p) => s + p.seats, 0);
}
