import { useRoutingEngine } from "@/hooks/useRoutingEngine";
import { LiquidityForecastPanel } from "@/components/dashboard/LiquidityForecastPanel";

const Liquidity = () => {
  const { liquidityForecast, isLoading } = useRoutingEngine();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Liquidity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Forecast demand and recommended fund transfers across providers.
        </p>
      </div>
      <LiquidityForecastPanel forecast={liquidityForecast} isLoading={isLoading} />
    </div>
  );
};

export default Liquidity;
