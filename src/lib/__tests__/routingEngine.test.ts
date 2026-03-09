import { describe, it, expect } from "vitest";
import { scoreTransaction, type RoutingContext } from "@/lib/routingEngine";
import type {
  Transaction,
  Balance,
  CurrencyRail,
  BeneBanned,
  SenderBanned,
  SwiftCodeBanned,
  LightKycSender,
  FlowTarget,
} from "@/types";

/* ── Factories ───────────────────────────────────────────── */

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    transactionId: "tx1",
    senderName: "Acme Corp",
    senderCountry: "SN",
    senderCurrency: "XOF",
    senderAmount: 1000000,
    receiverName: "Widget Ltd",
    receiverCountry: "FR",
    receiverCurrency: "EUR",
    receiverAmount: 5000,
    usdValue: 5500,
    receiverSwiftCode: "BNPAFRPP",
    receiverIban: "FR7630001007941234567890185",
    status: "pending_payout",
    collectionProviderId: null,
    payoutProviderId: null,
    reference: "REF-001",
    createdAtDate: "2026-01-01",
    collectedAtDate: "2026-01-02",
    paymentInitiatedAtDate: null,
    paymentSentAtDate: null,
    hasBlockingIssue: false,
    pendingApprovalAtDate: null,
    approvedAtDate: null,
    senderId: null,
    senderBusinessNumber: null,
    senderAddressLine1: null,
    senderAddressCity: null,
    senderAddressState: null,
    receiverAddressLine1: null,
    receiverAddressCity: null,
    receiverAddressState: null,
    ...overrides,
  };
}

function makeRail(overrides: Partial<CurrencyRail> = {}): CurrencyRail {
  return {
    provider: "CORPAY",
    currency: "EUR",
    rail: "SWIFT",
    isPobo: true,
    speedRank: 2,
    fundingCutoffUtc: "12:00",
    payoutCutoffUtc: "14:00",
    holidayCalendar: "EUR",
    fxCostBps: 0,
    ...overrides,
  };
}

function makeBalance(overrides: Partial<Balance> = {}): Balance {
  return {
    accountId: "acc1",
    accountName: "Test",
    accountCountry: "GB",
    provider: "CORPAY",
    currency: "EUR",
    currentBalance: 100000,
    lastBalanceAt: "2026-01-01",
    ...overrides,
  };
}

function makeCountryRow(
  code: string,
  providers: Record<string, string>
): Record<string, unknown> {
  return { country_code: code, ...providers };
}

function baseCtx(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return {
    currencyRails: [
      makeRail({ provider: "CORPAY", currency: "EUR", rail: "SEPA", speedRank: 1 }),
      makeRail({ provider: "CORPAY", currency: "EUR", rail: "SWIFT", speedRank: 2 }),
      makeRail({ provider: "EMQ", currency: "EUR", rail: "SWIFT", speedRank: 2 }),
      makeRail({ provider: "GIB", currency: "EUR", rail: "SWIFT", speedRank: 2 }),
      makeRail({ provider: "NEO", currency: "EUR", rail: "SWIFT", speedRank: 3 }),
    ],
    senderCountryMatrix: [
      makeCountryRow("SN", { CORPAY: "YES", EMQ: "YES", GIB: "YES", NEO: "YES" }),
    ],
    receiverCountryMatrix: [
      makeCountryRow("FR", { CORPAY: "YES", EMQ: "YES", GIB: "YES", NEO: "YES" }),
    ],
    benesBanned: [],
    sendersBanned: [],
    swiftCodesBanned: [],
    lightKycSenders: [],
    flowTargets: [],
    balances: [
      makeBalance({ provider: "CORPAY", currency: "EUR", currentBalance: 100000 }),
      makeBalance({ provider: "EMQ", currency: "EUR", currentBalance: 50000 }),
      makeBalance({ provider: "GIB", currency: "EUR", currentBalance: 80000 }),
      makeBalance({ provider: "NEO", currency: "EUR", currentBalance: 200000 }),
    ],
    allTransactions: [],
    providerManual: [],
    sepaCountries: new Set<string>(),
    ...overrides,
  };
}

/* ── Tests ───────────────────────────────────────────────── */

describe("routingEngine", () => {
  describe("basic scoring", () => {
    it("returns suggestions for all eligible providers sorted by score", () => {
      const results = scoreTransaction(makeTx(), baseCtx());
      expect(results.length).toBeGreaterThan(0);
      // Should be sorted descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it("assigns higher score to faster rails (lower speedRank)", () => {
      const results = scoreTransaction(makeTx(), baseCtx());
      const sepa = results.find((r) => r.provider === "CORPAY" && r.rail === "SEPA");
      const swift = results.find((r) => r.provider === "CORPAY" && r.rail === "SWIFT");
      expect(sepa).toBeDefined();
      expect(swift).toBeDefined();
      expect(sepa!.score).toBeGreaterThan(swift!.score);
    });
  });

  describe("hard constraints: country checks", () => {
    it("disqualifies provider when sender country not approved", () => {
      const ctx = baseCtx({
        senderCountryMatrix: [
          makeCountryRow("SN", { CORPAY: "NO", EMQ: "YES", GIB: "YES", NEO: "YES" }),
        ],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const corpay = results.filter((r) => r.provider === "CORPAY");
      for (const s of corpay) {
        expect(s.score).toBe(0);
        expect(s.flaggedReasons).toContain("Sender country not approved");
      }
    });

    it("disqualifies provider when receiver country not approved", () => {
      const ctx = baseCtx({
        receiverCountryMatrix: [
          makeCountryRow("FR", { CORPAY: "YES", EMQ: "NO", GIB: "YES", NEO: "YES" }),
        ],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const emq = results.filter((r) => r.provider === "EMQ");
      for (const s of emq) {
        expect(s.score).toBe(0);
        expect(s.flaggedReasons).toContain("Receiver country not approved");
      }
    });
  });

  describe("hard constraints: bans", () => {
    it("disqualifies provider when beneficiary is banned", () => {
      const ctx = baseCtx({
        benesBanned: [{ beneficiaryName: "Widget Ltd", provider: "GIB" }],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const gib = results.filter((r) => r.provider === "GIB");
      for (const s of gib) {
        expect(s.score).toBe(0);
        expect(s.flaggedReasons).toContain("Beneficiary banned");
      }
    });

    it("disqualifies provider when sender is banned", () => {
      const ctx = baseCtx({
        sendersBanned: [{ senderName: "Acme Corp", provider: "NEO" }],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const neo = results.filter((r) => r.provider === "NEO");
      for (const s of neo) {
        expect(s.score).toBe(0);
        expect(s.flaggedReasons).toContain("Sender banned");
      }
    });

    it("disqualifies provider when SWIFT code is banned", () => {
      const ctx = baseCtx({
        swiftCodesBanned: [{ swiftCode: "BNPAFRPP", provider: "EMQ" }],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const emq = results.filter((r) => r.provider === "EMQ");
      for (const s of emq) {
        expect(s.score).toBe(0);
        expect(s.flaggedReasons).toContain("SWIFT code banned");
      }
    });

    it("ban matching is case-insensitive", () => {
      const ctx = baseCtx({
        benesBanned: [{ beneficiaryName: "WIDGET LTD", provider: "gib" }],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const gib = results.filter((r) => r.provider === "GIB");
      for (const s of gib) {
        expect(s.score).toBe(0);
      }
    });
  });

  describe("hard constraints: light KYC", () => {
    it("restricts light KYC senders to GIB only", () => {
      const ctx = baseCtx({
        lightKycSenders: [{ senderName: "Acme Corp" }],
      });
      const results = scoreTransaction(makeTx(), ctx);
      // Only GIB should appear
      const providers = new Set(results.map((r) => r.provider));
      expect(providers.size).toBe(1);
      expect(providers.has("GIB")).toBe(true);
    });

    it("does not restrict non-light-KYC senders", () => {
      const ctx = baseCtx({
        lightKycSenders: [{ senderName: "Other Company" }],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const providers = new Set(results.map((r) => r.provider));
      expect(providers.size).toBeGreaterThan(1);
    });
  });

  describe("soft scoring: balance", () => {
    it("flags insufficient balance and lowers score", () => {
      const ctx = baseCtx({
        balances: [
          makeBalance({ provider: "CORPAY", currency: "EUR", currentBalance: 1 }),
          makeBalance({ provider: "EMQ", currency: "EUR", currentBalance: 100000 }),
          makeBalance({ provider: "GIB", currency: "EUR", currentBalance: 100000 }),
          makeBalance({ provider: "NEO", currency: "EUR", currentBalance: 100000 }),
        ],
      });
      const tx = makeTx({ receiverAmount: 5000 });
      const results = scoreTransaction(tx, ctx);
      const corpayResults = results.filter((r) => r.provider === "CORPAY");
      for (const s of corpayResults) {
        expect(s.balanceSufficient).toBe(false);
        expect(s.flaggedReasons.some((f) => f.includes("Insufficient balance"))).toBe(true);
      }
      // Other providers should have sufficient balance
      const emq = results.find((r) => r.provider === "EMQ");
      expect(emq?.balanceSufficient).toBe(true);
    });
  });

  describe("soft scoring: flow targets", () => {
    it("boosts provider under its flow target", () => {
      const ctx = baseCtx({
        flowTargets: [{ provider: "GIB", currency: "EUR", targetPct: 50 }],
        allTransactions: [
          makeTx({ transactionId: "old1", payoutProviderId: "CORPAY", usdValue: 10000 }),
          makeTx({ transactionId: "old2", payoutProviderId: "GIB", usdValue: 1000 }),
        ],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const gib = results.find((r) => r.provider === "GIB");
      const corpay = results.find((r) => r.provider === "CORPAY" && r.rail === "SWIFT");
      // GIB is under target (9% vs 50%) so should get a boost
      expect(gib).toBeDefined();
      expect(gib!.score).toBeGreaterThan(0);
    });
  });

  describe("no matching currency", () => {
    it("returns empty when no provider supports the currency", () => {
      const tx = makeTx({ receiverCurrency: "ZZZ" });
      const results = scoreTransaction(tx, baseCtx());
      expect(results).toHaveLength(0);
    });
  });

  describe("multiple constraints combined", () => {
    it("handles sender banned + receiver country blocked on different providers", () => {
      const ctx = baseCtx({
        sendersBanned: [{ senderName: "Acme Corp", provider: "CORPAY" }],
        receiverCountryMatrix: [
          makeCountryRow("FR", { CORPAY: "YES", EMQ: "NO", GIB: "YES", NEO: "YES" }),
        ],
      });
      const results = scoreTransaction(makeTx(), ctx);
      const corpay = results.filter((r) => r.provider === "CORPAY");
      const emq = results.filter((r) => r.provider === "EMQ");
      // CORPAY banned by sender, EMQ blocked by country
      for (const s of corpay) expect(s.score).toBe(0);
      for (const s of emq) expect(s.score).toBe(0);
      // GIB and NEO should be eligible
      const gib = results.find((r) => r.provider === "GIB");
      const neo = results.find((r) => r.provider === "NEO");
      expect(gib!.score).toBeGreaterThan(0);
      expect(neo!.score).toBeGreaterThan(0);
    });
  });
});
