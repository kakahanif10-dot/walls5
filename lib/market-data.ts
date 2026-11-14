import "server-only";

import {
  ASSETS,
  ASSET_BY_SYMBOL,
  setMarketData,
  type Asset,
  type FeedQuote,
  type Point,
  type RealTelemetry,
} from "@/lib/market";

/**
 * Real-time market data, fetched server-side from live exchange & market feeds
 * across all 2,038 tracked equities, digital assets, and speculative tokens.
 *
 *  - US equities (800): TradingView America Scanner (primary, all NYSE/Nasdaq/AMEX
 *    real-time quotes + RSI/SMA20/SMA50/SMA200/52W/volatility) + Nasdaq Screener & Yahoo Chart
 *  - Crypto & speculative tokens (1,238): Binance, OKX, Bybit, KuCoin, Gate.io, MEXC & CoinGecko
 */

export type { FeedQuote };

export type MarketSnapshot = {
  quotes: Record<string, FeedQuote>;
  telemetry: Record<string, RealTelemetry>;
  points: Record<string, Point[]>;
  fetchedAt: number;
  sources: string[];
  missing: string[];
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  LINK: "chainlink",
  AVAX: "avalanche-2",
  ARB: "arbitrum",
  SUI: "sui",
  APT: "aptos",
  NEAR: "near",
  ICP: "internet-computer",
  TON: "the-open-network",
  TAO: "bittensor",
  RENDER: "render-token",
  FET: "fetch-ai",
  INJ: "injective-protocol",
  AAVE: "aave",
  MKR: "maker",
  PENDLE: "pendle",
  ONDO: "ondo-finance",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  WIF: "dogwifcoin",
  BONK: "bonk",
  FLOKI: "floki",
  POPCAT: "popcat",
  BRETT: "based-brett",
  DEGEN: "degen-base",
};

const SYMBOL_ALIASES: Record<string, string> = {
  SIX: "FUN", // Six Flags merged under FUN
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const QUOTE_TTL = 10_000;
const COINGECKO_TTL = 60_000;
const HISTORY_TTL = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 4500;

const STOCK_HEADERS = { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" };

async function getJson<T>(
  url: string,
  headers: Record<string, string> = {},
  revalidate = 10,
): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", ...headers },
    next: { revalidate },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string") {
    const value = Number(raw.replace(/[$,%\s]/g, ""));
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function sortPoints(points: Point[]): Point[] {
  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/* -------------------------- US Equities Bulk ----------------------------- */

const TV_COLUMNS = [
  "name",
  "close",
  "change",
  "change_abs",
  "RSI",
  "SMA20",
  "SMA50",
  "SMA200",
  "Perf.W",
  "Perf.1M",
  "Perf.3M",
  "Perf.Y",
  "price_52_week_high",
  "price_52_week_low",
  "Volatility.D",
];

type TvScanResponse = {
  data?: Array<{ s: string; d: (string | number | null)[] }>;
};

async function fetchTradingViewStocksBulk(): Promise<{
  quotes: Record<string, FeedQuote>;
  telemetry: Record<string, RealTelemetry>;
}> {
  const quotes: Record<string, FeedQuote> = {};
  const telemetry: Record<string, RealTelemetry> = {};
  const nowIso = new Date().toISOString();

  const scanRange = async (range: [number, number]) => {
    const res = await fetch("https://scanner.tradingview.com/america/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": UA,
      },
      body: JSON.stringify({
        filter: [
          {
            left: "exchange",
            operation: "in_range",
            right: ["NASDAQ", "NYSE", "AMEX", "ARCA", "BATS", "CBOE"],
          },
        ],
        columns: TV_COLUMNS,
        sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
        range,
      }),
      next: { revalidate: 10 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`TradingView ${res.status}`);
    return (await res.json()) as TvScanResponse;
  };

  const results = await Promise.allSettled([scanRange([0, 6000]), scanRange([6000, 12000])]);
  const rawRows = new Map<string, (string | number | null)[]>();

  for (const res of results) {
    if (res.status !== "fulfilled") continue;
    for (const item of res.value.data ?? []) {
      const sym = typeof item.d?.[0] === "string" ? item.d[0].toUpperCase() : "";
      if (sym && !rawRows.has(sym)) {
        rawRows.set(sym, item.d);
      }
    }
  }

  for (const asset of ASSETS) {
    if (asset.kind !== "stock") continue;
    const lookup = SYMBOL_ALIASES[asset.symbol] ?? asset.symbol;
    const d = rawRows.get(lookup);
    if (!d) continue;

    const close = toNumber(d[1]);
    if (!close || close <= 0) continue;

    const changePct = toNumber(d[2]);
    const changeAbs = toNumber(d[3]);
    const change = changePct !== null ? changePct / 100 : 0;
    const prevClose =
      changeAbs !== null && close - changeAbs > 0
        ? close - changeAbs
        : 1 + change > 0
          ? close / (1 + change)
          : close;

    quotes[asset.symbol] = {
      price: close,
      previousClose: prevClose,
      change,
      delayed: false,
      asOf: nowIso,
      provider: "NYSE/Nasdaq Live",
    };

    const volD = toNumber(d[14]);
    telemetry[asset.symbol] = {
      price: close,
      change24h: change,
      rsi: toNumber(d[4]) ?? undefined,
      sma20: toNumber(d[5]) ?? undefined,
      sma50: toNumber(d[6]) ?? undefined,
      sma200: toNumber(d[7]) ?? undefined,
      change7d: toNumber(d[8]) !== null ? toNumber(d[8])! / 100 : undefined,
      change30d: toNumber(d[9]) !== null ? toNumber(d[9])! / 100 : undefined,
      change90d: toNumber(d[10]) !== null ? toNumber(d[10])! / 100 : undefined,
      change1y: toNumber(d[11]) !== null ? toNumber(d[11])! / 100 : undefined,
      high52: toNumber(d[12]) ?? undefined,
      low52: toNumber(d[13]) ?? undefined,
      vol: volD !== null && volD > 0 ? (volD / 100) * Math.sqrt(252) : undefined,
    };
  }

  return { quotes, telemetry };
}

type NasdaqScreenerResponse = {
  data?: {
    table?: {
      rows?: Array<{
        symbol?: string;
        lastsale?: string;
        netchange?: string;
        pctchange?: string;
      }>;
    };
  };
};

async function fetchNasdaqScreenerBulk(
  missingStocks: Asset[],
): Promise<Record<string, FeedQuote>> {
  if (!missingStocks.length) return {};
  const payload = await getJson<NasdaqScreenerResponse>(
    "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0",
    STOCK_HEADERS,
    30,
  );
  const bySymbol = new Map<string, { price: number; change: number; prevClose: number }>();
  for (const row of payload.data?.table?.rows ?? []) {
    const sym = row.symbol?.trim().toUpperCase();
    const price = toNumber(row.lastsale);
    if (!sym || !price || price <= 0) continue;
    const pct = toNumber(row.pctchange);
    const net = toNumber(row.netchange);
    const change = pct !== null ? pct / 100 : 0;
    const prevClose = net !== null && price - net > 0 ? price - net : price / (1 + change || 1);
    bySymbol.set(sym, { price, change, prevClose });
  }

  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const asset of missingStocks) {
    const lookup = SYMBOL_ALIASES[asset.symbol] ?? asset.symbol;
    const match = bySymbol.get(lookup);
    if (!match) continue;
    out[asset.symbol] = {
      price: match.price,
      previousClose: match.prevClose,
      change: match.change,
      delayed: false,
      asOf: nowIso,
      provider: "Nasdaq Live",
    };
  }
  return out;
}

/* ------------------------ Crypto & Meme Bulk Feeds ----------------------- */

async function fetchBinanceBulk(): Promise<Record<string, FeedQuote>> {
  const data = await getJson<
    Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      prevClosePrice: string;
      openPrice: string;
    }>
  >("https://api.binance.com/api/v3/ticker/24hr", {}, 10);

  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const item of data) {
    if (!item.symbol?.endsWith("USDT")) continue;
    const sym = item.symbol.slice(0, -4).toUpperCase();
    const price = Number(item.lastPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const change = Number(item.priceChangePercent) / 100;
    const prevClose = Number(item.prevClosePrice) || Number(item.openPrice) || price;
    out[sym] = {
      price,
      previousClose: prevClose > 0 ? prevClose : price,
      change: Number.isFinite(change) ? change : 0,
      delayed: false,
      asOf: nowIso,
      provider: "Binance Live",
    };
  }
  return out;
}

async function fetchOkxBulk(): Promise<Record<string, FeedQuote>> {
  const payload = await getJson<{ data?: Array<{ instId?: string; last?: string; open24h?: string }> }>(
    "https://www.okx.com/api/v5/market/tickers?instType=SPOT",
    {},
    10,
  );
  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const row of payload.data ?? []) {
    if (!row.instId?.endsWith("-USDT")) continue;
    const sym = row.instId.slice(0, -5).toUpperCase();
    const price = Number(row.last);
    if (!Number.isFinite(price) || price <= 0) continue;
    const open24h = Number(row.open24h) || price;
    out[sym] = {
      price,
      previousClose: open24h > 0 ? open24h : price,
      change: open24h > 0 ? price / open24h - 1 : 0,
      delayed: false,
      asOf: nowIso,
      provider: "OKX Live",
    };
  }
  return out;
}

async function fetchBybitBulk(): Promise<Record<string, FeedQuote>> {
  const payload = await getJson<{
    result?: { list?: Array<{ symbol?: string; lastPrice?: string; prevPrice24h?: string; price24hPcnt?: string }> };
  }>("https://api.bybit.com/v5/market/tickers?category=spot", {}, 10);

  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const row of payload.result?.list ?? []) {
    if (!row.symbol?.endsWith("USDT")) continue;
    const sym = row.symbol.slice(0, -4).toUpperCase();
    const price = Number(row.lastPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const prev = Number(row.prevPrice24h) || price;
    const pct = Number(row.price24hPcnt);
    out[sym] = {
      price,
      previousClose: prev > 0 ? prev : price,
      change: Number.isFinite(pct) ? pct : prev > 0 ? price / prev - 1 : 0,
      delayed: false,
      asOf: nowIso,
      provider: "Bybit Live",
    };
  }
  return out;
}

async function fetchKucoinBulk(): Promise<Record<string, FeedQuote>> {
  const payload = await getJson<{
    data?: { ticker?: Array<{ symbol?: string; last?: string; changeRate?: string }> };
  }>("https://api.kucoin.com/api/v1/market/allTickers", {}, 10);

  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const row of payload.data?.ticker ?? []) {
    if (!row.symbol?.endsWith("-USDT")) continue;
    const sym = row.symbol.slice(0, -5).toUpperCase();
    const price = Number(row.last);
    if (!Number.isFinite(price) || price <= 0) continue;
    const change = Number(row.changeRate);
    const ratio = Number.isFinite(change) ? change : 0;
    out[sym] = {
      price,
      previousClose: 1 + ratio > 0 ? price / (1 + ratio) : price,
      change: ratio,
      delayed: false,
      asOf: nowIso,
      provider: "KuCoin Live",
    };
  }
  return out;
}

async function fetchGateBulk(): Promise<Record<string, FeedQuote>> {
  const payload = await getJson<
    Array<{ currency_pair?: string; last?: string; change_percentage?: string }>
  >("https://api.gateio.ws/api/v4/spot/tickers", {}, 15);

  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const row of payload) {
    if (!row.currency_pair?.endsWith("_USDT")) continue;
    const sym = row.currency_pair.slice(0, -5).toUpperCase();
    const price = Number(row.last);
    if (!Number.isFinite(price) || price <= 0) continue;
    const change = Number(row.change_percentage) / 100;
    const ratio = Number.isFinite(change) ? change : 0;
    out[sym] = {
      price,
      previousClose: 1 + ratio > 0 ? price / (1 + ratio) : price,
      change: ratio,
      delayed: false,
      asOf: nowIso,
      provider: "Gate Live",
    };
  }
  return out;
}

async function fetchMexcBulk(): Promise<Record<string, FeedQuote>> {
  const payload = await getJson<
    Array<{ symbol?: string; lastPrice?: string; priceChangePercent?: string; prevClosePrice?: string }>
  >("https://api.mexc.com/api/v3/ticker/24hr", {}, 15);

  const nowIso = new Date().toISOString();
  const out: Record<string, FeedQuote> = {};
  for (const row of payload) {
    if (!row.symbol?.endsWith("USDT")) continue;
    const sym = row.symbol.slice(0, -4).toUpperCase();
    if (out[sym]) continue;
    const price = Number(row.lastPrice);
    if (!Number.isFinite(price) || price <= 0) continue;
    const change = Number(row.priceChangePercent) / 100;
    const prev = Number(row.prevClosePrice) || price;
    out[sym] = {
      price,
      previousClose: prev > 0 ? prev : price,
      change: Number.isFinite(change) ? change : 0,
      delayed: false,
      asOf: nowIso,
      provider: "MEXC Live",
    };
  }
  return out;
}

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  ath?: number | null;
};

let coinGeckoCache: {
  quotes: Record<string, FeedQuote>;
  telemetry: Record<string, RealTelemetry>;
  ts: number;
} | null = null;

async function fetchCoinGeckoBulkCached(): Promise<{
  quotes: Record<string, FeedQuote>;
  telemetry: Record<string, RealTelemetry>;
}> {
  if (coinGeckoCache && Date.now() - coinGeckoCache.ts < COINGECKO_TTL) {
    return { quotes: coinGeckoCache.quotes, telemetry: coinGeckoCache.telemetry };
  }

  const urls = [
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d",
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2&price_change_percentage=24h,7d,30d",
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=3&price_change_percentage=24h,7d,30d",
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=4&price_change_percentage=24h,7d,30d",
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=meme-token&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d",
  ];

  const results = await Promise.allSettled(urls.map((u) => getJson<CoinGeckoMarket[]>(u, {}, 60)));
  const quotes: Record<string, FeedQuote> = {};
  const telemetry: Record<string, RealTelemetry> = {};
  const nowIso = new Date().toISOString();

  for (const res of results) {
    if (res.status !== "fulfilled" || !Array.isArray(res.value)) continue;
    for (const row of res.value) {
      const sym = row.symbol?.toUpperCase();
      const price = row.current_price;
      if (!sym || !price || !Number.isFinite(price) || price <= 0) continue;

      const change24h = (row.price_change_percentage_24h ?? 0) / 100;
      if (!quotes[sym]) {
        quotes[sym] = {
          price,
          previousClose: 1 + change24h > 0 ? price / (1 + change24h) : price,
          change: change24h,
          delayed: false,
          asOf: nowIso,
          provider: "CoinGecko Live",
        };
      }
      if (!telemetry[sym]) {
        telemetry[sym] = {
          price,
          change24h,
          change7d:
            row.price_change_percentage_7d_in_currency != null
              ? row.price_change_percentage_7d_in_currency / 100
              : undefined,
          change30d:
            row.price_change_percentage_30d_in_currency != null
              ? row.price_change_percentage_30d_in_currency / 100
              : undefined,
          high52: row.ath && row.ath > price ? Math.min(row.ath, price * 2.5) : undefined,
        };
      }
    }
  }

  if (Object.keys(quotes).length > 0) {
    coinGeckoCache = { quotes, telemetry, ts: Date.now() };
  }
  return { quotes, telemetry };
}

/* ----------------------- Per-Symbol Daily History ------------------------ */

async function fetchYahooStockHistory(symbol: string): Promise<Point[]> {
  const yahooSym = (SYMBOL_ALIASES[symbol] ?? symbol).replace(/\./g, "-");
  const payload = await getJson<{
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }>;
    };
  }>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=1y&interval=1d`,
    {},
    3600,
  );
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const points: Point[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c && Number.isFinite(c) && c > 0) {
      points.push({ close: c, date: new Date(timestamps[i] * 1000) });
    }
  }
  if (points.length < 30) throw new Error(`thin yahoo history for ${symbol}`);
  return sortPoints(points);
}

async function fetchNasdaqStockHistory(symbol: string): Promise<Point[]> {
  const lookup = SYMBOL_ALIASES[symbol] ?? symbol;
  const fromDate = new Date(Date.now() - 380 * 86_400_000).toISOString().slice(0, 10);
  const payload = await getJson<{
    data?: { tradesTable?: { rows?: { date?: string; close?: string }[] } | null } | null;
  }>(
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(lookup)}/historical?assetclass=stocks&fromdate=${fromDate}&limit=400`,
    STOCK_HEADERS,
    3600,
  );
  const points: Point[] = [];
  for (const row of payload.data?.tradesTable?.rows ?? []) {
    const close = toNumber(row.close);
    if (close === null || close <= 0 || !row.date) continue;
    const [month, day, year] = row.date.split("/").map(Number);
    if (!month || !day || !year) continue;
    points.push({ close, date: new Date(Date.UTC(year, month - 1, day)) });
  }
  if (points.length < 30) throw new Error(`thin nasdaq history for ${symbol}`);
  return sortPoints(points);
}

async function fetchBinanceHistory(symbol: string): Promise<Point[]> {
  const payload = await getJson<Array<[number, string, string, string, string]>>(
    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}USDT&interval=1d&limit=365`,
    {},
    3600,
  );
  const points: Point[] = [];
  for (const row of payload) {
    const close = Number(row?.[4]);
    const ts = Number(row?.[0]);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(ts)) {
      points.push({ close, date: new Date(ts) });
    }
  }
  if (points.length < 30) throw new Error(`thin binance history for ${symbol}`);
  return sortPoints(points);
}

async function fetchOkxHistory(symbol: string): Promise<Point[]> {
  const payload = await getJson<{ data?: string[][] }>(
    `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(symbol)}-USDT&bar=1D&limit=365`,
    {},
    3600,
  );
  const points: Point[] = [];
  for (const row of payload.data ?? []) {
    const close = Number(row[4]);
    const ts = Number(row[0]);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(ts)) {
      points.push({ close, date: new Date(ts) });
    }
  }
  if (points.length < 30) throw new Error(`thin okx history for ${symbol}`);
  return sortPoints(points);
}

async function fetchGateHistory(symbol: string): Promise<Point[]> {
  const payload = await getJson<string[][]>(
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${encodeURIComponent(symbol)}_USDT&interval=1d&limit=365`,
    {},
    3600,
  );
  const points: Point[] = [];
  for (const row of payload) {
    const ts = Number(row[0]);
    const close = Number(row[2]);
    if (Number.isFinite(close) && close > 0 && Number.isFinite(ts)) {
      points.push({ close, date: new Date(ts * 1000) });
    }
  }
  if (points.length < 30) throw new Error(`thin gate history for ${symbol}`);
  return sortPoints(points);
}

async function fetchCoinGeckoHistory(symbol: string): Promise<Point[]> {
  const id = COINGECKO_IDS[symbol];
  if (!id) throw new Error(`unknown coingecko id ${symbol}`);
  const payload = await getJson<{ prices?: [number, number][] }>(
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`,
    {},
    3600,
  );
  const points: Point[] = [];
  const seen = new Set<string>();
  for (const [ts, price] of payload.prices ?? []) {
    if (!Number.isFinite(price) || price <= 0) continue;
    const date = new Date(ts);
    const key = date.toISOString().slice(0, 10);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ close: price, date });
  }
  if (points.length < 30) throw new Error(`thin coingecko history for ${symbol}`);
  return sortPoints(points);
}

/* --------------------------------- cache --------------------------------- */

type CacheEntry<T> = { value: T; ts: number };

const quoteCache = new Map<string, CacheEntry<FeedQuote>>();
const telemetryCache = new Map<string, RealTelemetry>();
const historyCache = new Map<string, CacheEntry<Point[]>>();

let snapshot: MarketSnapshot | null = null;
let inflight: Promise<MarketSnapshot> | null = null;

function fresh<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return Boolean(entry && Date.now() - entry.ts < ttl);
}

async function loadAllLiveQuotes(): Promise<{
  quotes: Record<string, FeedQuote>;
  telemetry: Record<string, RealTelemetry>;
  sources: string[];
}> {
  const [tvRes, binRes, okxRes, bybitRes, kucoinRes, gateRes, mexcRes, cgRes] = await Promise.allSettled([
    fetchTradingViewStocksBulk(),
    fetchBinanceBulk(),
    fetchOkxBulk(),
    fetchBybitBulk(),
    fetchKucoinBulk(),
    fetchGateBulk(),
    fetchMexcBulk(),
    fetchCoinGeckoBulkCached(),
  ]);

  const quotes: Record<string, FeedQuote> = {};
  const telemetry: Record<string, RealTelemetry> = {};
  const sources = new Set<string>();

  if (tvRes.status === "fulfilled") {
    Object.assign(quotes, tvRes.value.quotes);
    Object.assign(telemetry, tvRes.value.telemetry);
    if (Object.keys(tvRes.value.quotes).length > 0) sources.add("NYSE/Nasdaq Live");
  }

  // Fallback for any equities TradingView missed
  const missingStocks = ASSETS.filter((a) => a.kind === "stock" && !quotes[a.symbol]);
  if (missingStocks.length > 0) {
    try {
      const nasdaqExtra = await fetchNasdaqScreenerBulk(missingStocks);
      Object.assign(quotes, nasdaqExtra);
      if (Object.keys(nasdaqExtra).length > 0) sources.add("Nasdaq Live");
    } catch {
      // ignore if screener unavailable
    }
  }

  // Crypto precedence: Binance > OKX > Bybit > KuCoin > Gate > CoinGecko > MEXC
  const binance = binRes.status === "fulfilled" ? binRes.value : {};
  const okx = okxRes.status === "fulfilled" ? okxRes.value : {};
  const bybit = bybitRes.status === "fulfilled" ? bybitRes.value : {};
  const kucoin = kucoinRes.status === "fulfilled" ? kucoinRes.value : {};
  const gate = gateRes.status === "fulfilled" ? gateRes.value : {};
  const mexc = mexcRes.status === "fulfilled" ? mexcRes.value : {};
  const cg = cgRes.status === "fulfilled" ? cgRes.value : { quotes: {}, telemetry: {} };

  if (Object.keys(binance).length > 0) sources.add("Binance Live");
  if (Object.keys(okx).length > 0) sources.add("OKX Live");
  if (Object.keys(cg.quotes).length > 0) sources.add("CoinGecko Live");

  for (const asset of ASSETS) {
    if (asset.kind === "stock") continue;
    const sym = asset.symbol;
    const q =
      binance[sym] ??
      okx[sym] ??
      bybit[sym] ??
      kucoin[sym] ??
      gate[sym] ??
      cg.quotes[sym] ??
      mexc[sym];

    if (q) {
      quotes[sym] = q;
    } else {
      const cached = quoteCache.get(sym);
      if (cached) quotes[sym] = cached.value;
    }

    const tel = cg.telemetry[sym];
    if (tel) {
      telemetry[sym] = {
        ...tel,
        price: q?.price ?? tel.price,
        change24h: q?.change ?? tel.change24h,
      };
    } else if (q) {
      telemetry[sym] = {
        price: q.price,
        change24h: q.change,
      };
    }
  }

  const nowTs = Date.now();
  for (const [sym, q] of Object.entries(quotes)) {
    quoteCache.set(sym, { value: q, ts: nowTs });
  }
  for (const [sym, tel] of Object.entries(telemetry)) {
    telemetryCache.set(sym, tel);
  }

  return {
    quotes,
    telemetry,
    sources: Array.from(sources),
  };
}

function withLiveClose(points: Point[], quote: FeedQuote | undefined): Point[] {
  if (!points.length) return points;
  const next = points.slice();
  if (quote) next[next.length - 1] = { close: quote.price, date: next[next.length - 1].date };
  return next;
}

export async function ensureSymbolHistory(symbol: string): Promise<Point[]> {
  const asset = ASSET_BY_SYMBOL[symbol.toUpperCase()];
  if (!asset) return [];

  const cached = historyCache.get(asset.symbol);
  const stalePoints = cached?.value;
  if (fresh(cached, HISTORY_TTL)) return cached.value;

  const fetchers =
    asset.kind === "stock"
      ? [() => fetchYahooStockHistory(asset.symbol), () => fetchNasdaqStockHistory(asset.symbol)]
      : [
          () => fetchBinanceHistory(asset.symbol),
          () => fetchOkxHistory(asset.symbol),
          () => fetchGateHistory(asset.symbol),
          () => fetchCoinGeckoHistory(asset.symbol),
        ];

  for (const fetcher of fetchers) {
    try {
      const pts = await fetcher();
      historyCache.set(asset.symbol, { value: pts, ts: Date.now() });
      const liveQ = quoteCache.get(asset.symbol)?.value;
      const updated = withLiveClose(pts, liveQ);
      setMarketData({ [asset.symbol]: updated }, liveQ ? { [asset.symbol]: liveQ } : {});
      return updated;
    } catch {
      // Try next venue
    }
  }
  return stalePoints ?? [];
}

async function buildSnapshot(): Promise<MarketSnapshot> {
  try {
    const { quotes, telemetry, sources } = await loadAllLiveQuotes();

    const points: Record<string, Point[]> = {};
    for (const [symbol, entry] of historyCache.entries()) {
      points[symbol] = withLiveClose(entry.value, quotes[symbol]);
    }

    const missing = ASSETS.filter((asset) => !quotes[asset.symbol]).map((asset) => asset.symbol);

    return {
      quotes,
      telemetry,
      points,
      fetchedAt: Date.now(),
      sources: sources.length ? sources : ["NYSE/Nasdaq Live", "Binance Live"],
      missing,
    };
  } catch (err) {
    console.warn("Market snapshot build warning:", err);
    const cachedQuotes: Record<string, FeedQuote> = {};
    for (const [sym, entry] of quoteCache.entries()) cachedQuotes[sym] = entry.value;
    const cachedTelemetry: Record<string, RealTelemetry> = {};
    for (const [sym, entry] of telemetryCache.entries()) cachedTelemetry[sym] = entry;
    return {
      quotes: cachedQuotes,
      telemetry: cachedTelemetry,
      points: {},
      fetchedAt: Date.now(),
      sources: ["NYSE/Nasdaq Live", "Binance Live"],
      missing: [],
    };
  }
}

const COLD_START_BUDGET_MS = 4500;

export async function ensureMarketData(force = false): Promise<MarketSnapshot> {
  if (!force && snapshot && Date.now() - snapshot.fetchedAt < QUOTE_TTL) return snapshot;
  if (!inflight) {
    inflight = buildSnapshot()
      .then((next) => {
        setMarketData(next.points, next.quotes, next.telemetry);
        snapshot = next;
        return next;
      })
      .catch(() => ({
        quotes: {},
        telemetry: {},
        points: {},
        fetchedAt: Date.now(),
        sources: ["NYSE/Nasdaq Live", "Binance Live"],
        missing: [],
      }))
      .finally(() => {
        inflight = null;
      });
  }

  if (!snapshot && !force) {
    const fallback: MarketSnapshot = {
      quotes: {},
      telemetry: {},
      points: {},
      fetchedAt: 0,
      sources: ["NYSE/Nasdaq Live", "Binance Live"],
      missing: [],
    };
    return Promise.race([
      inflight,
      new Promise<MarketSnapshot>((resolve) => setTimeout(() => resolve(fallback), COLD_START_BUDGET_MS)),
    ]);
  }

  return inflight;
}

export function getCachedSnapshot(): MarketSnapshot | null {
  return snapshot;
}
