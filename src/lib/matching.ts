import Fuse from "fuse.js";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { MatchSuggestion, NormalizedTransaction } from "./types";
import { scoreNearMatch } from "./llm";

const DATE_WINDOW_DAYS = 5;
const AMOUNT_TOLERANCE = 0.02;
const FUZZY_THRESHOLD = 0.45;
const MAX_FUZZY_CANDIDATES = 5;

export async function matchTransactions(
  bank: NormalizedTransaction[],
  accounting: NormalizedTransaction[]
): Promise<{
  exact: MatchSuggestion[];
  fuzzy: MatchSuggestion[];
  unmatchedBank: NormalizedTransaction[];
  unmatchedAccounting: NormalizedTransaction[];
  duplicates: string[];
}> {
  const exactMatches: MatchSuggestion[] = [];
  const fuzzyMatches: MatchSuggestion[] = [];
  const matchedAccounting = new Set<string>();
  const matchedBank = new Set<string>();
  const duplicates: string[] = [];

  for (const bankTxn of bank) {
    const candidate = accounting.find((acct) =>
      isExactMatch(bankTxn, acct)
    );
    if (candidate && !matchedAccounting.has(candidate.id)) {
      exactMatches.push({
        bankId: bankTxn.id,
        accountingId: candidate.id,
        type: "exact",
        confidence: 0.98,
        explanation: "Exact amount, date, and description/reference match."
      });
      matchedAccounting.add(candidate.id);
      matchedBank.add(bankTxn.id);
    }
  }

  const remainingBank = bank.filter((txn) => !matchedBank.has(txn.id));
  const remainingAccounting = accounting.filter((txn) => !matchedAccounting.has(txn.id));

  const accountingFuse = new Fuse(remainingAccounting, {
    keys: ["description", "reference"],
    includeScore: true,
    threshold: 0.4
  });

  for (const bankTxn of remainingBank) {
    const candidatesByText = accountingFuse
      .search(`${bankTxn.description} ${bankTxn.reference}`.trim())
      .slice(0, MAX_FUZZY_CANDIDATES)
      .map((result) => result.item);

    const candidates = remainingAccounting.filter((acct) => {
      const closeByAmount = amountsClose(bankTxn.amount, acct.amount);
      const closeByDate = isWithinWindow(bankTxn, acct);
      return closeByAmount || closeByDate || candidatesByText.includes(acct);
    });

    let bestMatch: NormalizedTransaction | null = null;
    let bestScore = 0;

    for (const acct of candidates) {
      const score = candidateScore(bankTxn, acct, accountingFuse);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = acct;
      }
    }

    if (bestMatch && bestScore >= FUZZY_THRESHOLD) {
      const llmScore = await scoreNearMatch(bankTxn, bestMatch, bestScore);
      const confidence = llmScore.confidence;
      if (matchedAccounting.has(bestMatch.id)) {
        duplicates.push(bestMatch.id);
        continue;
      }
      fuzzyMatches.push({
        bankId: bankTxn.id,
        accountingId: bestMatch.id,
        type: "fuzzy",
        confidence,
        explanation: llmScore.explanation
      });
      matchedAccounting.add(bestMatch.id);
      matchedBank.add(bankTxn.id);
    }
  }

  return {
    exact: exactMatches,
    fuzzy: fuzzyMatches,
    unmatchedBank: bank.filter((txn) => !matchedBank.has(txn.id)),
    unmatchedAccounting: accounting.filter((txn) => !matchedAccounting.has(txn.id)),
    duplicates
  };
}

function isExactMatch(a: NormalizedTransaction, b: NormalizedTransaction) {
  return (
    amountsClose(a.amount, b.amount) &&
    a.date === b.date &&
    normalizeText(a.description) === normalizeText(b.description)
  );
}

function isWithinWindow(a: NormalizedTransaction, b: NormalizedTransaction) {
  const diff = Math.abs(
    differenceInCalendarDays(parseISO(a.date), parseISO(b.date))
  );
  return diff <= DATE_WINDOW_DAYS;
}

function amountsClose(a: number, b: number) {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function descriptionSimilarity(
  bankTxn: NormalizedTransaction,
  acctTxn: NormalizedTransaction,
  fuse: Fuse<NormalizedTransaction>
) {
  const query = `${bankTxn.description} ${bankTxn.reference}`.trim();
  if (!query) return 0;
  const results = fuse.search(query);
  const match = results.find((result) => result.item.id === acctTxn.id);
  if (!match || match.score == null) return 0;
  return 1 - match.score;
}

function candidateScore(
  bankTxn: NormalizedTransaction,
  acctTxn: NormalizedTransaction,
  fuse: Fuse<NormalizedTransaction>
) {
  const similarity = descriptionSimilarity(bankTxn, acctTxn, fuse);
  const dateDiff = Math.abs(
    differenceInCalendarDays(parseISO(bankTxn.date), parseISO(acctTxn.date))
  );
  const dateScore = 1 - Math.min(dateDiff / (DATE_WINDOW_DAYS * 2), 1);
  const amountScore = amountsClose(bankTxn.amount, acctTxn.amount) ? 1 : 0.6;
  return similarity * 0.55 + dateScore * 0.25 + amountScore * 0.2;
}
 
