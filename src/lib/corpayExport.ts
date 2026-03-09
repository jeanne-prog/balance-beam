import type { Transaction, RoutingSuggestion } from "@/types";

const HEADER = [
  "Beneficiary Identifier (50)",
  "Beneficiary Name (100)",
  "Bank Account Number (50)",
  "Bank Country (2)",
  "Beneficiary Currency (3)",
  "Intermediary Bank Name (50)",
  "Intermediary SWIFT Code (11)",
  "Bank Name (50)",
  "Bank AddressLine 1 (35)",
  "Bank Address Line 2 (35)",
  "Bank City (20)",
  "",
  "",
  "SWIFT Code (11)",
  "Internal Comments (100)",
  "Beneficiary Address Line 1 (35)",
  "Beneficiary Address Line 2 (35)",
  "Beneficiary City (20)",
  "Beneficiary Postal Code (10)",
  "Beneficiary Telephone Number (30)",
  "Beneficiary Email Address (30)",
  "Beneficiary Reference (100)",
  "Beneficiary Country (2)",
  "Beneficiary Province (30)",
  "Routing Code (20)",
  "Payment Method (1)",
  "Beneficiary Classification (20)",
  "Purpose Of Payment (50)",
  "Regulatory Field 1",
  "Regulatory Field 2",
  "Regulatory Field 3",
  "Regulatory Field 4",
  "Regulatory Field 5",
  "Regulatory Field 6",
  "Regulatory Field 7",
  "Settlement Currency (3)",
  "Payment Amount (10)",
  "Settlement Amount (10)",
  "Payment Reference (120)",
  "Settlement Account (22)",
  "Remitter Class (50)",
  "Remitter ID (50)",
  "Remitter Name (100)",
  "Remitter Incorporation No (50)",
  "Remitter Email (50)",
  "Remitter Bank Name (50)",
  "Remitter Bank Code (11)",
  "Remitter Address (100)",
  "Remitter City (50)",
  "Remitter Country (2)",
  "Remitter Province (50)",
  "Remitter Postal Code (10)",
];

// ── Text cleaning ──────────────────────────────────────────

const SPECIAL_CHARS_RE = /[~!@#$%^&*()+{}|:"<>?`;']/g;

/**
 * Clean a field value for Corpay CSV output.
 * - Optionally strips special characters
 * - Truncates to maxChars at the last word boundary
 */
export function cleanField(value: string | null | undefined, maxChars: number, stripSpecialChars: boolean): string {
  let v = (value ?? "").trim();
  if (!v) return "";
  if (stripSpecialChars) {
    // Decompose accented characters and strip combining marks (é→e, à→a, ç→c, etc.)
    v = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    v = v.replace(SPECIAL_CHARS_RE, "").replace(/\s{2,}/g, " ").trim();
  }
  if (v.length <= maxChars) return v;
  // Truncate at last word boundary
  const truncated = v.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated).trim();
}

// ── CSV helpers ────────────────────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function stripSpaces(v: string | null): string {
  return (v ?? "").replace(/\s/g, "");
}

/** Extract bank country from SWIFT code (chars 5-6) or fall back to receiver country */
function bankCountry(tx: Transaction): string {
  if (tx.receiverSwiftCode && tx.receiverSwiftCode.length >= 6) {
    return tx.receiverSwiftCode.substring(4, 6).toUpperCase();
  }
  return (tx.receiverCountry ?? "").substring(0, 2).toUpperCase();
}

// ── Types ──────────────────────────────────────────────────

export interface CorpayTransaction {
  tx: Transaction;
  rail: string; // "SEPA" or "SWIFT"
}

export interface SwiftLookupResult {
  bankName: string;
  address: string;
  city: string;
}

/** Get all transactions allocated to CORPAY SEPA or CORPAY SWIFT */
export function getCorpayTransactions(
  transactions: Transaction[],
  suggestions: Map<string, RoutingSuggestion[]>,
  overrides: Map<string, string>,
  operatorHeldIds: Set<string>,
): CorpayTransaction[] {
  const result: CorpayTransaction[] = [];
  for (const tx of transactions) {
    if (operatorHeldIds.has(tx.transactionId)) continue;
    const sugs = suggestions.get(tx.transactionId) ?? [];
    const overrideKey = overrides.get(tx.transactionId);
    let selectedProvider = "";
    let selectedRail = "";

    if (overrideKey) {
      const [prov, rail] = overrideKey.split("|");
      selectedProvider = prov;
      selectedRail = rail ?? "";
    } else {
      const best = sugs.find((s) => s.score > 0);
      if (best) {
        selectedProvider = best.provider;
        selectedRail = best.rail;
      }
    }

    if (
      selectedProvider.toUpperCase().includes("CORPAY") &&
      (selectedRail.toUpperCase() === "SEPA" || selectedRail.toUpperCase() === "SWIFT")
    ) {
      result.push({ tx, rail: selectedRail.toUpperCase() });
    }
  }
  return result;
}

function buildRow(ct: CorpayTransaction, swiftCache: Record<string, SwiftLookupResult>): string[] {
  const { tx, rail } = ct;
  const swift = tx.receiverSwiftCode ? swiftCache[tx.receiverSwiftCode] : undefined;

  const row: string[] = new Array(52).fill("");
  row[0] = cleanField(tx.transactionId, 50, false);                          // Beneficiary Identifier
  row[1] = cleanField(tx.receiverName, 100, true);                           // Beneficiary Name
  row[2] = stripSpaces(tx.receiverAccountNumber?.trim() || tx.receiverIban);   // Bank Account Number
  row[3] = bankCountry(tx);                                                  // Bank Country
  row[4] = tx.receiverCurrency.toUpperCase();                                // Beneficiary Currency
  // 5-6: intermediary — empty
  row[7] = cleanField(swift?.bankName ?? "", 50, true);                      // Bank Name
  row[8] = swift?.address ?? "";                                             // Bank AddressLine 1
  // 9: Bank Address Line 2 — empty
  row[10] = swift?.city ?? "";                                               // Bank City
  // 11-12: empty columns
  row[13] = tx.receiverSwiftCode ?? "";                                      // SWIFT Code
  // 14: internal comments — empty
  row[15] = cleanField(tx.receiverAddressLine1, 35, true);                   // Beneficiary Address Line 1
  // 16: Beneficiary Address Line 2 — empty
  row[17] = cleanField(tx.receiverAddressCity, 20, true);                    // Beneficiary City
  // 18-19: postal code, phone — empty
  row[20] = "payments@capimoney.com";                                        // Beneficiary Email
  // 21: beneficiary reference — empty
  row[22] = (tx.receiverCountry ?? "").substring(0, 2).toUpperCase();        // Beneficiary Country
  row[23] = cleanField(tx.receiverAddressState, 30, true);                   // Beneficiary Province
  // 24: routing code — empty
  row[25] = rail === "SEPA" ? "E" : "W";                                    // Payment Method
  row[26] = "Business";                                                      // Beneficiary Classification
  row[27] = "Supplier payment";                                              // Purpose Of Payment
  // 28-34: regulatory fields — empty
  row[35] = tx.receiverCurrency.toUpperCase();                               // Settlement Currency
  row[36] = tx.receiverAmount.toString();                                    // Payment Amount
  // 37: settlement amount — empty
  row[38] = cleanField(`${tx.senderName} - ${tx.reference ?? ""}`, 120, false); // Payment Reference
  row[39] = "C";                                                             // Settlement Account
  row[40] = "Corporation";                                                   // Remitter Class
  row[41] = tx.senderId ?? tx.transactionId;                                 // Remitter ID
  row[42] = cleanField(tx.senderName, 100, true);                            // Remitter Name
  row[43] = tx.senderBusinessNumber ?? "";                                   // Remitter Incorporation No
  // 44: remitter email — empty
  row[45] = "Capi Money Canada Ltd";                                         // Remitter Bank Name
  row[46] = "CMYCCAT2";                                                      // Remitter Bank Code
  row[47] = cleanField(tx.senderAddressLine1, 100, true);                    // Remitter Address
  row[48] = cleanField(tx.senderAddressCity, 50, true);                      // Remitter City
  row[49] = (tx.senderCountry ?? "").substring(0, 2).toUpperCase();          // Remitter Country
  row[50] = cleanField(tx.senderAddressState, 50, true);                     // Remitter Province
  // 51: postal code — empty
  return row;
}

export function generateCorpayCsv(corpayTxns: CorpayTransaction[], swiftCache: Record<string, SwiftLookupResult> = {}): string {
  const lines: string[] = [];
  lines.push(HEADER.map(csvEscape).join(","));
  for (const ct of corpayTxns) {
    lines.push(buildRow(ct, swiftCache).map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCorpayCsv(corpayTxns: CorpayTransaction[], swiftCache: Record<string, SwiftLookupResult> = {}): void {
  const csv = generateCorpayCsv(corpayTxns, swiftCache);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `corpay_batch_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
