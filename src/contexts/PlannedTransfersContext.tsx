import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { PlannedTransfer } from "@/lib/fundMovements";

interface PlannedTransfersContextValue {
  plannedTransfers: PlannedTransfer[];
  addPlannedTransfer: (t: Omit<PlannedTransfer, "id" | "createdAt" | "source">) => void;
  removePlannedTransfer: (id: string) => void;
}

const PlannedTransfersContext = createContext<PlannedTransfersContextValue | null>(null);

export function PlannedTransfersProvider({ children }: { children: ReactNode }) {
  const [plannedTransfers, setPlannedTransfers] = useState<PlannedTransfer[]>([]);

  const addPlannedTransfer = useCallback((t: Omit<PlannedTransfer, "id" | "createdAt" | "source">) => {
    setPlannedTransfers(prev => [...prev, {
      ...t,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      source: "planned",
    }]);
  }, []);

  const removePlannedTransfer = useCallback((id: string) => {
    setPlannedTransfers(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <PlannedTransfersContext.Provider value={{ plannedTransfers, addPlannedTransfer, removePlannedTransfer }}>
      {children}
    </PlannedTransfersContext.Provider>
  );
}

export function usePlannedTransfers() {
  const ctx = useContext(PlannedTransfersContext);
  if (!ctx) throw new Error("usePlannedTransfers must be used within PlannedTransfersProvider");
  return ctx;
}
