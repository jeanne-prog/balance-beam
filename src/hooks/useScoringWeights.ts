import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScoringWeight {
  id: string;
  key: string;
  label: string;
  description: string | null;
  value: number;
  min_value: number;
  max_value: number;
  sort_order: number;
  updated_at: string;
}

export function useScoringWeights() {
  return useQuery({
    queryKey: ["scoring-weights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scoring_weights" as any)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data as unknown as ScoringWeight[]) ?? [];
    },
    staleTime: 60_000,
  });
}

/** Returns a key→value map for use in the routing engine */
export function useScoringWeightsMap() {
  const query = useScoringWeights();
  const map = new Map<string, number>();
  if (query.data) {
    for (const w of query.data) {
      map.set(w.key, w.value);
    }
  }
  return { ...query, weightsMap: map };
}

export function useUpdateScoringWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase
        .from("scoring_weights" as any)
        .update({ value, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scoring-weights"] });
    },
  });
}
