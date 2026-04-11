"use client";
import { useState } from "react";
import {
  sortParties,
  getPartyColor,
  getPartyShortLabel,
} from "@/lib/constants";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";
import { ToggleGroup } from "@/components/ui/ToggleGroup";

/** Format a number as EUR with K/M suffix. */
export function formatEur(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K €`;
  return `${Math.round(n)} €`;
}

export interface GroupedBarSection {
  /** Section header label. */
  label: string;
  /** Map of party name → numeric value. Parties not present are shown as 0. */
  partyValues: Record<string, number>;
  /** Max value for bar scaling. Defaults to the max across all parties in this section. */
  max?: number;
  /** Display formatter for the value column. Defaults to formatEur. */
  formatValue?: (v: number) => string;
  /** Bar color per party. Defaults to PARTY_COLORS[party]. */
  barColor?: (party: string) => string;
  /** Width of the value column in px. Defaults to 52. */
  valueWidth?: number;
  /**
   * "total" renders with uppercase gray header + border-top separator.
   * Use for summary rows like "Gesamt alle Kategorien".
   */
  variant?: "default" | "total";
  /** Opacity of the bar fill — use to visually de-emphasise a secondary metric. */
  fillOpacity?: number;
}

/**
 * Pivots sections×parties into party×sections.
 * Sections with variant="total" are excluded — they'd be redundant sub-totals.
 * Max per party-section = max of all non-total section values for that party.
 */
function transposeToPartyFirst(
  sections: GroupedBarSection[],
  parties: string[],
): GroupedBarSection[] {
  const nonTotal = sections.filter((s) => s.variant !== "total");

  return parties.map((party) => {
    const partyValues: Record<string, number> = {};
    for (const section of nonTotal) {
      partyValues[section.label] = section.partyValues[party] ?? 0;
    }
    const maxVal = Math.max(...Object.values(partyValues), 1);
    return {
      label: party,
      partyValues,
      max: maxVal,
      // formatValue + barColor are looked up per-bar in the render step
      formatValue: nonTotal[0]?.formatValue,
      barColor: nonTotal[0]?.barColor,
    };
  });
}

/**
 * Renders a list of sections, each with a header label and one HorizontalBarRow per party.
 * Use this as the building block for any new grouped horizontal bar chart.
 *
 * Example:
 *   const sections: GroupedBarSection[] = [
 *     { label: "Rubrik A", partyValues: { "SPD": 45000, "CDU/CSU": 32000 } },
 *     { label: "Gesamt", partyValues: totalByParty, variant: "total" },
 *   ];
 *   <GroupedPartyBars sections={sections} parties={sortedParties} />
 */
export function GroupedPartyBars({
  sections,
  parties: partiesProp,
  labelWidth = 72,
  barHeight = 7,
  allowGroupToggle = false,
  sectionLabelWidth = 130,
}: {
  sections: GroupedBarSection[];
  /** Party list in display order. Derived from sections via sortParties() if omitted. */
  parties?: string[];
  labelWidth?: number;
  barHeight?: number;
  /** Renders a Rubrik/Partei toggle above the chart. State is internal. */
  allowGroupToggle?: boolean;
  /** Label column width (px) for rubric names in partei-first mode. Default 130. */
  sectionLabelWidth?: number;
}) {
  const [groupBy, setGroupBy] = useState<"section" | "party">("section");

  const parties =
    partiesProp ??
    sortParties(
      Array.from(new Set(sections.flatMap((s) => Object.keys(s.partyValues)))),
    );

  // Non-total sections (used for bar labels in partei-first mode)
  const nonTotalSections = sections.filter((s) => s.variant !== "total");

  // Derive which sections to render based on groupBy mode
  const renderSections =
    groupBy === "party" ? transposeToPartyFirst(sections, parties) : sections;

  // In partei-first mode, rubric names need more space than party abbreviations
  const effectiveLabelWidth =
    groupBy === "party" ? sectionLabelWidth : labelWidth;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {allowGroupToggle && (
        <div style={{ marginBottom: 12 }}>
          <ToggleGroup
            options={[
              { value: "section", label: "Rubrik" },
              { value: "party", label: "Partei" },
            ]}
            value={groupBy}
            onChange={setGroupBy}
          />
        </div>
      )}
      {renderSections.map((section) => {
        const {
          label,
          partyValues,
          formatValue = formatEur,
          barColor,
          valueWidth = 52,
          variant = "default",
          fillOpacity,
          max: sectionMax,
        } = section;

        // Rubrik-first: bars are parties. Partei-first: bars are rubric labels.
        const barLabels =
          groupBy === "party" ? nonTotalSections.map((s) => s.label) : parties;

        const computedMax =
          sectionMax ??
          Math.max(...barLabels.map((l) => partyValues[l] ?? 0), 1);

        const isTotal = variant === "total";

        return (
          <div
            key={label}
            style={
              isTotal
                ? {
                    borderTop: "1px solid #F0EEE9",
                    paddingTop: 14,
                    marginTop: 2,
                    marginBottom: 16,
                  }
                : { marginBottom: 16 }
            }
          >
            <p
              style={
                isTotal
                  ? {
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#9A9790",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 10,
                    }
                  : {
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#555",
                      marginBottom: 8,
                      lineHeight: 1.4,
                    }
              }
            >
              {label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {barLabels.map((barLabel) => {
                const value = partyValues[barLabel] ?? 0;
                // In partei-first mode, look up the original section for this rubric
                const origSection =
                  groupBy === "party"
                    ? sections.find((s) => s.label === barLabel)
                    : undefined;
                // In partei-first mode, look up color from the original section for this rubric
                const resolvedColor = (() => {
                  if (groupBy === "party") {
                    if (origSection?.barColor)
                      return origSection.barColor(label); // label = party name
                    return getPartyColor(label);
                  }
                  return barColor
                    ? barColor(barLabel)
                    : getPartyColor(barLabel);
                })();
                // In partei-first mode, look up formatValue from the original section for this rubric
                const resolvedFormat = (() => {
                  if (groupBy === "party") {
                    return origSection?.formatValue ?? formatEur;
                  }
                  return formatValue;
                })();
                // In section mode, barLabel is a party name — show short label.
                // In party mode, barLabel is a rubric category — show as-is.
                const displayLabel =
                  groupBy === "section"
                    ? getPartyShortLabel(barLabel)
                    : barLabel;
                return (
                  <HorizontalBarRow
                    key={barLabel}
                    label={displayLabel}
                    labelWidth={effectiveLabelWidth}
                    value={value}
                    max={computedMax}
                    color={resolvedColor}
                    displayValue={resolvedFormat(value)}
                    barHeight={barHeight}
                    valueWidth={valueWidth}
                    fillOpacity={fillOpacity}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
