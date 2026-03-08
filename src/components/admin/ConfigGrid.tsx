import { useState, useEffect, useCallback, useMemo } from "react";
import { useSheetTab, useWriteSheet } from "@/hooks/useSheetData";
import type { TabKey } from "@/lib/sheets";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Plus, X, Save } from "lucide-react";

export interface GridColumn {
  key: string;
  label: string;
  type: "text" | "number" | "yesno" | "readonly";
}

interface ConfigGridProps {
  tabKey: TabKey;
  columns: GridColumn[];
  title?: string;
}

export function ConfigGrid({ tabKey, columns, title }: ConfigGridProps) {
  const { data: rawData, isLoading } = useSheetTab(tabKey, (r) => r);
  const writeSheet = useWriteSheet();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [dirty, setDirty] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  useEffect(() => {
    if (rawData) {
      setRows(
        rawData.map((r) => {
          const mapped: Record<string, string> = {};
          for (const col of columns) {
            mapped[col.key] = r[col.key] != null ? String(r[col.key]) : "";
          }
          return mapped;
        })
      );
      setDirty(false);
    }
  }, [rawData, columns]);

  const handleCellChange = useCallback((rowIdx: number, key: string, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
    setDirty(true);
  }, []);

  const toggleYesNo = useCallback((rowIdx: number, key: string) => {
    setRows((prev) => {
      const next = [...prev];
      const cur = (next[rowIdx][key] ?? "").toUpperCase();
      next[rowIdx] = { ...next[rowIdx], [key]: cur === "YES" || cur === "TRUE" || cur === "1" ? "NO" : "YES" };
      return next;
    });
    setDirty(true);
  }, []);

  const addRow = useCallback(() => {
    const blank: Record<string, string> = {};
    for (const col of columns) blank[col.key] = "";
    setRows((prev) => [...prev, blank]);
    setDirty(true);
  }, [columns]);

  const deleteRow = useCallback((idx: number) => {
    if (!window.confirm("Delete this row?")) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    const headers = columns.map((c) => c.key);
    const values: unknown[][] = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
    const range = `A1:${String.fromCharCode(64 + headers.length)}${values.length}`;
    try {
      await writeSheet.mutateAsync({ tab: tabKey, range, values });
      toast({ title: "Saved", description: `${tabKey} updated successfully.` });
      setDirty(false);
    } catch (e) {
      toast({ title: "Error", description: `Failed to save: ${(e as Error).message}`, variant: "destructive" });
    }
  }, [columns, rows, tabKey, writeSheet]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const isYes = (v: string) => {
    const u = (v ?? "").toUpperCase();
    return u === "YES" || u === "TRUE" || u === "1";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        <Button size="sm" disabled={!dirty || writeSheet.isPending} onClick={handleSave}>
          <Save className="w-4 h-4 mr-1" />
          Save
          {dirty && <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-400 inline-block" />}
        </Button>
      </div>

      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              {columns.map((col) => (
                <th key={col.key} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0 hover:bg-muted/30">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-1.5">
                    {col.type === "readonly" ? (
                      <span className="bg-muted px-2 py-1 rounded text-muted-foreground">{row[col.key]}</span>
                    ) : col.type === "yesno" ? (
                      <button
                        type="button"
                        onClick={() => toggleYesNo(ri, col.key)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          isYes(row[col.key])
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-500/15 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {isYes(row[col.key]) ? "✓ YES" : "✗ NO"}
                      </button>
                    ) : editingCell?.row === ri && editingCell?.col === col.key ? (
                      <input
                        autoFocus
                        type={col.type === "number" ? "number" : "text"}
                        className="w-full bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={row[col.key]}
                        onChange={(e) => handleCellChange(ri, col.key, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingCell(null)}
                      />
                    ) : (
                      <span
                        className="block px-2 py-1 rounded cursor-pointer hover:bg-muted/50 min-h-[28px]"
                        onClick={() => setEditingCell({ row: ri, col: col.key })}
                      >
                        {row[col.key] || <span className="text-muted-foreground/40 italic">empty</span>}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-1">
                  <button
                    type="button"
                    onClick={() => deleteRow(ri)}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="w-4 h-4 mr-1" /> Add row
      </Button>
    </div>
  );
}
