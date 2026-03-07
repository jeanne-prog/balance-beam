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
  fundingGaps?: { provider: string; currency: string; gap: number }[];
}

const chipBase = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-all hover:brightness-95";

export function DashboardStats({ transactions, suggestions, isLoading, fundingGaps = [] }: Props) {
  if (isLoading) return <Skeleton className="h-8 w-full" />;

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
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Pending chip */}
        <span className={`${chipBase} bg-muted text-muted-foreground`}>
          Pending: <span className="font-semibold font-mono-numbers">{transactions.length}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="font-semibold font-mono-numbers">{formatCurrency(totalUsd, "USD")}</span>
        </span>

        {/* Ready chip */}
        <span className={`${chipBase} bg-[hsl(var(--status-positive-bg))] text-[hsl(var(--status-positive))] border border-[hsl(var(--status-positive)/0.25)]`}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ready <span className="font-semibold font-mono-numbers">{readyCount}</span>
        </span>

        {/* Insuf. balance chip */}
        <span className={`${chipBase} bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))] border border-[hsl(var(--status-warning)/0.25)] ${insufficientBalanceCount === 0 ? "opacity-50" : ""}`}>
          <AlertTriangle className="h-3.5 w-3.5" />
          Insuf. <span className="font-semibold font-mono-numbers">{insufficientBalanceCount}</span>
        </span>

        {/* Unroutable chip */}
        <span className={`${chipBase} bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] border border-[hsl(var(--status-danger)/0.25)] ${unroutableCount === 0 ? "opacity-50" : ""}`}>
          <XCircle className="h-3.5 w-3.5" />
          Unroutable <span className="font-semibold font-mono-numbers">{unroutableCount}</span>
        </span>

        {/* Blocked chip */}
        <span className={`${chipBase} bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] border border-[hsl(var(--status-danger)/0.35)] ${blockedCount === 0 ? "opacity-50" : ""}`}>
          <Ban className="h-3.5 w-3.5" />
          Blocked <span className="font-semibold font-mono-numbers">{blockedCount}</span>
        </span>
      </div>

      {/* Funding gap chip */}
      {fundingGaps.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${chipBase} bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] border border-[hsl(var(--status-danger)/0.25)]`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Funding gap:
            {fundingGaps.map((g, i) => (
              <span key={`${g.provider}-${g.currency}`} className="font-semibold font-mono-numbers">
                {i > 0 && ","} {g.provider} {g.currency} {formatCurrency(g.gap, g.currency)}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
