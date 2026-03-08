import { useSheetTab, useAppendSheet } from "@/hooks/useSheetData";
import type { RoutingDecision } from "@/types";

function str(v: unknown): string {
  return v != null && v !== "" ? String(v) : "";
}

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toUpperCase() === "TRUE" || v.toUpperCase() === "YES" || v === "1";
  return false;
}

export function useRoutingDecisions() {
  return useSheetTab<RoutingDecision>("routingDecisions", (raw) =>
    raw.map((r) => ({
      transactionId: str(r.transaction_id),
      assignedProvider: str(r.assigned_provider),
      assignedRail: str(r.assigned_rail),
      isPobo: parseBool(r.is_pobo),
      status: str(r.status),
      routedBy: str(r.routed_by),
      routedAt: str(r.routed_at),
    }))
  );
}

export function useAppendRoutingDecision() {
  return useAppendSheet();
}
