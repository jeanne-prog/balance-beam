import { usePipelineTransactions } from "@/hooks/useSheetData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Clock, ArrowUpRight } from "lucide-react";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

const Pipeline = () => {
  const { data: transactions, isLoading, error } = usePipelineTransactions();

  const stats = transactions
    ? {
        total: transactions.length,
        totalUsd: transactions.reduce((s, t) => s + t.usdValue, 0),
        byCurrency: transactions.reduce(
          (acc, t) => {
            const key = t.receiverCurrency;
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-semibold font-mono-numbers">
                {stats?.total ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total USD Equivalent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-semibold font-mono-numbers">
                {formatCurrency(stats?.totalUsd ?? 0, "USD")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(stats?.byCurrency ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([cur, count]) => (
                    <Badge key={cur} variant="secondary" className="text-xs font-mono-numbers">
                      {cur} ({count})
                    </Badge>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !transactions?.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No pending collection transactions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Reference</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">USD Equiv</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const age = daysSince(tx.createdAtDate);
                    const isOld = age !== null && age > 5;
                    return (
                      <TableRow key={tx.transactionId}>
                        <TableCell className="font-mono-numbers text-xs">
                          {tx.reference ?? tx.transactionId.slice(0, 12)}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {tx.senderName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tx.senderCountry}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          <div className="flex items-center gap-1">
                            {tx.receiverName}
                            <ArrowUpRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground text-xs">
                              {tx.receiverCountry}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono-numbers text-sm">
                          {formatCurrency(tx.receiverAmount, tx.receiverCurrency)}
                        </TableCell>
                        <TableCell className="text-right font-mono-numbers text-sm text-muted-foreground">
                          {formatCurrency(tx.usdValue, "USD")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(tx.createdAtDate)}
                        </TableCell>
                        <TableCell>
                          <div
                            className={`flex items-center gap-1 text-xs ${
                              isOld
                                ? "text-[hsl(var(--status-warning))]"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {age !== null ? `${age}d` : "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tx.hasBlockingIssue ? (
                            <Badge
                              variant="destructive"
                              className="text-xs"
                            >
                              Blocked
                            </Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Pipeline;
