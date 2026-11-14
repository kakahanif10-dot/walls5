"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useWhop } from "@/lib/whop-context";
import type { FrontpageIntelBundle } from "@/lib/live-frontpage-data";

function fmtUsdCompact(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}

function fmtSpot(val: number): string {
  return `$${val.toLocaleString("en-US", {
    minimumFractionDigits: val < 1 ? 4 : 2,
    maximumFractionDigits: val < 1 ? 6 : 2,
  })}`;
}

export default function FrontpageTriplePoster({
  initialData,
}: {
  initialData: FrontpageIntelBundle;
}) {
  const { isUnlocked, openWhopModal } = useWhop();
  const [bundle, setBundle] = useState<FrontpageIntelBundle>(initialData);
  const [refreshing, setRefreshing] = useState(false);

  const refreshLive = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/frontpage-intel", { cache: "no-store" });
      if (res.ok) {
        const next: FrontpageIntelBundle = await res.json();
        setBundle(next);
      }
    } catch {
      // keep existing live bundle
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshLive();
    }, 45_000);
    return () => window.clearInterval(id);
  }, []);

  const { whales, sentiment, topSignals } = bundle;
  const topWhales = whales.report.items.slice(0, 4);
  const top3Signals = topSignals.signals.slice(0, 3);

  const renderViewAllButton = (href: string, toolLabel: string) => {
    if (isUnlocked) {
      return (
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full bg-ink-950/80 px-4 py-2 text-xs font-semibold text-gold-bright transition hover:bg-ink-850"
        >
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5 text-gold-bright" />
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={() => openWhopModal(toolLabel)}
        className="inline-flex items-center gap-2 rounded-full bg-ink-950/80 px-4 py-2 text-xs font-semibold text-gold-bright transition hover:bg-ink-850"
      >
        <span>View All · $1,487 USD</span>
      </button>
    );
  };

  return (
    <section
      aria-label="Real-Time Market Intelligence Poster"
      className="bg-ink-950"
    >
      <div className="mx-auto max-w-7xl px-5 py-12 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Live Market Desk Brief · Real-Time Feeds
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl text-bone">
              Whale Tape, AI Sentiment &amp; Highest-Conviction Signals
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void refreshLive()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/80 px-3.5 py-1.5 font-mono text-[11px] text-muted transition hover:bg-ink-850 hover:text-bone disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 text-gold-bright ${refreshing ? "animate-spin" : ""}`} />
            <span>Sync Live</span>
          </button>
        </div>

        {/* POSTER SECTION 1: LIVE WHALE MOVEMENT FEED (TOOL #30) */}
        <article className="rounded-2xl bg-ink-900/55 p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <p className="font-mono text-[11px] text-muted">
                {whales.sources.join(" · ")}
              </p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl text-bone">
                Live Whale Movement Feed (Whale Alert)
              </h3>
            </div>

            {renderViewAllButton(
              "/tools/whale-alert",
              "Trade Tool #30 · Live Whale Movement Feed",
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-ink-950/75 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Net Flow Bias</p>
              <p
                className={`mt-1 font-mono text-base font-bold ${
                  whales.report.netFlowBias === "Accumulation"
                    ? "text-up"
                    : whales.report.netFlowBias === "Distribution"
                    ? "text-down"
                    : "text-gold-bright"
                }`}
              >
                {whales.report.netFlowBias}
              </p>
            </div>
            <div className="rounded-xl bg-ink-950/75 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Tracked Flow</p>
              <p className="mt-1 font-mono text-base font-bold text-bone tabular-nums">
                {fmtUsdCompact(whales.report.totalTrackedUsd)}
              </p>
            </div>
            <div className="rounded-xl bg-ink-950/75 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Largest Print</p>
              <p className="mt-1 font-mono text-base font-bold text-gold-bright tabular-nums">
                {fmtUsdCompact(whales.report.largestPrintUsd)}
              </p>
            </div>
            <div className="rounded-xl bg-ink-950/75 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">ETH Block</p>
              <p className="mt-1 font-mono text-base font-bold text-bone tabular-nums">
                {whales.report.ethBlockNumber > 0
                  ? `#${whales.report.ethBlockNumber.toLocaleString()}`
                  : "Mainnet Live"}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-1.5 rounded-xl bg-ink-950/55 p-2">
            {topWhales.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs transition hover:bg-ink-900/45"
              >
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span className="rounded bg-ink-900/90 px-2 py-0.5 font-mono text-[10px] font-bold text-gold-bright">
                    {item.direction}
                  </span>
                  <span className="font-mono font-bold text-bone">{item.asset}</span>
                  <span className="text-bone/85 truncate">{item.summary}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-muted">
                  <span className="font-semibold text-gold-bright tabular-nums">
                    {item.amountLabel}
                  </span>
                  <span>{item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* POSTER SECTION 2: REAL-TIME AI MARKET SENTIMENT (TOOL #31) */}
        <article className="rounded-2xl bg-ink-900/55 p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <p className="font-mono text-[11px] text-muted">
                {sentiment.sources.join(" · ")}
              </p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl text-bone">
                Real-Time AI Market Sentiment
              </h3>
            </div>

            {renderViewAllButton(
              "/tools/ai-sentiment",
              "Trade Tool #31 · Real-Time AI Market Sentiment",
            )}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl bg-ink-950/75 p-5 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    Composite AI Sentiment
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold text-bone tabular-nums">
                      {sentiment.report.compositeScore}
                    </span>
                    <span className="text-xs text-muted">/ 100</span>
                  </div>
                </div>
                <span className="rounded-full bg-ink-900/90 px-3 py-1 font-mono text-xs font-semibold text-gold-bright">
                  {sentiment.report.regime}
                </span>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-900">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${sentiment.report.compositeScore}%` }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted">
                  Posture: <strong className="text-bone">{sentiment.report.stanceBias}</strong>
                </span>
                <span className="font-mono text-gold-bright">
                  Confidence {sentiment.report.confidencePct}%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {sentiment.report.drivers.map((driver) => (
                  <div
                    key={driver.label}
                    className="rounded-xl bg-ink-950/75 px-4 py-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
                      {driver.label}
                    </p>
                    <p
                      className={`mt-1.5 font-mono text-xs font-semibold ${
                        driver.tone === "bull"
                          ? "text-up"
                          : driver.tone === "bear"
                          ? "text-down"
                          : "text-bone"
                      }`}
                    >
                      {driver.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl bg-ink-950/75 px-4 py-3.5 text-xs leading-relaxed text-bone/90">
                {sentiment.report.deskSummary}
              </div>
            </div>
          </div>
        </article>

        {/* POSTER SECTION 3: TOP 3 SIGNALS TODAY (TOOL #32) */}
        <article className="rounded-2xl bg-ink-900/55 p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div>
              <p className="font-mono text-[11px] text-muted">
                {topSignals.sources.join(" · ")}
              </p>
              <h3 className="mt-1 font-display text-xl sm:text-2xl text-bone">
                Top 3 Signals Today
              </h3>
            </div>

            {renderViewAllButton(
              "/tools/top-signals",
              "Trade Tool #32 · Top 3 Signals Today",
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {top3Signals.map((sig) => (
              <div
                key={sig.symbol}
                className="flex flex-col justify-between rounded-xl bg-ink-950/75 p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-ink-900/90 px-2 py-0.5 font-mono text-[11px] font-bold text-gold-bright">
                        #{sig.rank}
                      </span>
                      <span className="font-mono text-base font-bold text-bone">
                        {sig.symbol}
                      </span>
                    </div>
                    <span className="rounded-full bg-ink-900/90 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gold-bright">
                      {sig.stance} · {sig.score}/100
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted truncate">
                    {sig.name} · {sig.group}
                  </p>

                  <div className="mt-4 flex items-baseline justify-between py-2 font-mono">
                    <span className="text-lg font-bold text-bone tabular-nums">
                      {fmtSpot(sig.price)}
                    </span>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        sig.change24h >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {sig.change24h >= 0 ? "+" : ""}
                      {sig.change24h.toFixed(2)}% (24h)
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
                    <div>
                      <p className="text-[10px] text-muted">Target</p>
                      <p className="font-semibold text-up tabular-nums">
                        {fmtSpot(sig.targetPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted">Invalidation</p>
                      <p className="font-semibold text-down tabular-nums">
                        {fmtSpot(sig.invalidationPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted">R:R Ratio</p>
                      <p className="font-semibold text-gold-bright tabular-nums">
                        {sig.riskReward}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 pt-1 text-[11px] leading-relaxed text-muted">
                  {sig.rationale}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
