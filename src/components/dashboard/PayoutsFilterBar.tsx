import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { Transaction, RoutingSuggestion } from "@/types";

export interface PayoutsFilters {
  search: string;
  currency: string;
  status: string;
  provider: string;
}

interface Props {
  transactions: Transaction[];
  suggestions: Map<string, RoutingSuggestion[]>;
  filters: PayoutsFilters;
  onChange: (filters: PayoutsFilters) => void;
}

function getStatus(tx: Transaction, sugs: RoutingSuggestion[]): string {
  if (tx.hasBlockingIssue) return "Blocked";
  const hasScoring = sugs.some((s) => s.score > 0);
  if (!hasScoring || sugs.length === 0) return "Unroutable";
  if (sugs.some((s) => s.score > 0 && s.balanceSufficient)) return "Ready";
  return "Insuf. balance";
}

export function getRecommendedProvider(sugs: RoutingSuggestion[]): string | null {
  const top = sugs.find((s) => s.score > 0);
  return top?.provider ?? null;
}

export function applyPayoutsFilters(
  transactions: Transaction[],
  suggestions: Map<string, RoutingSuggestion[]>,
  filters: PayoutsFilters,
): Transaction[] {
  return transactions.filter((tx) => {
    const sugs = suggestions.get(tx.transactionId) ?? [];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        tx.senderName.toLowerCase().includes(q) ||
        tx.receiverName.toLowerCase().includes(q) ||
        (tx.reference ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filters.currency && filters.currency !== "__all") {
      if (tx.receiverCurrency.toUpperCase() !== filters.currency) return false;
    }

    if (filters.status && filters.status !== "__all") {
      if (getStatus(tx, sugs) !== filters.status) return false;
    }

    if (filters.provider && filters.provider !== "__all") {
      const rec = getRecommendedProvider(sugs);
      if (rec !== filters.provider) return false;
    }

    return true;
  });
}

export function PayoutsFilterBar({ transactions, suggestions, filters, onChange }: Props) {
  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) set.add(tx.receiverCurrency.toUpperCase());
    return [...set].sort();
  }, [transactions]);

  const providers = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      const rec = getRecommendedProvider(suggestions.get(tx.transactionId) ?? []);
      if (rec) set.add(rec);
    }
    return [...set].sort();
  }, [transactions, suggestions]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search sender, beneficiary, ref…"
          className="h-8 text-xs pl-8 w-[220px]"
        />
      </div>

      <Select value={filters.currency || "__all"} onValueChange={(v) => onChange({ ...filters, currency: v })}>
        <SelectTrigger className="h-8 text-xs w-[130px]">
          <SelectValue placeholder="All currencies" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">All currencies</SelectItem>
          {currencies.map((c) => (
            <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status || "__all"} onValueChange={(v) => onChange({ ...filters, status: v })}>
        <SelectTrigger className="h-8 text-xs w-[140px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">All statuses</SelectItem>
          <SelectItem value="Ready" className="text-xs">Ready</SelectItem>
          <SelectItem value="Insuf. balance" className="text-xs">Insuf. balance</SelectItem>
          <SelectItem value="Unroutable" className="text-xs">Unroutable</SelectItem>
          <SelectItem value="Blocked" className="text-xs">Blocked</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.provider || "__all"} onValueChange={(v) => onChange({ ...filters, provider: v })}>
        <SelectTrigger className="h-8 text-xs w-[130px]">
          <SelectValue placeholder="All providers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all" className="text-xs">All providers</SelectItem>
          {providers.map((p) => (
            <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
