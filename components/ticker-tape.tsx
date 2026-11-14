"use client";

import { useFeedMeta, useQuote } from "@/components/live-prices";
import { fmtPct, fmtPrice, type Row } from "@/lib/market";

function TapeItem({ row }: { row: Row }) {
  const quote = useQuote(row.symbol);
  const price = quote?.price ?? row.price;
  const change = quote?.change ?? row.change24h;
  const flash = quote?.dir && quote.dir > 0 ? "flash-up" : quote?.dir && quote.dir < 0 ? "flash-down" : "";

  return (
    <span className="flex items-center gap-2 whitespace-nowrap text-xs">
      <span className="font-mono font-semibold tracking-wide text-bone/90">{row.symbol}</span>
      <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
        <span key={`tp-${quote?.tick ?? 0}`} className={`inline-block text-muted ${flash}`}>
          {fmtPrice(price, row.kind)}
        </span>
        {" "}
        <span
          key={`tc-${quote?.tick ?? 0}`}
          className={`inline-block ${change >= 0 ? "text-up" : "text-down"} ${flash}`}
        >
          {fmtPct(change)}
        </span>
      </span>
      <span className="text-line" aria-hidden="true">|</span>
    </span>
  );
}

export default function TickerTape({ rows }: { rows: Row[] }) {
  const { mode } = useFeedMeta();

  return (
    <div className="overflow-hidden border-y border-line/70 bg-ink-900/70">
      <div className="flex items-stretch">
        <div className="z-10 flex shrink-0 items-center gap-1.5 border-r border-line/70 bg-ink-900 px-3">
          <span
            className={`live-dot h-1.5 w-1.5 rounded-full ${mode === "live" ? "bg-up" : "bg-gold"}`}
            aria-hidden="true"
          />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Market Tape · Real-Time Equities &amp; Live Crypto
          </span>
        </div>
        <div className="marquee-track flex items-center gap-8 py-2.5">
          {rows.map((row) => (
            <TapeItem key={row.symbol} row={row} />
          ))}
          <div className="flex items-center gap-8" aria-hidden="true">
            {rows.map((row) => (
              <TapeItem key={`${row.symbol}-loop`} row={row} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
