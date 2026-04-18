"use client";
import { useEffect } from "react";
import { useLanguage } from "@/lib/language-context";

/** Syncs document.documentElement.lang with the active language.
 *  Fixes WCAG 3.1.1: the static lang="de" in layout.tsx is the SSR default;
 *  this component updates it client-side when the user switches language. */
export function LangSync() {
  const { language } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return null;
}
