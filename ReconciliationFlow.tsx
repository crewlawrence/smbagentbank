"use client";

import { useState } from "react";

type Match = {
  bankId: string;
  accountingId: string;
  type: "exact" | "fuzzy";
  confidence: number;
  explanation: string;
};

type ExceptionItem = {
  id: string;
  type: "unmatched" | "low_confidence" | "duplicate" | "missing_invoice";
  message: string;
  source?: "bank" | "accounting";
  analysis?: string;
  suggestedAction?: string;
};

type Summary = {
  totalBank: number;
  totalAccounting: number;
  exactMatches: number;
  fuzzyMatches: number;
  unmatchedBank: number;
  unmatchedAccounting: number;
  duplicates: number;
};

type ReconciliationResult = {
  summary: Summary;
  matches: Match[];
  exceptions: ExceptionItem[];
  unmatched: Array<{
    id: string;
    source: "bank" | "accounting";
    date: string;
    amount: number;
    description: string;
    reference: string;
  }>;
};

export default function ReconciliationFlow() {
  const [bankCsv, setBankCsv] = useState<string>("");
  const [accountingCsv, setAccountingCsv] = useState<string>("");
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [bankFileName, setBankFileName] = useState<string>("");
  const [accountingFileName, setAccountingFileName] = useState<string>("");
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "rejected">>({});
  const [unmatchAnalysis, setUnmatchAnalysis] = useState<Record<string, { analysis: string; suggestedAction: string }>>({});

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);
    setDecisions({});
    setUnmatchAnalysis({});
    try {
      const response = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankCsv, accountingCsv })
      });
      const data = (await response.json()) as ReconciliationResult;
      setResult(data);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExplainUnmatch = async (transactionId: string) => {
    const response = await fetch("/api/ai/unmatch-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId })
    });
    if (!response.ok) return;
    const data = (await response.json()) as { analysis: string; suggestedAction: string };
    setUnmatchAnalysis((prev) => ({
      ...prev,
      [transactionId]: { analysis: data.analysis, suggestedAction: data.suggestedAction }
    }));
  };

  const handleFile = (file: File | null, setter: (value: string) => void, nameSetter: (value: string) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setter(String(reader.result ?? ""));
      nameSetter(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid gap-8">
      <div className="node-card p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Run reconciliation</h2>
            <p className="mt-2 text-sm text-ink-500">
              Upload your bank transactions and accounting ledger CSVs. The agent normalizes,
              matches, and explains exceptions with suggested fixes.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={handleRun}
            disabled={isRunning || !bankCsv || !accountingCsv}
          >
            {isRunning ? "Running agent..." : "Run reconciliation"}
          </button>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-ink-700/10 bg-white/80 p-5">
            <div className="flex flex-col gap-2 text-xs text-ink-500">
              <label className="font-semibold text-ink-900">Bank transactions CSV</label>
              <input
                className="block w-full cursor-pointer rounded-full border border-ink-700/20 px-4 py-2 text-xs"
                type="file"
                onChange={(event) =>
                  handleFile(event.target.files?.[0] ?? null, setBankCsv, setBankFileName)
                }
              />
              {bankFileName ? <span>Loaded: {bankFileName}</span> : null}
            </div>
            <textarea
              className="mt-4 h-40 w-full rounded-2xl border border-ink-700/10 p-3 text-xs"
              placeholder="Paste bank transaction CSV here..."
              value={bankCsv}
              onChange={(event) => setBankCsv(event.target.value)}
            />
          </div>
          <div className="rounded-2xl border border-ink-700/10 bg-white/80 p-5">
            <div className="flex flex-col gap-2 text-xs text-ink-500">
              <label className="font-semibold text-ink-900">Accounting ledger CSV</label>
              <input
                className="block w-full cursor-pointer rounded-full border border-ink-700/20 px-4 py-2 text-xs"
                type="file"
                onChange={(event) =>
                  handleFile(event.target.files?.[0] ?? null, setAccountingCsv, setAccountingFileName)
                }
              />
              {accountingFileName ? <span>Loaded: {accountingFileName}</span> : null}
            </div>
            <textarea
              className="mt-4 h-40 w-full rounded-2xl border border-ink-700/10 p-3 text-xs"
              placeholder="Paste accounting records CSV here..."
              value={accountingCsv}
              onChange={(event) => setAccountingCsv(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="node-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Review & exceptions</h2>
          <div className="flex gap-3">
            <a className="secondary-button" href="/api/export/csv" target="_blank">
              Export CSV
            </a>
            <a className="secondary-button" href="/api/export/pdf" target="_blank">
              Export PDF
            </a>
          </div>
        </div>
        {!result ? (
          <p className="mt-6 text-sm text-ink-500">
            Run the agent to see match suggestions, confidence scores, and exceptions.
          </p>
        ) : (
          <div className="mt-6 grid gap-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-ink-700/10 p-4">
                <p className="text-xs uppercase text-ink-500">Exact matches</p>
                <p className="mt-2 text-2xl font-semibold text-ink-900">
                  {result.summary.exactMatches}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-700/10 p-4">
                <p className="text-xs uppercase text-ink-500">Fuzzy matches</p>
                <p className="mt-2 text-2xl font-semibold text-ink-900">
                  {result.summary.fuzzyMatches}
                </p>
              </div>
              <div className="rounded-2xl border border-ink-700/10 p-4">
                <p className="text-xs uppercase text-ink-500">Exceptions</p>
                <p className="mt-2 text-2xl font-semibold text-ink-900">
                  {result.exceptions.length}
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-ink-700/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-sand-100 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Bank ID</th>
                    <th className="px-4 py-3">Accounting ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Explanation</th>
                    <th className="px-4 py-3">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((match) => (
                    <tr key={`${match.bankId}-${match.accountingId}`} className="border-t">
                      <td className="px-4 py-3">{match.bankId}</td>
                      <td className="px-4 py-3">{match.accountingId}</td>
                      <td className="px-4 py-3 capitalize">{match.type}</td>
                      <td className="px-4 py-3">{Math.round(match.confidence * 100)}%</td>
                      <td className="px-4 py-3 text-xs text-ink-500">{match.explanation}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setDecisions((prev) => ({
                                ...prev,
                                [`${match.bankId}-${match.accountingId}`]: "accepted"
                              }))
                            }
                          >
                            Accept
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setDecisions((prev) => ({
                                ...prev,
                                [`${match.bankId}-${match.accountingId}`]: "rejected"
                              }))
                            }
                          >
                            Reject
                          </button>
                        </div>
                        {decisions[`${match.bankId}-${match.accountingId}`] ? (
                          <p className="mt-2 text-xs text-ink-500">
                            Decision: {decisions[`${match.bankId}-${match.accountingId}`]}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase text-ink-500">Exceptions & fixes</h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {result.exceptions.map((exception) => (
                  <div key={exception.id} className="rounded-2xl border border-ink-700/10 bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-ink-500">
                          {exception.type.replace("_", " ")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-ink-900">{exception.message}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-ink-500">
                      <div>
                        <p className="font-semibold text-ink-700">Likely cause</p>
                        <p>{exception.analysis ?? "Pending AI explanation."}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-ink-700">Suggested fix</p>
                        <p>{exception.suggestedAction ?? "Review and resolve in the ledger."}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-ink-700/10 p-5">
              <h3 className="text-sm font-semibold uppercase text-ink-500">AI reasoning for unmatches</h3>
              <p className="mt-2 text-xs text-ink-500">
                These items were not matched. Use AI to explain likely causes and next steps.
              </p>
              <div className="mt-4 space-y-3">
                {result.unmatched.length === 0 ? (
                  <p className="text-sm text-ink-500">No unmatched items found.</p>
                ) : (
                  result.unmatched.map((txn) => {
                    const analysis = unmatchAnalysis[txn.id];
                    return (
                      <div key={txn.id} className="rounded-2xl border border-ink-700/10 bg-white/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4 text-sm">
                          <div>
                            <p className="font-semibold text-ink-900">
                              {txn.description || "(no description)"}
                            </p>
                            <p className="text-xs text-ink-500">
                              {txn.source.toUpperCase()} · {txn.date} · {txn.amount.toFixed(2)}
                            </p>
                          </div>
                          <button
                            className="secondary-button"
                            onClick={() => handleExplainUnmatch(txn.id)}
                          >
                            Explain this unmatch
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 text-xs text-ink-500 lg:grid-cols-2">
                          <div>
                            <p className="font-semibold text-ink-700">Likely cause</p>
                            <p>{analysis?.analysis ?? "Click to generate explanation."}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-ink-700">Suggested fix</p>
                            <p>{analysis?.suggestedAction ?? "Click to generate fix."}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
