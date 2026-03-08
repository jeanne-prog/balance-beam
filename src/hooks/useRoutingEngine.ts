import { useMemo, useState, useCallback } from "react";
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
  useRoutingRules,
  useCohortRates,
  useSepaCountries,
  useInternalTransfers,
} from "@/hooks/useSheetData";
import { useScoringWeightsMap } from "@/hooks/useScoringWeights";
import {
  scoreAllTransactions,
  getProviderFlowPcts,
  type RoutingContext,
  type ScoringWeights,
  DEFAULT_WEIGHTS,
} from "@/lib/routingEngine";
import {
  computeLiquidityForecast,
  parseCohortRates,
  computeEffectiveBalances,
  computeIncomingTransfers,
} from "@/lib/fundMovements";
import { isTransactionDueForPayout } from "@/lib/routingRules";
import type { RoutingSuggestion, RoutingRule } from "@/types";
import type { LiquidityForecast, IncomingTransferSummary } from "@/lib/fundMovements";
import { usePlannedTransfers } from "@/contexts/PlannedTransfersContext";

export function useRoutingEngine(releasedIds: Set<string> = new Set(), operatorHeldIds: Set<string> = new Set()) {
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
  const routingRules = useRoutingRules();
  const cohortRatesQuery = useCohortRates();
  const sepaCountriesQuery = useSepaCountries();
  const internalTransfersQuery = useInternalTransfers();
  const { weightsMap, isLoading: weightsLoading } = useScoringWeightsMap();

  // Planned transfers — shared via context (persists across tab navigation)
  const { plannedTransfers, addPlannedTransfer, removePlannedTransfer } = usePlannedTransfers();

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
    routingRules.isLoading ||
    cohortRatesQuery.isLoading ||
    sepaCountriesQuery.isLoading ||
    internalTransfersQuery.isLoading ||
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
    providerManual.error ||
    routingRules.error ||
    cohortRatesQuery.error ||
    internalTransfersQuery.error;

  const allPendingPayouts = useMemo(
    () => (allTx.data ?? []).filter((t) => t.status === "pending_payout"),
    [allTx.data]
  );

  const pendingPayouts = useMemo(() => {
    const rules = routingRules.data ?? [];
    if (rules.length === 0) return allPendingPayouts;
    return allPendingPayouts.filter(
      (tx) => isTransactionDueForPayout(tx, rules) || releasedIds.has(tx.transactionId)
    );
  }, [allPendingPayouts, routingRules.data, releasedIds]);

  const heldBackPayouts = useMemo(() => {
    const rules = routingRules.data ?? [];
    if (rules.length === 0) return [];
    return allPendingPayouts.filter(
      (tx) => !isTransactionDueForPayout(tx, rules) && !releasedIds.has(tx.transactionId)
    );
  }, [allPendingPayouts, routingRules.data, releasedIds]);

  // Effective balances (actual + planned + in-flight)
  const inFlightTransfers = internalTransfersQuery.data ?? [];

  const effectiveBalances = useMemo(() => {
    if (!balances.data) return [];
    return computeEffectiveBalances(balances.data, plannedTransfers, inFlightTransfers);
  }, [balances.data, plannedTransfers, inFlightTransfers]);

  const incomingTransfers = useMemo<IncomingTransferSummary>(() => {
    return computeIncomingTransfers(plannedTransfers, inFlightTransfers);
  }, [plannedTransfers, inFlightTransfers]);

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

    const sepaSet = new Set((sepaCountriesQuery.data ?? []).map((s) => s.countryCode));

    const ctx: RoutingContext = {
      currencyRails: currencies.data,
      senderCountryMatrix: senderMatrix.data,
      receiverCountryMatrix: receiverMatrix.data,
      benesBanned: benesBanned.data,
      sendersBanned: sendersBanned.data,
      swiftCodesBanned: swiftBanned.data,
      lightKycSenders: lightKyc.data,
      flowTargets: flowTargets.data,
      balances: effectiveBalances,
      allTransactions: allTx.data,
      providerManual: providerManual.data ?? [],
      sepaCountries: sepaSet,
      weights,
    };

    return scoreAllTransactions(pendingPayouts, ctx, operatorHeldIds);
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
    sepaCountriesQuery.data,
    weightsMap,
    pendingPayouts,
    operatorHeldIds,
    effectiveBalances,
  ]);

  const flowTargetProgress = useMemo(() => {
    if (!flowTargets.data || !allTx.data) return [];
    return getProviderFlowPcts(flowTargets.data, allTx.data);
  }, [flowTargets.data, allTx.data]);

  const routingProviders = useMemo(() => {
    if (!currencies.data) return new Set<string>();
    return new Set(currencies.data.map((cr) => (cr.provider ?? "").toUpperCase()).filter(Boolean));
  }, [currencies.data]);

  const cohortRates = useMemo(() => {
    if (!cohortRatesQuery.data) return null;
    return parseCohortRates(cohortRatesQuery.data);
  }, [cohortRatesQuery.data]);

  const liquidityForecast = useMemo<LiquidityForecast[]>(() => {
    if (!allTx.data || !balances.data || !currencies.data || !cohortRates) return [];
    return computeLiquidityForecast(
      allTx.data,
      effectiveBalances,
      currencies.data,
      routingRules.data ?? [],
      results,
      cohortRates,
    );
  }, [allTx.data, balances.data, currencies.data, routingRules.data, results, cohortRates, effectiveBalances]);

  return {
    pendingPayouts,
    heldBackPayouts,
    allPendingPayouts,
    suggestions: results,
    balances: balances.data ?? [],
    effectiveBalances,
    incomingTransfers,
    routingProviders,
    flowTargetProgress,
    liquidityForecast,
    routingRules: routingRules.data ?? [],
    plannedTransfers,
    addPlannedTransfer,
    removePlannedTransfer,
    isLoading,
    error,
  };
}
