// ── Role Model ──────────────────────────────────────────────
export type Role = "viewer" | "editor" | "admin";

// ── Transaction ─────────────────────────────────────────────
export type TransactionStatus =
  | "pending_collection"
  | "collected"
  | "payment_initiated"
  | "payment_sent"
  | "cancelled"
  | "deleted";

export interface Transaction {
  transactionId: string;
  senderName: string;
  senderCountry: string;
  senderCurrency: string;
  senderAmount: number;
  receiverName: string;
  receiverCountry: string;
  receiverCurrency: string;
  receiverAmount: number;
  usdValue: number;
  receiverSwiftCode: string | null;
  receiverIban: string | null;
  status: string;
  collectionProviderId: string | null;
  payoutProviderId: string | null;
  reference: string | null;
  createdAtDate: string | null;
  collectedAtDate: string | null;
  paymentInitiatedAtDate: string | null;
  paymentSentAtDate: string | null;
  hasBlockingIssue: boolean;
}

// ── Balance (DB_Accounts) ───────────────────────────────────
export interface Balance {
  accountId: string;
  accountName: string;
  accountCountry: string;
  provider: string;
  currency: string;
  currentBalance: number;
  lastBalanceAt: string;
}

// ── Provider matrices ───────────────────────────────────────
export interface SenderCountryEntry {
  provider: string;
  country: string;
  approved: boolean;
}

export interface ReceiverCountryEntry {
  provider: string;
  country: string;
  approved: boolean;
}

export interface CurrencyRail {
  provider: string;
  currency: string;
  rail: string;
  isPobo: boolean;
  speedRank: number;
  fundingCutoffUtc: string | null;
  payoutCutoffUtc: string | null;
  holidayCalendar: string;
}

// ── Banned lists ────────────────────────────────────────────
export interface BeneBanned {
  beneficiaryName: string;
  provider: string;
}

export interface SenderBanned {
  senderName: string;
  provider: string;
}

export interface SwiftCodeBanned {
  swiftCode: string;
  provider: string;
}

// ── Light KYC senders ───────────────────────────────────────
export interface LightKycSender {
  senderName: string;
}

// ── Routing ─────────────────────────────────────────────────
export interface RoutingRule {
  sourceCountryCode: string;
  amountUsdMin: number;
  amountUsdMax: number | null;
  payoutDays: number;
}

export interface FlowTarget {
  provider: string;
  currency: string;
  targetPct: number | null;
}

// ── Routing Decision ────────────────────────────────────────
export interface RoutingDecision {
  transactionId: string;
  assignedProvider: string;
  assignedRail: string;
  isPobo: boolean;
  status: string;
  routedBy: string;
  routedAt: string;
}

export interface RoutingSuggestion {
  provider: string;
  rail: string;
  isPobo: boolean;
  score: number;
  balanceSufficient: boolean;
  availableTomorrow: boolean;
  flaggedReasons: string[];
}

// ── Audit ───────────────────────────────────────────────────
export interface AuditEntry {
  timestamp: string;
  userId: string;
  transactionId: string;
  field: string;
  oldValue: string;
  newValue: string;
  note: string | null;
}
