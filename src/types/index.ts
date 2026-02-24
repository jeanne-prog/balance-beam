// ── Role Model ──────────────────────────────────────────────
export type Role = 'viewer' | 'editor' | 'admin';

// ── Transaction ─────────────────────────────────────────────
export type TransactionStatus = 'pending' | 'routed' | 'confirmed' | 'paid';

export interface Transaction {
  id: string;
  clientName: string;
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
}

// ── Balance ─────────────────────────────────────────────────
export interface Balance {
  provider: string;
  currency: string;
  currentBalance: number;
  plannedInflows: number;
  lastUpdated: string;
}

// ── Provider ────────────────────────────────────────────────
export interface Corridor {
  senderCountry: string;
  beneficiaryCountry: string;
}

export interface CurrencyRail {
  currency: string;
  rail: string;
  isPobo: boolean;
  speedRank: number;
  fundingCutoff: string;
  payoutCutoff: string;
  cutoffTimezone: string;
}

export interface Provider {
  id: string;
  name: string;
  corridors: Corridor[];
  currencyRails: CurrencyRail[];
  bannedSenderCountries: string[];
  blockedIndustryTags: string[];
}

// ── Routing ─────────────────────────────────────────────────
export interface RoutingRule {
  sourceCountry: string;
  amountBandMin: number;
  amountBandMax: number | null;
  daysAfterCollection: number;
}

export interface BeneficiaryIndustry {
  beneficiaryName: string;
  industryTag: string;
}

export interface FlowTarget {
  provider: string;
  targetPct: number;
}

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
  provider: Provider;
  rail: string;
  isPobo: boolean;
  score: number;
  balanceSufficient: boolean;
  availableTomorrow: boolean;
  flaggedReasons: string[];
}

// ── Fund Movement ───────────────────────────────────────────
export interface FundMovementSuggestion {
  type: 'transfer' | 'fx' | 'preposition';
  fromProvider: string;
  toProvider: string;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  fxRateUsed?: number;
  deadline: string;
  deadlineTimezone: string;
  urgency: 'today' | 'tomorrow';
  affectedTransactionCount: number;
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

// ── Data Source Interface ───────────────────────────────────
export interface DataSource {
  getConfirmedTransactions(): Promise<Transaction[]>;
  getPipelineTransactions(): Promise<Transaction[]>;
  getBalances(): Promise<Balance[]>;
  getProviderCapabilities(): Promise<Provider[]>;
  getRoutingRules(): Promise<RoutingRule[]>;
  getBeneficiaryIndustries(): Promise<BeneficiaryIndustry[]>;
  getFlowTargets(): Promise<FlowTarget[]>;
  writeRoutingDecisions(decisions: RoutingDecision[]): Promise<void>;
  writeAuditLog(entry: AuditEntry): Promise<void>;
}
