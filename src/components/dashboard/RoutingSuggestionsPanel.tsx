import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProviderBadge } from "./ProviderBadge";
import { Check, X, AlertTriangle, Zap, Wallet, Target } from "lucide-react";
import type { RoutingSuggestion } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  suggestions: RoutingSuggestion[];
}

export function RoutingSuggestionsPanel({ suggestions }: Props) {
  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-warning))]" />
        No eligible providers found for this transaction.
      </div>
    );
  }

  const maxScore = Math.max(...suggestions.map((s) => s.score), 1);

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Ranked Providers
      </p>
      {suggestions.map((s, i) => {
        const isDisqualified = s.score === 0;
        const isTop = i === 0 && !isDisqualified;
        return (
          <div
            key={`${s.provider}-${s.rail}`}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition-colors",
              isTop && "border-[hsl(var(--status-positive)/0.4)] bg-[hsl(var(--status-positive-bg))]",
              isDisqualified && "opacity-60 border-[hsl(var(--status-danger)/0.3)] bg-[hsl(var(--status-danger-bg))]",
              !isTop && !isDisqualified && "border-border bg-card"
            )}
          >
            {/* Rank */}
            <div className={cn(
              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
              isTop ? "bg-[hsl(var(--status-positive))] text-white" : "bg-muted text-muted-foreground"
            )}>
              {isDisqualified ? <X className="h-3 w-3" /> : i + 1}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <ProviderBadge provider={s.provider} />
                <Badge variant="secondary" className="text-xs font-mono-numbers">{s.rail}</Badge>
                {s.isPobo && <Badge variant="outline" className="text-xs">POBO</Badge>}
                {s.isFlowTargetAssignment && (
                  <Badge variant="outline" className="text-xs border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))]">
                    <Target className="h-3 w-3 mr-0.5" /> Flow target
                  </Badge>
                )}
                {isTop && (
                  <Badge className="text-xs status-positive border-0">
                    <Zap className="h-3 w-3 mr-0.5" /> Recommended
                  </Badge>
                )}
              </div>

              {/* Score bar */}
              {!isDisqualified && (
                <div className="flex items-center gap-2">
                  <Progress value={(s.score / maxScore) * 100} className="h-1.5 flex-1" />
                  <span className="text-xs font-mono-numbers text-muted-foreground w-8 text-right">{s.score}</span>
                </div>
              )}

              {/* Indicators */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className={cn("flex items-center gap-1", s.balanceSufficient ? "text-[hsl(var(--status-positive))]" : "text-[hsl(var(--status-warning))]")}>
                  <Wallet className="h-3 w-3" />
                  {s.balanceSufficient ? "Funded" : "Low balance"}
                </span>
                {s.availableTomorrow && (
                  <span className="flex items-center gap-1 text-[hsl(var(--status-positive))]">
                    <Check className="h-3 w-3" /> Fast payout
                  </span>
                )}
              </div>

              {/* Flags */}
              {s.flaggedReasons.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.flaggedReasons.map((reason, j) => (
                    <Badge
                      key={j}
                      variant="outline"
                      className={cn(
                        "text-xs",
                        isDisqualified
                          ? "border-[hsl(var(--status-danger)/0.4)] text-[hsl(var(--status-danger))]"
                          : "border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))]"
                      )}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {reason}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
