"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentPropsWithoutRef, MouseEvent, ReactNode } from "react";
import { ShieldCheck, ExternalLink, KeyRound, ArrowRight } from "lucide-react";
import { useWhop } from "@/lib/whop-context";
import { getLifetimeCheckoutUrl } from "@/lib/whop-checkout-links";

const PUBLIC_PATHS = new Set(["/", "/pricing", "/disclaimer"]);

export function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

interface LockedLinkProps extends Omit<ComponentPropsWithoutRef<typeof Link>, "href"> {
  href: string;
  deskLabel?: string;
  children: ReactNode;
}

export function LockedLink({
  href,
  deskLabel,
  onClick,
  children,
  target,
  rel,
  ...rest
}: LockedLinkProps) {
  const { isUnlocked, openWhopModal } = useWhop();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isUnlocked && !isPublicRoute(href.split("?")[0])) {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e);
      openWhopModal(deskLabel || href);
      return;
    }
    onClick?.(e);
  };

  return (
    <Link
      href={href}
      prefetch={isUnlocked ? undefined : false}
      target={isUnlocked ? target : undefined}
      rel={isUnlocked ? rel : undefined}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function LifetimeRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isUnlocked, hasCheckedStorage, openWhopModal } = useWhop();
  const checkoutUrl = getLifetimeCheckoutUrl();

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  if (!hasCheckedStorage) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-5 py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/40 border-t-gold" />
      </div>
    );
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-5 py-16">
      <div className="relative w-full overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-b from-[#13110c] via-ink-900 to-ink-950 p-7 sm:p-8 shadow-[0_32px_90px_rgba(0,0,0,0.85)] ring-1 ring-gold/20 space-y-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-bright/80 to-transparent" />

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
            Purchase details
          </p>
          <h1 className="mt-1 font-display text-2xl text-bone">
            Continue to Lifetime Premium checkout
          </h1>
        </div>

        <p className="text-xs sm:text-sm leading-relaxed text-muted">
          Get every research piece, full crypto and meme-coin coverage, all four Academy courses,
          score-change alerts, and model portfolio access with one lifetime purchase.
        </p>

        <div className="rounded-xl border border-gold/30 bg-ink-950/90 p-4 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted">Selected Tier:</span>
            <span className="font-semibold text-bone">Lifetime Premium</span>
          </div>
          <div className="flex items-center justify-between border-t border-line/50 pt-2">
            <span className="text-muted">Payment type:</span>
            <span className="font-medium text-bone">One-time · Lifetime</span>
          </div>
          <div className="flex items-center justify-between border-t border-line/50 pt-2">
            <span className="text-muted">Amount due once:</span>
            <span className="font-mono text-lg font-bold text-gold-bright tabular-nums">
              $1,487 USD
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-xs font-bold text-ink-950 transition hover:bg-gold-bright shadow-lg"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Continue to Lifetime Premium checkout</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openWhopModal("Lifetime Premium")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-xs font-bold text-ink-950 transition hover:bg-gold-bright shadow-lg"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Continue to Lifetime Premium checkout</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => openWhopModal("Verify Whop Purchase")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs font-semibold text-gold-bright transition hover:bg-gold/20"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Verify Existing Whop License Key</span>
          </button>
        </div>

        <p className="text-[11px] leading-relaxed text-muted/85 text-center">
          You will continue to Whop to complete the one-time $1,487 USD purchase. Access is
          activated only after payment verification.
        </p>

        <div className="flex items-center justify-center gap-4 border-t border-line/60 pt-3 text-xs text-muted">
          <Link href="/" className="hover:text-bone transition">
            ← Return Home
          </Link>
          <span>·</span>
          <Link href="/pricing" className="text-gold-bright hover:underline">
            View Pricelist
          </Link>
        </div>
      </div>
    </div>
  );
}
