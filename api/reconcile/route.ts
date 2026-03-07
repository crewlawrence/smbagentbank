import { NextResponse } from "next/server";
import { reconcileWithTransactions } from "@/lib/reconcile";
import { setLastResult } from "@/lib/store";
import { z } from "zod";
import { auth } from "@/auth";
import {
  createLedgerAccount,
  createReconciliationRun,
  insertMatchSuggestions,
  insertTransactions
} from "@/lib/db";

const payloadSchema = z.object({
  bankCsv: z.string().min(1),
  accountingCsv: z.string().min(1)
});

export async function POST(request: Request) {
  const body = await request.json();
  const payload = payloadSchema.parse(body);
  const session = await auth();
  const tenantId = session?.user?.tenantId ?? null;

  const { result, bank, accounting } = await reconcileWithTransactions(
    payload.bankCsv,
    payload.accountingCsv
  );
  setLastResult(result);

  if (tenantId) {
    const bankAccount = createLedgerAccount({
      tenantId,
      name: "Bank CSV Upload",
      type: "bank"
    });
    const accountingAccount = createLedgerAccount({
      tenantId,
      name: "Accounting CSV Upload",
      type: "accounting"
    });

    if (bank.length > 0) {
      insertTransactions(
        bank.map((txn) => ({
          id: txn.id,
          tenantId,
          accountId: bankAccount.id,
          source: txn.source,
          date: new Date(txn.date),
          amount: txn.amount,
          description: txn.description,
          reference: txn.reference,
          rawJson: JSON.stringify(txn.raw)
        }))
      );
    }

    if (accounting.length > 0) {
      insertTransactions(
        accounting.map((txn) => ({
          id: txn.id,
          tenantId,
          accountId: accountingAccount.id,
          source: txn.source,
          date: new Date(txn.date),
          amount: txn.amount,
          description: txn.description,
          reference: txn.reference,
          rawJson: JSON.stringify(txn.raw)
        }))
      );
    }

    const run = createReconciliationRun({
      tenantId,
      summary: JSON.stringify(result.summary)
    });

    if (result.matches.length > 0) {
      insertMatchSuggestions(
        result.matches.map((match) => ({
          runId: run.id,
          bankTransactionId: match.bankId,
          accountingTransactionId: match.accountingId,
          type: match.type,
          confidence: match.confidence,
          explanation: match.explanation
        }))
      );
    }
  }

  return NextResponse.json(result);
}
