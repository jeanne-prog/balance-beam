import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Clock, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { Transaction } from "@/types";

type SortKey = "reference" | "senderName" | "senderCountry" | "receiverName" | "receiverAmount" | "usdValue" | "createdAtDate" | "age" | "hasBlockingIssue";
type SortDir = "asc" | "desc";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(amount);
  } catch { return `${amount.toLocaleString()} ${currency}`; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  } catch { return null; }
}

function SortIcon({ column, active, dir }: { column: string; active: string | null; dir: SortDir }) {
  if (active !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
  return dir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

interface Props {
  transactions: Transaction[];
}

export function PipelineTable({ transactions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("createdAtDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    const copy = [...transactions];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "reference": cmp = (a.reference ?? a.transactionId).localeCompare(b.reference ?? b.transactionId); break;
        case "senderName": cmp = a.senderName.localeCompare(b.senderName); break;
        case "senderCountry": cmp = a.senderCountry.localeCompare(b.senderCountry); break;
        case "receiverName": cmp = a.receiverName.localeCompare(b.receiverName); break;
        case "receiverAmount": cmp = a.receiverAmount - b.receiverAmount; break;
        case "usdValue": cmp = a.usdValue - b.usdValue; break;
        case "createdAtDate": cmp = (a.createdAtDate ?? "").localeCompare(b.createdAtDate ?? ""); break;
        case "age": cmp = (daysSince(a.createdAtDate) ?? -1) - (daysSince(b.createdAtDate) ?? -1); break;
        case "hasBlockingIssue": cmp = Number(a.hasBlockingIssue) - Number(b.hasBlockingIssue); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [transactions, sortKey, sortDir]);

  const headClass = "cursor-pointer select-none hover:text-foreground transition-colors";

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={`w-[120px] ${headClass}`} onClick={() => toggleSort("reference")}>
              <span className="flex items-center">Reference <SortIcon column="reference" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headClass} onClick={() => toggleSort("senderName")}>
              <span className="flex items-center">Sender <SortIcon column="senderName" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headClass} onClick={() => toggleSort("senderCountry")}>
              <span className="flex items-center">Origin <SortIcon column="senderCountry" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headClass} onClick={() => toggleSort("receiverName")}>
              <span className="flex items-center">Beneficiary <SortIcon column="receiverName" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={`text-right ${headClass}`} onClick={() => toggleSort("receiverAmount")}>
              <span className="flex items-center justify-end">Amount <SortIcon column="receiverAmount" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={`text-right ${headClass}`} onClick={() => toggleSort("usdValue")}>
              <span className="flex items-center justify-end">USD Equiv <SortIcon column="usdValue" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headClass} onClick={() => toggleSort("createdAtDate")}>
              <span className="flex items-center">Created <SortIcon column="createdAtDate" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headClass} onClick={() => toggleSort("age")}>
              <span className="flex items-center">Age <SortIcon column="age" active={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headClass} onClick={() => toggleSort("hasBlockingIssue")}>
              <span className="flex items-center">Issues <SortIcon column="hasBlockingIssue" active={sortKey} dir={sortDir} /></span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((tx) => {
            const age = daysSince(tx.createdAtDate);
            const isOld = age !== null && age > 5;
            return (
              <TableRow key={tx.transactionId}>
                <TableCell className="font-mono-numbers text-xs">
                  {tx.reference ?? tx.transactionId.slice(0, 12)}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-sm">{tx.senderName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{tx.senderCountry}</Badge>
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-sm">
                  <div className="flex items-center gap-1">
                    {tx.receiverName}
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground text-xs">{tx.receiverCountry}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono-numbers text-sm">
                  {formatCurrency(tx.receiverAmount, tx.receiverCurrency)}
                </TableCell>
                <TableCell className="text-right font-mono-numbers text-sm text-muted-foreground">
                  {formatCurrency(tx.usdValue, "USD")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(tx.createdAtDate)}</TableCell>
                <TableCell>
                  <div className={`flex items-center gap-1 text-xs ${isOld ? "text-[hsl(var(--status-warning))]" : "text-muted-foreground"}`}>
                    <Clock className="h-3 w-3" />
                    {age !== null ? `${age}d` : "—"}
                  </div>
                </TableCell>
                <TableCell>
                  {tx.hasBlockingIssue ? <Badge variant="destructive" className="text-xs">Blocked</Badge> : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
