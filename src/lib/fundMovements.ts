// ── PATCH for useSheetData.ts ─────────────────────────────
// Only the useTransactions transform needs updating.
// Add these two lines inside the raw.map((r) => ({ ... })) object:
//
//   pendingApprovalAtDate: strOrNull(r.pending_approval_at_date ?? r.pending_approval_date),
//   approvedAtDate: strOrNull(r.approved_at ?? r.approved_at_date),
//
// And update the statusFilter to allow draft/pending_approval through:
// Remove the statusFilter parameter restriction — all statuses are now needed
// for the liquidity forecast. The existing filter still works for specific
// status queries (usePendingPayouts etc) but useTransactions() with no
// argument must now return ALL statuses including draft and pending_approval.
//
// Full updated useTransactions function:

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
      // NEW: lifecycle timestamp fields for liquidity forecast cohort aging
      pendingApprovalAtDate: strOrNull(r.pending_approval_at_date ?? r.pending_approval_date),
      approvedAtDate: strOrNull(r.approved_at),
      collectedAtDate: strOrNull(r.collected_at_date),
      paymentInitiatedAtDate: strOrNull(r.payment_initiated_at_date),
      paymentSentAtDate: strOrNull(r.payment_sent_at_date),
      hasBlockingIssue: parseBool(r.has_blocking_issue),
    }));
    if (statusFilter) return all.filter((t) => t.status === statusFilter);
    return all;
  });
}
