import { useMemo, useState, useCallback, useEffect } from "react";
import { useRoutingEngine } from "@/hooks/useRoutingEngine";
import { useRoutingDecisions, useAppendRoutingDecision } from "@/hooks/useRoutingDecisions";
import { useAuthContext } from "@/contexts/AuthContext";
import { AlertCircle, Clock } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { PayoutsTable } from "@/components/dashboard/PayoutsTable";
import { PayoutsFilterBar, applyPayoutsFilters, type PayoutsFilters } from "@/components/dashboard/PayoutsFilterBar";
import { FlowTargetCards } from "@/components/dashboard/FlowTargetCards";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

const Dashboard = () => {
  const { user } = useAuthContext();
  const { data: decisions } = useRoutingDecisions();
  const appendDecision = useAppendRoutingDecision();

  const [releasedIds, setReleasedIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [operatorHeldIds, setOperatorHeldIds] = useState<Set<string>>(new Set());
  const [decisionsLoaded, setDecisionsLoaded] = useState(false);

  // Initialise overrides from latest routing decisions
  useEffect(() => {
    if (decisions && !decisionsLoaded) {
      const latestByTx = new Map<string, { provider: string; rail: string }>();
      for (const d of decisions) {
        const existing = latestByTx.get(d.transactionId);
        if (!existing || d.routedAt > (latestByTx.get(d.transactionId) as any)._routedAt) {
          latestByTx.set(d.transactionId, { provider: d.assignedProvider, rail: d.assignedRail });
        }
      }
      const initial = new Map<string, string>();
      for (const [txId, { provider, rail }] of latestByTx) {
        initial.set(txId, `${provider}|${rail}`);
      }
      setOverrides(initial);
      setDecisionsLoaded(true);
    }
  }, [decisions, decisionsLoaded]);

  const handleRelease = useCallback((txId: string) => {
    setReleasedIds((prev) => new Set(prev).add(txId));
  }, []);
  const handleOverride = useCallback((txId: string, value: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (value === "__recommended") { next.delete(txId); } else { next.set(txId, value); }
      return next;
    });

    // Persist routing decision
    if (value !== "__recommended") {
      const [provider, rail] = value.split("|");
      const isPobo = value.includes("POBO");
      appendDecision.mutate(
        {
          tab: "routingDecisions",
          values: [[txId, provider, rail || "", isPobo ? "YES" : "NO", "manual", user?.email || "unknown", new Date().toISOString()]],
        },
        {
          onError: (e) => {
            toast({ title: "Failed to save routing decision", description: (e as Error).message, variant: "destructive" });
          },
        }
      );
    }
  }, [appendDecision, user]);
  const handleToggleHold = useCallback((txId: string) => {
    setOperatorHeldIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) { next.delete(txId); } else { next.add(txId); }
      return next;
    });
  }, []);
  const { pendingPayouts, heldBackPayouts, allPendingPayouts, suggestions, balances, effectiveBalances, incomingTransfers, routingProviders, flowTargetProgress, routingRules, isLoading, error } = useRoutingEngine(releasedIds, operatorHeldIds);

  const allocated = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of pendingPayouts) {
      if (operatorHeldIds.has(tx.transactionId)) continue;
      const sugs = suggestions.get(tx.transactionId) ?? [];
      const overrideKey = overrides.get(tx.transactionId);
      let selected: { provider: string } | undefined;
      if (overrideKey) {
        const [prov] = overrideKey.split("|");
        selected = sugs.find((s) => s.provider === prov);
      } else {
        selected = sugs.find((s) => s.score > 0 && s.balanceSufficient);
      }
      if (selected) {
        const key = `${selected.provider}|${tx.receiverCurrency.toUpperCase()}`;
        map.set(key, (map.get(key) ?? 0) + tx.receiverAmount);
      }
    }
    return map;
  }, [pendingPayouts, suggestions, overrides, operatorHeldIds]);

  // Funding gap: providers where effective balance - allocated < 0
  const fundingGaps = useMemo(() => {
    const gaps: { provider: string; currency: string; gap: number }[] = [];
    const balMap = new Map<string, number>();
    for (const b of effectiveBalances) {
      const key = `${b.provider.toUpperCase()}|${b.currency.toUpperCase()}`;
      balMap.set(key, (balMap.get(key) ?? 0) + b.currentBalance);
    }
    for (const [key, allocAmt] of allocated) {
      const bal = balMap.get(key) ?? 0;
      const remaining = bal - allocAmt;
      if (remaining < 0) {
        const [provider, currency] = key.split("|");
        gaps.push({ provider, currency, gap: remaining });
      }
    }
    return gaps;
  }, [effectiveBalances, allocated]);

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

      <DashboardStats transactions={pendingPayouts} suggestions={suggestions} isLoading={isLoading} fundingGaps={fundingGaps} />

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
        <BalanceCards balances={balances} routingProviders={routingProviders} allocated={allocated} isLoading={isLoading} incomingTransfers={incomingTransfers} />
      </div>
      
      <PayoutsTable transactions={pendingPayouts} heldBackTransactions={heldBackPayouts} suggestions={suggestions} routingRules={routingRules} isLoading={isLoading} onRelease={handleRelease} overrides={overrides} onOverride={handleOverride} operatorHeldIds={operatorHeldIds} onToggleHold={handleToggleHold} />
    </div>
  );
};

export default Dashboard;
