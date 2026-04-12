import React from "react";
import { render, screen, act } from "@testing-library/react";
import {
  LanguageProvider,
  useLanguage,
  useTranslation,
} from "@/lib/language-context";

function LangDisplay() {
  const { language } = useLanguage();
  return <div data-testid="lang">{language}</div>;
}

function LangSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <button onClick={() => setLanguage("en")}>to-en</button>
      <button onClick={() => setLanguage("de")}>to-de</button>
    </div>
  );
}

function TransDisplay() {
  const t = useTranslation();
  return <div data-testid="cta">{t.home.cta}</div>;
}

describe("LanguageProvider auto-detection", () => {
  it("defaults to 'de' when browser language is de-DE", () => {
    Object.defineProperty(navigator, "language", {
      value: "de-DE",
      configurable: true,
    });
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("de");
  });

  it("defaults to 'en' when browser language is en-US", () => {
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });

  it("defaults to 'en' for an unrecognised locale", () => {
    Object.defineProperty(navigator, "language", {
      value: "fr-FR",
      configurable: true,
    });
    render(
      <LanguageProvider>
        <LangDisplay />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
  });
});

describe("setLanguage", () => {
  it("switches from de to en and updates the translation", () => {
    Object.defineProperty(navigator, "language", {
      value: "de-DE",
      configurable: true,
    });
    render(
      <LanguageProvider>
        <LangSwitcher />
        <TransDisplay />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("cta")).toHaveTextContent("Öffnen");
    act(() => screen.getByText("to-en").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("en");
    expect(screen.getByTestId("cta")).toHaveTextContent("Open");
  });

  it("switches back to de", () => {
    Object.defineProperty(navigator, "language", {
      value: "en-US",
      configurable: true,
    });
    render(
      <LanguageProvider>
        <LangSwitcher />
      </LanguageProvider>,
    );
    act(() => screen.getByText("to-de").click());
    expect(screen.getByTestId("lang")).toHaveTextContent("de");
  });
});
