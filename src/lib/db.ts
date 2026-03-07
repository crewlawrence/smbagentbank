import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";

const resolveDatabasePath = () => {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (url.startsWith("file:")) {
    const relative = url.replace("file:", "");
    return path.resolve(process.cwd(), relative);
  }
  return path.resolve(process.cwd(), url);
};

export const db = new Database(resolveDatabasePath());
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  image TEXT,
  tenant_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES ledger_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_suggestions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  bank_transaction_id TEXT NOT NULL,
  accounting_transaction_id TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence REAL NOT NULL,
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES reconciliation_runs(id) ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_tenant ON ledger_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_runs_tenant ON reconciliation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_matches_run ON match_suggestions(run_id);
`);

const nowIso = () => new Date().toISOString();
const createId = () => crypto.randomUUID();

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  tenantId: string | null;
};

export const ensureTenantForUser = (input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): { userId: string; tenantId: string } => {
  const getUser = db.prepare("SELECT id, name, email, image, tenant_id as tenantId FROM users WHERE email = ?");
  const user = getUser.get(input.email) as UserRow | undefined;

  if (!user) {
    const tenantId = createId();
    const userId = createId();
    const tenantName = input.name ? `${input.name}'s Workspace` : "SMB Workspace";
    const createdAt = nowIso();

    const insertTenant = db.prepare(
      "INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)"
    );
    insertTenant.run(tenantId, tenantName, createdAt);

    const insertUser = db.prepare(
      "INSERT INTO users (id, name, email, image, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertUser.run(userId, input.name ?? null, input.email, input.image ?? null, tenantId, createdAt);

    return { userId, tenantId };
  }

  if (user.tenantId) {
    return { userId: user.id, tenantId: user.tenantId };
  }

  const tenantId = createId();
  const tenantName = input.name ? `${input.name}'s Workspace` : "SMB Workspace";
  const createdAt = nowIso();

  db.prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")
    .run(tenantId, tenantName, createdAt);
  db.prepare("UPDATE users SET tenant_id = ? WHERE id = ?").run(tenantId, user.id);

  return { userId: user.id, tenantId };
};

export const createLedgerAccount = (input: {
  tenantId: string;
  name: string;
  type: string;
}) => {
  const id = createId();
  db.prepare(
    "INSERT INTO ledger_accounts (id, tenant_id, name, type, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, input.tenantId, input.name, input.type, nowIso());

  return { id, ...input };
};

export const getOrCreateLedgerAccount = (input: {
  tenantId: string;
  name: string;
  type: string;
}) => {
  const existing = db
    .prepare("SELECT id, tenant_id as tenantId, name, type FROM ledger_accounts WHERE tenant_id = ? AND name = ? LIMIT 1")
    .get(input.tenantId, input.name) as { id: string; tenantId: string; name: string; type: string } | undefined;

  if (existing) return existing;
  return createLedgerAccount(input);
};

export const insertTransactions = (
  rows: Array<{
    id: string;
    tenantId: string;
    accountId: string;
    source: string;
    date: Date;
    amount: number;
    description: string;
    reference: string;
    rawJson: string;
  }>
) => {
  if (rows.length === 0) return;

  const stmt = db.prepare(
    `INSERT INTO transactions
      (id, tenant_id, account_id, source, date, amount, description, reference, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction((items: typeof rows) => {
    const createdAt = nowIso();
    for (const row of items) {
      stmt.run(
        row.id,
        row.tenantId,
        row.accountId,
        row.source,
        row.date.toISOString(),
        row.amount,
        row.description,
        row.reference,
        row.rawJson,
        createdAt
      );
    }
  });

  insertMany(rows);
};

export const clearTransactionsForSource = (tenantId: string, source: string) => {
  db.prepare("DELETE FROM transactions WHERE tenant_id = ? AND source = ?").run(tenantId, source);
};


export const createReconciliationRun = (input: {
  tenantId: string;
  summary: string;
}) => {
  const id = createId();
  db.prepare(
    "INSERT INTO reconciliation_runs (id, tenant_id, created_at, summary) VALUES (?, ?, ?, ?)"
  ).run(id, input.tenantId, nowIso(), input.summary);

  return { id, ...input };
};

export const insertMatchSuggestions = (
  rows: Array<{
    runId: string;
    bankTransactionId: string;
    accountingTransactionId: string;
    type: string;
    confidence: number;
    explanation: string;
    status?: string;
  }>
) => {
  if (rows.length === 0) return;

  const stmt = db.prepare(
    `INSERT INTO match_suggestions
      (id, run_id, bank_transaction_id, accounting_transaction_id, type, confidence, explanation, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction((items: typeof rows) => {
    const createdAt = nowIso();
    for (const row of items) {
      stmt.run(
        createId(),
        row.runId,
        row.bankTransactionId,
        row.accountingTransactionId,
        row.type,
        row.confidence,
        row.explanation,
        row.status ?? "pending",
        createdAt
      );
    }
  });

  insertMany(rows);
};

export const getLatestRun = (tenantId: string) => {
  return db
    .prepare("SELECT id, tenant_id as tenantId, created_at as createdAt, summary FROM reconciliation_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(tenantId) as { id: string; tenantId: string; createdAt: string; summary: string } | undefined;
};

export const getLatestRunWithMatches = (tenantId: string) => {
  const run = getLatestRun(tenantId);
  if (!run) return null;

  const matches = db
    .prepare(
      `SELECT
        id,
        run_id as runId,
        bank_transaction_id as bankTransactionId,
        accounting_transaction_id as accountingTransactionId,
        type,
        confidence,
        explanation,
        status,
        created_at as createdAt
       FROM match_suggestions
       WHERE run_id = ?
       ORDER BY created_at ASC`
    )
    .all(run.id) as Array<{
      id: string;
      runId: string;
      bankTransactionId: string;
      accountingTransactionId: string;
      type: string;
      confidence: number;
      explanation: string;
      status: string;
      createdAt: string;
    }>;

  return { run, matches };
};



export const getTransactionById = (tenantId: string, id: string) => {
  return db
    .prepare(
      "SELECT id, tenant_id as tenantId, source, date, amount, description, reference, raw_json as rawJson FROM transactions WHERE tenant_id = ? AND id = ?"
    )
    .get(tenantId, id) as
    | {
        id: string;
        tenantId: string;
        source: string;
        date: string;
        amount: number;
        description: string;
        reference: string;
        rawJson: string;
      }
    | undefined;
};
