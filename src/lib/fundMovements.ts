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
  /** Currency to move */
  currency: string;
  /** Amount to transfer */
  amount: number;
  /** Source provider (non-POBO, has surplus) */
  fromProvider: string;
  /** Destination provider (POBO, has shortfall) */
  toProvider: string;
  /** Number of transactions this would unlock for POBO */
  txCount: number;
  /** Funding cutoff time (UTC) at the destination provider, if known */
  fundingCutoffUtc: string | null;
  /** Human-readable reason */
  reason: string;
}

function normalize(s: string): string {
  return s.trim().toUpperCase();
}

/**
 * Compute recommended fund movements to maximize POBO payments.
 *
 * Strategy:
 * 1. Look at all pending transactions and their routing suggestions
 * 2. Find transactions where the top suggestion is non-POBO but a POBO rail exists
 *    at another provider (just lacking balance)
 * 3. Check if the non-POBO provider has surplus funds in that currency
 * 4. Recommend moving the shortfall amount
 */
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

  // Build allocated map from top suggestions (what the engine currently assigns)
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
      // Keep the fastest POBO rail
      if (!poboRails.has(key) || cr.speedRank < poboRails.get(key)!.speedRank) {
        poboRails.set(key, cr);
      }
    }
  }

  // Group: for each currency, find POBO providers that are short and non-POBO providers with surplus
  const currencySet = new Set<string>();
  for (const tx of pendingPayouts) {
    currencySet.add(normalize(tx.receiverCurrency));
  }

  const movements: FundMovement[] = [];
  const allowedCurrencies = new Set(["EUR", "USD"]);

  for (const currency of currencySet) {
    if (!allowedCurrencies.has(currency)) continue;
    // Find POBO providers for this currency with their shortfall
    const poboShortfalls: { provider: string; shortfall: number; rail: CurrencyRail; txCount: number }[] = [];

    for (const [key, rail] of poboRails) {
      if (!key.endsWith(`|${currency}`)) continue;
      const provider = key.split("|")[0];
      const balance = balanceMap.get(key) ?? 0;
      const allocated = allocatedMap.get(key) ?? 0;
      const remaining = balance - allocated;

      // Count how many pending txs could use this POBO provider but can't due to balance
      let unlockedTxCount = 0;
      let additionalNeeded = 0;

      for (const tx of pendingPayouts) {
        if (normalize(tx.receiverCurrency) !== currency) continue;
        const sugs = suggestions.get(tx.transactionId) ?? [];
        const top = sugs.find((s) => s.score > 0);
        // Transaction is currently NOT routed to this POBO provider
        if (top && normalize(top.provider) !== provider) {
          // But this POBO provider appears in suggestions (just not top, likely due to balance)
          const poboSug = sugs.find(
            (s) => normalize(s.provider) === provider && s.isPobo && s.score > 0
          );
          // Or it was disqualified only because of balance
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
        // How much more this POBO provider needs
        const shortfall = Math.max(0, additionalNeeded - Math.max(0, remaining));
        if (shortfall > 0) {
          poboShortfalls.push({ provider, shortfall, rail, txCount: unlockedTxCount });
        }
      }
    }

    if (poboShortfalls.length === 0) continue;

    // Find non-POBO providers with surplus in this currency
    const nonPoboSurplus: { provider: string; surplus: number }[] = [];
    const allProviders = new Set<string>();
    for (const [key] of balanceMap) {
      if (key.endsWith(`|${currency}`)) allProviders.add(key.split("|")[0]);
    }

    for (const provider of allProviders) {
      const key = `${provider}|${currency}`;
      // Skip if this provider has POBO rails for this currency
      if (poboRails.has(key)) continue;
      const balance = balanceMap.get(key) ?? 0;
      const allocated = allocatedMap.get(key) ?? 0;
      const surplus = balance - allocated;
      if (surplus > 0) {
        nonPoboSurplus.push({ provider, surplus });
      }
    }

    // Match shortfalls with surpluses
    // Sort surpluses largest first
    nonPoboSurplus.sort((a, b) => b.surplus - a.surplus);

    for (const shortfall of poboShortfalls) {
      let remaining = shortfall.shortfall;
      for (const source of nonPoboSurplus) {
        if (remaining <= 0 || source.surplus <= 0) break;
        const moveAmount = Math.min(remaining, source.surplus);

        movements.push({
          currency,
          amount: moveAmount,
          fromProvider: source.provider,
          toProvider: shortfall.provider,
          txCount: shortfall.txCount,
          fundingCutoffUtc: shortfall.rail.fundingCutoffUtc,
          reason: `Move to enable ${shortfall.txCount} POBO payment${shortfall.txCount > 1 ? "s" : ""}`,
        });

        remaining -= moveAmount;
        source.surplus -= moveAmount;
      }
    }
  }

  // Sort by amount descending
  movements.sort((a, b) => b.amount - a.amount);
  return movements;
}
