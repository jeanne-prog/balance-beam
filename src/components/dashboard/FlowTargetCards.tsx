import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { ProviderBadge } from "./ProviderBadge";

interface FlowTargetInfo {
  provider: string;
  currentPct: number;
  targetPct: number;
}

interface Props {
  targets: FlowTargetInfo[];
  isLoading: boolean;
}

export function FlowTargetCards({ targets, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Target className="h-4 w-4" /> Flow Targets
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {targets.map((t) => {
          const isUnder = t.currentPct < t.targetPct;
          const progressPct = Math.min((t.currentPct / t.targetPct) * 100, 100);
          return (
            <Card key={t.provider} className={isUnder ? "border-[hsl(var(--status-warning)/0.4)]" : ""}>
              <CardContent className="pt-4 pb-3 px-4 space-y-2">
                <div className="flex items-center justify-between">
                  <ProviderBadge provider={t.provider} />
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-numbers text-sm font-semibold">
                      {t.currentPct.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground text-xs">/ {t.targetPct}%</span>
                  </div>
                </div>
                <Progress value={progressPct} className="h-2" />
                {isUnder && (
                  <Badge variant="outline" className="text-xs border-[hsl(var(--status-warning)/0.4)] text-[hsl(var(--status-warning))]">
                    Below target — transactions being force-assigned
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
