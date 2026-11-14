"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getLifetimeCheckoutUrl } from "@/lib/whop-checkout-links";
import {
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  X,
} from "lucide-react";

interface WhopContextValue {
  isUnlocked: boolean;
  hasCheckedStorage: boolean;
  badge: string;
  unlockWithWhop: (options?: { licenseKey?: string; email?: string }) => Promise<boolean>;
  lockWhop: () => void;
  openWhopModal: (deskName?: string) => void;
  closeWhopModal: () => void;
  isModalOpen: boolean;
}

const WhopContext = createContext<WhopContextValue>({
  isUnlocked: false,
  hasCheckedStorage: false,
  badge: "LIFETIME",
  unlockWithWhop: async () => false,
  lockWhop: () => {},
  openWhopModal: () => {},
  closeWhopModal: () => {},
  isModalOpen: false,
});

export function WhopProvider({ children }: { children: ReactNode }) {
  const { user, profile, updateUserPlan } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deskName, setDeskName] = useState<string>("Lifetime Premium");
  const [licenseInput, setLicenseInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const lifetimeCheckoutUrl = getLifetimeCheckoutUrl();

  useEffect(() => {
    try {
      const localStatus = localStorage.getItem("nws_whop_unlocked");
      if (localStatus === "true") {
        setIsUnlocked(true);
      } else if (profile?.plan === "premium" || profile?.plan === "institutional") {
        setIsUnlocked(true);
        localStorage.setItem("nws_whop_unlocked", "true");
      }
    } catch {
      // ignore storage errors
    } finally {
      setHasCheckedStorage(true);
    }
  }, [profile]);

  const unlockWithWhop = useCallback(
    async (options?: { licenseKey?: string; email?: string }) => {
      const cleanKey = (options?.licenseKey ?? licenseInput).trim();
      const cleanEmail = (options?.email ?? emailInput).trim();
      if (!cleanKey && !cleanEmail) {
        setShowKeyForm(true);
        setFeedback({
          type: "error",
          message: "Enter your Whop license key or purchase email after completing checkout.",
        });
        return false;
      }

      setLoading(true);
      setFeedback(null);
      try {
        const res = await fetch("/api/whop/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            licenseKey: cleanKey,
            email: cleanEmail,
            action: "activate",
          }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.unlocked) {
          setIsUnlocked(true);
          try {
            localStorage.setItem("nws_whop_unlocked", "true");
            if (cleanKey) {
              localStorage.setItem("nws_whop_license", cleanKey);
            }
          } catch {}

          if (user) {
            try {
              const userRef = doc(db, "users", user.uid);
              await setDoc(userRef, { whopUnlocked: true, plan: "premium" }, { merge: true });
            } catch (err) {
              console.warn("Firestore whop sync:", err);
            }
          }
          await updateUserPlan("premium");

          setFeedback({
            type: "success",
            message:
              "Lifetime Premium verified. All 2,038+ assets, research desks, Academy courses, and 32 Trade Tools are now unlocked.",
          });
          setTimeout(() => {
            setIsModalOpen(false);
            setFeedback(null);
          }, 1600);
          return true;
        } else {
          setFeedback({
            type: "error",
            message:
              data.error ||
              "Unable to verify active Whop Lifetime purchase. Confirm your license key or checkout email.",
          });
          return false;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to connect to Whop verification.";
        setFeedback({ type: "error", message });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [licenseInput, emailInput, user, updateUserPlan],
  );

  const lockWhop = useCallback(() => {
    setIsUnlocked(false);
    try {
      localStorage.removeItem("nws_whop_unlocked");
      localStorage.removeItem("nws_whop_license");
    } catch {}
    if (user) {
      try {
        const userRef = doc(db, "users", user.uid);
        setDoc(userRef, { whopUnlocked: false, plan: "reader" }, { merge: true });
      } catch {}
    }
    updateUserPlan("reader");
    setFeedback({
      type: "success",
      message: "Lifetime session locked.",
    });
    setTimeout(() => setFeedback(null), 2000);
  }, [user, updateUserPlan]);

  const openWhopModal = useCallback((desk?: string) => {
    setDeskName(desk || "Lifetime Premium");
    setFeedback(null);
    setIsModalOpen(true);
  }, []);

  const closeWhopModal = useCallback(() => {
    setIsModalOpen(false);
    setFeedback(null);
  }, []);

  return (
    <WhopContext.Provider
      value={{
        isUnlocked,
        hasCheckedStorage,
        badge: "LIFETIME",
        unlockWithWhop,
        lockWhop,
        openWhopModal,
        closeWhopModal,
        isModalOpen,
      }}
    >
      {children}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeWhopModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lifetime-purchase-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/45 bg-gradient-to-b from-[#13110c] via-ink-900 to-ink-950 p-6 sm:p-7 shadow-[0_32px_90px_rgba(0,0,0,0.92)] ring-1 ring-gold/25"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-bright/80 to-transparent" />

            <button
              type="button"
              aria-label="Close purchase modal"
              onClick={closeWhopModal}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition hover:bg-ink-800 hover:text-bone"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-3 pr-8">
                {isUnlocked && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/50 bg-gold/10 text-gold-bright shadow-inner">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                    Purchase details
                  </p>
                  <h3
                    id="lifetime-purchase-title"
                    className="mt-0.5 font-display text-xl leading-snug text-bone"
                  >
                    {isUnlocked ? "Lifetime Premium Active" : "Continue to Lifetime Premium checkout"}
                  </h3>
                </div>
              </div>

              {!isUnlocked && deskName && deskName !== "Lifetime Premium" && (
                <div className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-1.5 text-[11px] text-gold-bright">
                  Unlocking: <span className="font-semibold text-bone">{deskName}</span>
                </div>
              )}

              <p className="text-xs leading-relaxed text-muted">
                Get every research piece, full crypto and meme-coin coverage, all four Academy
                courses, score-change alerts, and model portfolio access with one lifetime purchase.
              </p>

              {/* Prestigious Summary Ledger */}
              <div className="rounded-xl border border-gold/30 bg-ink-950/90 p-4 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Selected Tier:</span>
                  <span className="font-semibold text-bone">Lifetime Premium</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-line/50 pt-2">
                  <span className="text-muted">Payment type:</span>
                  <span className="font-medium text-bone">One-time · Lifetime</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-line/50 pt-2">
                  <span className="text-muted">Amount due once:</span>
                  <span className="font-mono text-base font-bold text-gold-bright tabular-nums">
                    $1,487 USD
                  </span>
                </div>
              </div>

              {feedback && (
                <div
                  className={`rounded-xl border p-3 text-xs leading-relaxed ${
                    feedback.type === "success"
                      ? "border-emerald-500/50 bg-emerald-950/60 text-emerald-300"
                      : "border-rose-500/50 bg-rose-950/60 text-rose-300"
                  }`}
                >
                  {feedback.message}
                </div>
              )}

              {!isUnlocked ? (
                <div className="space-y-3 pt-1">
                  {lifetimeCheckoutUrl ? (
                    <a
                      href={lifetimeCheckoutUrl}
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
                      onClick={() => setShowKeyForm(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-xs font-bold text-ink-950 transition hover:bg-gold-bright shadow-lg"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Continue to Lifetime Premium checkout</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <p className="text-[11px] leading-relaxed text-muted/85 text-center">
                    You will continue to Whop to complete the one-time $1,487 USD purchase. Access is
                    activated only after payment verification.
                  </p>

                  <div className="border-t border-line/60 pt-3">
                    {!showKeyForm ? (
                      <button
                        type="button"
                        onClick={() => setShowKeyForm(true)}
                        className="flex w-full items-center justify-center gap-1.5 text-[11px] font-medium text-gold-bright hover:underline"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Already completed payment? Verify Whop License Key</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={licenseInput}
                          onChange={(e) => setLicenseInput(e.target.value)}
                          placeholder="Paste Whop License Key..."
                          className="w-full rounded-xl border border-line bg-ink-950 px-3.5 py-2 text-xs font-mono text-bone placeholder:text-muted/60 focus:border-gold focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            placeholder="Whop Checkout Email..."
                            className="flex-1 rounded-xl border border-line bg-ink-950 px-3.5 py-2 text-xs text-bone placeholder:text-muted/60 focus:border-gold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => unlockWithWhop()}
                            disabled={loading || (!licenseInput.trim() && !emailInput.trim())}
                            className="rounded-xl border border-gold/50 bg-gold/15 px-4 py-2 text-xs font-semibold text-gold-bright transition hover:bg-gold/25 disabled:opacity-40"
                          >
                            {loading ? "Verifying..." : "Verify"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <div className="space-y-1">
                      <p className="font-semibold text-emerald-200">Lifetime Premium Unlocked</p>
                      <p className="text-[11px] text-emerald-300/80">
                        All 2,038+ assets, 70 research decks, all four Academy courses, and all 32 Trade
                        Tools are permanently active.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-line/60 pt-2">
                    <button
                      type="button"
                      onClick={lockWhop}
                      className="text-xs text-muted transition hover:text-rose-400"
                    >
                      Reset Session
                    </button>
                    <button
                      type="button"
                      onClick={closeWhopModal}
                      className="rounded-full bg-gold px-5 py-2 text-xs font-bold text-ink-950 transition hover:bg-gold-bright"
                    >
                      Enter Platform
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </WhopContext.Provider>
  );
}

export function useWhop() {
  return useContext(WhopContext);
}
