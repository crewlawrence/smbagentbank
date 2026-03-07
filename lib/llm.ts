import type { NormalizedTransaction } from "./types";
import { differenceInCalendarDays, parseISO } from "date-fns";
import OpenAI from "openai";

export type LlmMatchScore = {
  confidence: number;
  explanation: string;
};

export type UnmatchAnalysis = {
  analysis: string;
  suggestedAction: string;
  confidence: number;
};

export type ExceptionAnalysis = {
  analysis: string;
  suggestedAction: string;
  confidence: number;
};
const getClient = () =>
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? ""
  });

export async function scoreNearMatch(
  bankTxn: NormalizedTransaction,
  acctTxn: NormalizedTransaction,
  similarity: number
): Promise<LlmMatchScore> {
  if (!process.env.OPENAI_API_KEY) {
    return heuristicScore(bankTxn, acctTxn, similarity, "OPENAI_API_KEY missing");
  }

  try {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const client = getClient();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a bank reconciliation assistant. Return JSON only with keys confidence (0-1) and explanation."
        },
        {
          role: "user",
          content: JSON.stringify({
            bank: bankTxn,
            accounting: acctTxn,
            similarity
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "match_score",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              confidence: { type: "number" },
              explanation: { type: "string" }
            },
            required: ["confidence", "explanation"]
          }
        }
      }
    });

    const output = response.output_text;
    const parsed = JSON.parse(output ?? "{}") as LlmMatchScore;
    const confidence = clampNumber(parsed.confidence ?? 0, 0, 1);
    const explanation =
      typeof parsed.explanation === "string" && parsed.explanation.trim().length > 0
        ? parsed.explanation.trim()
        : "LLM provided no explanation.";
    return { confidence, explanation };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM call failed";
    return heuristicScore(bankTxn, acctTxn, similarity, message);
  }
}

export async function analyzeUnmatchedTransaction(
  txn: NormalizedTransaction
): Promise<UnmatchAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      analysis: "OPENAI_API_KEY missing. Showing heuristic guidance only.",
      suggestedAction: "Verify source records and upload missing documents.",
      confidence: 0.4
    };
  }

  try {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const client = getClient();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a bank reconciliation analyst. Return JSON only with keys analysis, suggestedAction, confidence (0-1). Be concise and actionable."
        },
        {
          role: "user",
          content: JSON.stringify({
            transaction: txn
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "unmatch_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              analysis: { type: "string" },
              suggestedAction: { type: "string" },
              confidence: { type: "number" }
            },
            required: ["analysis", "suggestedAction", "confidence"]
          }
        }
      }
    });

    const output = response.output_text;
    const parsed = JSON.parse(output ?? "{}") as UnmatchAnalysis;
    return {
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : "No analysis returned.",
      suggestedAction:
        typeof parsed.suggestedAction === "string"
          ? parsed.suggestedAction
          : "Review source documents.",
      confidence: clampNumber(parsed.confidence ?? 0, 0, 1)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM call failed";
    return {
      analysis: `LLM analysis failed (${message}).`,
      suggestedAction: "Retry or review the raw documents.",
      confidence: 0.3
    };
  }
}

export async function analyzeException(input: {
  type: string;
  message: string;
  transaction?: NormalizedTransaction;
  bank?: NormalizedTransaction;
  accounting?: NormalizedTransaction;
  match?: { type: string; confidence: number; explanation: string };
}): Promise<ExceptionAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      analysis: "OPENAI_API_KEY missing. Showing heuristic guidance only.",
      suggestedAction: "Review the related transactions and adjust matching rules.",
      confidence: 0.4
    };
  }

  try {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const client = getClient();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a bank reconciliation analyst. Return JSON only with keys analysis, suggestedAction, confidence (0-1). Explain likely cause and suggested fix."
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "exception_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              analysis: { type: "string" },
              suggestedAction: { type: "string" },
              confidence: { type: "number" }
            },
            required: ["analysis", "suggestedAction", "confidence"]
          }
        }
      }
    });

    const output = response.output_text;
    const parsed = JSON.parse(output ?? "{}") as ExceptionAnalysis;
    return {
      analysis: typeof parsed.analysis === "string" ? parsed.analysis : "No analysis returned.",
      suggestedAction:
        typeof parsed.suggestedAction === "string"
          ? parsed.suggestedAction
          : "Review source records and adjust the match.",
      confidence: clampNumber(parsed.confidence ?? 0, 0, 1)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "LLM call failed";
    return {
      analysis: `LLM analysis failed (${message}).`,
      suggestedAction: "Retry or review the source documents.",
      confidence: 0.3
    };
  }
}

function heuristicScore(
  bankTxn: NormalizedTransaction,
  acctTxn: NormalizedTransaction,
  similarity: number,
  reason: string
): LlmMatchScore {
  const dateDiff = Math.abs(
    differenceInCalendarDays(parseISO(bankTxn.date), parseISO(acctTxn.date))
  );
  const amountMatch = Math.abs(bankTxn.amount - acctTxn.amount) <= 0.01;
  const confidence = clampNumber(
    Number(
      (
        similarity * 0.6 +
        (amountMatch ? 0.25 : 0.1) +
        (dateDiff === 0 ? 0.15 : 0.05)
      ).toFixed(2)
    ),
    0,
    1
  );
  const explanation = `Fallback score (${reason}). Similarity ${(similarity * 100).toFixed(0)}%, ${dateDiff} day gap.`;
  return { confidence, explanation };
}

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}
