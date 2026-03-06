/**
 * Sheets API client — calls the sheets-proxy edge function.
 * All Google Sheets data lives in one spreadsheet; tabs are referenced by key.
 */



export const TAB_KEYS = [
  "transactions",
  "accounts",
  "senderCountryMatrix",
  "receiverCountryMatrix",
  "routingRules",
  "currenciesMatrix",
  "benesBanned",
  "sendersBanned",
  "swiftCodesBanned",
  "lightKycSenders",
  "flowTargets",
  "providerManual",
  "cohortRates",
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export interface SheetReadResponse {
  data: Record<string, unknown>[];
  raw: unknown[][];
}

export async function readTab(tab: TabKey): Promise<Record<string, unknown>[]> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-proxy?action=read&tab=${tab}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`sheets-proxy read failed: ${errBody}`);
  }

  const result: SheetReadResponse = await resp.json();
  return result.data;
}

export async function writeTab(
  tab: TabKey,
  range: string,
  values: unknown[][]
): Promise<void> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-proxy?action=write&tab=${tab}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ range, values }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`sheets-proxy write failed: ${errBody}`);
  }
}

export async function appendTab(
  tab: TabKey,
  values: unknown[][]
): Promise<void> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sheets-proxy?action=append&tab=${tab}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`sheets-proxy append failed: ${errBody}`);
  }
}
