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

/**
 * Parse the Wise dedicated SWIFT code page at /gb/swift-codes/{CODE}XXX.
 * The page renders structured spans:
 *   <p><span>BANK NAME</span>, <span>ADDRESS</span>, <span>CITY</span>, <span>COUNTRY</span></p>
 * inside the lead section.
 */
function parseSwiftPage(html: string): SwiftResult | null {
  let bankName = "";
  let address = "";
  let city = "";

  // Strategy 1: Extract from the structured <p> with multiple <span> children
  // Pattern: <p><span>BANK NAME</span>, <span>ADDRESS</span>, <span>CITY</span>, <span>COUNTRY</span></p>
  const spanGroupMatch = html.match(
    /<p>\s*<span>([^<]+)<\/span>\s*,\s*<span>([^<]+)<\/span>\s*,\s*<span>([^<]+)<\/span>/i
  );
  if (spanGroupMatch) {
    bankName = spanGroupMatch[1].trim();
    address = spanGroupMatch[2].trim();
    city = spanGroupMatch[3].trim();
    return { bankName, address, city };
  }

  // Strategy 2: Extract from h2 "BANK NAME BIC / Swift code details"
  const h2Match = html.match(/<h2[^>]*>([^<]+)\s+BIC\s*\/?\s*Swift\s+code\s+details/i);
  if (h2Match) {
    bankName = h2Match[1].trim();
  }

  // Strategy 3: dt/dd pairs
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

  // Strategy 4: table rows
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
    const { codes } = (await req.json()) as { codes: string[] };
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return new Response(
        JSON.stringify({ error: "codes array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toFetch = codes.slice(0, 20);
    const results: Record<string, SwiftResult | null> = {};

    await Promise.all(
      toFetch.map(async (code) => {
        try {
          // Pad to 11 chars with XXX if needed (e.g. BUNQNL2A -> BUNQNL2AXXX)
          const paddedCode = code.length <= 8 ? code + "XXX" : code;

          // Try the dedicated bank page first — cleaner structure
          const bankPageUrl = `https://wise.com/gb/swift-codes/${encodeURIComponent(paddedCode)}`;
          let resp = await fetch(bankPageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; CapiMoney/1.0)",
              Accept: "text/html",
            },
          });

          // Fall back to checker page if bank page returns 404
          if (!resp.ok) {
            resp = await fetch(
              `https://wise.com/gb/swift-codes/bic-swift-code-checker?code=${encodeURIComponent(code)}`,
              {
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; CapiMoney/1.0)",
                  Accept: "text/html",
                },
              }
            );
          }

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
