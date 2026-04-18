import { Piazzolla } from "next/font/google";

/** Shared Piazzolla instance — import from here to avoid duplicate font loading. */
export const piazzolla = Piazzolla({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["italic", "normal"],
  display: "swap",
});
