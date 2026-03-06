import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProviderBadge } from "./ProviderBadge";
import { ArrowRight, Clock, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LiquidityForecast, FundingAction } from "@/lib/fundMovements";

interface Props {
  forecast: LiquidityForecast[];
  isLoading: boolean;
}

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
  if (h > 0) return `${h} hr${h > 1 ? "s" : ""} ${m} min left`;
  return `${m} min left`;
}

function cutoffClasses(mins: number | null): string {
  if (mins === null) return "";
  if (mins < 60) return "border-[hsl(var(--status-danger)/0.4)] text-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger-bg))]";
  if (mins <= 180) return "border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning-bg))]";
  return "border-border text-muted-foreground";
}

function urgencyClasses(urgency: FundingAction["urgency"]): string {
  switch (urgency) {
    case "critical": return "bg-[hsl(var(--status-danger))] text-white";
    case "high": return "bg-[hsl(var(--status-warning))] text-white";
    case "medium": return "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))]";
    case "low": return "bg-muted text-muted-foreground";
  }
}

function borderClass(action: FundingAction): string {
  if (!action.p50Covered) return "border-[hsl(var(--status-danger)/0.5)]";
  if (!action.p75Covered) return "border-[hsl(var(--status-warning)/0.5)]";
  return "border-border";
}

function ActionCard({ action }: { action: FundingAction }) {
  const [open, setOpen] = useState(false);
  const bd = action.demandBreakdown;

  return (
    <div className={`rounded-lg border-2 bg-card p-3 ${borderClass(action)}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ProviderBadge provider={action.fromProvider} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <ProviderBadge provider={action.toProvider} />
        </div>

        <Badge variant="outline" className="text-xs capitalize">
          {action.horizon}
        </Badge>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className="font-mono-numbers text-sm font-semibold">
            {fmt(action.amountP50, action.currency)}
          </span>
          <span className="font-mono-numbers text-xs text-muted-foreground">
            P75: {fmt(action.amountP75, action.currency)}
          </span>

          {action.minutesUntilCutoff !== null && (
            <Badge variant="outline" className={`text-xs ${cutoffClasses(action.minutesUntilCutoff)}`}>
              <Clock className="h-3 w-3 mr-1" />
              {formatTimeLeft(action.minutesUntilCutoff)}
            </Badge>
          )}

          <Badge className={`text-xs ${urgencyClasses(action.urgency)}`}>
            {action.urgency}
          </Badge>
        </div>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground transition-colors">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Breakdown
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
            <div><span className="text-muted-foreground">Confirmed:</span> <span className="font-mono-numbers">{fmt(bd.confirmedPendingPayout, action.currency)}</span></div>
            <div><span className="text-muted-foreground">Pipeline:</span> <span className="font-mono-numbers">{fmt(bd.fromPendingCollection, action.currency)}</span></div>
            <div><span className="text-muted-foreground">Draft:</span> <span className="font-mono-numbers">{fmt(bd.fromDraftPending, action.currency)}</span></div>
            <div><span className="text-muted-foreground">New vol:</span> <span className="font-mono-numbers">{fmt(bd.fromNewVolume, action.currency)}</span></div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function LiquidityForecastPanel({ forecast, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const visible = forecast.filter(
    f => f.demandTodayP50 > 0 || f.demandTomorrowP50 > 0 || f.actions.length > 0
  );

  if (visible.length === 0) return null;

  return (
    <div className="space-y-4">
      {visible.map((f) => (
        <Card key={f.currency}>
          <CardContent className="pt-4 pb-3 space-y-3">
            {/* Demand summary */}
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

            {/* Action cards */}
            {f.actions.length > 0 && (
              <div className="space-y-2">
                {f.actions.map((a, i) => (
                  <ActionCard key={`${a.toProvider}-${a.horizon}-${i}`} action={a} />
                ))}
              </div>
            )}

            {f.actions.length === 0 && (
              <p className="text-xs text-muted-foreground">All providers adequately funded for {f.currency}.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
