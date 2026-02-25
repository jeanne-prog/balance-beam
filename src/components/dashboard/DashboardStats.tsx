import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { Transaction, RoutingSuggestion } from "@/types";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

interface Props {
  transactions: Transaction[];
  suggestions: Map<string, RoutingSuggestion[]>;
  isLoading: boolean;
}

export function DashboardStats({ transactions, suggestions, isLoading }: Props) {
  const totalUsd = transactions.reduce((s, t) => s + t.usdValue, 0);
  const blockedCount = transactions.filter((t) => t.hasBlockingIssue).length;

  // Count transactions with no eligible provider (all suggestions score 0 or empty)
  const noRouteCount = transactions.filter((t) => {
    const sugs = suggestions.get(t.transactionId) ?? [];
    return sugs.length === 0 || sugs.every((s) => s.score === 0);
  }).length;

  const routableCount = transactions.length - noRouteCount;

  const cells: { label: string; value: React.ReactNode; variant?: string }[] = [
    { label: "Pending Payouts", value: transactions.length },
    { label: "Total USD Value", value: formatCurrency(totalUsd, "USD") },
    { label: "Routable", value: routableCount },
    { label: "No Route / Blocked", value: `${noRouteCount} / ${blockedCount}` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cells.map(({ label, value }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold font-mono-numbers">{value}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
