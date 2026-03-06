import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, XCircle, Ban } from "lucide-react";
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

  const noRouteCount = transactions.filter((t) => {
    const sugs = suggestions.get(t.transactionId) ?? [];
    return sugs.length === 0 || sugs.every((s) => s.score === 0);
  }).length;

  const routableCount = transactions.length - noRouteCount;

  // Routing status breakdown
  let readyCount = 0;
  let insufficientBalanceCount = 0;
  let unroutableCount = 0;

  for (const tx of transactions) {
    if (tx.hasBlockingIssue) continue; // counted separately as "Blocked"
    const sugs = suggestions.get(tx.transactionId) ?? [];
    const hasScoring = sugs.some((s) => s.score > 0);
    if (!hasScoring || sugs.length === 0) {
      unroutableCount++;
    } else if (sugs.some((s) => s.score > 0 && s.balanceSufficient)) {
      readyCount++;
    } else {
      insufficientBalanceCount++;
    }
  }

  const cells: { label: string; value: React.ReactNode }[] = [
    { label: "Pending Payouts", value: transactions.length },
    { label: "Total USD Value", value: formatCurrency(totalUsd, "USD") },
    { label: "Routable", value: routableCount },
    { label: "No Route / Blocked", value: `${noRouteCount} / ${blockedCount}` },
  ];

  const statusCells: {
    label: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    bgClass: string;
  }[] = [
    {
      label: "Ready",
      value: readyCount,
      icon: <CheckCircle2 className="h-4 w-4" />,
      colorClass: "text-[hsl(var(--status-positive))]",
      bgClass: "bg-[hsl(var(--status-positive-bg))]",
    },
    {
      label: "Insufficient Balance",
      value: insufficientBalanceCount,
      icon: <AlertTriangle className="h-4 w-4" />,
      colorClass: "text-[hsl(var(--status-warning))]",
      bgClass: "bg-[hsl(var(--status-warning-bg))]",
    },
    {
      label: "Unroutable",
      value: unroutableCount,
      icon: <XCircle className="h-4 w-4" />,
      colorClass: "text-[hsl(var(--status-danger))]",
      bgClass: "bg-[hsl(var(--status-danger-bg))]",
    },
    {
      label: "Blocked",
      value: blockedCount,
      icon: <Ban className="h-4 w-4" />,
      colorClass: "text-[hsl(var(--status-danger))]",
      bgClass: "bg-[hsl(var(--status-danger-bg))]",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary row */}
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

      {/* Routing status row */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Routing Status</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statusCells.map(({ label, value, icon, colorClass, bgClass }) => (
            <Card key={label} className={bgClass}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium flex items-center gap-1.5 ${colorClass}`}>
                  {icon}
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className={`text-2xl font-semibold font-mono-numbers ${colorClass}`}>{value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
