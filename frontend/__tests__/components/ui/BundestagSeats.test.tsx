import React from "react";
import { render, screen } from "@testing-library/react";
import { BundestagSeats } from "@/components/ui/BundestagSeats";
import { PeriodContext } from "@/lib/period-context";

function withPeriod(periodId: number | null, ui: React.ReactElement) {
  return render(
    <PeriodContext.Provider
      value={{
        periods: [],
        activePeriodId: periodId,
        setActivePeriodId: () => {},
      }}
    >
      {ui}
    </PeriodContext.Provider>,
  );
}

it("renders 630 SVG circles for period 21", () => {
  const { container } = withPeriod(21, <BundestagSeats />);
  const circles = container.querySelectorAll("circle");
  expect(circles).toHaveLength(630);
});

it("renders all party seat counts in the legend for period 21", () => {
  withPeriod(21, <BundestagSeats />);
  expect(screen.getByText("208")).toBeInTheDocument(); // CDU/CSU
  expect(screen.getByText("150")).toBeInTheDocument(); // AfD
  expect(screen.getByText("120")).toBeInTheDocument(); // SPD
  expect(screen.getByText("85")).toBeInTheDocument(); // Grüne
  expect(screen.getByText("64")).toBeInTheDocument(); // Die Linke
});

it("renders nothing for an unknown period", () => {
  const { container } = withPeriod(99, <BundestagSeats />);
  expect(container.firstChild).toBeNull();
});

it("renders nothing when period is null", () => {
  const { container } = withPeriod(null, <BundestagSeats />);
  expect(container.firstChild).toBeNull();
});
