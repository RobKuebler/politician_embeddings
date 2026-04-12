"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { de } from "./i18n/de";
import { en } from "./i18n/en";
import type { Translations } from "./i18n/types";

type Language = "de" | "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "de",
  setLanguage: () => {},
  t: de,
});

/** Auto-detects browser language on mount. No persistence — re-detects on each visit. */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("de");

  // Detect browser language on first render
  useEffect(() => {
    setLanguage(navigator.language.startsWith("de") ? "de" : "en");
  }, []);

  // Keep <html lang> in sync
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = language === "de" ? de : en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Returns { language, setLanguage, t }. */
export function useLanguage() {
  return useContext(LanguageContext);
}

/** Returns the active translation dictionary. Shorthand for useLanguage().t. */
export function useTranslation() {
  return useContext(LanguageContext).t;
}
