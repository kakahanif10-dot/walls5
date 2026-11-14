export interface WhopMembershipRecord {
  id?: string;
  status?: string;
  valid?: boolean;
  email?: string;
  license_key?: string;
  product?: string;
  plan?: string;
}

export interface WhopVerificationResult {
  verified: boolean;
  membershipId?: string;
  status?: string;
  reason?: string;
}

const ACTIVE_STATUSES = new Set(["active", "completed", "trialing", "valid"]);

export function validateWhopCredentialsInput(input: {
  licenseKey?: string;
  email?: string;
}): { ok: boolean; licenseKey: string; email: string; error?: string } {
  const licenseKey = (input.licenseKey ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();

  if (!licenseKey && !email) {
    return {
      ok: false,
      licenseKey,
      email,
      error: "Payment verification required. Enter the Whop license key or checkout email from your $1,487 USD purchase.",
    };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      ok: false,
      licenseKey,
      email,
      error: "Please enter a valid Whop checkout email address.",
    };
  }

  return { ok: true, licenseKey, email };
}

export function extractActiveWhopMembership(
  records: WhopMembershipRecord[] | undefined | null,
  criteria: { licenseKey?: string; email?: string },
): WhopVerificationResult {
  if (!Array.isArray(records) || records.length === 0) {
    return {
      verified: false,
      reason: "No verified $1,487 USD Lifetime Premium membership found for those credentials.",
    };
  }

  const keyTarget = (criteria.licenseKey ?? "").trim();
  const emailTarget = (criteria.email ?? "").trim().toLowerCase();

  for (const rec of records) {
    const status = (rec.status ?? "").toLowerCase();
    const isActive = rec.valid === true || ACTIVE_STATUSES.has(status);
    if (!isActive) continue;

    const keyMatch =
      Boolean(keyTarget) &&
      ((rec.license_key && rec.license_key.trim() === keyTarget) ||
        (rec.id && rec.id.trim() === keyTarget));
    const emailMatch =
      Boolean(emailTarget) &&
      Boolean(rec.email) &&
      rec.email!.trim().toLowerCase() === emailTarget;

    if (keyMatch || emailMatch) {
      return {
        verified: true,
        membershipId: rec.id,
        status: rec.status ?? "active",
      };
    }
  }

  return {
    verified: false,
    reason: "No active Lifetime Premium membership matched the provided license key or email.",
  };
}
