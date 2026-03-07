import { NextResponse } from "next/server";
import { getLastResult } from "@/lib/store";
import { stringifyCsv } from "@/lib/csv";
import { auth } from "@/auth";
import { getLatestRunWithMatches } from "@/lib/db";

export async function GET() {
  const session = await auth();
  const tenantId = session?.user?.tenantId ?? null;

  const runWithMatches = tenantId ? getLatestRunWithMatches(tenantId) : null;

  const matches = runWithMatches?.matches ?? getLastResult()?.matches ?? [];
  if (matches.length === 0) {
    return NextResponse.json({ error: "Run a reconciliation first." }, { status: 400 });
  }

  const rows = matches.map((match) => {
    const bankId = "bankId" in match ? match.bankId : match.bankTransactionId;
    const accountingId =
      "accountingId" in match ? match.accountingId : match.accountingTransactionId;
    return {
      bank_id: bankId,
      accounting_id: accountingId,
      match_type: match.type,
      confidence: match.confidence.toString(),
      explanation: match.explanation
    };
  });
  const csv = stringifyCsv(rows, ["bank_id", "accounting_id", "match_type", "confidence", "explanation"]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=ledger-reconciliation.csv"
    }
  });
}
