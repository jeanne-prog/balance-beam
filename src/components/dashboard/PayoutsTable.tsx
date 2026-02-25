import { useState, useMemo, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronRight, ArrowUpRight, AlertTriangle } from "lucide-react";
import { ProviderBadge } from "./ProviderBadge";
import { RoutingSuggestionsPanel } from "./RoutingSuggestionsPanel";
import type { Transaction, RoutingSuggestion } from "@/types";
import { cn } from "@/lib/utils";

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

export function PayoutsTable({ transactions, suggestions, isLoading }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Manual overrides: transactionId → "PROVIDER|RAIL" */
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  const handleOverride = useCallback((txId: string, value: string) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      if (value === "__recommended") {
        next.delete(txId);
      } else {
        next.set(txId, value);
      }
      return next;
    });
  }, []);

  const sorted = useMemo(() => {
    return [...transactions].sort((a, b) => {
      if (a.hasBlockingIssue !== b.hasBlockingIssue) return a.hasBlockingIssue ? -1 : 1;
      const aTop = (suggestions.get(a.transactionId)?.[0]?.score ?? 0);
      const bTop = (suggestions.get(b.transactionId)?.[0]?.score ?? 0);
      if (aTop === 0 && bTop !== 0) return -1;
      if (bTop === 0 && aTop !== 0) return 1;
      return b.usdValue - a.usdValue;
    });
  }, [transactions, suggestions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!transactions.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No pending payout transactions found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-[110px]">Reference</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Beneficiary</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead className="w-[180px]">Selected</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((tx) => {
                const sugs = suggestions.get(tx.transactionId) ?? [];
                const top = sugs.find((s) => s.score > 0);
                const noRoute = sugs.length === 0 || sugs.every((s) => s.score === 0);
                const isOpen = expandedId === tx.transactionId;

                // Eligible providers for the dropdown (score > 0)
                const eligible = sugs.filter((s) => s.score > 0);
                // Deduplicate by provider (keep highest-scoring rail per provider)
                const uniqueProviders = new Map<string, RoutingSuggestion>();
                for (const s of eligible) {
                  const key = s.provider;
                  if (!uniqueProviders.has(key) || s.score > uniqueProviders.get(key)!.score) {
                    uniqueProviders.set(key, s);
                  }
                }
                const providerOptions = Array.from(uniqueProviders.values());

                const overrideKey = overrides.get(tx.transactionId);
                const selectedProvider = overrideKey
                  ? providerOptions.find((s) => `${s.provider}|${s.rail}` === overrideKey) ?? top
                  : top;
                const isOverridden = !!overrideKey;

                return (
                  <Collapsible key={tx.transactionId} open={isOpen} onOpenChange={(open) => setExpandedId(open ? tx.transactionId : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className={cn(
                          "cursor-pointer transition-colors",
                          isOpen && "bg-muted/50",
                          tx.hasBlockingIssue && "bg-[hsl(var(--status-danger-bg))]",
                          noRoute && !tx.hasBlockingIssue && "bg-[hsl(var(--status-warning-bg))]"
                        )}>
                          <TableCell className="px-2">
                            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                          </TableCell>
                          <TableCell className="font-mono-numbers text-xs">
                            {tx.reference ?? tx.transactionId.slice(0, 12)}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-sm">
                            <div>
                              <span>{tx.senderName}</span>
                              <Badge variant="outline" className="text-xs ml-1.5">{tx.senderCountry}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-sm">
                            <div className="flex items-center gap-1">
                              {tx.receiverName}
                              <ArrowUpRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-muted-foreground text-xs">{tx.receiverCountry}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono-numbers text-sm">
                            {formatCurrency(tx.receiverAmount, tx.receiverCurrency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{tx.receiverCountry}</Badge>
                          </TableCell>
                          <TableCell>
                            {top ? (
                              <div className="flex items-center gap-1.5">
                                <ProviderBadge provider={top.provider} />
                                <span className="text-xs text-muted-foreground font-mono-numbers">{top.rail}</span>
                              </div>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-[hsl(var(--status-warning))]">
                                <AlertTriangle className="h-3 w-3" /> No route
                              </span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {providerOptions.length > 0 ? (
                              <Select
                                value={overrideKey ?? "__recommended"}
                                onValueChange={(val) => handleOverride(tx.transactionId, val)}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "h-8 text-xs w-[160px]",
                                    isOverridden && "border-primary ring-1 ring-primary/30"
                                  )}
                                >
                                  <SelectValue>
                                    {selectedProvider ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold">{selectedProvider.provider}</span>
                                        <span className="text-muted-foreground">{selectedProvider.rail}</span>
                                        {isOverridden && <span className="text-primary text-[10px]">✎</span>}
                                      </div>
                                    ) : "Select"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="z-50 bg-popover">
                                  <SelectItem value="__recommended" className="text-xs">
                                    <div className="flex items-center gap-1.5">
                                      {top && <span className="font-semibold">{top.provider}</span>}
                                      <span className="text-muted-foreground">(recommended)</span>
                                    </div>
                                  </SelectItem>
                                  {providerOptions
                                    .filter((s) => !top || s.provider !== top.provider || s.rail !== top.rail)
                                    .map((s) => (
                                      <SelectItem key={`${s.provider}|${s.rail}`} value={`${s.provider}|${s.rail}`} className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold">{s.provider}</span>
                                          <span className="text-muted-foreground">{s.rail}</span>
                                          {s.isPobo && <Badge variant="outline" className="text-[10px] px-1 py-0">POBO</Badge>}
                                          {!s.balanceSufficient && <span className="text-[hsl(var(--status-warning))] text-[10px]">low bal</span>}
                                        </div>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {tx.hasBlockingIssue ? (
                              <Badge variant="destructive" className="text-xs">Blocked</Badge>
                            ) : noRoute ? (
                              <Badge variant="outline" className="text-xs border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))]">Needs review</Badge>
                            ) : (
                              <Badge className="text-xs status-positive border-0">Ready</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={9} className="p-0 border-b bg-muted/30">
                            <RoutingSuggestionsPanel suggestions={sugs} />
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
