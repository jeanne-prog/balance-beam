/**
 * Fund Movement Recommendations
 *
 * Computes a 2-day liquidity forecast (today D and next business day D+1)
 * per currency, incorporating:
 *   1. Already-queued pending_payout transactions (confirmed demand)
 *   2. Transactions held back by routing rules that become due today or tomorrow
 *   3. Probabilistic conversion of pending_collection and pending_approval/draft
 *      transactions based on cohort rates loaded from the `cohort_rates` Google Sheet
 *   4. Expected new transaction volume = average of last 3 working days' collected vol
 *
 * For each provider × currency, computes required funding actions with:
 *   - P50 (mean) scenario — not covered = bad
 *   - P75 scenario        — not covered = worth flagging but not critical
 *   - Urgency based on provider funding cutoff times
 *
 * Cohort rates are NOT hardcoded — they come from the `cohort_rates` sheet
 * so they can be recalibrated without touching code.
 */

import type { Transaction, Balance, CurrencyRail, RoutingSuggestion } from "@/types";
import { getTransactionDueDate } from "@/lib/routingRules";
import type { RoutingRule } from "@/types";

// ── Cohort rates — loaded from `cohort_rates` sheet ───────

/**
 * Typed cohort rates, parsed from the cohort_rates sheet.
 * Passed into computeLiquidityForecast() as a parameter.
 */
export interface CohortRates {
  /** pending_collection → pending_payout rates: age_bucket → [d0,d1,d2,d3,d4,d5+] */
  pendingCollection: Record<string, number[]>;
  /** draft/pending_approval → pending_payout rates: age_bucket → [d0,d1,d2,d3,d4,d5+] */
  draftPending: Record<string, number[]>;
  /** New volume payout distribution: [d0,d1,d2,d3,d4,d5+] */
  newVolume: number[];
  /** Cancellation rates by currency code e.g. { USD: 0.1574, EUR: 0.1370, DEFAULT: 0.15 } */
  cancellationRates: Record<string, number>;
  /** P75 multiplier over mean e.g. 1.18 */
  p75Multiplier: number;
}

/**
 * Raw row shape from the cohort_rates Google Sheet tab.
 *
 * Sheet structure (one row per entry):
 * | cohort_type        | age_bucket | d0     | d1     | d2     | d3     | d4     | d5_plus |
 * |--------------------|------------|--------|--------|--------|--------|--------|---------|
 * | pending_collection | 0-1        | 0.4041 | 0.1832 | 0.1561 | 0.1558 | 0.0608 | 0.0400  |
 * | pending_collection | 1-2        | 0.3076 | ...    |        |        |        |         |
 * | pending_collection | 2-3        | ...    |        |        |        |        |         |
 * | pending_collection | 3+         | ...    |        |        |        |        |         |
 * | draft_pending      | 0-1        | 0.0092 | 0.3019 | 0.6399 | 0.0091 | 0.0049 | 0.0350  |
 * | draft_pending      | 1-2        | ...    |        |        |        |        |         |
 * | draft_pending      | 2-3        | ...    |        |        |        |        |         |
 * | draft_pending      | 3+         | ...    |        |        |        |        |         |
 * | new_volume         | any        | 0.1510 | 0.1696 | 0.2052 | 0.1535 | 0.3151 | 0.0056  |
 * | cancellation_rate  | USD        | 0.1574 |        |        |        |        |         |
 * | cancellation_rate  | EUR        | 0.1370 |        |        |        |        |         |
 * | p75_multiplier     |            | 1.18   |        |        |        |        |         |
 */
export interface CohortRateRow {
  cohort_type: string;
  age_bucket: string;
  d0: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5_plus: number;
}

/**
 * Parse raw sheet rows into CohortRates.
 * Add this to useSheetData.ts as useCohortRates().
 */
export function parseCohortRates(rows: CohortRateRow[]): CohortRates {
  const pendingCollection: Record<string, number[]> = {};
  const draftPending: Record<string, number[]> = {};
  let newVolume: number[] = [0.1510, 0.1696, 0.2052, 0.1535, 0.3151, 0.0056];
  const cancellationRates: Record<string, number> = { DEFAULT: 0.15 };
  let p75Multiplier = 1.18;

  for (const row of rows) {
    const rates = [row.d0, row.d1, row.d2, row.d3, row.d4, row.d5_plus];
    switch (row.cohort_type) {
      case "pending_collection":
        pendingCollection[row.age_bucket] = rates;
        break;
      case "draft_pending":
        draftPending[row.age_bucket] = rates;
        break;
      case "new_volume":
        newVolume = rates;
        break;
      case "cancellation_rate":
        cancellationRates[row.age_bucket.toUpperCase()] = row.d0;
        break;
      case "p75_multiplier":
        p75Multiplier = row.d0;
        break;
    }
  }

  return { pendingCollection, draftPending, newVolume, cancellationRates, p75Multiplier };
}

// ── Types ─────────────────────────────────────────────────

export interface FundingAction {
  currency: string;
  amountP50: number;
  amountP75: number;
  fromProvider: string;
  toProvider: string;
  horizon: "today" | "tomorrow";
  demandBreakdown: {
    confirmedPendingPayout: number;
    heldBackDueToday: number;
    fromPendingCollection: number;
    fromDraftPending: number;
    fromNewVolume: number;
  };
  fundingCutoffUtc: string | null;
  minutesUntilCutoff: number | null;
  cutoffIsTomorrow: boolean;
  urgency: "critical" | "high" | "medium" | "low";
  p50Covered: boolean;
  p75Covered: boolean;
  neoInsufficient: boolean;
}

export interface LiquidityForecast {
  currency: string;
  demandTodayP50: number;
  demandTodayP75: number;
  demandTomorrowP50: number;
  demandTomorrowP75: number;
  totalCurrentBalance: number;
  totalAllocated: number;
  actions: FundingAction[];
}

// ── Helpers ───────────────────────────────────────────────

function normalize(s: string): string {
  return s.trim().toUpperCase();
}

// ── Account name → provider lookup for in-flight transfers ──

const ACCOUNT_PROVIDER_MAP: Record<string, string> = {
  "CORPAY EUR": "CORPAY",
  "CORPAY USD": "CORPAY",
  "CORPAY GBP": "CORPAY",
  "EMQ USD": "EMQ",
  "EMQ EUR": "EMQ",
  "EMQ GBP": "EMQ",
  "NEO - USD CLIENTS": "NEO",
  "NEO - EUR CLIENTS": "NEO",
  "NEO - GBP CLIENTS": "NEO",
  "GIB USD": "GIB",
  "TAZAPAY USD": "TAZAPAY",
};

function resolveAccountProvider(accountName: string): { provider: string; currency: string } | null {
  const upper = accountName.trim().toUpperCase();
  for (const [pattern, provider] of Object.entries(ACCOUNT_PROVIDER_MAP)) {
    if (upper.includes(pattern) || upper === pattern) {
      // Extract currency from the pattern (last 3 chars usually)
      const parts = pattern.split(" ");
      const currency = parts[parts.length - 1];
      return { provider, currency };
    }
  }
  // Fallback: try to parse "Provider Currency" pattern
  const parts = upper.split(/\s+/);
  if (parts.length >= 2) {
    const currency = parts[parts.length - 1];
    const provider = parts.slice(0, -1).join(" ").replace(/[^A-Z]/g, "");
    if (currency.length === 3 && provider.length >= 2) {
      return { provider, currency };
    }
  }
  return null;
}

export interface PlannedTransfer {
  id: string;
  fromProvider: string;
  toProvider: string;
  currency: string;
  amount: number;
  createdAt: string;
  source: "planned";
}

export interface IncomingTransferSummary {
  /** "PROVIDER|CURRENCY" → inflight amount */
  inflight: Map<string, number>;
  /** "PROVIDER|CURRENCY" → planned amount */
  planned: Map<string, number>;
}

export function computeIncomingTransfers(
  plannedTransfers: PlannedTransfer[],
  inFlightTransfers: { toAccount: string; amount: number; currency: string }[],
): IncomingTransferSummary {
  const inflight = new Map<string, number>();
  const planned = new Map<string, number>();

  for (const t of inFlightTransfers) {
    const resolved = resolveAccountProvider(t.toAccount);
    if (resolved) {
      const key = `${resolved.provider}|${resolved.currency}`;
      inflight.set(key, (inflight.get(key) ?? 0) + t.amount);
    }
  }

  for (const t of plannedTransfers) {
    const key = `${normalize(t.toProvider)}|${normalize(t.currency)}`;
    planned.set(key, (planned.get(key) ?? 0) + t.amount);
  }

  return { inflight, planned };
}

export function computeEffectiveBalances(
  balances: Balance[],
  plannedTransfers: PlannedTransfer[],
  inFlightTransfers: { toAccount: string; amount: number; currency: string }[],
): Balance[] {
  // Start from a mutable copy keyed by provider|currency
  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    const key = `${normalize(b.provider)}|${normalize(b.currency)}`;
    balanceMap.set(key, (balanceMap.get(key) ?? 0) + b.currentBalance);
  }

  // Planned transfers: subtract from source, add to destination
  for (const t of plannedTransfers) {
    const fromKey = `${normalize(t.fromProvider)}|${normalize(t.currency)}`;
    const toKey = `${normalize(t.toProvider)}|${normalize(t.currency)}`;
    balanceMap.set(fromKey, (balanceMap.get(fromKey) ?? 0) - t.amount);
    balanceMap.set(toKey, (balanceMap.get(toKey) ?? 0) + t.amount);
  }

  // In-flight transfers: only add to destination (already left source)
  for (const t of inFlightTransfers) {
    const resolved = resolveAccountProvider(t.toAccount);
    if (resolved) {
      const key = `${resolved.provider}|${resolved.currency}`;
      balanceMap.set(key, (balanceMap.get(key) ?? 0) + t.amount);
    }
  }

  // Convert back to Balance[]
  return Array.from(balanceMap.entries()).map(([key, amount]) => {
    const [provider, currency] = key.split("|");
    const original = balances.find(
      b => normalize(b.provider) === provider && normalize(b.currency) === currency
    );
    return {
      accountId: original?.accountId ?? `eff-${key}`,
      accountName: original?.accountName ?? provider,
      accountCountry: original?.accountCountry ?? "",
      provider,
      currency,
      currentBalance: amount,
      lastBalanceAt: original?.lastBalanceAt ?? "",
    };
  });
}

function getAgeBucket(ageInDays: number): string {
  if (ageInDays < 1) return "0-1";
  if (ageInDays < 2) return "1-2";
  if (ageInDays < 3) return "2-3";
  return "3+";
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

function parseCutoffToday(cutoffUtc: string): Date | null {
  const parts = cutoffUtc.split(":");
  if (parts.length < 2) return null;
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    parseInt(parts[0], 10), parseInt(parts[1], 10), 0
  ));
}

function lastNWorkingDays(n: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (days.length < n) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
  }
  return days;
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function tomorrowUtc(): Date {
  const d = todayUtc();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// ── Step 1: Average daily volume from last 3 working days ──

function computeAvgDailyVolume(allTransactions: Transaction[]): Map<string, number> {
  const workingDays = lastNWorkingDays(3);
  const totals = new Map<string, number>();

  for (const tx of allTransactions) {
    if (tx.status !== "payment_sent" || !tx.paymentSentAtDate) continue;
    const sentDate = new Date(tx.paymentSentAtDate);
    sentDate.setUTCHours(0, 0, 0, 0);
    const isRecentWorkingDay = workingDays.some(d => d.getTime() === sentDate.getTime());
    if (!isRecentWorkingDay) continue;
    const dayKey = `${normalize(tx.receiverCurrency)}|${sentDate.toISOString().slice(0, 10)}`;
    totals.set(dayKey, (totals.get(dayKey) ?? 0) + tx.receiverAmount);
  }

  const avgByCurrency = new Map<string, number>();
  const currencies = new Set<string>();
  for (const key of totals.keys()) currencies.add(key.split("|")[0]);

  for (const currency of currencies) {
    let sum = 0;
    let count = 0;
    for (const day of workingDays) {
      const dayKey = `${currency}|${day.toISOString().slice(0, 10)}`;
      if (totals.has(dayKey)) { sum += totals.get(dayKey)!; count++; }
    }
    if (count > 0) avgByCurrency.set(currency, sum / count);
  }
  return avgByCurrency;
}

// ── Step 2: Historical routing share per provider × currency ──

function computeRoutingShares(allTransactions: Transaction[]): Map<string, number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);

  const provTotals = new Map<string, number>();
  const curTotals = new Map<string, number>();

  for (const tx of allTransactions) {
    if (tx.status !== "payment_sent" || !tx.payoutProviderId || !tx.paymentSentAtDate) continue;
    if (new Date(tx.paymentSentAtDate) < cutoff) continue;
    const provKey = `${normalize(tx.payoutProviderId)}|${normalize(tx.receiverCurrency)}`;
    const curKey = normalize(tx.receiverCurrency);
    provTotals.set(provKey, (provTotals.get(provKey) ?? 0) + tx.receiverAmount);
    curTotals.set(curKey, (curTotals.get(curKey) ?? 0) + tx.receiverAmount);
  }

  const shares = new Map<string, number>();
  for (const [provKey, total] of provTotals) {
    const currency = provKey.split("|")[1];
    const currencyTotal = curTotals.get(currency) ?? 0;
    if (currencyTotal > 0) shares.set(provKey, total / currencyTotal);
  }
  return shares;
}

// ── Step 3: Demand forecast per currency per horizon ──────

interface DemandForecast {
  confirmedPendingPayout: number;
  heldBackDueToday: number;
  fromPendingCollection: number;
  fromDraftPending: number;
  fromNewVolume: number;
  total: number;
}

function computeDemandForecast(
  currency: string,
  horizon: "today" | "tomorrow",
  allTransactions: Transaction[],
  routingRules: RoutingRule[],
  avgDailyVolume: Map<string, number>,
  cohortRates: CohortRates,
): DemandForecast {
  const cur = normalize(currency);
  // For today horizon: EUR and USD use full forecast, all others use confirmed only
  const confirmedOnly = horizon === "today" && cur !== "EUR" && cur !== "USD";
  const horizonIndex = horizon === "today" ? 0 : 1;
  const today = todayUtc();
  const tomorrow = tomorrowUtc();
  const targetDate = horizon === "today" ? today : tomorrow;
  const now = new Date();
  const cur = normalize(currency);
  const cancellationRate = cohortRates.cancellationRates[cur] ?? cohortRates.cancellationRates["DEFAULT"] ?? 0.15;

  let confirmedPendingPayout = 0;
  let heldBackDueToday = 0;
  let fromPendingCollection = 0;
  let fromDraftPending = 0;

  for (const tx of allTransactions) {
    if (normalize(tx.receiverCurrency) !== cur) continue;

    if (tx.status === "pending_payout") {
      const dueDate = getTransactionDueDate(tx, routingRules) ?? today;
      dueDate.setUTCHours(0, 0, 0, 0);
      if (dueDate.getTime() === targetDate.getTime()) {
        confirmedPendingPayout += tx.receiverAmount;
      }
      continue;
    }

    if (confirmedOnly) continue; // Non EUR/USD today: skip pipeline/draft/new volume

    if (tx.status === "pending_collection") {
      const approvedAt = tx.approvedAtDate ? new Date(tx.approvedAtDate) : null;
      if (!approvedAt) continue;
      const bucket = getAgeBucket(daysBetween(approvedAt, now));
      const rates = cohortRates.pendingCollection[bucket];
      if (!rates) continue;
      fromPendingCollection += tx.receiverAmount * (rates[horizonIndex] ?? 0);
      continue;
    }

    if (tx.status === "draft" || tx.status === "pending_approval") {
      const approvalAt = tx.pendingApprovalAtDate
        ? new Date(tx.pendingApprovalAtDate)
        : tx.createdAtDate ? new Date(tx.createdAtDate) : null;
      if (!approvalAt) continue;
      const bucket = getAgeBucket(daysBetween(approvalAt, now));
      const rates = cohortRates.draftPending[bucket];
      if (!rates) continue;
      fromDraftPending += tx.receiverAmount * (rates[horizonIndex] ?? 0) * (1 - cancellationRate);
      continue;
    }
  }

  const avgVol = avgDailyVolume.get(cur) ?? 0;
  const newVolRates = cohortRates.newVolume;
  let fromNewVolume = 0;
  if (!confirmedOnly) {
    if (horizon === "today") {
      fromNewVolume = avgVol * (newVolRates[0] ?? 0);
    } else {
      fromNewVolume = avgVol * (newVolRates[1] ?? 0) + avgVol * (newVolRates[0] ?? 0);
    }
  }

  const total = confirmedPendingPayout + heldBackDueToday + fromPendingCollection + fromDraftPending + fromNewVolume;
  return { confirmedPendingPayout, heldBackDueToday, fromPendingCollection, fromDraftPending, fromNewVolume, total };
}

// ── Constants ─────────────────────────────────────────────

/** 08:00 UTC — earliest time the team can initiate a transfer */
const TEAM_START_HOUR_UTC = 8;

// ── Step 4: Urgency ───────────────────────────────────────

function computeMinutesUntilCutoff(cutoffUtc: string, forTomorrow: boolean): number | null {
  const cutoff = parseCutoffToday(cutoffUtc);
  if (!cutoff) return null;
  if (forTomorrow) cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  return Math.floor((cutoff.getTime() - Date.now()) / (1000 * 60));
}

function getUrgency(minutesUntilCutoff: number | null, p50Covered: boolean): FundingAction["urgency"] {
  if (!p50Covered) {
    if (minutesUntilCutoff !== null && minutesUntilCutoff < 60) return "critical";
    return "high";
  }
  if (minutesUntilCutoff !== null && minutesUntilCutoff < 60) return "high";
  if (minutesUntilCutoff !== null && minutesUntilCutoff < 180) return "medium";
  return "low";
}

// ── Main export ───────────────────────────────────────────

export function computeLiquidityForecast(
  allTransactions: Transaction[],
  balances: Balance[],
  currencyRails: CurrencyRail[],
  routingRules: RoutingRule[],
  currentSuggestions: Map<string, RoutingSuggestion[]>,
  cohortRates: CohortRates,
): LiquidityForecast[] {
  const avgDailyVolume = computeAvgDailyVolume(allTransactions);
  const routingShares = computeRoutingShares(allTransactions);

  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    const key = `${normalize(b.provider)}|${normalize(b.currency)}`;
    balanceMap.set(key, (balanceMap.get(key) ?? 0) + b.currentBalance);
  }

  const allocatedMap = new Map<string, number>();
  for (const tx of allTransactions) {
    if (tx.status !== "pending_payout") continue;
    const sugs = currentSuggestions.get(tx.transactionId) ?? [];
    const top = sugs.find(s => s.score > 0 && s.balanceSufficient);
    if (top) {
      const key = `${normalize(top.provider)}|${normalize(tx.receiverCurrency)}`;
      allocatedMap.set(key, (allocatedMap.get(key) ?? 0) + tx.receiverAmount);
    }
  }

  const activeCurrencies = new Set<string>(["EUR", "USD"]);
  for (const cr of currencyRails) activeCurrencies.add(normalize(cr.currency));

  const forecasts: LiquidityForecast[] = [];

  for (const currency of activeCurrencies) {
    const providersForCurrency = new Set<string>();
    for (const cr of currencyRails) {
      if (normalize(cr.currency) === currency) providersForCurrency.add(normalize(cr.provider));
    }
    for (const key of routingShares.keys()) {
      if (key.endsWith(`|${currency}`)) providersForCurrency.add(key.split("|")[0]);
    }
    if (providersForCurrency.size === 0) continue;

    const forecastToday = computeDemandForecast(currency, "today", allTransactions, routingRules, avgDailyVolume, cohortRates);
    const forecastTomorrow = computeDemandForecast(currency, "tomorrow", allTransactions, routingRules, avgDailyVolume, cohortRates);

    const p75 = cohortRates.p75Multiplier;
    const demandTodayP50 = forecastToday.total;
    const demandTodayP75 = forecastToday.total * p75;
    const demandTomorrowP50 = forecastTomorrow.total;
    const demandTomorrowP75 = forecastTomorrow.total * p75;

    let totalCurrentBalance = 0;
    let totalAllocated = 0;
    for (const provider of providersForCurrency) {
      totalCurrentBalance += balanceMap.get(`${provider}|${currency}`) ?? 0;
      totalAllocated += allocatedMap.get(`${provider}|${currency}`) ?? 0;
    }

    const actions: FundingAction[] = [];
    const now = new Date();

    // Compute Neo effective balance for this currency to cap transfers
    let neoRemaining = balanceMap.get(`NEO|${currency}`) ?? 0;

    for (const provider of providersForCurrency) {
      const provKey = `${provider}|${currency}`;
      const currentBalance = balanceMap.get(provKey) ?? 0;
      const allocated = allocatedMap.get(provKey) ?? 0;
      const remainingBalance = currentBalance - allocated;
      const share = routingShares.get(provKey) ?? 0;
      if (share === 0) continue;

      const rail = currencyRails.find(
        cr => normalize(cr.provider) === provider && normalize(cr.currency) === currency
      );
      const fundingCutoffUtc = rail?.fundingCutoffUtc ?? null;

      // ── TODAY ──
      const provDemandTodayP50 = demandTodayP50 * share;
      const provDemandTodayP75 = demandTodayP75 * share;
      const shortfallTodayP50 = Math.max(0, provDemandTodayP50 - remainingBalance);
      const shortfallTodayP75 = Math.max(0, provDemandTodayP75 - remainingBalance);

      let todayCutoffPassed = false;
      if (fundingCutoffUtc) {
        const cutoffTime = parseCutoffToday(fundingCutoffUtc);
        if (cutoffTime && cutoffTime < now) todayCutoffPassed = true;
      }

      if ((shortfallTodayP50 > 0 || shortfallTodayP75 > 0) && !todayCutoffPassed) {
        const minutesUntilCutoff = (fundingCutoffUtc && fundingCutoffUtc !== "TBC") ? computeMinutesUntilCutoff(fundingCutoffUtc, false) : null;
        // Cap at Neo remaining balance
        const cappedP50 = Math.min(shortfallTodayP50, Math.max(0, neoRemaining));
        const cappedP75 = Math.min(shortfallTodayP75, Math.max(0, neoRemaining));
        const neoInsufficient = cappedP50 < shortfallTodayP50;
        const p50Covered = shortfallTodayP50 === 0;
        const p75Covered = shortfallTodayP75 === 0;
        actions.push({
          currency, amountP50: cappedP50, amountP75: cappedP75,
          fromProvider: "NEO", toProvider: provider, horizon: "today",
          demandBreakdown: {
            confirmedPendingPayout: forecastToday.confirmedPendingPayout * share,
            heldBackDueToday: forecastToday.heldBackDueToday * share,
            fromPendingCollection: forecastToday.fromPendingCollection * share,
            fromDraftPending: forecastToday.fromDraftPending * share,
            fromNewVolume: forecastToday.fromNewVolume * share,
          },
          fundingCutoffUtc, minutesUntilCutoff, cutoffIsTomorrow: false,
          urgency: getUrgency(minutesUntilCutoff, p50Covered), p50Covered, p75Covered,
          neoInsufficient,
        });
        neoRemaining -= cappedP50;
      }

      // ── TOMORROW ──
      // Only generate tomorrow-horizon actions for providers whose funding cutoff
      // is <= TEAM_START_HOUR_UTC (i.e. funds must arrive before the working day starts,
      // meaning pre-funding is required the day before). Currently only EMQ EUR/GBP.
      const cutoffHour = fundingCutoffUtc ? parseInt(fundingCutoffUtc.split(":")[0], 10) : null;
      const needsPreFunding = fundingCutoffUtc != null
        && fundingCutoffUtc !== "TBC"
        && cutoffHour != null
        && !isNaN(cutoffHour)
        && cutoffHour <= TEAM_START_HOUR_UTC;

      if (needsPreFunding) {
        const provDemandTomorrowP50 = demandTomorrowP50 * share;
        const provDemandTomorrowP75 = demandTomorrowP75 * share;
        const balanceAfterToday = Math.max(0, remainingBalance - provDemandTodayP50);
        const shortfallTomorrowP50 = Math.max(0, provDemandTomorrowP50 - balanceAfterToday);
        const shortfallTomorrowP75 = Math.max(0, provDemandTomorrowP75 - balanceAfterToday);

        if (shortfallTomorrowP50 > 0 || shortfallTomorrowP75 > 0) {
          let minutesUntilTomorrowCutoff: number | null = null;
          if (fundingCutoffUtc) {
            minutesUntilTomorrowCutoff = computeMinutesUntilCutoff(fundingCutoffUtc, true);
          }
          if (minutesUntilTomorrowCutoff === null || minutesUntilTomorrowCutoff > 0) {
            const p50Covered = shortfallTomorrowP50 === 0;
            const p75Covered = shortfallTomorrowP75 === 0;
            actions.push({
              currency, amountP50: shortfallTomorrowP50, amountP75: shortfallTomorrowP75,
              fromProvider: "NEO", toProvider: provider, horizon: "tomorrow",
              demandBreakdown: {
                confirmedPendingPayout: forecastTomorrow.confirmedPendingPayout * share,
                heldBackDueToday: forecastTomorrow.heldBackDueToday * share,
                fromPendingCollection: forecastTomorrow.fromPendingCollection * share,
                fromDraftPending: forecastTomorrow.fromDraftPending * share,
                fromNewVolume: forecastTomorrow.fromNewVolume * share,
              },
              fundingCutoffUtc, minutesUntilCutoff: minutesUntilTomorrowCutoff, cutoffIsTomorrow: true,
              urgency: getUrgency(minutesUntilTomorrowCutoff, p50Covered), p50Covered, p75Covered,
            });
          }
        }
      }
    }

    actions.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      const uDiff = order[a.urgency] - order[b.urgency];
      if (uDiff !== 0) return uDiff;
      if (a.minutesUntilCutoff !== null && b.minutesUntilCutoff !== null) {
        return a.minutesUntilCutoff - b.minutesUntilCutoff;
      }
      return b.amountP50 - a.amountP50;
    });

    forecasts.push({
      currency, demandTodayP50, demandTodayP75, demandTomorrowP50, demandTomorrowP75,
      totalCurrentBalance, totalAllocated, actions,
    });
  }

  return forecasts.filter(f => f.demandTodayP50 > 0 || f.demandTomorrowP50 > 0 || f.actions.length > 0);
}

// ── Legacy shim ───────────────────────────────────────────
export interface FundMovement {
  currency: string;
  amount: number;
  fromProvider: string;
  toProvider: string;
  txCount: number;
  fundingCutoffUtc: string | null;
  minutesUntilCutoff: number | null;
  reason: string;
  horizon: "today" | "tomorrow";
  p50Covered: boolean;
  p75Covered: boolean;
  urgency: FundingAction["urgency"];
}

/** @deprecated Use computeLiquidityForecast instead */
export function computeFundMovements(): FundMovement[] {
  return [];
}
