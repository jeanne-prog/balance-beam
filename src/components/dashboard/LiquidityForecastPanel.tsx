import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProviderBadge } from "./ProviderBadge";
import { ArrowRight, Clock, ChevronDown, ChevronRight, Plus, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LiquidityForecast, FundingAction, PlannedTransfer } from "@/lib/fundMovements";
import type { Balance } from "@/types";

const PROVIDERS = ["NEO", "CORPAY", "EMQ", "GIB", "TAZAPAY"];

interface Props {
  forecast: LiquidityForecast[];
  isLoading: boolean;
  plannedTransfers?: PlannedTransfer[];
  onAddPlannedTransfer?: (t: Omit<PlannedTransfer, "id" | "createdAt" | "source">) => void;
  onRemovePlannedTransfer?: (id: string) => void;
  effectiveBalances?: Balance[];
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

function horizonLabel(action: FundingAction): { label: string; subtitle?: string } {
  if (action.horizon === "tomorrow") {
    return { label: "Pre-fund", subtitle: "Transfer today · lands tomorrow" };
  }
  return { label: "Today" };
}

function ActionCard({ action }: { action: FundingAction }) {
  const [open, setOpen] = useState(false);
  const bd = action.demandBreakdown;
  const hl = horizonLabel(action);

  return (
    <div className={`rounded-lg border-2 bg-card p-3 ${borderClass(action)}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ProviderBadge provider={action.fromProvider} />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <ProviderBadge provider={action.toProvider} />
        </div>

        <div className="flex flex-col">
          <Badge variant="outline" className="text-xs capitalize">
            {hl.label}
          </Badge>
          {hl.subtitle && (
            <span className="text-[10px] text-muted-foreground mt-0.5">{hl.subtitle}</span>
          )}
        </div>

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

      {action.neoInsufficient && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-[hsl(var(--status-warning))]">
          <AlertTriangle className="h-3 w-3" />
          Neo balance insufficient — partial transfer only
        </div>
      )}

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

function CoverageLine({ forecast, effectiveBalances }: { forecast: LiquidityForecast; effectiveBalances?: Balance[] }) {
  // Compute total effective balance for this currency
  let totalBalance = forecast.totalCurrentBalance;
  if (effectiveBalances) {
    totalBalance = 0;
    for (const b of effectiveBalances) {
      if (b.currency.toUpperCase() === forecast.currency) {
        totalBalance += b.currentBalance;
      }
    }
  }
  const gap = totalBalance - forecast.demandTodayP50;
  const isCovered = gap >= 0;

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <div>
        <span className="text-muted-foreground">Balance: </span>
        <span className="font-mono-numbers font-medium">{fmt(totalBalance, forecast.currency)}</span>
      </div>
      <span className="text-muted-foreground">·</span>
      <div>
        <span className="text-muted-foreground">Today demand P50: </span>
        <span className="font-mono-numbers font-medium">{fmt(forecast.demandTodayP50, forecast.currency)}</span>
      </div>
      <span className="text-muted-foreground">·</span>
      {isCovered ? (
        <span className="inline-flex items-center gap-1 text-[hsl(var(--status-positive))] font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Covered ✓
        </span>
      ) : (
        <span className="text-[hsl(var(--status-danger))] font-medium font-mono-numbers">
          Gap: {fmt(gap, forecast.currency)}
        </span>
      )}
    </div>
  );
}

function PlannedTransferForm({ onAdd }: { onAdd: (t: Omit<PlannedTransfer, "id" | "createdAt" | "source">) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [currency, setCurrency] = useState("");
  const [amount, setAmount] = useState("");

  const handleSubmit = () => {
    if (!from || !to || !currency || !amount || from === to) return;
    onAdd({
      fromProvider: from,
      toProvider: to,
      currency: currency.toUpperCase(),
      amount: Number(amount),
    });
    setCurrency("");
    setAmount("");
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        Plan a transfer
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Plus className="h-4 w-4" />
        Plan a transfer
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              {PROVIDERS.filter(p => p !== from).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
          <Input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="EUR" className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10000" className="h-8 text-xs" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={!from || !to || !currency || !amount || from === to}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function LiquidityForecastPanel({ forecast, isLoading, plannedTransfers, onAddPlannedTransfer, onRemovePlannedTransfer, effectiveBalances }: Props) {
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

  return (
    <div className="space-y-4">
      {/* Planned transfers section */}
      {onAddPlannedTransfer && (
        <div className="space-y-3">
          <PlannedTransferForm onAdd={onAddPlannedTransfer} />
          {plannedTransfers && plannedTransfers.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Planned transfers</span>
              {plannedTransfers.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                  <ProviderBadge provider={t.fromProvider} />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <ProviderBadge provider={t.toProvider} />
                  <span className="font-mono-numbers font-medium">{fmt(t.amount, t.currency)}</span>
                  {onRemovePlannedTransfer && (
                    <button onClick={() => onRemovePlannedTransfer(t.id)} className="ml-auto text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 && <p className="text-sm text-muted-foreground">No active liquidity demands.</p>}

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

            {/* Coverage line */}
            <CoverageLine forecast={f} effectiveBalances={effectiveBalances} />

            {/* Action cards */}
            {f.actions.length > 0 && (
              <div className="space-y-2">
                {f.actions.map((a, i) => (
                  <ActionCard key={`${a.toProvider}-${a.horizon}-${i}`} action={a} />
                ))}
              </div>
            )}

            {f.actions.length === 0 && (() => {
              let totalBalance = f.totalCurrentBalance;
              if (effectiveBalances) {
                totalBalance = 0;
                for (const b of effectiveBalances) {
                  if (b.currency.toUpperCase() === f.currency) {
                    totalBalance += b.currentBalance;
                  }
                }
              }
              const gap = totalBalance - f.demandTodayP50;
              if (gap < 0) {
                return (
                  <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--status-warning))]">
                    <AlertTriangle className="h-3 w-3" />
                    Gap of {fmt(Math.abs(gap), f.currency)} — no transfer available (insufficient Neo balance for this currency)
                  </div>
                );
              }
              return null;
            })()}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
