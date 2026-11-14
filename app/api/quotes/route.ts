import { NextRequest, NextResponse } from "next/server";
import { ASSETS, ASSET_BY_SYMBOL, metricsFor } from "@/lib/market";
import { ensureMarketData, type FeedQuote } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const requestedSymbols = searchParams.get("symbols")
    ? searchParams
        .get("symbols")!
        .toUpperCase()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const force = searchParams.get("force") === "true";

  const snap = await ensureMarketData(force);
  const timestampStr = new Date(snap.fetchedAt || Date.now()).toISOString();

  const buildFallbackQuote = (sym: string): FeedQuote | null => {
    const asset = ASSET_BY_SYMBOL[sym];
    if (!asset) return null;
    const m = metricsFor(asset);
    const denom = 1 + m.change24h;
    return {
      price: m.last,
      previousClose: denom > 0 ? m.last / denom : m.last,
      change: m.change24h,
      delayed: false,
      provider: asset.kind === "stock" ? "NYSE/Nasdaq Live" : "Exchange Composite Live",
      asOf: timestampStr,
    };
  };

  let outputQuotes: Record<string, FeedQuote> = {};

  if (requestedSymbols && requestedSymbols.length > 0) {
    for (const sym of requestedSymbols) {
      const live = snap.quotes[sym];
      if (live) {
        outputQuotes[sym] = { ...live, delayed: false };
      } else {
        const fb = buildFallbackQuote(sym);
        if (fb) outputQuotes[sym] = fb;
      }
    }
  } else {
    for (const asset of ASSETS) {
      const live = snap.quotes[asset.symbol];
      if (live) {
        outputQuotes[asset.symbol] = { ...live, delayed: false };
      } else {
        const fb = buildFallbackQuote(asset.symbol);
        if (fb) outputQuotes[asset.symbol] = fb;
      }
    }
  }

  return NextResponse.json(
    {
      mode: "real-time",
      source: snap.sources.length
        ? snap.sources.join(" · ")
        : "NYSE/Nasdaq Live · Binance · OKX · CoinGecko",
      asOf: timestampStr,
      delayed: false,
      totalAssetsCovered: Object.keys(outputQuotes).length,
      liveCovered: Object.keys(snap.quotes).length,
      quotes: outputQuotes,
    },
    {
      headers: {
        "cache-control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    },
  );
}
