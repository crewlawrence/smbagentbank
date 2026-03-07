import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getLastResult } from "@/lib/store";
import { auth } from "@/auth";
import { getLatestRun } from "@/lib/db";
import type { ReconciliationSummary } from "@/lib/types";

const parseSummary = (summary: unknown): ReconciliationSummary | null => {
  if (summary && typeof summary === "object") {
    return summary as ReconciliationSummary;
  }

  if (typeof summary === "string") {
    try {
      return JSON.parse(summary) as ReconciliationSummary;
    } catch {
      return null;
    }
  }

  return null;
};

export async function GET() {
  const session = await auth();
  const tenantId = session?.user?.tenantId ?? null;

  const run = tenantId ? getLatestRun(tenantId) : null;

  const parsedSummary = run ? parseSummary(run.summary) : null;
  const result = run && parsedSummary ? { summary: parsedSummary, exceptions: [] } : getLastResult();

  if (!result) {
    return NextResponse.json({ error: "Run a reconciliation first." }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  const headingSize = 18;
  const textSize = 11;
  let y = height - 60;

  page.drawText("LedgerSync AI Reconciliation Summary", {
    x: 50,
    y,
    size: headingSize,
    font,
    color: rgb(0.06, 0.1, 0.13)
  });

  y -= 30;
  const summaryLines = [
    `Total bank transactions: ${result.summary.totalBank}`,
    `Total accounting transactions: ${result.summary.totalAccounting}`,
    `Exact matches: ${result.summary.exactMatches}`,
    `Fuzzy matches: ${result.summary.fuzzyMatches}`,
    `Unmatched bank items: ${result.summary.unmatchedBank}`,
    `Unmatched accounting items: ${result.summary.unmatchedAccounting}`,
    `Duplicates flagged: ${result.summary.duplicates}`
  ];

  summaryLines.forEach((line) => {
    page.drawText(line, { x: 50, y, size: textSize, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  });

  y -= 12;
  page.drawText("Exceptions", { x: 50, y, size: 13, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;

  result.exceptions.slice(0, 10).forEach((exception) => {
    const line = `${exception.type.toUpperCase()}: ${exception.message}`;
    page.drawText(line, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 14;
  });

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=ledger-reconciliation.pdf"
    }
  });
}
