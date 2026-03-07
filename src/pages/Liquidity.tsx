import { useRoutingEngine } from "@/hooks/useRoutingEngine";
import { LiquidityForecastPanel } from "@/components/dashboard/LiquidityForecastPanel";
import { BalanceCards } from "@/components/dashboard/BalanceCards";
import { useMemo } from "react";

const Liquidity = () => {
  const { liquidityForecast, balances, effectiveBalances, incomingTransfers, routingProviders, plannedTransfers, addPlannedTransfer, removePlannedTransfer, isLoading } = useRoutingEngine();

  const emptyAllocated = useMemo(() => new Map<string, number>(), []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Liquidity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Forecast demand and recommended fund transfers across providers.
        </p>
      </div>
      <BalanceCards balances={balances} routingProviders={routingProviders} allocated={emptyAllocated} isLoading={isLoading} incomingTransfers={incomingTransfers} />
      <LiquidityForecastPanel
        forecast={liquidityForecast}
        isLoading={isLoading}
        plannedTransfers={plannedTransfers}
        onAddPlannedTransfer={addPlannedTransfer}
        onRemovePlannedTransfer={removePlannedTransfer}
        effectiveBalances={effectiveBalances}
      />
    </div>
  );
};

export default Liquidity;
