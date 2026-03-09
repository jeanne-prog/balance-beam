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

/** Decode HTML entities like &#x27; &#39; &amp; etc. without DOM (Deno-safe) */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
  const spanGroupMatch = html.match(
    /<p>\s*<span>([^<]+)<\/span>\s*,\s*<span>([^<]+)<\/span>\s*,\s*<span>([^<]+)<\/span>/i
  );
  if (spanGroupMatch) {
    bankName = decodeHtmlEntities(spanGroupMatch[1].trim());
    address = decodeHtmlEntities(spanGroupMatch[2].trim());
    city = decodeHtmlEntities(spanGroupMatch[3].trim());
    return { bankName, address, city };
  }

  // Strategy 2: Extract from h2 "BANK NAME BIC / Swift code details"
  const h2Match = html.match(/<h2[^>]*>([^<]+)\s+BIC\s*\/?\s*Swift\s+code\s+details/i);
  if (h2Match) {
    bankName = decodeHtmlEntities(h2Match[1].trim());
  }

  // Strategy 3: dt/dd pairs — bank name, address, city from same structured block
  const dtDdPairs = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)];
  for (const [, labelRaw, valueRaw] of dtDdPairs) {
    const lbl = labelRaw.replace(/<[^>]*>/g, "").trim().toLowerCase();
    const val = decodeHtmlEntities(valueRaw.replace(/<[^>]*>/g, "").trim());
    if (lbl.includes("bank") && lbl.includes("name") && !bankName) {
      bankName = val;
    } else if (lbl.includes("address") && !address) {
      address = val;
    } else if (lbl.includes("city") && !city) {
      city = val;
    }
  }

  // Strategy 4: table rows
  const trPairs = [...html.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)];
  for (const [, labelRaw, valueRaw] of trPairs) {
    const lbl = labelRaw.replace(/<[^>]*>/g, "").trim().toLowerCase();
    const val = decodeHtmlEntities(valueRaw.replace(/<[^>]*>/g, "").trim());
    if ((lbl.includes("bank") || lbl.includes("institution")) && !bankName) {
      bankName = val;
    } else if (lbl.includes("address") && !lbl.includes("line 2") && !address) {
      address = val;
    } else if (lbl.includes("city") && !city) {
      city = val;
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
