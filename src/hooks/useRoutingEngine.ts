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
  useRoutingRules,
  useCohortRates,
  useSepaCountries,
} from "@/hooks/useSheetData";
import { useScoringWeightsMap } from "@/hooks/useScoringWeights";
import {
  scoreAllTransactions,
  getProviderFlowPcts,
  type RoutingContext,
  type ScoringWeights,
  DEFAULT_WEIGHTS,
} from "@/lib/routingEngine";
import { computeLiquidityForecast, parseCohortRates } from "@/lib/fundMovements";
import { isTransactionDueForPayout } from "@/lib/routingRules";
import type { RoutingSuggestion, RoutingRule } from "@/types";
import type { LiquidityForecast } from "@/lib/fundMovements";

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
    routingRules.isLoading ||
    cohortRatesQuery.isLoading ||
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
    cohortRatesQuery.error;

  /** All pending_payout transactions (before routing rules filter) */
  const allPendingPayouts = useMemo(
    () => (allTx.data ?? []).filter((t) => t.status === "pending_payout"),
    [allTx.data]
  );

  /** Only transactions that are due for payout today per routing rules (or manually released) */
  const pendingPayouts = useMemo(() => {
    const rules = routingRules.data ?? [];
    if (rules.length === 0) return allPendingPayouts;
    return allPendingPayouts.filter(
      (tx) => isTransactionDueForPayout(tx, rules) || releasedIds.has(tx.transactionId)
    );
  }, [allPendingPayouts, routingRules.data, releasedIds]);

  /** Transactions held back by routing rules (not yet due and not released) */
  const heldBackPayouts = useMemo(() => {
    const rules = routingRules.data ?? [];
    if (rules.length === 0) return [];
    return allPendingPayouts.filter(
      (tx) => !isTransactionDueForPayout(tx, rules) && !releasedIds.has(tx.transactionId)
    );
  }, [allPendingPayouts, routingRules.data, releasedIds]);

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
    weightsMap,
    pendingPayouts,
    operatorHeldIds,
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

  /** Parsed cohort rates */
  const cohortRates = useMemo(() => {
    if (!cohortRatesQuery.data) return null;
    return parseCohortRates(cohortRatesQuery.data);
  }, [cohortRatesQuery.data]);

  /** Liquidity forecast */
  const liquidityForecast = useMemo<LiquidityForecast[]>(() => {
    if (!allTx.data || !balances.data || !currencies.data || !cohortRates) return [];
    return computeLiquidityForecast(
      allTx.data,
      balances.data,
      currencies.data,
      routingRules.data ?? [],
      results,
      cohortRates,
    );
  }, [allTx.data, balances.data, currencies.data, routingRules.data, results, cohortRates]);

  return {
    pendingPayouts,
    heldBackPayouts,
    allPendingPayouts,
    suggestions: results,
    balances: balances.data ?? [],
    routingProviders,
    flowTargetProgress,
    liquidityForecast,
    routingRules: routingRules.data ?? [],
    isLoading,
    error,
  };
}
