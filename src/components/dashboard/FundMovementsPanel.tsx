import { Card, CardContent } from "@/components/ui/card";
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

function formatTimeLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h} hr${h > 1 ? "s" : ""} ${m} min left`;
  return `${m} min left`;
}

function cutoffBadgeClasses(minutesLeft: number | null): string {
  if (minutesLeft === null) return "";
  if (minutesLeft < 60) {
    // Urgent – red/destructive
    return "border-[hsl(var(--status-danger)/0.4)] text-[hsl(var(--status-danger))] bg-[hsl(var(--status-danger-bg))]";
  }
  if (minutesLeft <= 180) {
    // Warning – amber
    return "border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))] bg-[hsl(var(--status-warning-bg))]";
  }
  // Informational – muted
  return "border-border text-muted-foreground";
}

export function FundMovementsPanel({ movements, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4">
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
            {movements.map((m, i) => (
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

                {/* Amount + meta */}
                <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                  <span className="font-mono-numbers text-sm font-semibold">
                    {formatCurrency(m.amount, m.currency)}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {m.txCount} tx{m.txCount > 1 ? "s" : ""}
                  </Badge>
                  {m.minutesUntilCutoff !== null && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${cutoffBadgeClasses(m.minutesUntilCutoff)}`}
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimeLeft(m.minutesUntilCutoff)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Moving funds to POBO providers enables faster, lower-cost payments. Cutoff times indicate when funds must arrive.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
