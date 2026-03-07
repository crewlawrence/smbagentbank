import { parseCsv } from "./csv";
import { normalizeRows } from "./normalize";
import { matchTransactions } from "./matching";
import { analyzeException } from "./llm";
import type { ExceptionItem, NormalizedTransaction, ReconciliationResult } from "./types";

export async function reconcileWithTransactions(
  bankCsv: string,
  accountingCsv: string
): Promise<{
  result: ReconciliationResult;
  bank: NormalizedTransaction[];
  accounting: NormalizedTransaction[];
}> {
  const bankRows = parseCsv(bankCsv);
  const accountingRows = parseCsv(accountingCsv);
  const bank = normalizeRows(bankRows, "bank");
  const accounting = normalizeRows(accountingRows, "accounting");

  const { exact, fuzzy, unmatchedBank, unmatchedAccounting, duplicates } = await matchTransactions(
    bank,
    accounting
  );

  const exceptions: ExceptionItem[] = [];
  const exceptionContexts: Array<{
    exception: ExceptionItem;
    context: {
      type: string;
      message: string;
      transaction?: NormalizedTransaction;
      bank?: NormalizedTransaction;
      accounting?: NormalizedTransaction;
      match?: { type: string; confidence: number; explanation: string };
    };
  }> = [];
  const bankById = new Map(bank.map((txn) => [txn.id, txn]));
  const accountingById = new Map(accounting.map((txn) => [txn.id, txn]));
  const unmatchedItems = [...unmatchedBank, ...unmatchedAccounting];

  unmatchedBank.forEach((txn) => {
    const exception: ExceptionItem = {
      id: txn.id,
      type: "unmatched",
      message: `Unmatched bank transaction: ${txn.description || "(no description)"}`,
      source: "bank"
    };
    exceptions.push(exception);
    exceptionContexts.push({
      exception,
      context: { type: "unmatched", message: exception.message, transaction: txn }
    });
  });

  unmatchedAccounting.forEach((txn) => {
    const exception: ExceptionItem = {
      id: txn.id,
      type: "missing_invoice",
      message: `Possible missing invoice or deposit for ${txn.description || "(no description)"}`,
      source: "accounting"
    };
    exceptions.push(exception);
    exceptionContexts.push({
      exception,
      context: { type: "missing_invoice", message: exception.message, transaction: txn }
    });
  });

  fuzzy
    .filter((match) => match.confidence < 0.75)
    .forEach((match) => {
      const bankTxn = bankById.get(match.bankId);
      const accountingTxn = accountingById.get(match.accountingId);
      const exception: ExceptionItem = {
        id: `${match.bankId}-${match.accountingId}`,
        type: "low_confidence",
        message: `Low confidence match for ${match.bankId} → ${match.accountingId}`,
        source: bankTxn?.source ?? "bank"
      };
      exceptions.push(exception);
      exceptionContexts.push({
        exception,
        context: {
          type: "low_confidence",
          message: exception.message,
          bank: bankTxn,
          accounting: accountingTxn,
          match: { type: match.type, confidence: match.confidence, explanation: match.explanation }
        }
      });
    });

  duplicates.forEach((id) => {
    const exception: ExceptionItem = {
      id,
      type: "duplicate",
      message: `Multiple bank transactions targeting accounting record ${id}`
    };
    exceptions.push(exception);
    exceptionContexts.push({
      exception,
      context: { type: "duplicate", message: exception.message }
    });
  });

  const MAX_EXCEPTION_LLM = 12;
  const analysisTargets = exceptionContexts.slice(0, MAX_EXCEPTION_LLM);
  const analysisResults = await Promise.all(
    analysisTargets.map((entry) => analyzeException(entry.context))
  );
  analysisTargets.forEach((entry, index) => {
    const analysis = analysisResults[index];
    entry.exception.analysis = analysis.analysis;
    entry.exception.suggestedAction = analysis.suggestedAction;
  });

  const result: ReconciliationResult = {
    summary: {
      totalBank: bank.length,
      totalAccounting: accounting.length,
      exactMatches: exact.length,
      fuzzyMatches: fuzzy.length,
      unmatchedBank: unmatchedBank.length,
      unmatchedAccounting: unmatchedAccounting.length,
      duplicates: duplicates.length
    },
    matches: [...exact, ...fuzzy],
    exceptions,
    unmatched: unmatchedItems.map((txn) => ({
      id: txn.id,
      source: txn.source,
      date: txn.date,
      amount: txn.amount,
      description: txn.description,
      reference: txn.reference
    }))
  };
  return { result, bank, accounting };
}

export async function reconcile(bankCsv: string, accountingCsv: string): Promise<ReconciliationResult> {
  return (await reconcileWithTransactions(bankCsv, accountingCsv)).result;
}
