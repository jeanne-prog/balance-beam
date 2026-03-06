import { useMemo, useState, useCallback } from "react";
import { useRoutingEngine } from "@/hooks/useRoutingEngine";
import { AlertCircle, Clock } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { PayoutsTable } from "@/components/dashboard/PayoutsTable";
import { FlowTargetCards } from "@/components/dashboard/FlowTargetCards";
import { Card, CardContent } from "@/components/ui/card";

const Dashboard = () => {
  const [releasedIds, setReleasedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const handleRelease = useCallback((txId: string) => {
    setReleasedIds((prev) => new Set(prev).add(txId));
  }, []);
  const handleOverride = useCallback((txId: string, value: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (value === "__recommended") { next.delete(txId); } else { next.set(txId, value); }
      return next;
    });
  }, []);
  const { pendingPayouts, heldBackPayouts, allPendingPayouts, suggestions, balances, routingProviders, flowTargetProgress, routingRules, isLoading, error } = useRoutingEngine(releasedIds);

  const allocated = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of pendingPayouts) {
      const sugs = suggestions.get(tx.transactionId) ?? [];
      const overrideKey = overrides.get(tx.transactionId);
      let selected: { provider: string } | undefined;
      if (overrideKey) {
        const [prov] = overrideKey.split("|");
        selected = sugs.find((s) => s.provider === prov && s.score > 0) ?? sugs.find((s) => s.score > 0 && s.balanceSufficient);
      } else {
        selected = sugs.find((s) => s.score > 0 && s.balanceSufficient);
      }
      if (selected) {
        const key = `${selected.provider}|${tx.receiverCurrency.toUpperCase()}`;
        map.set(key, (map.get(key) ?? 0) + tx.receiverAmount);
      }
    }
    return map;
  }, [pendingPayouts, suggestions, overrides]);

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

      {heldBackPayouts.length > 0 && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardContent className="py-3 px-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              <strong>{heldBackPayouts.length}</strong> pending payout{heldBackPayouts.length !== 1 ? "s" : ""} held back by routing rules (
              ${heldBackPayouts.reduce((s, t) => s + t.usdValue, 0).toLocaleString()} USD).
              Total pending: {allPendingPayouts.length}, routing today: {pendingPayouts.length}.
            </span>
          </CardContent>
        </Card>
      )}

      {flowTargetProgress.length > 0 && (
        <FlowTargetCards targets={flowTargetProgress} isLoading={isLoading} />
      )}
      <div className="sticky top-14 z-20 -mx-6 px-6 py-3 bg-background/95 backdrop-blur-sm border-b border-border">
        <BalanceCards balances={balances} routingProviders={routingProviders} allocated={allocated} isLoading={isLoading} />
      </div>
      <LiquidityForecastPanel forecast={liquidityForecast} isLoading={isLoading} />
      <PayoutsTable transactions={pendingPayouts} heldBackTransactions={heldBackPayouts} suggestions={suggestions} routingRules={routingRules} isLoading={isLoading} onRelease={handleRelease} overrides={overrides} onOverride={handleOverride} />
    </div>
  );
};

export default Dashboard;
