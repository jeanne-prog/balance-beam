import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProviderBadge } from "./ProviderBadge";
import { ArrowRight, Clock, MoveRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { FundMovement } from "@/lib/fundMovements";

interface Props {
  movements: FundMovement[];
  isLoading: boolean;
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

function formatCutoff(cutoffUtc: string | null): string | null {
  if (!cutoffUtc) return null;
  // Parse HH:MM or HH:MM:SS format
  const parts = cutoffUtc.split(":");
  if (parts.length < 2) return cutoffUtc;
  return `${parts[0]}:${parts[1]} UTC`;
}

export function FundMovementsPanel({ movements, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (movements.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <MoveRight className="h-4 w-4" />
        Recommended Fund Transfers
      </div>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="space-y-3">
            {movements.map((m, i) => {
              const cutoff = formatCutoff(m.fundingCutoffUtc);
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  {/* From */}
                  <div className="flex items-center gap-2 min-w-0">
                    <ProviderBadge provider={m.fromProvider} />
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                  {/* To */}
                  <div className="flex items-center gap-2 min-w-0">
                    <ProviderBadge provider={m.toProvider} />
                    <Badge variant="outline" className="text-xs">POBO</Badge>
                  </div>

                  {/* Amount */}
                  <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono-numbers text-sm font-semibold">
                      {formatCurrency(m.amount, m.currency)}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {m.txCount} tx{m.txCount > 1 ? "s" : ""}
                    </Badge>
                    {cutoff && (
                      <Badge
                        variant="outline"
                        className="text-xs border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))]"
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        Before {cutoff}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Moving funds to POBO providers enables faster, lower-cost payments. Cutoff times indicate when funds must arrive.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
