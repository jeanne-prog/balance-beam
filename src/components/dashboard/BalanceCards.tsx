import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderBadge } from "./ProviderBadge";
import { Wallet } from "lucide-react";
import type { Balance } from "@/types";
import type { IncomingTransferSummary } from "@/lib/fundMovements";

interface Props {
  balances: Balance[];
  routingProviders: Set<string>;
  allocated: Map<string, number>;
  isLoading: boolean;
  incomingTransfers?: IncomingTransferSummary;
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

interface ProviderGroup {
  provider: string;
  currencies: { currency: string; balance: number }[];
  totalUsd: number;
}

export function BalanceCards({ balances, routingProviders, allocated, isLoading, incomingTransfers }: Props) {
  const grouped = useMemo<ProviderGroup[]>(() => {
    const map = new Map<string, { currency: string; balance: number }[]>();
    for (const b of balances) {
      const key = b.provider.toUpperCase();
      if (!routingProviders.has(key)) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ currency: b.currency, balance: b.currentBalance });
    }
    return [...map.entries()]
      .map(([provider, currencies]) => ({
        provider,
        currencies: currencies.sort((a, b) => b.balance - a.balance),
        totalUsd: currencies.reduce((s, c) => s + c.balance, 0),
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider));
  }, [balances, routingProviders]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (!grouped.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Wallet className="h-4 w-4" />
        Provider Balances
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {grouped.map(({ provider, currencies }) => (
          <Card key={provider} className="overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-4">
              <ProviderBadge provider={provider} />
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="space-y-1.5">
                {currencies.map(({ currency, balance }) => {
                  const allocKey = `${provider}|${currency.toUpperCase()}`;
                  const allocAmt = allocated.get(allocKey) ?? 0;
                  const remaining = balance - allocAmt;
                  const isShort = allocAmt > 0 && remaining < 0;
                  const inflightAmt = incomingTransfers?.inflight.get(allocKey) ?? 0;
                  const plannedAmt = incomingTransfers?.planned.get(allocKey) ?? 0;
                  return (
                    <div key={currency} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs">{currency}</span>
                        <span className={`font-mono-numbers text-xs font-medium ${balance <= 0 ? "text-[hsl(var(--status-danger))]" : ""}`}>
                          {formatCurrency(balance, currency)}
                        </span>
                      </div>
                      {allocAmt > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Allocated</span>
                          <span className="font-mono-numbers text-muted-foreground">
                            {formatCurrency(allocAmt, currency)}
                          </span>
                        </div>
                      )}
                      {allocAmt > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className={isShort ? "text-[hsl(var(--status-danger))] font-medium" : "text-muted-foreground"}>
                            Remaining
                          </span>
                          <span className={`font-mono-numbers font-medium ${isShort ? "text-[hsl(var(--status-danger))]" : "text-[hsl(var(--status-positive))]"}`}>
                            {formatCurrency(remaining, currency)}
                          </span>
                        </div>
                      )}
                      {inflightAmt > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[hsl(var(--status-positive))]">+ incoming (in transit)</span>
                          <span className="font-mono-numbers text-[hsl(var(--status-positive))]">
                            {formatCurrency(inflightAmt, currency)}
                          </span>
                        </div>
                      )}
                      {plannedAmt > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-blue-500">+ incoming (planned)</span>
                          <span className="font-mono-numbers text-blue-500">
                            {formatCurrency(plannedAmt, currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
