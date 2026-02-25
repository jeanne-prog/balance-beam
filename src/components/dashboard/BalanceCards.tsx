import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderBadge } from "./ProviderBadge";
import { Wallet } from "lucide-react";
import type { Balance } from "@/types";

interface Props {
  balances: Balance[];
  isLoading: boolean;
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

export function BalanceCards({ balances, isLoading }: Props) {
  const grouped = useMemo<ProviderGroup[]>(() => {
    const map = new Map<string, { currency: string; balance: number }[]>();
    for (const b of balances) {
      const key = b.provider.toUpperCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ currency: b.currency, balance: b.currentBalance });
    }
    return [...map.entries()]
      .map(([provider, currencies]) => ({
        provider,
        currencies: currencies.sort((a, b) => b.balance - a.balance),
        totalUsd: currencies.reduce((s, c) => s + c.balance, 0), // approximate
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider));
  }, [balances]);

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
              <div className="space-y-1">
                {currencies.map(({ currency, balance }) => (
                  <div key={currency} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">{currency}</span>
                    <span className={`font-mono-numbers text-xs font-medium ${balance <= 0 ? "text-[hsl(var(--status-danger))]" : ""}`}>
                      {formatCurrency(balance, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
