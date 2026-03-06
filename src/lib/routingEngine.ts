/**
 * Routing Engine — scores and ranks providers for each pending_payout transaction.
 *
 * Constraints (hard filters — disqualify a provider):
 *  1. Currency support: provider must support the receiver currency
 *  2. Sender country: provider must accept sender country
 *  3. Receiver country: provider must accept receiver country
 *  4. Bene banned: beneficiary must not be banned at that provider
 *  5. Sender banned: sender must not be banned at that provider
 *  6. SWIFT code banned: receiver SWIFT code must not be banned at that provider
 *  7. Light KYC: if sender is light-KYC, only GIB is allowed
 *
 * Scoring factors (soft ranking among eligible providers):
 *  - Speed rank (lower = faster = better)
 *  - Balance sufficiency (single weight: +W if sufficient, -W if not)
 *  - POBO bonus (prefer POBO rails)
 *  - Manual penalty (penalize providers requiring manual processing)
 *
 * Flow targets:
 *  - Force-assign eligible transactions to under-target providers
 */

import type {
  Transaction,
  Balance,
  CurrencyRail,
  BeneBanned,
  SenderBanned,
  SwiftCodeBanned,
  LightKycSender,
  FlowTarget,
  RoutingSuggestion,
  ProviderManual,
} from "@/types";

/* ── Input data bundle ───────────────────────────────────── */

export interface ScoringWeights {
  speed_rank_multiplier: number;
  balance_weight: number;
  pobo_bonus: number;
  manual_penalty: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  speed_rank_multiplier: 10,
  balance_weight: 20,
  pobo_bonus: 25,
  manual_penalty: 20,
};

export interface RoutingContext {
  currencyRails: CurrencyRail[];
  senderCountryMatrix: Record<string, unknown>[];
  receiverCountryMatrix: Record<string, unknown>[];
  benesBanned: BeneBanned[];
  sendersBanned: SenderBanned[];
  swiftCodesBanned: SwiftCodeBanned[];
  lightKycSenders: LightKycSender[];
  flowTargets: FlowTarget[];
  balances: Balance[];
  allTransactions: Transaction[];
  providerManual: ProviderManual[];
  sepaCountries: Set<string>;
  weights?: ScoringWeights;
}

/* ── Helpers ──────────────────────────────────────────────── */

function normalize(s: string): string {
  return s.trim().toUpperCase();
}

/** Check if a provider supports a country in a pivot-format matrix */
function isCountryApproved(
  matrix: Record<string, unknown>[],
  countryCode: string,
  provider: string
): boolean {
  const row = matrix.find(
    (r) => normalize(String(r.country_code ?? "")) === normalize(countryCode)
  );
  if (!row) return false;
  const val = row[normalize(provider)] ?? row[provider];
  return normalize(String(val ?? "")) === "YES";
}

/** Get total USD routed per provider from already-routed transactions */
function computeFlowDistribution(
  transactions: Transaction[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.payoutProviderId) {
      const key = normalize(t.payoutProviderId);
      totals.set(key, (totals.get(key) ?? 0) + t.usdValue);
    }
  }
  return totals;
}

/** Get provider's total balance in a specific currency */
function getProviderBalance(
  balances: Balance[],
  provider: string,
  currency: string
): number {
  return balances
    .filter(
      (b) =>
        normalize(b.provider) === normalize(provider) &&
        normalize(b.currency) === normalize(currency)
    )
    .reduce((sum, b) => sum + b.currentBalance, 0);
}

/* ── Flow target allocation ──────────────────────────────── */

/** Compute which providers are under their flow target */
export function getUnderTargetProviders(
  flowTargets: FlowTarget[],
  allTransactions: Transaction[]
): Map<string, { currentPct: number; targetPct: number }> {
  const flowDist = computeFlowDistribution(allTransactions);
  const totalRouted = Array.from(flowDist.values()).reduce((a, b) => a + b, 0);
  const result = new Map<string, { currentPct: number; targetPct: number }>();

  for (const ft of flowTargets) {
    if (ft.targetPct == null || ft.targetPct <= 0) continue;
    const key = normalize(ft.provider);
    const currentAmt = flowDist.get(key) ?? 0;
    const currentPct = totalRouted > 0 ? (currentAmt / totalRouted) * 100 : 0;
    if (currentPct < ft.targetPct) {
      result.set(key, { currentPct, targetPct: ft.targetPct });
    }
  }

  return result;
}

/** Get flow distribution as percentages per provider */
export function getProviderFlowPcts(
  flowTargets: FlowTarget[],
  allTransactions: Transaction[]
): { provider: string; currentPct: number; targetPct: number }[] {
  const flowDist = computeFlowDistribution(allTransactions);
  const totalRouted = Array.from(flowDist.values()).reduce((a, b) => a + b, 0);

  // Aggregate targets by provider (a provider may have targets for multiple currencies)
  const targetsByProvider = new Map<string, number>();
  for (const ft of flowTargets) {
    if (ft.targetPct != null && ft.targetPct > 0) {
      const key = normalize(ft.provider);
      // Use the max target across currencies for the provider
      targetsByProvider.set(key, Math.max(targetsByProvider.get(key) ?? 0, ft.targetPct));
    }
  }

  return Array.from(targetsByProvider.entries()).map(([provider, targetPct]) => {
    const currentAmt = flowDist.get(provider) ?? 0;
    const currentPct = totalRouted > 0 ? (currentAmt / totalRouted) * 100 : 0;
    return { provider, currentPct, targetPct };
  });
}

/* ── Main scoring function ───────────────────────────────── */

export function scoreTransaction(
  tx: Transaction,
  ctx: RoutingContext
): RoutingSuggestion[] {
  const suggestions: RoutingSuggestion[] = [];

  // Pre-compute lookups
  const bannedBenes = new Set(
    ctx.benesBanned.map((b) => `${normalize(b.provider)}|${normalize(b.beneficiaryName)}`)
  );
  const bannedSenders = new Set(
    ctx.sendersBanned.map((b) => `${normalize(b.provider)}|${normalize(b.senderName)}`)
  );
  const bannedSwift = new Set(
    ctx.swiftCodesBanned.map((b) => `${normalize(b.provider)}|${normalize(b.swiftCode)}`)
  );
  const lightKycSet = new Set(
    ctx.lightKycSenders.map((s) => normalize(s.senderName))
  );
  const manualSet = new Set(
    ctx.providerManual.filter((p) => p.isManual).map((p) => normalize(p.provider))
  );

  const w = ctx.weights ?? DEFAULT_WEIGHTS;
  const isLightKyc = lightKycSet.has(normalize(tx.senderName));

  // Check which providers are under flow target
  const underTarget = getUnderTargetProviders(ctx.flowTargets, ctx.allTransactions);

  // Find all currency/rail combos for the receiver currency
  const matchingRails = ctx.currencyRails.filter(
    (cr) => normalize(cr.currency) === normalize(tx.receiverCurrency)
  );

  // Group by provider
  const railsByProvider = new Map<string, CurrencyRail[]>();
  for (const cr of matchingRails) {
    const key = normalize(cr.provider);
    if (!railsByProvider.has(key)) railsByProvider.set(key, []);
    railsByProvider.get(key)!.push(cr);
  }

  for (const [providerKey, rails] of railsByProvider) {
    const flaggedReasons: string[] = [];
    let disqualified = false;

    // ── Hard constraint: Light KYC → only GIB ──
    if (isLightKyc && providerKey !== "GIB") {
      continue; // skip entirely, not even shown
    }

    // ── Hard constraint: Sender country ──
    if (
      tx.senderCountry &&
      !isCountryApproved(ctx.senderCountryMatrix, tx.senderCountry, providerKey)
    ) {
      flaggedReasons.push("Sender country not approved");
      disqualified = true;
    }

    // ── Hard constraint: Receiver country ──
    if (
      tx.receiverCountry &&
      !isCountryApproved(ctx.receiverCountryMatrix, tx.receiverCountry, providerKey)
    ) {
      flaggedReasons.push("Receiver country not approved");
      disqualified = true;
    }

    // ── Hard constraint: Bene banned ──
    if (bannedBenes.has(`${providerKey}|${normalize(tx.receiverName)}`)) {
      flaggedReasons.push("Beneficiary banned");
      disqualified = true;
    }

    // ── Hard constraint: Sender banned ──
    if (bannedSenders.has(`${providerKey}|${normalize(tx.senderName)}`)) {
      flaggedReasons.push("Sender banned");
      disqualified = true;
    }

    // ── Hard constraint: SWIFT code banned ──
    if (
      tx.receiverSwiftCode &&
      bannedSwift.has(`${providerKey}|${normalize(tx.receiverSwiftCode)}`)
    ) {
      flaggedReasons.push("SWIFT code banned");
      disqualified = true;
    }

    if (disqualified) {
      suggestions.push({
        provider: providerKey,
        rail: rails[0]?.rail ?? "SWIFT",
        isPobo: rails[0]?.isPobo ?? false,
        score: 0,
        balanceSufficient: false,
        availableTomorrow: false,
        flaggedReasons,
      });
      continue;
    }

    // ── Check if this provider is under flow target ──
    const targetInfo = underTarget.get(providerKey);

    // ── Score each rail for this provider ──
    for (const rail of rails) {
      // Balance check (do it early — it's a hard constraint for flow targets too)
      const balance = getProviderBalance(
        ctx.balances,
        providerKey,
        tx.receiverCurrency
      );
      const balanceSufficient = balance >= tx.receiverAmount;

      // Only force-assign for flow target if balance is sufficient
      const isFlowTargetAssignment = !!targetInfo && balanceSufficient;

      let score = isFlowTargetAssignment ? 1000 : 100;
      const railFlags: string[] = [];

      if (isFlowTargetAssignment) {
        railFlags.push(
          `Flow target: ${targetInfo!.currentPct.toFixed(1)}% → ${targetInfo!.targetPct}%`
        );
      }

      // Speed rank: lower is better
      const speedBonus = Math.max(0, 40 - rail.speedRank * w.speed_rank_multiplier);
      score += speedBonus;

      // POBO bonus — prefer POBO rails
      if (rail.isPobo) {
        score += w.pobo_bonus;
      } else if (w.pobo_bonus > 0) {
        railFlags.push("Non-POBO rail");
      }

      // Balance scoring (balance/balanceSufficient already computed above)
      if (balanceSufficient) {
        score += w.balance_weight;
      } else {
        score -= w.balance_weight;
        railFlags.push(
          `Insufficient balance (${balance.toLocaleString()} vs ${tx.receiverAmount.toLocaleString()})`
        );
      }

      // Manual processing penalty
      if (manualSet.has(providerKey)) {
        score -= w.manual_penalty;
        railFlags.push("Manual processing required");
      }

      suggestions.push({
        provider: providerKey,
        rail: rail.rail,
        isPobo: rail.isPobo,
        score: Math.max(0, score),
        balanceSufficient,
        availableTomorrow: rail.speedRank <= 2,
        flaggedReasons: railFlags,
        isFlowTargetAssignment,
      });
    }
  }

  // Sort by score descending
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}

/* ── Batch score all pending transactions ────────────────── */

/**
 * Score and allocate transactions oldest-first by collectedAtDate.
 * Balance is a hard constraint: each allocation deducts from remaining balance
 * so subsequent transactions see what's actually left.
 */
export function scoreAllTransactions(
  pendingTransactions: Transaction[],
  ctx: RoutingContext,
  heldTransactionIds?: Set<string>
): Map<string, RoutingSuggestion[]> {
  // Sort oldest collected first
  const sorted = [...pendingTransactions].sort((a, b) => {
    const da = a.collectedAtDate ? new Date(a.collectedAtDate).getTime() : Infinity;
    const db = b.collectedAtDate ? new Date(b.collectedAtDate).getTime() : Infinity;
    return da - db;
  });

  // Track remaining balances (mutable copy)
  const remainingBalances = new Map<string, number>();
  for (const b of ctx.balances) {
    const key = `${normalize(b.provider)}|${normalize(b.currency)}`;
    remainingBalances.set(key, (remainingBalances.get(key) ?? 0) + b.currentBalance);
  }

  const results = new Map<string, RoutingSuggestion[]>();

  for (const tx of sorted) {
    // Held transactions: skip scoring/allocation, return empty suggestions
    if (heldTransactionIds?.has(tx.transactionId)) {
      results.set(tx.transactionId, []);
      continue;
    }

    // Score with a context that uses remaining balances
    const ctxWithRemaining: RoutingContext = {
      ...ctx,
      balances: balancesFromRemaining(remainingBalances),
    };
    const suggestions = scoreTransaction(tx, ctxWithRemaining);
    results.set(tx.transactionId, suggestions);

    // Deduct from remaining balance for the top eligible suggestion
    // Blocked transactions are scored but must not consume balance
    const top = suggestions.find((s) => s.score > 0 && s.balanceSufficient);
    if (top && !tx.hasBlockingIssue) {
      const key = `${normalize(top.provider)}|${normalize(tx.receiverCurrency)}`;
      const cur = remainingBalances.get(key) ?? 0;
      remainingBalances.set(key, cur - tx.receiverAmount);
    }
  }

  return results;
}

/** Convert the remaining-balance map back into Balance[] for scoring */
function balancesFromRemaining(remaining: Map<string, number>): Balance[] {
  return Array.from(remaining.entries()).map(([key, amount]) => {
    const [provider, currency] = key.split("|");
    return {
      accountId: `synth-${key}`,
      accountName: provider,
      accountCountry: "",
      provider,
      currency,
      currentBalance: amount,
      lastBalanceAt: "",
    };
  });
}
