/**
 * Routing Rules — determines whether a pending_payout transaction
 * is due for payout today based on source country, USD amount, and
 * the required hold period (payout_days) after collection.
 */

import type { Transaction, RoutingRule } from "@/types";

/**
 * Find the matching routing rule for a transaction.
 * Rules are matched by sender country and USD amount band.
 * Returns the first match (most specific).
 */
export function findMatchingRule(
  tx: Transaction,
  rules: RoutingRule[]
): RoutingRule | null {
  const country = tx.senderCountry.trim().toUpperCase();
  const amount = tx.usdValue;

  for (const rule of rules) {
    const ruleCountry = rule.sourceCountryCode.trim().toUpperCase();
    if (ruleCountry !== country) continue;
    if (amount < rule.amountUsdMin) continue;
    if (rule.amountUsdMax !== null && amount > rule.amountUsdMax) continue;
    return rule;
  }
  return null;
}

/**
 * Check if a transaction is due for payout today.
 * If no rule matches, the transaction is routed immediately.
 * If a rule matches, collectedAtDate + payoutDays must be <= today.
 */
export function isTransactionDueForPayout(
  tx: Transaction,
  rules: RoutingRule[]
): boolean {
  const rule = findMatchingRule(tx, rules);
  if (!rule) return true; // no matching rule → route immediately

  if (rule.payoutDays <= 0) return true; // 0 days delay → route immediately

  if (!tx.collectedAtDate) return false; // no collection date → can't determine, hold it

  const collectedAt = new Date(tx.collectedAtDate);
  if (isNaN(collectedAt.getTime())) return false;

  const dueDate = new Date(collectedAt);
  dueDate.setDate(dueDate.getDate() + rule.payoutDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate <= today;
}

/**
 * Get the due date for a transaction based on routing rules.
 * Returns null if no rule matches or no collection date.
 */
export function getTransactionDueDate(
  tx: Transaction,
  rules: RoutingRule[]
): Date | null {
  const rule = findMatchingRule(tx, rules);
  if (!rule || rule.payoutDays <= 0 || !tx.collectedAtDate) return null;

  const collectedAt = new Date(tx.collectedAtDate);
  if (isNaN(collectedAt.getTime())) return null;

  const dueDate = new Date(collectedAt);
  dueDate.setDate(dueDate.getDate() + rule.payoutDays);
  return dueDate;
}
