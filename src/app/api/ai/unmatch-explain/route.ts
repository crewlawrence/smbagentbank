import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getTransactionById } from "@/lib/db";
import { analyzeUnmatchedTransaction } from "@/lib/llm";

const payloadSchema = z.object({
  transactionId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await auth();
  const tenantId = session?.user?.tenantId ?? null;

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const payload = payloadSchema.parse(body);

  const txn = getTransactionById(tenantId, payload.transactionId);
  if (!txn) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const analysis = await analyzeUnmatchedTransaction({
    id: txn.id,
    source: txn.source === "bank" ? "bank" : "accounting",
    date: txn.date,
    amount: txn.amount,
    description: txn.description,
    reference: txn.reference,
    raw: JSON.parse(txn.rawJson)
  });

  return NextResponse.json(analysis);
}
