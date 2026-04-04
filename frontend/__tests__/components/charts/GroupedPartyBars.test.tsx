import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  GroupedPartyBars,
  type GroupedBarSection,
} from "@/components/charts/GroupedPartyBars";

const sections: GroupedBarSection[] = [
  { label: "Rubrik A", partyValues: { SPD: 80, CDU: 60 } },
  { label: "Rubrik B", partyValues: { SPD: 40, CDU: 70 } },
  { label: "Gesamt", partyValues: { SPD: 120, CDU: 130 }, variant: "total" },
];
const parties = ["SPD", "CDU"];

describe("GroupedPartyBars — rubrik-first (default)", () => {
  it("renders section headers", () => {
    render(<GroupedPartyBars sections={sections} parties={parties} />);
    expect(screen.getByText("Rubrik A")).toBeInTheDocument();
    expect(screen.getByText("Rubrik B")).toBeInTheDocument();
  });

  it("renders party labels as bars", () => {
    render(<GroupedPartyBars sections={sections} parties={parties} />);
    // SPD appears once per section (including total) = 3 times
    expect(screen.getAllByText("SPD")).toHaveLength(3);
  });
});

describe("GroupedPartyBars — toggle UI", () => {
  it("does not render toggle when allowGroupToggle is false", () => {
    render(<GroupedPartyBars sections={sections} parties={parties} />);
    expect(screen.queryByText("Partei")).toBeNull();
  });

  it("renders toggle when allowGroupToggle is true", () => {
    render(
      <GroupedPartyBars
        sections={sections}
        parties={parties}
        allowGroupToggle
      />,
    );
    expect(screen.getByText("Rubrik")).toBeInTheDocument();
    expect(screen.getByText("Partei")).toBeInTheDocument();
  });
});

describe("GroupedPartyBars — partei-first view", () => {
  function renderToggled() {
    render(
      <GroupedPartyBars
        sections={sections}
        parties={parties}
        allowGroupToggle
      />,
    );
    const parteiButton = screen.getByText("Partei");
    expect(parteiButton).toBeInTheDocument(); // Fails fast if toggle UI is missing
    fireEvent.click(parteiButton);
  }

  it("renders party names as section headers after toggle", () => {
    renderToggled();
    // In partei-first mode, each party is a section header — appears exactly once
    expect(screen.getAllByText("SPD")).toHaveLength(1);
    expect(screen.getAllByText("CDU")).toHaveLength(1);
  });

  it("renders rubrik labels as bars after toggle", () => {
    renderToggled();
    // Each rubric label appears once per party section (2 parties = 2 times each)
    expect(screen.getAllByText("Rubrik A")).toHaveLength(2);
    expect(screen.getAllByText("Rubrik B")).toHaveLength(2);
  });

  it("excludes total sections from partei-first view", () => {
    renderToggled();
    expect(screen.queryByText("Gesamt")).toBeNull();
  });

  it("switching back to Rubrik restores original view", () => {
    renderToggled();
    fireEvent.click(screen.getByText("Rubrik"));
    expect(screen.getByText("Gesamt")).toBeInTheDocument();
  });
});
