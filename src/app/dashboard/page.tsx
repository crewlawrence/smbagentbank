import Link from "next/link";
import ReconciliationFlow from "@/components/ReconciliationFlow";
import { auth } from "@/auth";

export default async function DashboardPage() {
  await auth();

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="badge">Tenant Workspace</span>
            <h1 className="mt-4 font-display text-3xl font-semibold text-ink-900">
              Reconciliation Control Room
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              Automate matches, review exceptions, and export reconciliation packages.
            </p>
          </div>
          <div className="flex gap-3">
            <Link className="secondary-button" href="/login">
              Switch account
            </Link>
          </div>
        </div>
        <div className="mt-10">
          <ReconciliationFlow />
        </div>
      </div>
    </main>
  );
}
