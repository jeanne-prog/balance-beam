import { CheckCircle2, AlertTriangle, XCircle, Ban } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction, RoutingSuggestion } from "@/types";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

interface Props {
  transactions: Transaction[];
  suggestions: Map<string, RoutingSuggestion[]>;
  isLoading: boolean;
}

export function DashboardStats({ transactions, suggestions, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-6 w-full" />;

  const totalUsd = transactions.reduce((s, t) => s + t.usdValue, 0);
  const blockedCount = transactions.filter((t) => t.hasBlockingIssue).length;

  let readyCount = 0;
  let insufficientBalanceCount = 0;
  let unroutableCount = 0;

  for (const tx of transactions) {
    if (tx.hasBlockingIssue) continue;
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

  return (
    <div className="flex items-center gap-4 text-sm flex-wrap py-1">
      <span className="font-medium">
        Pending: <span className="font-mono-numbers">{transactions.length}</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="font-mono-numbers">{formatCurrency(totalUsd, "USD")}</span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1 text-[hsl(var(--status-positive))]">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Ready: <span className="font-mono-numbers font-medium">{readyCount}</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1 text-[hsl(var(--status-warning))]">
        <AlertTriangle className="h-3.5 w-3.5" />
        Insuf. balance: <span className="font-mono-numbers font-medium">{insufficientBalanceCount}</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1 text-[hsl(var(--status-danger))]">
        <XCircle className="h-3.5 w-3.5" />
        Unroutable: <span className="font-mono-numbers font-medium">{unroutableCount}</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span className="inline-flex items-center gap-1 text-[hsl(var(--status-danger))]">
        <Ban className="h-3.5 w-3.5" />
        Blocked: <span className="font-mono-numbers font-medium">{blockedCount}</span>
      </span>
    </div>
  );
}
