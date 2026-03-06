/**
 * Fund Movement Recommendations
 *
 * Identifies opportunities to move funds from non-POBO providers (surplus)
 * to POBO providers (shortfall) to maximize POBO payments.
 * Respects provider funding cutoff times.
 */

import type {
  Transaction,
  Balance,
  CurrencyRail,
  RoutingSuggestion,
} from "@/types";

export interface FundMovement {
  currency: string;
  amount: number;
  fromProvider: string;
  toProvider: string;
  txCount: number;
  fundingCutoffUtc: string | null;
  /** Minutes until the funding cutoff (null if no cutoff). Negative values are filtered out. */
  minutesUntilCutoff: number | null;
  reason: string;
}

function normalize(s: string): string {
  return s.trim().toUpperCase();
}

/**
 * Parse a HH:MM or HH:MM:SS cutoff string and return minutes until that time today (UTC).
 * Returns null if the string is unparseable.
 */
function minutesUntilCutoffToday(cutoffUtc: string): number | null {
  const parts = cutoffUtc.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;

  const now = new Date();
  const cutoffMs = Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0
  );
  return (cutoffMs - now.getTime()) / 60_000;
}

export function computeFundMovements(
  pendingPayouts: Transaction[],
  suggestions: Map<string, RoutingSuggestion[]>,
  balances: Balance[],
  currencyRails: CurrencyRail[]
): FundMovement[] {
  // Build balance map: PROVIDER|CURRENCY → balance
  const balanceMap = new Map<string, number>();
  for (const b of balances) {
    const key = `${normalize(b.provider)}|${normalize(b.currency)}`;
    balanceMap.set(key, (balanceMap.get(key) ?? 0) + b.currentBalance);
  }

  // Build allocated map from top suggestions
  const allocatedMap = new Map<string, number>();
  for (const tx of pendingPayouts) {
    const sugs = suggestions.get(tx.transactionId) ?? [];
    const top = sugs.find((s) => s.score > 0);
    if (top) {
      const key = `${normalize(top.provider)}|${normalize(tx.receiverCurrency)}`;
      allocatedMap.set(key, (allocatedMap.get(key) ?? 0) + tx.receiverAmount);
    }
  }

  // Find POBO rails by provider+currency
  const poboRails = new Map<string, CurrencyRail>();
  for (const cr of currencyRails) {
    if (cr.isPobo) {
      const key = `${normalize(cr.provider)}|${normalize(cr.currency)}`;
      if (!poboRails.has(key) || cr.speedRank < poboRails.get(key)!.speedRank) {
        poboRails.set(key, cr);
      }
    }
  }

  const currencySet = new Set<string>();
  for (const tx of pendingPayouts) {
    currencySet.add(normalize(tx.receiverCurrency));
  }

  const movements: FundMovement[] = [];
  const allowedCurrencies = new Set(["EUR", "USD"]);

  for (const currency of currencySet) {
    if (!allowedCurrencies.has(currency)) continue;
    const poboShortfalls: { provider: string; shortfall: number; rail: CurrencyRail; txCount: number }[] = [];

    for (const [key, rail] of poboRails) {
      if (!key.endsWith(`|${currency}`)) continue;
      const provider = key.split("|")[0];
      const balance = balanceMap.get(key) ?? 0;
      const allocated = allocatedMap.get(key) ?? 0;
      const remaining = balance - allocated;

      let unlockedTxCount = 0;
      let additionalNeeded = 0;

      for (const tx of pendingPayouts) {
        if (normalize(tx.receiverCurrency) !== currency) continue;
        const sugs = suggestions.get(tx.transactionId) ?? [];
        const top = sugs.find((s) => s.score > 0);
        if (top && normalize(top.provider) !== provider) {
          const poboSug = sugs.find(
            (s) => normalize(s.provider) === provider && s.isPobo && s.score > 0
          );
          const poboDisqualified = sugs.find(
            (s) => normalize(s.provider) === provider && s.isPobo && !s.balanceSufficient
          );
          if (poboSug || poboDisqualified) {
            unlockedTxCount++;
            additionalNeeded += tx.receiverAmount;
          }
        }
      }

      if (additionalNeeded > 0) {
        const shortfall = Math.max(0, additionalNeeded - Math.max(0, remaining));
        if (shortfall > 0) {
          poboShortfalls.push({ provider, shortfall, rail, txCount: unlockedTxCount });
        }
      }
    }

    if (poboShortfalls.length === 0) continue;

    const nonPoboSurplus: { provider: string; surplus: number }[] = [];
    const allProviders = new Set<string>();
    for (const [key] of balanceMap) {
      if (key.endsWith(`|${currency}`)) allProviders.add(key.split("|")[0]);
    }

    for (const provider of allProviders) {
      const key = `${provider}|${currency}`;
      if (poboRails.has(key)) continue;
      const balance = balanceMap.get(key) ?? 0;
      const allocated = allocatedMap.get(key) ?? 0;
      const surplus = balance - allocated;
      if (surplus > 0) {
        nonPoboSurplus.push({ provider, surplus });
      }
    }

    nonPoboSurplus.sort((a, b) => b.surplus - a.surplus);

    for (const shortfall of poboShortfalls) {
      let rem = shortfall.shortfall;
      for (const source of nonPoboSurplus) {
        if (rem <= 0 || source.surplus <= 0) break;
        const moveAmount = Math.min(rem, source.surplus);

        const cutoff = shortfall.rail.fundingCutoffUtc;
        const minsLeft = cutoff ? minutesUntilCutoffToday(cutoff) : null;

        // Skip if cutoff has already passed today
        if (minsLeft !== null && minsLeft <= 0) {
          continue;
        }

        movements.push({
          currency,
          amount: moveAmount,
          fromProvider: source.provider,
          toProvider: shortfall.provider,
          txCount: shortfall.txCount,
          fundingCutoffUtc: cutoff,
          minutesUntilCutoff: minsLeft,
          reason: `Move to enable ${shortfall.txCount} POBO payment${shortfall.txCount > 1 ? "s" : ""}`,
        });

        rem -= moveAmount;
        source.surplus -= moveAmount;
      }
    }
  }

  // Sort by urgency: soonest cutoff first, then no-cutoff by amount desc
  movements.sort((a, b) => {
    const aHasCutoff = a.minutesUntilCutoff !== null;
    const bHasCutoff = b.minutesUntilCutoff !== null;
    if (aHasCutoff && bHasCutoff) return a.minutesUntilCutoff! - b.minutesUntilCutoff!;
    if (aHasCutoff && !bHasCutoff) return -1;
    if (!aHasCutoff && bHasCutoff) return 1;
    return b.amount - a.amount;
  });

  return movements;
}
