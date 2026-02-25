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
  useProviderManual,
} from "@/hooks/useSheetData";
import { useScoringWeightsMap } from "@/hooks/useScoringWeights";
import {
  scoreAllTransactions,
  getProviderFlowPcts,
  type RoutingContext,
  type ScoringWeights,
  DEFAULT_WEIGHTS,
} from "@/lib/routingEngine";
import { computeFundMovements } from "@/lib/fundMovements";
import type { RoutingSuggestion } from "@/types";

export function useRoutingEngine() {
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
  const providerManual = useProviderManual();
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
    providerManual.isLoading ||
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
    receiverMatrix.error ||
    providerManual.error;

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
      balance_weight: weightsMap.get("balance_weight") ?? DEFAULT_WEIGHTS.balance_weight,
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
      providerManual: providerManual.data ?? [],
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
    providerManual.data,
    weightsMap,
    pendingPayouts,
  ]);

  /** Provider flow target progress */
  const flowTargetProgress = useMemo(() => {
    if (!flowTargets.data || !allTx.data) return [];
    return getProviderFlowPcts(flowTargets.data, allTx.data);
  }, [flowTargets.data, allTx.data]);

  /** Set of provider IDs from currencies matrix (uppercase) */
  const routingProviders = useMemo(() => {
    if (!currencies.data) return new Set<string>();
    return new Set(currencies.data.map((cr) => cr.provider.toUpperCase()));
  }, [currencies.data]);

  /** Fund movement recommendations */
  const fundMovements = useMemo(() => {
    if (!balances.data || !currencies.data || pendingPayouts.length === 0) return [];
    return computeFundMovements(pendingPayouts, results, balances.data, currencies.data);
  }, [pendingPayouts, results, balances.data, currencies.data]);

  return {
    pendingPayouts,
    suggestions: results,
    balances: balances.data ?? [],
    routingProviders,
    flowTargetProgress,
    fundMovements,
    isLoading,
    error,
  };
}
