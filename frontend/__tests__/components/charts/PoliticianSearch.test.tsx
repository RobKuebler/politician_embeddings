// frontend/__tests__/components/charts/PoliticianSearch.test.tsx
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoliticianSearch } from "@/components/charts/PoliticianSearch";
import { Politician } from "@/lib/data";

// Soft-hyphen in party name to test stripSoftHyphen usage
const POLITICIANS: Politician[] = [
  {
    politician_id: 1,
    name: "Anna Schmidt",
    party: "SPD",
    sex: "f",
    year_of_birth: 1980,
    occupation: null,
    education: null,
    field_title: null,
  },
  {
    politician_id: 2,
    name: "Bernd Müller",
    party: "CDU/CSU",
    sex: "m",
    year_of_birth: 1975,
    occupation: null,
    education: null,
    field_title: null,
  },
  {
    politician_id: 3,
    name: "Clara Grün",
    party: "BÜNDNIS 90/\u00adDIE GRÜNEN",
    sex: "f",
    year_of_birth: 1990,
    occupation: null,
    education: null,
    field_title: null,
  },
];

describe("PoliticianSearch", () => {
  describe("dropdown filtering", () => {
    it("shows no dropdown when input is empty", () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("shows dropdown with matching results when input has ≥1 character", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "Anna",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: /Anna Schmidt/ }),
      ).toBeInTheDocument();
    });

    it("filters case-insensitively by name", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "anna",
      );
      expect(
        screen.getByRole("option", { name: /Anna Schmidt/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: /Bernd/ }),
      ).not.toBeInTheDocument();
    });

    it('shows "Keine Ergebnisse" when no politicians match', async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "xyz",
      );
      expect(screen.getByText("Keine Ergebnisse")).toBeInTheDocument();
    });

    it("hides already-selected politicians from dropdown", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1]}
          onSelectionChange={jest.fn()}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "a",
      );
      // Anna (id=1) is selected → should not appear in dropdown
      expect(
        screen.queryByRole("option", { name: /Anna Schmidt/ }),
      ).not.toBeInTheDocument();
      // Clara matches 'a' and is not selected → should appear
      expect(screen.getByRole("option", { name: /Clara/ })).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("calls onSelectionChange with new id when a result is clicked", async () => {
      const onChange = jest.fn();
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={onChange}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "Anna",
      );
      await userEvent.click(
        screen.getByRole("option", { name: /Anna Schmidt/ }),
      );
      expect(onChange).toHaveBeenCalledWith([1]);
    });

    it("clears the search input after selecting a result", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      const input = screen.getByPlaceholderText("Politiker suchen…");
      await userEvent.type(input, "Anna");
      await userEvent.click(
        screen.getByRole("option", { name: /Anna Schmidt/ }),
      );
      expect(input).toHaveValue("");
    });

    it("keeps dropdown open after selecting a result (multiselect UX)", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "a",
      );
      await userEvent.click(screen.getByRole("option", { name: /Clara/ }));
      // Dropdown stays open so user can continue selecting without retyping
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("appends to existing selection when adding a second politician", async () => {
      const onChange = jest.fn();
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1]}
          onSelectionChange={onChange}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "Bernd",
      );
      await userEvent.click(
        screen.getByRole("option", { name: /Bernd Müller/ }),
      );
      expect(onChange).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe("chips", () => {
    it("renders a chip for each selected politician", () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1, 2]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(screen.getByTestId("chip-1")).toBeInTheDocument();
      expect(screen.getByTestId("chip-2")).toBeInTheDocument();
    });

    it("removes politician from selection when chip × is clicked", async () => {
      const onChange = jest.fn();
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1, 2]}
          onSelectionChange={onChange}
        />,
      );
      await userEvent.click(
        within(screen.getByTestId("chip-1")).getByRole("button", {
          name: /Entferne/,
        }),
      );
      expect(onChange).toHaveBeenCalledWith([2]);
    });

    it("truncates politician name at 20 characters in chip", () => {
      // 'Maximilian Mustermann' = 21 chars → slice(0,20) = 'Maximilian Musterman' + '…'
      const longNamePol: Politician = {
        politician_id: 99,
        name: "Maximilian Mustermann",
        party: "SPD",
        sex: "m",
        year_of_birth: 1970,
        occupation: null,
        education: null,
        field_title: null,
      };
      render(
        <PoliticianSearch
          politicians={[...POLITICIANS, longNamePol]}
          selected={[99]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(screen.getByTestId("chip-99")).toHaveTextContent(
        "Maximilian Musterman…",
      );
    });

    it("renders party badge without soft-hyphen in chip", () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[3]}
          onSelectionChange={jest.fn()}
        />,
      );
      const chip = screen.getByTestId("chip-3");
      // getPartyShortLabel maps canonical "BÜNDNIS 90/DIE GRÜNEN" → "Grüne" for display
      expect(chip).not.toHaveTextContent("\u00ad");
      expect(chip).toHaveTextContent("Grüne");
    });
  });

  describe("clear button", () => {
    it('does not show "Auswahl aufheben" when nothing is selected', () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(
        screen.queryByRole("button", { name: "Auswahl aufheben" }),
      ).not.toBeInTheDocument();
    });

    it('shows "Auswahl aufheben" when ≥1 politician is selected', () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Auswahl aufheben" }),
      ).toBeInTheDocument();
    });

    it('calls onSelectionChange([]) when "Auswahl aufheben" is clicked', async () => {
      const onChange = jest.fn();
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1, 2]}
          onSelectionChange={onChange}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Auswahl aufheben" }),
      );
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  describe("dropdown close behavior", () => {
    it("closes dropdown when Escape is pressed", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "Anna",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("clears input when Escape is pressed", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      const input = screen.getByPlaceholderText("Politiker suchen…");
      await userEvent.type(input, "Anna");
      await userEvent.keyboard("{Escape}");
      expect(input).toHaveValue("");
    });

    it("closes dropdown when clicking outside the component", async () => {
      render(
        <div>
          <PoliticianSearch
            politicians={POLITICIANS}
            selected={[]}
            onSelectionChange={jest.fn()}
          />
          <div data-testid="outside">outside</div>
        </div>,
      );
      await userEvent.type(
        screen.getByPlaceholderText("Politiker suchen…"),
        "Anna",
      );
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await userEvent.click(screen.getByTestId("outside"));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes dropdown when user manually clears the input", async () => {
      render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      const input = screen.getByPlaceholderText("Politiker suchen…");
      await userEvent.type(input, "Anna");
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      await userEvent.clear(input);
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("external selection sync (scatter → chips)", () => {
    it("renders chips for politicians selected externally (e.g. from scatter)", () => {
      const { rerender } = render(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(screen.queryByTestId("chip-1")).not.toBeInTheDocument();
      rerender(
        <PoliticianSearch
          politicians={POLITICIANS}
          selected={[1, 2]}
          onSelectionChange={jest.fn()}
        />,
      );
      expect(screen.getByTestId("chip-1")).toBeInTheDocument();
      expect(screen.getByTestId("chip-2")).toBeInTheDocument();
    });
  });
});
