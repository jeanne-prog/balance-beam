import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PipelineFilters {
  search: string;
  country: string;
  currency: string;
  blocking: string;
}

interface Props {
  filters: PipelineFilters;
  onChange: (filters: PipelineFilters) => void;
  countries: string[];
  currencies: string[];
}

const EMPTY = "__all__";

export function PipelineFiltersBar({ filters, onChange, countries, currencies }: Props) {
  const set = (patch: Partial<PipelineFilters>) => onChange({ ...filters, ...patch });

  const activeCount = [
    filters.search,
    filters.country !== EMPTY && filters.country,
    filters.currency !== EMPTY && filters.currency,
    filters.blocking !== EMPTY && filters.blocking,
  ].filter(Boolean).length;

  const clear = () =>
    onChange({ search: "", country: EMPTY, currency: EMPTY, blocking: EMPTY });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sender, beneficiary, reference…"
          className="pl-9 h-9"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      </div>

      <Select value={filters.country} onValueChange={(v) => set({ country: v })}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY}>All countries</SelectItem>
          {countries.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.currency} onValueChange={(v) => set({ currency: v })}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Currency" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY}>All currencies</SelectItem>
          {currencies.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.blocking} onValueChange={(v) => set({ blocking: v })}>
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Issues" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY}>All issues</SelectItem>
          <SelectItem value="blocked">Blocked only</SelectItem>
          <SelectItem value="clear">No issues</SelectItem>
        </SelectContent>
      </Select>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-9 gap-1 text-xs">
          <X className="h-3 w-3" />
          Clear
          <Badge variant="secondary" className="ml-1 text-xs px-1.5">
            {activeCount}
          </Badge>
        </Button>
      )}
    </div>
  );
}
