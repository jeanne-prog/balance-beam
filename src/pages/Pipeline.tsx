import { useState, useMemo } from "react";
import { usePipelineTransactions } from "@/hooks/useSheetData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { PipelineFiltersBar, type PipelineFilters } from "@/components/pipeline/PipelineFilters";
import { PipelineTable } from "@/components/pipeline/PipelineTable";

const EMPTY = "__all__";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

const Pipeline = () => {
  const { data: transactions, isLoading, error } = usePipelineTransactions();
  const [filters, setFilters] = useState<PipelineFilters>({
    search: "", country: EMPTY, currency: EMPTY, blocking: EMPTY,
  });

  const countries = useMemo(() => {
    if (!transactions) return [];
    const set = new Set<string>();
    transactions.forEach((t) => { set.add(t.senderCountry); set.add(t.receiverCountry); });
    return [...set].filter(Boolean).sort();
  }, [transactions]);

  const currencies = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map((t) => t.receiverCurrency))].filter(Boolean).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    const q = filters.search.toLowerCase();
    return transactions.filter((t) => {
      if (q && ![t.senderName, t.receiverName, t.reference ?? "", t.transactionId].some((s) => s.toLowerCase().includes(q))) return false;
      if (filters.country !== EMPTY && t.senderCountry !== filters.country && t.receiverCountry !== filters.country) return false;
      if (filters.currency !== EMPTY && t.receiverCurrency !== filters.currency) return false;
      if (filters.blocking === "blocked" && !t.hasBlockingIssue) return false;
      if (filters.blocking === "clear" && t.hasBlockingIssue) return false;
      return true;
    });
  }, [transactions, filters]);

  const stats = filtered.length
    ? {
        total: filtered.length,
        totalUsd: filtered.reduce((s, t) => s + t.usdValue, 0),
        byCurrency: filtered.reduce((acc, t) => {
          acc[t.receiverCurrency] = (acc[t.receiverCurrency] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      }
    : null;

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Failed to load pipeline: {error.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transactions pending collection — awaiting funds before routing.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <p className="text-2xl font-semibold font-mono-numbers">{stats?.total ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total USD Equivalent</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <p className="text-2xl font-semibold font-mono-numbers">{formatCurrency(stats?.totalUsd ?? 0, "USD")}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currencies</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-40" /> : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats?.byCurrency ?? {}).sort(([, a], [, b]) => b - a).map(([cur, count]) => (
                  <Badge key={cur} variant="secondary" className="text-xs font-mono-numbers">{cur} ({count})</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <PipelineFiltersBar filters={filters} onChange={setFilters} countries={countries} currencies={currencies} />

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !filtered.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {transactions?.length ? "No transactions match the current filters." : "No pending collection transactions found."}
            </div>
          ) : (
            <PipelineTable transactions={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pipeline;
