import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { readTab, writeTab, appendTab, type TabKey } from "@/lib/sheets";
import type {
  Transaction,
  Balance,
  RoutingRule,
  FlowTarget,
  CurrencyRail,
  BeneBanned,
  SenderBanned,
  SwiftCodeBanned,
  LightKycSender,
} from "@/types";

/* ── Generic hook for any tab ────────────────────────────── */

export function useSheetTab<T = Record<string, unknown>>(
  tab: TabKey,
  transform?: (raw: Record<string, unknown>[]) => T[],
  enabled = true
) {
  return useQuery({
    queryKey: ["sheet", tab],
    queryFn: async () => {
      const raw = await readTab(tab);
      return transform ? transform(raw) : (raw as unknown as T[]);
    },
    staleTime: 30_000, // 30s before refetch
    enabled,
  });
}

/* ── Typed hooks per domain ──────────────────────────────── */

function parseNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1" || v.toLowerCase() === "yes";
  return false;
}

export function useTransactions(statusFilter?: string) {
  return useSheetTab<Transaction>("transactions", (raw) => {
    const all = raw.map((r) => ({
      id: String(r.id ?? ""),
      clientName: String(r.client_name ?? r.clientName ?? ""),
      senderName: String(r.sender_name ?? r.senderName ?? ""),
      sourceCountry: String(r.source_country ?? r.sourceCountry ?? ""),
      beneficiaryName: String(r.beneficiary_name ?? r.beneficiaryName ?? ""),
      beneficiaryCountry: String(r.beneficiary_country ?? r.beneficiaryCountry ?? ""),
      destinationCurrency: String(r.destination_currency ?? r.destinationCurrency ?? ""),
      amountReceive: parseNumber(r.amount_receive ?? r.amountReceive),
      amountUSDEquiv: parseNumber(r.amount_usd_equiv ?? r.amountUSDEquiv),
      collectionDate: String(r.collection_date ?? r.collectionDate ?? ""),
      dueDate: String(r.due_date ?? r.dueDate ?? ""),
      status: String(r.status ?? "pending_collection") as Transaction["status"],
      assignedProvider: r.assigned_provider ? String(r.assigned_provider) : null,
      assignedRail: r.assigned_rail ? String(r.assigned_rail) : null,
      isPobo: r.is_pobo != null ? parseBool(r.is_pobo) : null,
      routedBy: r.routed_by ? String(r.routed_by) : null,
      routedAt: r.routed_at ? String(r.routed_at) : null,
      notes: r.notes ? String(r.notes) : null,
      swiftCode: r.swift_code ? String(r.swift_code) : null,
    }));
    if (statusFilter) return all.filter((t) => t.status === statusFilter);
    return all;
  });
}

export function usePendingPayouts() {
  return useTransactions("pending_payout");
}

export function usePipelineTransactions() {
  return useTransactions("pending_collection");
}

export function useBalances() {
  return useSheetTab<Balance>("accounts", (raw) =>
    raw.map((r) => ({
      provider: String(r.provider ?? ""),
      currency: String(r.currency ?? ""),
      currentBalance: parseNumber(r.current_balance ?? r.currentBalance),
      plannedInflows: parseNumber(r.planned_inflows ?? r.plannedInflows),
      lastUpdated: String(r.last_updated ?? r.lastUpdated ?? ""),
    }))
  );
}

export function useRoutingRules() {
  return useSheetTab<RoutingRule>("routingRules", (raw) =>
    raw.map((r) => ({
      sourceCountry: String(r.source_country ?? r.sourceCountry ?? ""),
      amountBandMin: parseNumber(r.amount_band_min ?? r.amountBandMin),
      amountBandMax: r.amount_band_max ? parseNumber(r.amount_band_max) : null,
      daysAfterCollection: parseNumber(r.days_after_collection ?? r.daysAfterCollection),
    }))
  );
}

export function useCurrenciesMatrix() {
  return useSheetTab<CurrencyRail>("currenciesMatrix", (raw) =>
    raw.map((r) => ({
      provider: String(r.provider ?? ""),
      currency: String(r.currency ?? ""),
      rail: String(r.rail ?? ""),
      isPobo: parseBool(r.is_pobo ?? r.isPobo),
      speedRank: parseNumber(r.speed_rank ?? r.speedRank),
      fundingCutoff: String(r.funding_cutoff ?? r.fundingCutoff ?? ""),
      payoutCutoff: String(r.payout_cutoff ?? r.payoutCutoff ?? ""),
      cutoffTimezone: String(r.cutoff_timezone ?? r.cutoffTimezone ?? ""),
    }))
  );
}

export function useBenesBanned() {
  return useSheetTab<BeneBanned>("benesBanned", (raw) =>
    raw.map((r) => ({
      beneficiaryName: String(r.beneficiary_name ?? r.beneficiaryName ?? ""),
      provider: String(r.provider ?? ""),
      reason: r.reason ? String(r.reason) : null,
    }))
  );
}

export function useSendersBanned() {
  return useSheetTab<SenderBanned>("sendersBanned", (raw) =>
    raw.map((r) => ({
      senderName: String(r.sender_name ?? r.senderName ?? ""),
      provider: String(r.provider ?? ""),
      reason: r.reason ? String(r.reason) : null,
    }))
  );
}

export function useSwiftCodesBanned() {
  return useSheetTab<SwiftCodeBanned>("swiftCodesBanned", (raw) =>
    raw.map((r) => ({
      swiftCode: String(r.swift_code ?? r.swiftCode ?? ""),
      provider: String(r.provider ?? ""),
      reason: r.reason ? String(r.reason) : null,
    }))
  );
}

export function useLightKycSenders() {
  return useSheetTab<LightKycSender>("lightKycSenders", (raw) =>
    raw.map((r) => ({
      senderName: String(r.sender_name ?? r.senderName ?? ""),
      restrictedToProvider: String(r.restricted_to_provider ?? r.restrictedToProvider ?? "GIB"),
    }))
  );
}

export function useFlowTargets() {
  return useSheetTab<FlowTarget>("flowTargets", (raw) =>
    raw.map((r) => ({
      provider: String(r.provider ?? ""),
      targetPct: r.target_pct != null && r.target_pct !== "" ? parseNumber(r.target_pct) : null,
    }))
  );
}

export function useSenderCountryMatrix() {
  return useSheetTab("senderCountryMatrix");
}

export function useReceiverCountryMatrix() {
  return useSheetTab("receiverCountryMatrix");
}

/* ── Mutations ───────────────────────────────────────────── */

export function useWriteSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tab,
      range,
      values,
    }: {
      tab: TabKey;
      range: string;
      values: unknown[][];
    }) => {
      await writeTab(tab, range, values);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sheet", vars.tab] });
    },
  });
}

export function useAppendSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tab,
      values,
    }: {
      tab: TabKey;
      values: unknown[][];
    }) => {
      await appendTab(tab, values);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sheet", vars.tab] });
    },
  });
}
