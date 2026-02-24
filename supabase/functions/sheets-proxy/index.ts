import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tab name constants matching the single spreadsheet
const TABS = {
  transactions: "DB_Transactions",
  accounts: "DB_Accounts",
  senderCountryMatrix: "sender_country_matrix",
  receiverCountryMatrix: "receiver_country_matrix",
  routingRules: "routing_rules",
  currenciesMatrix: "currencies_matrix",
  benesBanned: "benes_banned",
  sendersBanned: "senders_banned",
  swiftCodesBanned: "SWIFT_codes_banned",
  lightKycSenders: "light_KYC_senders",
  flowTargets: "flow_targets",
} as const;

type TabKey = keyof typeof TABS;

/* ── Google Auth via Service Account ──────────────────────── */

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function base64url(input: Uint8Array): string {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    enc.encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64url(new Uint8Array(signature))}`;

  const resp = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

/* ── Sheets API helpers ──────────────────────────────────── */

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function readSheet(
  token: string,
  spreadsheetId: string,
  tab: string
): Promise<unknown[][]> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets read error (${tab}): ${err}`);
  }
  const data = await resp.json();
  return data.values || [];
}

async function writeSheet(
  token: string,
  spreadsheetId: string,
  tab: string,
  range: string,
  values: unknown[][]
): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}!${range}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets write error (${tab}): ${err}`);
  }
  await resp.text(); // consume body
}

async function appendSheet(
  token: string,
  spreadsheetId: string,
  tab: string,
  values: unknown[][]
): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(tab)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Sheets append error (${tab}): ${err}`);
  }
  await resp.text();
}

/* ── Helper: rows → objects using header row ─────────────── */

function rowsToObjects(rows: unknown[][]): Record<string, unknown>[] {
  if (rows.length < 2) return [];
  const headers = rows[0] as string[];
  return rows.slice(1).map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? null;
    });
    return obj;
  });
}

/* ── Main handler ────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const saKeyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const spreadsheetId = Deno.env.get("GOOGLE_SPREADSHEET_ID");

    if (!saKeyRaw || !spreadsheetId) {
      return new Response(
        JSON.stringify({ error: "Missing GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SPREADSHEET_ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle potential double-quoting or escaped JSON in the secret
    let parsedKey = saKeyRaw.trim();
    // Try to unescape if the value was stored with escaping
    try {
      // If it's a JSON-encoded string (wrapped in quotes), unwrap it first
      if (parsedKey.startsWith('"') || parsedKey.startsWith("'")) {
        try {
          parsedKey = JSON.parse(parsedKey);
        } catch {
          // Not a JSON string, try as-is
        }
      }
    } catch {
      // ignore
    }
    console.log("SA key starts with:", parsedKey.substring(0, 20));
    const sa: ServiceAccountKey = JSON.parse(parsedKey);
    const token = await getAccessToken(sa);

    const url = new URL(req.url);
    
    // Support both query params (GET) and body params (POST)
    let action = url.searchParams.get("action");
    let tabKey = url.searchParams.get("tab") as TabKey | null;
    let bodyData: Record<string, unknown> = {};
    
    if (req.method === "POST" || req.method === "PUT") {
      try {
        bodyData = await req.json();
      } catch {
        bodyData = {};
      }
      if (!action) action = String(bodyData.action ?? "read");
      if (!tabKey) tabKey = (bodyData.tab as TabKey) ?? null;
    }
    
    if (!action) action = "read";

    if (!tabKey || !(tabKey in TABS)) {
      return new Response(
        JSON.stringify({ error: `Invalid tab. Valid tabs: ${Object.keys(TABS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tabName = TABS[tabKey];

    if (action === "read") {
      const rows = await readSheet(token, spreadsheetId, tabName);
      const data = rowsToObjects(rows);
      return new Response(JSON.stringify({ data, raw: rows }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "write") {
      const { range, values } = bodyData as { range?: string; values?: unknown[][] };
      if (!range || !values) {
        return new Response(
          JSON.stringify({ error: "write requires 'range' and 'values' in body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await writeSheet(token, spreadsheetId, tabName, range, values);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "append") {
      const { values } = bodyData as { values?: unknown[][] };
      if (!values) {
        return new Response(
          JSON.stringify({ error: "append requires 'values' in body" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await appendSheet(token, spreadsheetId, tabName, values);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: read, write, append" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? `${err.message} | stack: ${err.stack}` : "Unknown error";
    console.error("sheets-proxy error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
