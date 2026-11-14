"use client";

import { useState } from "react";
import {
  Check,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  KeyRound,
  ExternalLink,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWhop } from "@/lib/whop-context";
import { PLANS } from "@/lib/content";
import { getLifetimeCheckoutUrl } from "@/lib/whop-checkout-links";

const ACCOUNT_BILLING_FAQ = [
  {
    q: "How does the one-time $1,487 USD Lifetime Premium purchase work?",
    a: "Lifetime Premium is a single one-time payment of $1,487 USD processed via Whop with zero recurring monthly or annual fees. You receive permanent access to all 2,038+ daily trend scores, full crypto and meme-coin coverage, all four Academy courses, score-change alerts, all 32 trade tools, and model portfolio access.",
  },
  {
    q: "What payment methods are supported through Whop?",
    a: "Whop supports major credit and debit cards (Visa, Mastercard, American Express, Discover), digital wallets (Apple Pay, Google Pay), SEPA Direct Debit, and cryptocurrency rails (USDC, USDT, Ethereum, Solana, Bitcoin).",
  },
  {
    q: "When is access activated after checkout?",
    a: "Access is activated only after payment verification. After completing your one-time $1,487 USD purchase on Whop, click Verify Whop License Key on any page or in the activation bar below to unlock the full platform immediately.",
  },
  {
    q: "How do I restore Lifetime Premium access across devices?",
    a: "Click Verify Whop License Key on the Pricing page or on any locked desk, enter your Whop license key or checkout email, and your cloud profile and active session will unlock across devices.",
  },
  {
    q: "Are receipts and invoices issued automatically?",
    a: "Yes. Tax-compliant receipts and line-item invoices are generated automatically by Whop and emailed immediately following payment verification.",
  },
];

interface PricingPlansProps {
  faqList: { q: string; a: string }[];
}

export default function PricingPlans({ faqList }: PricingPlansProps) {
  const { user, profile } = useAuth();
  const { isUnlocked, openWhopModal } = useWhop();
  const [faqCategory, setFaqCategory] = useState<"billing" | "general">("billing");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const lifetimePlan = PLANS[0];
  const lifetimeCheckoutUrl = getLifetimeCheckoutUrl();
  const isCurrentActive = isUnlocked || profile?.plan === "premium" || profile?.plan === "institutional";

  return (
    <div className="space-y-12">
      {/* Existing Key Quick Activation */}
      <div className="flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => openWhopModal("Verify Whop Lifetime Key")}
          className="inline-flex items-center gap-2 rounded-full border border-gold/45 bg-gold/10 px-5 py-2 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
        >
          <KeyRound className="h-3.5 w-3.5 text-gold" />
          <span>Already purchased on Whop? Verify License Key to Unlock</span>
        </button>

        {user && (
          <p className="text-xs text-muted">
            Signed in as <strong className="text-bone">{user.email}</strong> · Status:{" "}
            <span className="font-mono font-bold uppercase text-gold-bright">
              {isCurrentActive ? "LIFETIME PREMIUM" : "LOCKED"}
            </span>
          </p>
        )}
      </div>

      {/* Single Prestigious Lifetime Premium Card */}
      <div className="mx-auto max-w-2xl">
        <div className="relative overflow-hidden rounded-2xl border border-gold/60 bg-gradient-to-b from-[#17130a] via-ink-900 to-ink-950 p-7 sm:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.75)] ring-1 ring-gold/30">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent" />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-gold px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-950">
              One-Time · Lifetime Purchase
            </span>
            {isCurrentActive && (
              <span className="rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                Active Membership ✓
              </span>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line/60 pb-6">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl text-bone">{lifetimePlan.name}</h2>
              <p className="mt-1.5 text-sm text-muted">{lifetimePlan.tagline}</p>
            </div>
            <div className="sm:text-right">
              <div className="flex items-baseline sm:justify-end gap-2">
                <span className="font-display text-4xl sm:text-5xl font-bold text-gold-bright tabular-nums">
                  $1,487
                </span>
                <span className="font-mono text-sm font-semibold text-bone">USD</span>
              </div>
              <p className="mt-1 text-xs text-muted">One-time · Lifetime · Zero monthly renewals</p>
            </div>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-1">
            {lifetimePlan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm leading-relaxed text-bone/90">
                <Check className="mt-1 h-4 w-4 shrink-0 text-gold" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-3">
            {isCurrentActive ? (
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-6 py-3.5 text-sm font-semibold text-emerald-300"
              >
                <Check className="h-4 w-4" />
                <span>Lifetime Premium Unlocked</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-bold text-ink-950 transition hover:bg-gold-bright shadow-xl"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Continue to Lifetime Premium checkout — $1,487 USD</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <p className="text-center text-[11px] text-muted">
              You will continue to Whop to complete the one-time $1,487 USD purchase. Access is
              activated only after payment verification.
            </p>
          </div>
        </div>
      </div>

      {/* Included Institutional Scope Table */}
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line bg-ink-900/60 p-6">
        <h3 className="font-display text-2xl text-bone mb-4">Everything Included With Lifetime Premium ($1,487 USD)</h3>
        <div className="divide-y divide-line/60 text-xs sm:text-sm">
          {[
            ["Tracked Universe", "All 2,038+ equities, crypto & meme-coin risk models"],
            ["Research Desks", "All 70 institutional research decks & invalidation reports"],
            ["The Academy", "All 4 courses & 60 watchable video masterclasses"],
            ["Trade Tools Directory", "All 32 institutional tools including #30 Whale Alert, #31 AI Sentiment & #32 Top 3 Signals"],
            ["Community & Alerts", "Live trading floor chat & real-time score-change alerts"],
            ["Billing Structure", "$1,487 USD one-time · Lifetime access (no subscriptions)"],
          ].map(([item, value]) => (
            <div key={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-3.5">
              <span className="font-medium text-bone">{item}</span>
              <span className="font-mono text-xs text-gold-bright">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive FAQ Accordion */}
      <div className="space-y-6 pt-4">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            Support &amp; Clarity
          </p>
          <h2 className="font-display text-2xl sm:text-3xl text-bone">Frequently asked questions</h2>
          <p className="text-xs text-muted max-w-lg mx-auto">
            Details on the one-time $1,487 USD Whop checkout, payment verification, and scoring methodology.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setFaqCategory("billing");
              setExpandedFaq(0);
            }}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              faqCategory === "billing"
                ? "bg-gold text-ink-950"
                : "border border-line bg-ink-900 text-muted hover:text-bone hover:border-gold/40"
            }`}
          >
            Checkout &amp; Verification (Whop)
          </button>

          <button
            type="button"
            onClick={() => {
              setFaqCategory("general");
              setExpandedFaq(0);
            }}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              faqCategory === "general"
                ? "bg-gold text-ink-950"
                : "border border-line bg-ink-900 text-muted hover:text-bone hover:border-gold/40"
            }`}
          >
            General &amp; Methodology
          </button>
        </div>

        <div className="mx-auto max-w-3xl space-y-3 pt-2">
          {(faqCategory === "billing" ? ACCOUNT_BILLING_FAQ : faqList).map((item, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={item.q}
                className="rounded-xl border border-line bg-ink-900/60 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-sm font-semibold text-bone hover:text-gold-bright transition"
                >
                  <span className="flex items-center gap-2">
                    {faqCategory === "billing" && <KeyRound className="h-3.5 w-3.5 text-gold shrink-0" />}
                    <span>{item.q}</span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-gold shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted shrink-0 ml-2" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-muted leading-relaxed border-t border-line/40 animate-in fade-in">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* PRESTIGIOUS LIFETIME CHECKOUT MODAL WITH EXACT REQUIRED COPY */}
      {showCheckoutModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCheckoutModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-dialog-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-b from-[#13110c] via-ink-900 to-ink-950 p-6 sm:p-7 shadow-[0_32px_90px_rgba(0,0,0,0.92)] ring-1 ring-gold/25 space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-bright/80 to-transparent" />

            <button
              type="button"
              aria-label="Close purchase dialog"
              onClick={() => setShowCheckoutModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition hover:bg-ink-800 hover:text-bone"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/50 bg-gold/10 text-gold-bright">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                  Purchase details
                </p>
                <h3 id="pricing-dialog-title" className="font-display text-xl text-bone">
                  Continue to Lifetime Premium checkout
                </h3>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              Get every research piece, full crypto and meme-coin coverage, all four Academy
              courses, score-change alerts, and model portfolio access with one lifetime purchase.
            </p>

            <div className="rounded-xl border border-gold/30 bg-ink-950/90 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Selected Tier:</span>
                <strong className="text-bone">Lifetime Premium</strong>
              </div>
              <div className="flex justify-between border-t border-line/50 pt-2">
                <span className="text-muted">Payment type:</span>
                <span className="font-medium text-bone">One-time · Lifetime</span>
              </div>
              <div className="flex justify-between border-t border-line/50 pt-2">
                <span className="text-muted">Amount due once:</span>
                <span className="font-mono text-base font-bold text-gold-bright tabular-nums">
                  $1,487 USD
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              You will continue to Whop to complete the one-time $1,487 USD purchase. Access is
              activated only after payment verification.
            </p>

            {!lifetimeCheckoutUrl && (
              <p role="status" className="text-[11px] text-amber-200">
                Whop checkout URL environment variable (NEXT_PUBLIC_WHOP_CHECKOUT_LIFETIME_URL) is not configured yet.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowCheckoutModal(false);
                  openWhopModal("Verify Whop Lifetime Key");
                }}
                className="text-xs font-medium text-gold-bright hover:underline"
              >
                Verify Whop License Key
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="rounded-full border border-line px-4 py-2 text-xs text-muted hover:text-bone"
                >
                  Cancel
                </button>
                {lifetimeCheckoutUrl ? (
                  <a
                    href={lifetimeCheckoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-xs font-bold text-ink-950 transition hover:bg-gold-bright shadow-lg"
                  >
                    <span>Continue to Whop</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-xs font-bold text-ink-950 opacity-50"
                  >
                    <span>Checkout URL Required</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
