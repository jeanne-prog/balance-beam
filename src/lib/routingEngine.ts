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
 *  - Balance sufficiency (provider has enough balance in that currency)
 *  - Flow target alignment (prefer providers that are under their target %)
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
} from "@/types";

/* ── Input data bundle ───────────────────────────────────── */

export interface ScoringWeights {
  speed_rank_multiplier: number;
  balance_sufficient_bonus: number;
  balance_insufficient_penalty: number;
  flow_target_under_bonus: number;
  flow_target_over_penalty: number;
  pobo_penalty: number;
  manual_penalty: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  speed_rank_multiplier: 10,
  balance_sufficient_bonus: 20,
  balance_insufficient_penalty: 30,
  flow_target_under_bonus: 15,
  flow_target_over_penalty: 10,
  pobo_penalty: 25,
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
  weights?: ScoringWeights;
}

/* ── Helpers ──────────────────────────────────────────────── */

const PROVIDERS = ["CORPAY", "EMQ", "GIB", "NEO", "TAZAPAY"] as const;

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

  const w = ctx.weights ?? DEFAULT_WEIGHTS;
  const isLightKyc = lightKycSet.has(normalize(tx.senderName));
  const flowDist = computeFlowDistribution(ctx.allTransactions);
  const totalRouted = Array.from(flowDist.values()).reduce((a, b) => a + b, 0);

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
      // Still include with score 0 so the UI can show why
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

    // ── Score each rail for this provider ──
    for (const rail of rails) {
      let score = 100;
      const railFlags: string[] = [];

      // Speed rank: lower is better. Uses dynamic multiplier.
      const speedBonus = Math.max(0, 40 - rail.speedRank * w.speed_rank_multiplier);
      score += speedBonus;

      // POBO penalty
      if (rail.isPobo) {
        score -= w.pobo_penalty;
        if (w.pobo_penalty > 0) {
          railFlags.push("POBO rail");
        }
      }

      // Balance check
      const balance = getProviderBalance(
        ctx.balances,
        providerKey,
        tx.receiverCurrency
      );
      const balanceSufficient = balance >= tx.receiverAmount;
      if (balanceSufficient) {
        score += w.balance_sufficient_bonus;
      } else {
        score -= w.balance_insufficient_penalty;
        railFlags.push(
          `Insufficient balance (${balance.toLocaleString()} vs ${tx.receiverAmount.toLocaleString()})`
        );
      }

      // Flow target alignment
      const targets = ctx.flowTargets.filter(
        (ft) =>
          normalize(ft.provider) === providerKey &&
          normalize(ft.currency) === normalize(tx.receiverCurrency)
      );
      if (targets.length > 0 && targets[0].targetPct != null && totalRouted > 0) {
        const currentPct =
          ((flowDist.get(providerKey) ?? 0) / totalRouted) * 100;
        const targetPct = targets[0].targetPct;
        if (currentPct < targetPct) {
          score += w.flow_target_under_bonus;
        } else if (currentPct > targetPct * 1.5) {
          score -= w.flow_target_over_penalty;
          railFlags.push(`Over flow target (${currentPct.toFixed(1)}% vs ${targetPct}%)`);
        }
      }

      suggestions.push({
        provider: providerKey,
        rail: rail.rail,
        isPobo: rail.isPobo,
        score: Math.max(0, score),
        balanceSufficient,
        availableTomorrow: rail.speedRank <= 2,
        flaggedReasons: railFlags,
      });
    }
  }

  // Sort by score descending
  suggestions.sort((a, b) => b.score - a.score);
  return suggestions;
}

/* ── Batch score all pending transactions ────────────────── */

export function scoreAllTransactions(
  pendingTransactions: Transaction[],
  ctx: RoutingContext
): Map<string, RoutingSuggestion[]> {
  const results = new Map<string, RoutingSuggestion[]>();
  for (const tx of pendingTransactions) {
    results.set(tx.transactionId, scoreTransaction(tx, ctx));
  }
  return results;
}
