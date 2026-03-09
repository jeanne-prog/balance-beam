const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SwiftResult {
  bankName: string;
  address: string;
  city: string;
}

function parseSwiftPage(html: string): SwiftResult | null {
  // Look for bank name in the h1 heading — Wise typically renders:
  // <h1>...SWIFT code for <strong>BANK NAME</strong>...</h1>
  // or just a plain h1 with the bank name
  let bankName = "";
  let address = "";
  let city = "";

  // Try extracting from structured data or headings
  // Pattern 1: h1 with strong tag
  const h1StrongMatch = html.match(/<h1[^>]*>.*?<strong>([^<]+)<\/strong>/is);
  if (h1StrongMatch) {
    bankName = h1StrongMatch[1].trim();
  }

  // Pattern 2: fallback — look for bank name in meta or og:title
  if (!bankName) {
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitle) {
      // e.g. "KREDBEBB - KBC BANK NV SWIFT code"
      const parts = ogTitle[1].split(/\s*[-–]\s*/);
      if (parts.length >= 2) {
        bankName = parts.slice(1).join(" - ").replace(/\s*SWIFT\s*code.*/i, "").trim();
      }
    }
  }

  // Pattern 3: look for bank name in h2 or h3
  if (!bankName) {
    const h2Match = html.match(/<h[23][^>]*>([^<]*(?:bank|credit|savings)[^<]*)<\/h[23]>/i);
    if (h2Match) {
      bankName = h2Match[1].trim();
    }
  }

  // Extract address and city from the page — look for address-like content
  // Wise shows bank details in a structured section
  const addressSectionMatch = html.match(/(?:address|location)[^<]*<[^>]*>([^<]+)/i);
  if (addressSectionMatch) {
    address = addressSectionMatch[1].trim();
  }

  // Try finding city from structured content
  const cityMatch = html.match(/(?:city|town)[^<]*<[^>]*>([^<]+)/i);
  if (cityMatch) {
    city = cityMatch[1].trim();
  }

  // Alternative: parse from a table or definition list that Wise uses
  const dtDdPairs = [...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>\s*<dd[^>]*>([^<]*)<\/dd>/gi)];
  for (const [, label, value] of dtDdPairs) {
    const lbl = label.trim().toLowerCase();
    if (lbl.includes("bank") && lbl.includes("name") && !bankName) {
      bankName = value.trim();
    } else if (lbl.includes("address") && !address) {
      address = value.trim();
    } else if (lbl.includes("city") && !city) {
      city = value.trim();
    }
  }

  // Also try table rows
  const trPairs = [...html.matchAll(/<t[hd][^>]*>([^<]*)<\/t[hd]>\s*<td[^>]*>([^<]*)<\/td>/gi)];
  for (const [, label, value] of trPairs) {
    const lbl = label.trim().toLowerCase();
    if ((lbl.includes("bank") || lbl.includes("institution")) && !bankName) {
      bankName = value.trim();
    } else if (lbl.includes("address") && !lbl.includes("line 2") && !address) {
      address = value.trim();
    } else if (lbl.includes("city") && !city) {
      city = value.trim();
    }
  }

  if (!bankName && !address && !city) return null;
  return { bankName, address, city };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { codes } = await req.json() as { codes: string[] };
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return new Response(
        JSON.stringify({ error: "codes array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 20 codes per request to avoid abuse
    const toFetch = codes.slice(0, 20);
    const results: Record<string, SwiftResult | null> = {};

    await Promise.all(
      toFetch.map(async (code) => {
        try {
          const resp = await fetch(
            `https://wise.com/gb/swift-codes/bic-swift-code-checker?code=${encodeURIComponent(code)}`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; CapiMoney/1.0)",
                "Accept": "text/html",
              },
            }
          );
          if (!resp.ok) {
            console.error(`Wise fetch failed for ${code}: ${resp.status}`);
            results[code] = null;
            return;
          }
          const html = await resp.text();
          results[code] = parseSwiftPage(html);
        } catch (e) {
          console.error(`Error fetching SWIFT ${code}:`, e);
          results[code] = null;
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("swift-lookup error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
