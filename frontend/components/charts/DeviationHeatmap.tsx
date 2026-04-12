"use client";
/**
 * DeviationHeatmap — shows how strongly each occupation/category deviates
 * from the Bundestag-wide average within each party.
 *
 * Thin wrapper over PartyHeatmap (mode="deviation").
 * Handles party sorting, colMap reordering, and the 95th-percentile colour
 * domain so outlier parties don't wash out the rest of the scale.
 */
import { useMemo } from "react";
import { DeviationPivot } from "@/lib/data";
import { sortParties, NO_FACTION_LABEL } from "@/lib/constants";
import { PartyHeatmap } from "./PartyHeatmap";

interface Props {
  pivot: DeviationPivot;
}

export function DeviationHeatmap({ pivot }: Props) {
  const { rows, cols, data } = useMemo(() => {
    // Re-order parties by seat count (PARTY_ORDER), drop fraktionslos.
    const sortedCols = sortParties(
      pivot.parties.filter((p) => p !== NO_FACTION_LABEL),
    );
    const colMap = sortedCols.map((p) => pivot.parties.indexOf(p));

    const categoryIndices = pivot.categories
      .map((cat, idx) => ({ cat, idx }))
      .filter(({ cat }) => cat !== "Unbekannt");
    const rows = categoryIndices.map(({ cat }) => cat);
    const data = categoryIndices.map(({ idx }) =>
      colMap.map((ci) => pivot.dev[idx][ci] ?? null),
    );

    return { rows, cols: sortedCols, data };
  }, [pivot]);

  // Build per-cell tooltip using the full pivot for count/pct/total context.
  const sortedCols = cols; // alias for closure clarity
  const tooltipHtml = useMemo(() => {
    const colMap = sortedCols.map((p) => pivot.parties.indexOf(p));
    const partyTotals = colMap.map((ci) => pivot.party_totals[ci] ?? 0);
    const pctData = pivot.pct.map((row) => colMap.map((ci) => row[ci] ?? null));
    const countData = pivot.count.map((row) =>
      colMap.map((ci) => row[ci] ?? 0),
    );

    return (row: string, col: string, value: number) => {
      const rowIdx = pivot.categories.indexOf(row);
      const colIdx = sortedCols.indexOf(col);
      const count = countData[rowIdx]?.[colIdx] ?? 0;
      const pct = pctData[rowIdx]?.[colIdx];
      const total = partyTotals[colIdx] ?? 0;
      return (
        `<b>${col}</b><br/>${row}<br/>` +
        `${count} von ${total} Abgeordneten (${pct?.toFixed(1) ?? "?"}%)<br/>` +
        `Abweichung: ${value > 0 ? "+" : ""}${value.toFixed(1)} pp`
      );
    };
  }, [pivot, sortedCols]);

  return (
    <PartyHeatmap
      rows={rows}
      cols={cols}
      data={data}
      mode="deviation"
      cellLabel={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}`}
      tooltipHtml={tooltipHtml}
    />
  );
}
