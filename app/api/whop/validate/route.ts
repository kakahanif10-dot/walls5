import { NextRequest, NextResponse } from "next/server";
import {
  extractActiveWhopMembership,
  validateWhopCredentialsInput,
  type WhopMembershipRecord,
} from "@/lib/whop-verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const validation = validateWhopCredentialsInput({
      licenseKey: typeof body?.licenseKey === "string" ? body.licenseKey : undefined,
      email: typeof body?.email === "string" ? body.email : undefined,
    });

    if (!validation.ok) {
      return NextResponse.json(
        {
          success: false,
          unlocked: false,
          error: validation.error,
        },
        { status: 400 },
      );
    }

    const apiKey = process.env.WHOP_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          unlocked: false,
          error:
            "Payment verification unavailable: Whop API credentials are not configured on this server. Complete checkout on Whop once WHOP_API_KEY is active.",
        },
        { status: 403 },
      );
    }

    const queryParam = validation.email
      ? `?email=${encodeURIComponent(validation.email)}`
      : validation.licenseKey
        ? `?query=${encodeURIComponent(validation.licenseKey)}`
        : "";

    const whopRes = await fetch(`https://api.whop.com/api/v2/memberships${queryParam}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });

    if (!whopRes.ok) {
      return NextResponse.json(
        {
          success: false,
          unlocked: false,
          error: `Whop verification gateway rejected query (${whopRes.status}). Access is activated only after payment verification.`,
        },
        { status: 403 },
      );
    }

    const whopData = (await whopRes.json()) as { data?: WhopMembershipRecord[] };
    const result = extractActiveWhopMembership(whopData?.data, {
      licenseKey: validation.licenseKey,
      email: validation.email,
    });

    if (!result.verified) {
      return NextResponse.json(
        {
          success: false,
          unlocked: false,
          error: result.reason || "No active Lifetime Premium ($1,487 USD) membership found.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      unlocked: true,
      plan: "premium",
      membershipId: result.membershipId,
      message:
        "Lifetime Premium ($1,487 USD) payment verified. All 2,038+ assets, 70 research desks, 60 Academy lessons, and 32 Trade Tools are now unlocked.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to verify Whop payment.";
    return NextResponse.json(
      { success: false, unlocked: false, error: message },
      { status: 500 },
    );
  }
}

export async function GET() {
  const apiKey = process.env.WHOP_API_KEY?.trim();
  return NextResponse.json({
    configured: Boolean(apiKey),
    tier: "Lifetime Premium",
    amountUsd: 1487,
  });
}
