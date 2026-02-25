import { useState, useEffect } from "react";
import { useScoringWeights, useUpdateScoringWeight } from "@/hooks/useScoringWeights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function ScoringWeights() {
  const { data: weights, isLoading, error } = useScoringWeights();
  const updateWeight = useUpdateScoringWeight();
  const [localValues, setLocalValues] = useState<Record<string, number>>({});
  const [dirty, setDirty] = useState(false);

  // Sync DB values to local state
  useEffect(() => {
    if (weights) {
      const map: Record<string, number> = {};
      for (const w of weights) map[w.id] = w.value;
      setLocalValues(map);
      setDirty(false);
    }
  }, [weights]);

  const handleSliderChange = (id: string, val: number[]) => {
    setLocalValues((prev) => ({ ...prev, [id]: val[0] }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!weights) return;
    try {
      for (const w of weights) {
        const newVal = localValues[w.id];
        if (newVal !== undefined && newVal !== w.value) {
          await updateWeight.mutateAsync({ id: w.id, value: newVal });
        }
      }
      toast.success("Scoring weights updated");
      setDirty(false);
    } catch {
      toast.error("Failed to update weights");
    }
  };

  const handleReset = () => {
    if (weights) {
      const map: Record<string, number> = {};
      for (const w of weights) map[w.id] = w.value;
      setLocalValues(map);
      setDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load scoring weights.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scoring Weights</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adjust how much each factor influences provider ranking in the routing engine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!dirty}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || updateWeight.isPending}>
            {updateWeight.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {weights?.map((w) => {
          const val = localValues[w.id] ?? w.value;
          const isPenalty = w.key.includes("penalty");
          return (
            <Card key={w.id}>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{w.label}</span>
                      <Badge
                        variant="outline"
                        className={
                          isPenalty
                            ? "text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger)/0.3)]"
                            : "text-[hsl(var(--status-positive))] border-[hsl(var(--status-positive)/0.3)]"
                        }
                      >
                        {isPenalty ? "Penalty" : "Bonus"}
                      </Badge>
                    </div>
                    {w.description && (
                      <p className="text-xs text-muted-foreground">{w.description}</p>
                    )}
                  </div>
                  <span className="font-mono-numbers text-lg font-semibold tabular-nums min-w-[3ch] text-right">
                    {val}
                  </span>
                </div>
                <Slider
                  value={[val]}
                  min={w.min_value}
                  max={w.max_value}
                  step={1}
                  onValueChange={(v) => handleSliderChange(w.id, v)}
                  className="mt-1"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">{w.min_value}</span>
                  <span className="text-[10px] text-muted-foreground">{w.max_value}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
