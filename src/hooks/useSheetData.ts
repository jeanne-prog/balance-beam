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
  ProviderManual,
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
    staleTime: 30_000,
    enabled,
  });
}

/* ── Helpers ─────────────────────────────────────────────── */

function parseNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/,/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function parseBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toUpperCase() === "TRUE" || v === "1";
  return false;
}

function str(v: unknown): string {
  return v != null && v !== "" ? String(v) : "";
}

function strOrNull(v: unknown): string | null {
  return v != null && v !== "" ? String(v) : null;
}

/* ── Typed hooks per domain ──────────────────────────────── */

export function useTransactions(statusFilter?: string) {
  return useSheetTab<Transaction>("transactions", (raw) => {
    const all = raw.map((r) => ({
      transactionId: str(r.transaction_id),
      senderName: str(r.sender_name),
      senderCountry: str(r.sender_country),
      senderCurrency: str(r.sender_currency),
      senderAmount: parseNumber(r.sender_amount),
      receiverName: str(r.receiver_name),
      receiverCountry: str(r.receiver_country),
      receiverCurrency: str(r.receiver_currency),
      receiverAmount: parseNumber(r.receiver_amount),
      usdValue: parseNumber(r.usd_value),
      receiverSwiftCode: strOrNull(r.receiver_swift_code),
      receiverIban: strOrNull(r.receiver_iban_code),
      status: str(r.status),
      collectionProviderId: strOrNull(r.collection_provider_id),
      payoutProviderId: strOrNull(r.payout_provider_id),
      reference: strOrNull(r.reference),
      createdAtDate: strOrNull(r.created_at_date),
      collectedAtDate: strOrNull(r.collected_at_date),
      paymentInitiatedAtDate: strOrNull(r.payment_initiated_at_date),
      paymentSentAtDate: strOrNull(r.payment_sent_at_date),
      hasBlockingIssue: parseBool(r.has_blocking_issue),
      pendingApprovalAtDate: strOrNull(r.submitted_for_approval_at),
      approvedAtDate: strOrNull(r.approved_at),
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
      accountId: str(r.account_id),
      accountName: str(r.account_name),
      accountCountry: str(r.account_country),
      provider: str(r.account_owner_provider_id),
      currency: str(r.currency),
      currentBalance: parseNumber(r.last_balance),
      lastBalanceAt: str(r.last_balance_at),
    }))
  );
}

export function useRoutingRules() {
  return useSheetTab<RoutingRule>("routingRules", (raw) =>
    raw.map((r) => ({
      sourceCountryCode: str(r.source_country_code),
      amountUsdMin: parseNumber(r.amount_usd_min),
      amountUsdMax: r.amount_usd_max && String(r.amount_usd_max) !== "null"
        ? parseNumber(r.amount_usd_max)
        : null,
      payoutDays: parseNumber(r.payout_days),
    }))
  );
}

export function useCurrenciesMatrix() {
  return useSheetTab<CurrencyRail>("currenciesMatrix", (raw) =>
    raw.map((r) => ({
      provider: str(r.provider_id),
      currency: str(r.currency),
      rail: str(r.rail),
      isPobo: parseBool(r.is_pobo),
      speedRank: parseNumber(r.speed_rank),
      fundingCutoffUtc: strOrNull(r.funding_cutoff_utc),
      payoutCutoffUtc: strOrNull(r.payout_cutoff_utc),
      holidayCalendar: str(r.holiday_calendar),
    }))
  );
}

export function useBenesBanned() {
  return useSheetTab<BeneBanned>("benesBanned", (raw) =>
    raw.map((r) => ({
      beneficiaryName: str(r["Bene name"]),
      provider: str(r.Provider),
    }))
  );
}

export function useSendersBanned() {
  return useSheetTab<SenderBanned>("sendersBanned", (raw) =>
    raw.map((r) => ({
      senderName: str(r.Sender ?? r["Sender name"] ?? r.sender_name),
      provider: str(r.Provider ?? r.provider),
    }))
  );
}

export function useSwiftCodesBanned() {
  return useSheetTab<SwiftCodeBanned>("swiftCodesBanned", (raw) =>
    raw.map((r) => ({
      swiftCode: str(r.Code ?? r["SWIFT code"] ?? r.swift_code),
      provider: str(r.Provider ?? r.provider),
    }))
  );
}

export function useLightKycSenders() {
  return useSheetTab<LightKycSender>("lightKycSenders", (raw) =>
    raw.map((r) => ({
      senderName: str(r.Sender ?? r.sender_name ?? r["Sender name"]),
    }))
  );
}

export function useFlowTargets() {
  return useSheetTab<FlowTarget>("flowTargets", (raw) =>
    raw.map((r) => {
      const targetStr = str(r.Target);
      let targetPct: number | null = null;
      if (targetStr) {
        const cleaned = targetStr.replace("%", "").trim();
        const n = Number(cleaned);
        if (!isNaN(n)) targetPct = n;
      }
      return {
        provider: str(r.Provider),
        currency: str(r.Currency),
        targetPct,
      };
    })
  );
}

export function useSenderCountryMatrix() {
  return useSheetTab("senderCountryMatrix");
}

export function useReceiverCountryMatrix() {
  return useSheetTab("receiverCountryMatrix");
}

export function useProviderManual() {
  return useSheetTab<ProviderManual>("providerManual", (raw) =>
    raw.map((r) => ({
      provider: str(r.provider_id ?? r.Provider ?? r.provider),
      isManual: parseBool(r.is_manual ?? r["Is Manual"] ?? r.manual),
    }))
  );
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
