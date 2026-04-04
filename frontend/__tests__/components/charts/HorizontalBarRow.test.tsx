import React from "react";
import { render, screen } from "@testing-library/react";
import { HorizontalBarRow } from "@/components/charts/HorizontalBarRow";

const base = {
  label: "SPD",
  labelWidth: 80,
  value: 50,
  max: 100,
  color: "#E3000F",
  displayValue: "50K",
};

it("renders label", () => {
  render(<HorizontalBarRow {...base} />);
  expect(screen.getByText("SPD")).toBeInTheDocument();
});

it("renders displayValue", () => {
  render(<HorizontalBarRow {...base} />);
  expect(screen.getByText("50K")).toBeInTheDocument();
});

it("renders rank when provided", () => {
  render(<HorizontalBarRow {...base} rank={3} />);
  expect(screen.getByText("3")).toBeInTheDocument();
});

it("does not render rank element when rank is undefined", () => {
  const { container } = render(<HorizontalBarRow {...base} />);
  // rank column is absent — only label, track, value divs present at top level
  expect(screen.queryByText(/^\d+$/)).toBeNull();
});

it("bar fill width is proportional to value/max", () => {
  const { container } = render(
    <HorizontalBarRow {...base} value={25} max={100} />,
  );
  const fill = container.querySelector(
    "[data-testid='bar-fill']",
  ) as HTMLElement;
  expect(fill.style.width).toBe("25%");
});

it("bar fill width is 0% when value is 0", () => {
  const { container } = render(
    <HorizontalBarRow {...base} value={0} max={100} />,
  );
  const fill = container.querySelector(
    "[data-testid='bar-fill']",
  ) as HTMLElement;
  expect(fill.style.width).toBe("0%");
});

it("bar fill width is 100% when value equals max", () => {
  const { container } = render(
    <HorizontalBarRow {...base} value={100} max={100} />,
  );
  const fill = container.querySelector(
    "[data-testid='bar-fill']",
  ) as HTMLElement;
  expect(fill.style.width).toBe("100%");
});

it("does not crash when max is 0", () => {
  render(<HorizontalBarRow {...base} value={0} max={0} />);
  expect(screen.getByText("SPD")).toBeInTheDocument();
});
