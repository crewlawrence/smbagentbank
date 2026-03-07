import { v4 as uuid } from "uuid";
import type { CsvRow } from "./csv";
import type { NormalizedTransaction, SourceKind } from "./types";

const FIELD_MAP = {
  date: ["date", "transaction date", "posted date", "posting date", "value date"],
  amount: ["amount", "amt", "total", "value", "debit", "credit"],
  description: ["description", "memo", "details", "narrative", "merchant", "name"],
  reference: ["reference", "ref", "check", "cheque", "id", "document" ]
};

const AMOUNT_SIGNS = ["debit", "withdrawal", "payment"];

export function normalizeRows(rows: CsvRow[], source: SourceKind): NormalizedTransaction[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  const map = resolveHeaderMap(headers);
  return rows.map((row) => {
    const rawAmount = row[map.amount] ?? "0";
    const parsedAmount = parseAmount(rawAmount, row, headers);
    const date = parseDate(row[map.date] ?? "");
    const description = (row[map.description] ?? "").trim();
    const reference = (row[map.reference] ?? "").trim();
    return {
      id: uuid(),
      source,
      date,
      amount: parsedAmount,
      description,
      reference,
      raw: row
    };
  });
}

function resolveHeaderMap(headers: string[]) {
  const normalized = headers.map((header) => header.toLowerCase());
  return {
    date: findHeader(normalized, headers, FIELD_MAP.date),
    amount: findHeader(normalized, headers, FIELD_MAP.amount),
    description: findHeader(normalized, headers, FIELD_MAP.description),
    reference: findHeader(normalized, headers, FIELD_MAP.reference)
  };
}

function findHeader(normalized: string[], original: string[], candidates: string[]): string {
  const index = normalized.findIndex((value) => candidates.some((candidate) => value.includes(candidate)));
  if (index === -1) return original[0];
  return original[index];
}

function parseDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function parseAmount(value: string, row: CsvRow, headers: string[]): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  let amount = Number.parseFloat(cleaned || "0");
  if (Number.isNaN(amount)) amount = 0;
  const lowerHeaders = headers.map((header) => header.toLowerCase());
  const debitIndex = lowerHeaders.findIndex((header) => header.includes("debit"));
  const creditIndex = lowerHeaders.findIndex((header) => header.includes("credit"));
  if (debitIndex !== -1 && creditIndex !== -1) {
    const debitKey = headers[debitIndex];
    const creditKey = headers[creditIndex];
    const debitValue = Number.parseFloat((row[debitKey] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
    const creditValue = Number.parseFloat((row[creditKey] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
    amount = creditValue - debitValue;
  }
  const isNegative = AMOUNT_SIGNS.some((token) => value.toLowerCase().includes(token));
  if (isNegative && amount > 0) amount *= -1;
  return Number(amount.toFixed(2));
}
