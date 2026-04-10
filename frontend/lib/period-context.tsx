"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { fetchData, Period } from "@/lib/data";

interface PeriodContextValue {
  periods: Period[];
  activePeriodId: number | null;
  setActivePeriodId: (id: number) => void;
}

export const PeriodContext = createContext<PeriodContextValue>({
  periods: [],
  activePeriodId: null,
  setActivePeriodId: () => {},
});

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<number | null>(null);

  useEffect(() => {
    fetchData<Period[]>("/data/periods.json")
      .then((data) => {
        const available = data.filter((p) => p.has_data);
        setPeriods(available);
        if (available.length > 0) {
          const latest = available.reduce((a, b) =>
            b.wahlperiode > a.wahlperiode ? b : a,
          );
          setActivePeriodId(latest.wahlperiode);
        }
      })
      .catch(console.error);
  }, []);

  return (
    <PeriodContext.Provider
      value={{ periods, activePeriodId, setActivePeriodId }}
    >
      {children}
    </PeriodContext.Provider>
  );
}

export const usePeriod = () => useContext(PeriodContext);
