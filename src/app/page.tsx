import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="badge">Bank Reconciliation Agent</span>
            <h1 className="mt-6 font-display text-4xl font-semibold text-ink-900 md:text-6xl">
              LedgerSync AI helps SMBs reconcile in minutes, not days.
            </h1>
            <p className="mt-6 text-lg text-ink-500">
              Upload your bank CSV and accounting records, let the agent normalize data,
              match transactions, surface exceptions, and guide your team through human
              review. Export a clean reconciliation package when you're done.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link className="primary-button" href="/login">
                Sign in with Google
              </Link>
              <Link className="secondary-button" href="/dashboard">
                View demo workspace
              </Link>
            </div>
          </div>
          <div className="node-card w-full max-w-md p-8">
            <h2 className="font-display text-2xl font-semibold">Workflow snapshot</h2>
            <ul className="mt-6 space-y-3 text-sm text-ink-500">
              <li>Upload bank + accounting CSVs</li>
              <li>Normalize fields: date, amount, description, reference</li>
              <li>Rule-based exact and date-window matching</li>
              <li>LLM-assisted fuzzy matching with explanations</li>
              <li>Human review + exception handling</li>
              <li>Export CSV/PDF packages</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
