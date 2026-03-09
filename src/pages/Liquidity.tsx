import { useMemo, useState } from "react";
import { useRoutingEngine } from "@/hooks/useRoutingEngine";
import { useFxRates } from "@/hooks/useFxRates";
import { LiquidityForecastPanel } from "@/components/dashboard/LiquidityForecastPanel";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderBadge } from "@/components/dashboard/ProviderBadge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRight, ArrowLeftRight, CheckCircle2, AlertTriangle, Clock, ChevronDown } from "lucide-react";
import type { FundingAction, FxSwapAction, PlannedTransfer } from "@/lib/fundMovements";

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

function formatTimeLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function urgencyClasses(urgency: FundingAction["urgency"]): string {
  switch (urgency) {
    case "critical": return "bg-[hsl(var(--status-danger))] text-white";
    case "high": return "bg-[hsl(var(--status-warning))] text-white";
    case "medium": return "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]";
    case "low": return "bg-muted text-muted-foreground";
  }
}

function TransferActionCard({ action, plannedTransfers }: { action: FundingAction; plannedTransfers: PlannedTransfer[] }) {
  // Check if covered by planned transfer
  const coveredPlanned = plannedTransfers.find(
    t => t.toProvider.toUpperCase() === action.toProvider &&
         t.currency.toUpperCase() === action.currency &&
         t.amount >= action.amountP50
  );

  if (coveredPlanned) {
    return (
      <div className="rounded-lg border-2 border-[hsl(var(--status-positive)/0.4)] bg-[hsl(var(--status-positive-bg))] p-3">
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--status-positive))]">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">Covered by planned transfer of {fmt(coveredPlanned.amount, coveredPlanned.currency)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 bg-card p-3 ${action.neoInsufficient ? "border-[hsl(var(--status-warning)/0.5)]" : "border-[hsl(var(--status-danger)/0.5)]"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ProviderBadge provider={action.fromProvider} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <ProviderBadge provider={action.toProvider} />
        </div>
        <span className="font-mono-numbers text-sm font-semibold">
          {fmt(action.amountP50, action.currency)}
        </span>
        <span className="font-mono-numbers text-xs text-muted-foreground">
          P75: {fmt(action.amountP75, action.currency)}
        </span>
        {action.minutesUntilCutoff !== null && (
          <Badge variant="outline" className={`text-xs ${action.minutesUntilCutoff < 60 ? "border-[hsl(var(--status-danger)/0.4)] text-[hsl(var(--status-danger))]" : action.minutesUntilCutoff <= 180 ? "border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))]" : "border-border text-muted-foreground"}`}>
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeLeft(action.minutesUntilCutoff)}
          </Badge>
        )}
        <Badge className={`text-xs ${urgencyClasses(action.urgency)}`}>
          {action.urgency}
        </Badge>
      </div>
      {action.neoInsufficient && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-[hsl(var(--status-warning))]">
          <AlertTriangle className="h-3 w-3" />
          Neo balance insufficient — partial transfer only
        </div>
      )}
    </div>
  );
}

function FxSwapCard({ swap }: { swap: FxSwapAction }) {
  const fxCost = swap.fxCostBps > 0 ? swap.shortfallAmount * swap.fxCostBps / 10000 : 0;
  const fxLabel = swap.fxCostBps === 0 ? "free" : `${swap.fxCostBps} bps`;

  return (
    <div className="rounded-lg border-2 border-indigo-300 bg-card p-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ProviderBadge provider="NEO" />
          <span className="text-xs font-medium text-muted-foreground">[{swap.sellCurrency}]</span>
          <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500" />
          <ProviderBadge provider="NEO" />
          <span className="text-xs font-medium text-muted-foreground">[{swap.shortfallCurrency}]</span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <ProviderBadge provider={swap.shortfallProvider} />
        </div>
        <Badge className="bg-indigo-100 text-indigo-700 text-xs">FX + Transfer</Badge>
        {swap.minutesUntilCutoff !== null && (
          <Badge variant="outline" className={`text-xs ${swap.minutesUntilCutoff < 60 ? "border-[hsl(var(--status-danger)/0.4)] text-[hsl(var(--status-danger))]" : "border-border text-muted-foreground"}`}>
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeLeft(swap.minutesUntilCutoff)}
          </Badge>
        )}
        <Badge className={`text-xs ${urgencyClasses(swap.urgency)}`}>
          {swap.urgency}
        </Badge>
      </div>
      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
        <p>
          Sell <span className="font-mono-numbers font-medium text-foreground">{fmt(swap.sellAmount, swap.sellCurrency)}</span> on Neo at{" "}
          <span className="font-mono-numbers font-medium text-foreground">{swap.fxRate.toFixed(4)}</span>{" "}
          (ECB · {fxLabel}) → receive{" "}
          <span className="font-mono-numbers font-medium text-foreground">{fmt(swap.shortfallAmount, swap.shortfallCurrency)}</span>{" "}
          → send to {swap.shortfallProvider}
        </p>
        {fxCost > 0 && (
          <p>· costs ~{fmt(fxCost, swap.shortfallCurrency)} in FX fees</p>
        )}
        {swap.fxRateDate && (
          <p className="text-[10px] italic">Rate as of {swap.fxRateDate} — confirm spot rate before executing</p>
        )}
      </div>
    </div>
  );
}

const Liquidity = () => {
  const { rates: fxRates, rateDate: fxRateDate, loading: fxLoading } = useFxRates();
  const {
    liquidityForecast, balances, effectiveBalances, incomingTransfers,
    routingProviders, plannedTransfers, addPlannedTransfer, removePlannedTransfer,
    allocatedMap, isLoading,
  } = useRoutingEngine(new Set(), new Set(), fxRates, fxRateDate);

  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showForecast, setShowForecast] = useState(false);

  const todayActions = useMemo(() =>
    liquidityForecast.flatMap(f =>
      f.actions
        .filter(a => a.horizon === "today")
        .map(a => ({
          action: a,
          fxSwaps: f.fxSwapActions.filter(s =>
            s.shortfallProvider === a.toProvider && s.shortfallCurrency === a.currency
          )
        }))
    ),
    [liquidityForecast]
  );

  const hasGaps = todayActions.length > 0;

  const tomorrowActions = useMemo(() => {
    return liquidityForecast.flatMap(f => f.actions.filter(a => a.horizon === "tomorrow"));
  }, [liquidityForecast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Liquidity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Funding gaps, FX swap recommendations, and forecast demand across providers.
        </p>
      </div>

      <div className="space-y-1">
        <BalanceCards balances={effectiveBalances} routingProviders={routingProviders} allocated={allocatedMap} isLoading={isLoading} incomingTransfers={incomingTransfers} />
        <p className="text-xs text-muted-foreground px-1">
          Allocation based on system routing recommendations. Dashboard may differ if manual overrides or holds are active.
        </p>
      </div>

      {/* Section 1 — Action needed now */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--status-danger))]" />
          Action needed now
        </h2>

        {!hasGaps && !isLoading && (
          <div className="rounded-lg border-2 border-[hsl(var(--status-positive)/0.4)] bg-[hsl(var(--status-positive-bg))] p-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-positive))]" />
            <span className="text-sm font-medium text-[hsl(var(--status-positive))]">All providers adequately funded</span>
          </div>
        )}

        {todayActions.map(({ action, fxSwaps }, i) => (
          <div key={`${action.toProvider}-${action.currency}-${i}`} className="space-y-2">
            {action.amountP50 > 0 && (
              <TransferActionCard action={action} plannedTransfers={plannedTransfers} />
            )}
            {fxSwaps.map((swap, j) => (
              <FxSwapCard key={`swap-${j}`} swap={swap} />
            ))}
          </div>
        ))}
      </div>

      {/* Plan a transfer */}
      <LiquidityForecastPanel
        forecast={[]}
        isLoading={isLoading}
        plannedTransfers={plannedTransfers}
        onAddPlannedTransfer={addPlannedTransfer}
        onRemovePlannedTransfer={removePlannedTransfer}
        effectiveBalances={effectiveBalances}
      />

      {/* Section 2 — Pre-fund for tomorrow */}
      {tomorrowActions.length > 0 && (
        <Collapsible open={showTomorrow} onOpenChange={setShowTomorrow}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
              <ChevronDown className={`h-4 w-4 transition-transform ${showTomorrow ? "" : "-rotate-90"}`} />
              Pre-fund for tomorrow ({tomorrowActions.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {tomorrowActions.map((a, i) => (
              <TransferActionCard key={`tmrw-${i}`} action={a} plannedTransfers={plannedTransfers} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Section 3 — Forecast detail */}
      {liquidityForecast.length > 0 && (
        <Collapsible open={showForecast} onOpenChange={setShowForecast}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-sm">
              <ChevronDown className={`h-4 w-4 transition-transform ${showForecast ? "" : "-rotate-90"}`} />
              Show demand forecast
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-2">
            {liquidityForecast.map((f) => (
              <Card key={f.currency}>
                <CardContent className="pt-4 pb-3 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge variant="secondary" className="text-sm font-semibold">{f.currency}</Badge>
                    <div className="flex gap-4 text-xs flex-wrap">
                      <div>
                        <span className="text-muted-foreground">Today P50: </span>
                        <span className="font-mono-numbers font-medium">{fmt(f.demandTodayP50, f.currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Today P75: </span>
                        <span className="font-mono-numbers font-medium">{fmt(f.demandTodayP75, f.currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tomorrow P50: </span>
                        <span className="font-mono-numbers font-medium">{fmt(f.demandTomorrowP50, f.currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tomorrow P75: </span>
                        <span className="font-mono-numbers font-medium">{fmt(f.demandTomorrowP75, f.currency)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default Liquidity;
