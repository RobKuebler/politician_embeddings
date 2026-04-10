// Hardcoded Bundestag seat distribution per wahlperiode.
// Parties listed in political L→R order — this determines angular position in the hemicycle.
export interface PartySeats {
  party: string;
  seats: number;
}

export const BUNDESTAG_SEATS: Record<number, PartySeats[]> = {
  21: [
    { party: "Die Linke", seats: 64 },
    { party: "Grüne", seats: 85 },
    { party: "SPD", seats: 120 },
    { party: "CDU/CSU", seats: 208 },
    { party: "AfD", seats: 150 },
    { party: "fraktionslos", seats: 3 },
  ],
};

/** Total seats for a given wahlperiode, or 0 if unknown. */
export function getTotalSeats(wahlperiode: number): number {
  return (BUNDESTAG_SEATS[wahlperiode] ?? []).reduce((s, p) => s + p.seats, 0);
}
