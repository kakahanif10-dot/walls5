import test from "node:test";
import assert from "node:assert/strict";
import {
  extractActiveWhopMembership,
  validateWhopCredentialsInput,
} from "./whop-verification";

test("validateWhopCredentialsInput rejects empty activation attempts", () => {
  const empty = validateWhopCredentialsInput({});
  assert.equal(empty.ok, false);
  assert.match(empty.error ?? "", /Payment verification required/);

  const badEmail = validateWhopCredentialsInput({ email: "not-an-email" });
  assert.equal(badEmail.ok, false);

  const validKey = validateWhopCredentialsInput({ licenseKey: "whop_key_12345" });
  assert.equal(validKey.ok, true);
  assert.equal(validKey.licenseKey, "whop_key_12345");
});

test("extractActiveWhopMembership only grants verified=true when active membership matches licenseKey or email", () => {
  const records = [
    {
      id: "mem_1",
      status: "canceled",
      valid: false,
      email: "canceled@example.com",
      license_key: "key_canceled",
    },
    {
      id: "mem_2",
      status: "completed",
      valid: true,
      email: "Buyer@NextWallStreet.com",
      license_key: "key_lifetime_1487",
    },
  ];

  const miss = extractActiveWhopMembership(records, { licenseKey: "key_canceled" });
  assert.equal(miss.verified, false);

  const byKey = extractActiveWhopMembership(records, { licenseKey: "key_lifetime_1487" });
  assert.equal(byKey.verified, true);
  assert.equal(byKey.membershipId, "mem_2");

  const byEmail = extractActiveWhopMembership(records, { email: "buyer@nextwallstreet.com" });
  assert.equal(byEmail.verified, true);
  assert.equal(byEmail.membershipId, "mem_2");
});
