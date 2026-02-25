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
import { useScoringWeightsMap } from "@/hooks/useScoringWeights";
import {
  scoreAllTransactions,
  type RoutingContext,
  type ScoringWeights,
  DEFAULT_WEIGHTS,
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
  const { weightsMap, isLoading: weightsLoading } = useScoringWeightsMap();

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
    receiverMatrix.isLoading ||
    weightsLoading;

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

    const weights: ScoringWeights = {
      speed_rank_multiplier: weightsMap.get("speed_rank_multiplier") ?? DEFAULT_WEIGHTS.speed_rank_multiplier,
      balance_sufficient_bonus: weightsMap.get("balance_sufficient_bonus") ?? DEFAULT_WEIGHTS.balance_sufficient_bonus,
      balance_insufficient_penalty: weightsMap.get("balance_insufficient_penalty") ?? DEFAULT_WEIGHTS.balance_insufficient_penalty,
      flow_target_under_bonus: weightsMap.get("flow_target_under_bonus") ?? DEFAULT_WEIGHTS.flow_target_under_bonus,
      flow_target_over_penalty: weightsMap.get("flow_target_over_penalty") ?? DEFAULT_WEIGHTS.flow_target_over_penalty,
      pobo_bonus: weightsMap.get("pobo_bonus") ?? DEFAULT_WEIGHTS.pobo_bonus,
      manual_penalty: weightsMap.get("manual_penalty") ?? DEFAULT_WEIGHTS.manual_penalty,
    };

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
      weights,
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
    weightsMap,
    pendingPayouts,
  ]);

  /** Set of provider IDs from currencies matrix (uppercase) */
  const routingProviders = useMemo(() => {
    if (!currencies.data) return new Set<string>();
    return new Set(currencies.data.map((cr) => cr.provider.toUpperCase()));
  }, [currencies.data]);

  return {
    /** Transactions with status=pending_payout */
    pendingPayouts,
    /** Map of transactionId → ranked RoutingSuggestion[] */
    suggestions: results,
    /** Provider account balances */
    balances: balances.data ?? [],
    /** Providers from currencies matrix */
    routingProviders,
    isLoading,
    error,
  };
}
