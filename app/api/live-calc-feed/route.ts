import { NextRequest, NextResponse } from "next/server";
import { ASSET_BY_SYMBOL, metricsFor } from "@/lib/market";
import {
  DEFAULT_FX_RATES,
  computeAtr14,
  computeRealizedVolatilityPct,
  computeSma,
  type CurrencyCode,
  type LiveFeedTelemetry,
  type OhlcBar,
} from "@/lib/precision-calculator";

export const dynamic = "force-dynamic";

let cachedFx: { rates: Record<CurrencyCode, number>; fetchedAt: number } | null = null;
const FX_TTL_MS = 10 * 60 * 1000;

async function fetchFreeFxRates(): Promise<{ rates: Record<CurrencyCode, number>; live: boolean }> {
  const now = Date.now();
  if (cachedFx && now - cachedFx.fetchedAt < FX_TTL_MS) {
    return { rates: cachedFx.rates, live: true };
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,SGD,IDR", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return { rates: DEFAULT_FX_RATES, live: false };
    const data = (await res.json()) as { rates?: Partial<Record<CurrencyCode, number>> };
    const rates: Record<CurrencyCode, number> = {
      USD: 1,
      EUR: data?.rates?.EUR ?? DEFAULT_FX_RATES.EUR,
      GBP: data?.rates?.GBP ?? DEFAULT_FX_RATES.GBP,
      JPY: data?.rates?.JPY ?? DEFAULT_FX_RATES.JPY,
      CHF: data?.rates?.CHF ?? DEFAULT_FX_RATES.CHF,
      SGD: data?.rates?.SGD ?? DEFAULT_FX_RATES.SGD,
      IDR: data?.rates?.IDR ?? DEFAULT_FX_RATES.IDR,
    };
    cachedFx = { rates, fetchedAt: now };
    return { rates, live: true };
  } catch {
    return { rates: DEFAULT_FX_RATES, live: false };
  }
}

async function fetchYahooChart(symbol: string): Promise<{
  priceUsd: number;
  change24hPct: number;
  bars: OhlcBar[];
  closes: number[];
} | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3500),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    const quote = result?.indicators?.quote?.[0];
    if (!meta || !quote) return null;

    const highs: Array<number | null> = quote.high ?? [];
    const lows: Array<number | null> = quote.low ?? [];
    const closesRaw: Array<number | null> = quote.close ?? [];

    const bars: OhlcBar[] = [];
    const closes: number[] = [];
    for (let i = 0; i < closesRaw.length; i++) {
      const h = highs[i];
      const l = lows[i];
      const c = closesRaw[i];
      if (typeof h === "number" && typeof l === "number" && typeof c === "number" && c > 0) {
        bars.push({ high: h, low: l, close: c });
        closes.push(c);
      }
    }

    const priceUsd =
      typeof meta.regularMarketPrice === "number" && meta.regularMarketPrice > 0
        ? meta.regularMarketPrice
        : closes[closes.length - 1] ?? 0;
    const lastBarClose = closes[closes.length - 1] ?? priceUsd;
    const prevSessionClose =
      closes.length >= 2 && Math.abs(lastBarClose - priceUsd) / Math.max(1e-9, priceUsd) < 0.005
        ? closes[closes.length - 2]
        : closes.length >= 1
          ? closes[closes.length - 1]
          : priceUsd;
    const prevClose =
      typeof meta.previousClose === "number" && meta.previousClose > 0
        ? meta.previousClose
        : prevSessionClose;
    const change24hPct = prevClose > 0 ? ((priceUsd - prevClose) / prevClose) * 100 : 0;

    if (priceUsd <= 0) return null;
    return { priceUsd, change24hPct, bars, closes };
  } catch {
    return null;
  }
}

async function fetchBinanceTelemetry(symbol: string): Promise<{
  priceUsd: number;
  change24hPct: number;
  bidUsd: number;
  askUsd: number;
  bars: OhlcBar[];
  closes: number[];
  fundingRatePct: number | null;
} | null> {
  const pair = `${symbol}USDT`;
  try {
    const [tickerRes, bookRes, klinesRes, fundingRes] = await Promise.allSettled([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
      fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${pair}`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=55`, {
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      }),
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`, {
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      }),
    ]);

    if (tickerRes.status !== "fulfilled" || !tickerRes.value.ok) return null;
    const ticker = (await tickerRes.value.json()) as { lastPrice?: string; priceChangePercent?: string };
    const priceUsd = Number.parseFloat(ticker.lastPrice ?? "0");
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
    const change24hPct = Number.parseFloat(ticker.priceChangePercent ?? "0") || 0;

    let bidUsd = priceUsd * 0.9998;
    let askUsd = priceUsd * 1.0002;
    if (bookRes.status === "fulfilled" && bookRes.value.ok) {
      const book = (await bookRes.value.json()) as { bidPrice?: string; askPrice?: string };
      const b = Number.parseFloat(book.bidPrice ?? "0");
      const a = Number.parseFloat(book.askPrice ?? "0");
      if (b > 0 && a > 0) {
        bidUsd = b;
        askUsd = a;
      }
    }

    const bars: OhlcBar[] = [];
    const closes: number[] = [];
    if (klinesRes.status === "fulfilled" && klinesRes.value.ok) {
      const klines = (await klinesRes.value.json()) as Array<[number, string, string, string, string]>;
      for (const k of klines) {
        const high = Number.parseFloat(k[2]);
        const low = Number.parseFloat(k[3]);
        const close = Number.parseFloat(k[4]);
        if (high > 0 && low > 0 && close > 0) {
          bars.push({ high, low, close });
          closes.push(close);
        }
      }
    }

    let fundingRatePct: number | null = null;
    if (fundingRes.status === "fulfilled" && fundingRes.value.ok) {
      const f = (await fundingRes.value.json()) as { lastFundingRate?: string };
      const parsed = Number.parseFloat(f.lastFundingRate ?? "");
      if (Number.isFinite(parsed)) {
        fundingRatePct = parsed * 100;
      }
    }

    return { priceUsd, change24hPct, bidUsd, askUsd, bars, closes, fundingRatePct };
  } catch {
    return null;
  }
}

async function fetchCoinbaseTicker(symbol: string): Promise<{
  priceUsd: number;
  bidUsd: number;
  askUsd: number;
} | null> {
  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}-USD/ticker`, {
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: string; bid?: string; ask?: string };
    const priceUsd = Number.parseFloat(data.price ?? "0");
    const bidUsd = Number.parseFloat(data.bid ?? "0") || priceUsd * 0.9997;
    const askUsd = Number.parseFloat(data.ask ?? "0") || priceUsd * 1.0003;
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
    return { priceUsd, bidUsd, askUsd };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const rawSymbol = req.nextUrl.searchParams.get("symbol") ?? "NVDA";
  const symbol = rawSymbol.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "NVDA";

  const knownAsset = ASSET_BY_SYMBOL[symbol];
  const isCrypto = knownAsset ? knownAsset.kind !== "stock" : ["BTC", "ETH", "SOL", "PEPE", "DOGE", "XRP", "AVAX"].includes(symbol);
  const assetClass: "equity" | "crypto" = isCrypto ? "crypto" : "equity";

  const fxPromise = fetchFreeFxRates();
  const sources: string[] = [];

  if (assetClass === "crypto") {
    const [binanceData, coinbaseData, yahooCrypto, fxResult] = await Promise.all([
      fetchBinanceTelemetry(symbol),
      fetchCoinbaseTicker(symbol),
      fetchYahooChart(`${symbol}-USD`),
      fxPromise,
    ]);

    if (fxResult.live) sources.push("Frankfurter ECB FX");

    if (binanceData) {
      sources.unshift("Binance Spot & Futures API");
      const bars = binanceData.bars.length >= 15 ? binanceData.bars : yahooCrypto?.bars ?? [];
      const closes = binanceData.closes.length >= 15 ? binanceData.closes : yahooCrypto?.closes ?? [binanceData.priceUsd];
      const atr14Usd = bars.length >= 2 ? computeAtr14(bars) : binanceData.priceUsd * 0.045;
      const realizedVol20dPct =
        closes.length >= 5 ? computeRealizedVolatilityPct(closes, 365) : 64.0;
      const sma20Usd = closes.length >= 5 ? computeSma(closes, 20) : binanceData.priceUsd;
      const sma50Usd = closes.length >= 5 ? computeSma(closes, 50) : binanceData.priceUsd;
      const spreadBps =
        binanceData.bidUsd > 0
          ? ((binanceData.askUsd - binanceData.bidUsd) / binanceData.priceUsd) * 10000
          : 2.0;

      const payload: LiveFeedTelemetry = {
        symbol,
        assetClass: "crypto",
        priceUsd: binanceData.priceUsd,
        change24hPct: binanceData.change24hPct,
        bidUsd: binanceData.bidUsd,
        askUsd: binanceData.askUsd,
        spreadBps,
        atr14Usd,
        atr14Pct: (atr14Usd / binanceData.priceUsd) * 100,
        realizedVol20dPct,
        sma20Usd,
        sma50Usd,
        fundingRatePct: binanceData.fundingRatePct ?? 0.01,
        fxRates: fxResult.rates,
        sources,
        asOf: new Date().toISOString(),
        isFallback: false,
      };
      return NextResponse.json(payload);
    }

    if (coinbaseData || yahooCrypto) {
      if (coinbaseData) sources.unshift("Coinbase Exchange Ticker");
      if (yahooCrypto) sources.push("Yahoo Finance 90D Candles");

      const priceUsd = coinbaseData?.priceUsd ?? yahooCrypto?.priceUsd ?? 100;
      const bidUsd = coinbaseData?.bidUsd ?? priceUsd * 0.9997;
      const askUsd = coinbaseData?.askUsd ?? priceUsd * 1.0003;
      const bars = yahooCrypto?.bars ?? [];
      const closes = yahooCrypto?.closes ?? [priceUsd];
      const atr14Usd = bars.length >= 2 ? computeAtr14(bars) : priceUsd * 0.045;

      const payload: LiveFeedTelemetry = {
        symbol,
        assetClass: "crypto",
        priceUsd,
        change24hPct: yahooCrypto?.change24hPct ?? 0,
        bidUsd,
        askUsd,
        spreadBps: ((askUsd - bidUsd) / priceUsd) * 10000,
        atr14Usd,
        atr14Pct: (atr14Usd / priceUsd) * 100,
        realizedVol20dPct: closes.length >= 5 ? computeRealizedVolatilityPct(closes, 365) : 64.0,
        sma20Usd: closes.length >= 5 ? computeSma(closes, 20) : priceUsd,
        sma50Usd: closes.length >= 5 ? computeSma(closes, 50) : priceUsd,
        fundingRatePct: 0.01,
        fxRates: fxResult.rates,
        sources,
        asOf: new Date().toISOString(),
        isFallback: false,
      };
      return NextResponse.json(payload);
    }
  } else {
    const [yahooStock, fxResult] = await Promise.all([fetchYahooChart(symbol), fxPromise]);
    if (fxResult.live) sources.push("Frankfurter ECB FX");

    if (yahooStock) {
      sources.unshift("Yahoo Finance 90D OHLCV");
      const atr14Usd = yahooStock.bars.length >= 2 ? computeAtr14(yahooStock.bars) : yahooStock.priceUsd * 0.028;
      const bidUsd = yahooStock.priceUsd * 0.99985;
      const askUsd = yahooStock.priceUsd * 1.00015;
      const payload: LiveFeedTelemetry = {
        symbol,
        assetClass: "equity",
        priceUsd: yahooStock.priceUsd,
        change24hPct: yahooStock.change24hPct,
        bidUsd,
        askUsd,
        spreadBps: ((askUsd - bidUsd) / yahooStock.priceUsd) * 10000,
        atr14Usd,
        atr14Pct: (atr14Usd / yahooStock.priceUsd) * 100,
        realizedVol20dPct:
          yahooStock.closes.length >= 5 ? computeRealizedVolatilityPct(yahooStock.closes, 252) : 34.0,
        sma20Usd: yahooStock.closes.length >= 5 ? computeSma(yahooStock.closes, 20) : yahooStock.priceUsd,
        sma50Usd: yahooStock.closes.length >= 5 ? computeSma(yahooStock.closes, 50) : yahooStock.priceUsd,
        fundingRatePct: null,
        fxRates: fxResult.rates,
        sources,
        asOf: new Date().toISOString(),
        isFallback: false,
      };
      return NextResponse.json(payload);
    }
  }

  // Deterministic quantitative fallback if all public market APIs are unavailable
  const fxResult = await fxPromise;
  const fallbackMetrics = knownAsset ? metricsFor(knownAsset) : null;
  const priceUsd = fallbackMetrics?.last ?? (assetClass === "crypto" ? 214.2 : 138.4);
  const volPct = fallbackMetrics ? fallbackMetrics.vol * 100 : assetClass === "crypto" ? 58.0 : 34.0;
  const atr14Usd = priceUsd * (volPct / 100 / Math.sqrt(assetClass === "crypto" ? 365 : 252)) * 1.35;

  const fallbackPayload: LiveFeedTelemetry = {
    symbol,
    assetClass,
    priceUsd,
    change24hPct: fallbackMetrics?.change24h ?? 0,
    bidUsd: priceUsd * 0.9998,
    askUsd: priceUsd * 1.0002,
    spreadBps: 4.0,
    atr14Usd,
    atr14Pct: (atr14Usd / priceUsd) * 100,
    realizedVol20dPct: volPct,
    sma20Usd: fallbackMetrics?.sma20 ?? priceUsd * 0.97,
    sma50Usd: fallbackMetrics?.sma50 ?? priceUsd * 0.93,
    fundingRatePct: assetClass === "crypto" ? 0.01 : null,
    fxRates: fxResult.rates,
    sources: [
      ...(fxResult.live ? ["Frankfurter ECB FX"] : []),
      "NextWallStreet Model Snapshot",
    ],
    asOf: new Date().toISOString(),
    isFallback: true,
  };

  return NextResponse.json(fallbackPayload);
}
