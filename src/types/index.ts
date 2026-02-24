// ── Role Model ──────────────────────────────────────────────
export type Role = "viewer" | "editor" | "admin";

// ── Transaction ─────────────────────────────────────────────
export type TransactionStatus =
  | "pending_collection"
  | "pending_payout"
  | "routed"
  | "confirmed"
  | "paid";

export interface Transaction {
  id: string;
  clientName: string;
  senderName: string;
  sourceCountry: string;
  beneficiaryName: string;
  beneficiaryCountry: string;
  destinationCurrency: string;
  amountReceive: number;
  amountUSDEquiv: number;
  collectionDate: string;
  dueDate: string;
  status: TransactionStatus;
  assignedProvider: string | null;
  assignedRail: string | null;
  isPobo: boolean | null;
  routedBy: string | null;
  routedAt: string | null;
  notes: string | null;
  swiftCode: string | null;
}

// ── Balance (DB_Accounts) ───────────────────────────────────
export interface Balance {
  provider: string;
  currency: string;
  currentBalance: number;
  plannedInflows: number;
  lastUpdated: string;
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
  fundingCutoff: string;
  payoutCutoff: string;
  cutoffTimezone: string;
}

// ── Banned lists ────────────────────────────────────────────
export interface BeneBanned {
  beneficiaryName: string;
  provider: string;
  reason: string | null;
}

export interface SenderBanned {
  senderName: string;
  provider: string;
  reason: string | null;
}

export interface SwiftCodeBanned {
  swiftCode: string;
  provider: string;
  reason: string | null;
}

// ── Light KYC senders ───────────────────────────────────────
export interface LightKycSender {
  senderName: string;
  restrictedToProvider: string; // currently "GIB"
}

// ── Routing ─────────────────────────────────────────────────
export interface RoutingRule {
  sourceCountry: string;
  amountBandMin: number;
  amountBandMax: number | null;
  daysAfterCollection: number;
}

export interface FlowTarget {
  provider: string;
  targetPct: number | null;
}

// ── Routing Decision ────────────────────────────────────────
export interface RoutingDecision {
  transactionId: string;
  assignedProvider: string;
  assignedRail: string;
  isPobo: boolean;
  status: TransactionStatus;
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
