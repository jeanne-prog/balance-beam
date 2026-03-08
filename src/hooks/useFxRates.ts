import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// Hardcoded pegs — treaty/central bank fixed rates that never change
const HARDCODED_PEGS: [string, string, number][] = [
  ["AED", "USD", 0.272294],
  ["USD", "AED", 3.6725],
  ["XOF", "EUR", 0.001524],
  ["EUR", "XOF", 655.957],
];

const ALL_CURRENCIES = ["EUR", "USD", "GBP", "CAD", "THB", "ZAR", "AED", "XOF"];

export function useFxRates() {
  const eurQuery = useQuery({
    queryKey: ["fx", "EUR"],
    queryFn: () =>
      fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CAD,THB,ZAR")
        .then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const usdQuery = useQuery({
    queryKey: ["fx", "USD"],
    queryFn: () =>
      fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,CAD,THB,ZAR")
        .then((r) => r.json()),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { rates, rateDate } = useMemo(() => {
    const map = new Map<string, number>();
    ALL_CURRENCIES.forEach((c) => map.set(`${c}|${c}`, 1));
    const eurRates = eurQuery.data?.rates ?? {};
    const usdRates = usdQuery.data?.rates ?? {};
    Object.entries(eurRates).forEach(([to, rate]) => {
      map.set(`EUR|${to}`, rate as number);
      map.set(`${to}|EUR`, 1 / (rate as number));
    });
    Object.entries(usdRates).forEach(([to, rate]) => {
      if (!map.has(`USD|${to}`)) map.set(`USD|${to}`, rate as number);
      if (!map.has(`${to}|USD`)) map.set(`${to}|USD`, 1 / (rate as number));
    });
    // Hardcoded pegs override floats
    HARDCODED_PEGS.forEach(([from, to, rate]) => map.set(`${from}|${to}`, rate));
    // Derive cross-rates via EUR for any missing pairs
    for (const a of ALL_CURRENCIES) {
      for (const b of ALL_CURRENCIES) {
        if (a === b || map.has(`${a}|${b}`)) continue;
        const aToEur = map.get(`${a}|EUR`);
        const eurToB = map.get(`EUR|${b}`);
        if (aToEur && eurToB) map.set(`${a}|${b}`, aToEur * eurToB);
      }
    }
    const rateDate = eurQuery.data?.date ?? usdQuery.data?.date ?? null;
    return { rates: map, rateDate };
  }, [eurQuery.data, usdQuery.data]);

  const getRate = (from: string, to: string) =>
    rates.get(`${from.toUpperCase()}|${to.toUpperCase()}`) ?? null;

  const convert = (amount: number, from: string, to: string) => {
    const rate = getRate(from, to);
    return rate != null ? amount * rate : null;
  };

  return {
    rates,
    rateDate,
    loading: eurQuery.isLoading || usdQuery.isLoading,
    getRate,
    convert,
  };
}
