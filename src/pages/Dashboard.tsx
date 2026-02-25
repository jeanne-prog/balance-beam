import { useMemo } from "react";
import { useRoutingEngine } from "@/hooks/useRoutingEngine";
import { AlertCircle } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { PayoutsTable } from "@/components/dashboard/PayoutsTable";
import { FlowTargetCards } from "@/components/dashboard/FlowTargetCards";
import { FundMovementsPanel } from "@/components/dashboard/FundMovementsPanel";

const Dashboard = () => {
  const { pendingPayouts, suggestions, balances, routingProviders, flowTargetProgress, fundMovements, isLoading, error } = useRoutingEngine();

  /** Compute allocated amounts per provider+currency from top suggestions */
  const allocated = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of pendingPayouts) {
      const sugs = suggestions.get(tx.transactionId) ?? [];
      const top = sugs.find((s) => s.score > 0 && s.balanceSufficient);
      if (top) {
        const key = `${top.provider}|${tx.receiverCurrency.toUpperCase()}`;
        map.set(key, (map.get(key) ?? 0) + tx.receiverAmount);
      }
    }
    return map;
  }, [pendingPayouts, suggestions]);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Failed to load dashboard: {(error as Error).message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pending payouts with routing suggestions — click a row to see ranked providers.
        </p>
      </div>

      <DashboardStats transactions={pendingPayouts} suggestions={suggestions} isLoading={isLoading} />
      {flowTargetProgress.length > 0 && (
        <FlowTargetCards targets={flowTargetProgress} isLoading={isLoading} />
      )}
      <BalanceCards balances={balances} routingProviders={routingProviders} allocated={allocated} isLoading={isLoading} />
      <FundMovementsPanel movements={fundMovements} isLoading={isLoading} />
      <PayoutsTable transactions={pendingPayouts} suggestions={suggestions} isLoading={isLoading} />
    </div>
  );
};

export default Dashboard;
