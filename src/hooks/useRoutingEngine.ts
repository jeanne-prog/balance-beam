import { useMemo } from "react";
import {
  useTransactions,
  useBalances,
  useCurrenciesMatrix,
  useBenesBanned,
  useSendersBanned,
  useSwiftCodesBanned,
  useLightKycSenders,
  useFlowTargets,
  useSenderCountryMatrix,
  useReceiverCountryMatrix,
} from "@/hooks/useSheetData";
import {
  scoreAllTransactions,
  type RoutingContext,
} from "@/lib/routingEngine";
import type { Transaction, RoutingSuggestion } from "@/types";

export function useRoutingEngine() {
  // Fetch all required data in parallel
  const allTx = useTransactions();
  const balances = useBalances();
  const currencies = useCurrenciesMatrix();
  const benesBanned = useBenesBanned();
  const sendersBanned = useSendersBanned();
  const swiftBanned = useSwiftCodesBanned();
  const lightKyc = useLightKycSenders();
  const flowTargets = useFlowTargets();
  const senderMatrix = useSenderCountryMatrix();
  const receiverMatrix = useReceiverCountryMatrix();

  const isLoading =
    allTx.isLoading ||
    balances.isLoading ||
    currencies.isLoading ||
    benesBanned.isLoading ||
    sendersBanned.isLoading ||
    swiftBanned.isLoading ||
    lightKyc.isLoading ||
    flowTargets.isLoading ||
    senderMatrix.isLoading ||
    receiverMatrix.isLoading;

  const error =
    allTx.error ||
    balances.error ||
    currencies.error ||
    benesBanned.error ||
    sendersBanned.error ||
    swiftBanned.error ||
    lightKyc.error ||
    flowTargets.error ||
    senderMatrix.error ||
    receiverMatrix.error;

  const pendingPayouts = useMemo(
    () =>
      (allTx.data ?? []).filter((t) => t.status === "pending_payout"),
    [allTx.data]
  );

  const results = useMemo(() => {
    if (
      isLoading ||
      !allTx.data ||
      !balances.data ||
      !currencies.data ||
      !benesBanned.data ||
      !sendersBanned.data ||
      !swiftBanned.data ||
      !lightKyc.data ||
      !flowTargets.data ||
      !senderMatrix.data ||
      !receiverMatrix.data
    ) {
      return new Map<string, RoutingSuggestion[]>();
    }

    const ctx: RoutingContext = {
      currencyRails: currencies.data,
      senderCountryMatrix: senderMatrix.data,
      receiverCountryMatrix: receiverMatrix.data,
      benesBanned: benesBanned.data,
      sendersBanned: sendersBanned.data,
      swiftCodesBanned: swiftBanned.data,
      lightKycSenders: lightKyc.data,
      flowTargets: flowTargets.data,
      balances: balances.data,
      allTransactions: allTx.data,
    };

    return scoreAllTransactions(pendingPayouts, ctx);
  }, [
    isLoading,
    allTx.data,
    balances.data,
    currencies.data,
    benesBanned.data,
    sendersBanned.data,
    swiftBanned.data,
    lightKyc.data,
    flowTargets.data,
    senderMatrix.data,
    receiverMatrix.data,
    pendingPayouts,
  ]);

  return {
    /** Transactions with status=pending_payout */
    pendingPayouts,
    /** Map of transactionId → ranked RoutingSuggestion[] */
    suggestions: results,
    isLoading,
    error,
  };
}
