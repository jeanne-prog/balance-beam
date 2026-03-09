import { createContext, useContext, useState, type ReactNode } from "react";

export type FundingGap = { provider: string; currency: string; gap: number };

interface AllocationContextValue {
  allocated: Map<string, number>;
  fundingGaps: FundingGap[];
  setAllocated: (m: Map<string, number>) => void;
  setFundingGaps: (g: FundingGap[]) => void;
}

const AllocationContext = createContext<AllocationContextValue>({
  allocated: new Map(),
  fundingGaps: [],
  setAllocated: () => {},
  setFundingGaps: () => {},
});

export function AllocationProvider({ children }: { children: ReactNode }) {
  const [allocated, setAllocated] = useState<Map<string, number>>(new Map());
  const [fundingGaps, setFundingGaps] = useState<FundingGap[]>([]);
  return (
    <AllocationContext.Provider value={{ allocated, fundingGaps, setAllocated, setFundingGaps }}>
      {children}
    </AllocationContext.Provider>
  );
}

export const useAllocation = () => useContext(AllocationContext);
