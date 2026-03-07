export type SourceKind = "bank" | "accounting";

export type NormalizedTransaction = {
  id: string;
  source: SourceKind;
  date: string; // ISO yyyy-mm-dd
  amount: number;
  description: string;
  reference: string;
  raw: Record<string, string>;
};

export type MatchType = "exact" | "fuzzy";

export type MatchSuggestion = {
  bankId: string;
  accountingId: string;
  type: MatchType;
  confidence: number;
  explanation: string;
};

export type ExceptionItem = {
  id: string;
  type: "unmatched" | "low_confidence" | "duplicate" | "missing_invoice";
  message: string;
  source?: SourceKind;
  analysis?: string;
  suggestedAction?: string;
};

export type ReconciliationSummary = {
  totalBank: number;
  totalAccounting: number;
  exactMatches: number;
  fuzzyMatches: number;
  unmatchedBank: number;
  unmatchedAccounting: number;
  duplicates: number;
};

export type UnmatchedItem = {
  id: string;
  source: SourceKind;
  date: string;
  amount: number;
  description: string;
  reference: string;
};

export type ReconciliationResult = {
  summary: ReconciliationSummary;
  matches: MatchSuggestion[];
  exceptions: ExceptionItem[];
  unmatched: UnmatchedItem[];
};
