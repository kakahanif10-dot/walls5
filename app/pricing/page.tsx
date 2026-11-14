import type { Metadata } from "next";
import Link from "next/link";
import PricingPlans from "@/components/pricing-plans";

export const metadata: Metadata = {
  title: "Lifetime Access & Plans",
  description:
    "Reader is free. Lifetime Access is a $2,497 one-time payment for all 2,038+ daily trend scores, exact invalidation levels, 70 research desks, 60 Academy lessons, 29 trade tools, and all future desk updates.",
};

const FAQ = [
  {
    q: "Is this investment advice?",
    a: "No. NextWallStreet publishes market analysis and education. We describe what the tape is doing, how the model scores it and where the call breaks. We do not manage money, do not take positions in the names we cover and do not tell you what to buy.",
  },
  {
    q: "How are the trend scores calculated?",
    a: "A weighted composite of five inputs: price versus the 20-day, the 20-versus-50-day, the 50-versus-200-day, 30-session rate of change and RSI positioning. Weights are published on the methodology page, and each asset page shows the component breakdown.",
  },
  {
    q: "How do you grade speculative digital assets?",
    a: "As pure liquidity risk, not investments. The sector has no cash flows, so we score concentration, order-book depth and narrative decay, and we cap conviction deliberately. Our coverage is designed to keep subscribers out of liquidity traps, not to talk them into positions.",
  },
  {
    q: "What is included in $2,497 One-Time Lifetime Access?",
    a: "A single payment of $2,497 permanently unlocks all 2,038+ daily trend scores, exact invalidation levels, 70 research desks, the complete 60-lesson Academy curriculum, 29 trade tools, and all future desk updates with zero recurring monthly or annual fees.",
  },
  {
    q: "Can teams still request multi-seat institutional access?",
    a: "Yes. Institutional accounts include multi-seat governance, shared watchlists, CSV signal history logs, and API access for fund workflows.",
  },
];

export default function PricingPage() {
  return (
    <div>
      <section className="grain border-b border-line/60">
        <div className="mx-auto max-w-7xl px-5 py-14 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">Lifetime Access</p>
          <h1 className="mx-auto mt-4 max-w-2xl font-display text-4xl leading-tight text-bone sm:text-5xl">
            Analysis you can audit. One-time lifetime access.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            One desk, one methodology, zero recurring monthly fees for individual Lifetime Access
            members. Unlock all 2,038+ daily scores, exact invalidation levels, 70 research desks, 60 Academy lessons, 29 trade tools, and our 1,100+ member community.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <PricingPlans faqList={FAQ} />

        <div className="mt-12 text-center text-xs text-muted">
          Still deciding? Read{" "}
          <Link href="/research" className="text-bone/85 underline decoration-line underline-offset-2 hover:text-gold-bright">
            free research
          </Link>{" "}
          or start with the{" "}
          <Link href="/academy/reading-trends" className="text-bone/85 underline decoration-line underline-offset-2 hover:text-gold-bright">
            foundation course
          </Link>
          .
        </div>
      </section>
    </div>
  );
}

