import { sql } from 'drizzle-orm'

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    display_name VARCHAR(160) NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    "group" VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(32) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    balance_minor INTEGER NOT NULL,
    credit_limit_minor INTEGER,
    billing_day INTEGER,
    due_day INTEGER,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date VARCHAR(16) NOT NULL,
    amount_minor INTEGER NOT NULL,
    direction VARCHAR(24) NOT NULL,
    category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    note TEXT,
    merchant VARCHAR(160),
    related_bill_id VARCHAR(64),
    related_installment_payment_id VARCHAR(64),
    is_recurring BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE SET NULL,
    name VARCHAR(160) NOT NULL,
    bill_type VARCHAR(32) NOT NULL,
    statement_month VARCHAR(16),
    total_amount_minor INTEGER NOT NULL,
    paid_amount_minor INTEGER NOT NULL,
    due_date VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    can_installment BOOLEAN NOT NULL,
    non_installment_amount_minor INTEGER,
    installment_eligible_amount_minor INTEGER,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS installment_plans (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bill_id VARCHAR(64) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    periods INTEGER NOT NULL,
    apr_bps INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL,
    total_principal_minor INTEGER NOT NULL,
    total_interest_minor INTEGER NOT NULL,
    total_payment_minor INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS installment_payments (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period INTEGER NOT NULL,
    principal_minor INTEGER NOT NULL,
    interest_minor INTEGER NOT NULL,
    total_minor INTEGER NOT NULL,
    due_date VARCHAR(16) NOT NULL,
    status VARCHAR(24) NOT NULL,
    paid_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS recurring_rules (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    amount_minor INTEGER NOT NULL,
    direction VARCHAR(16) NOT NULL,
    account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE SET NULL,
    payment_account_id VARCHAR(64) REFERENCES accounts(id) ON DELETE SET NULL,
    category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    frequency VARCHAR(24) NOT NULL,
    day_of_month INTEGER,
    uncertainty VARCHAR(24) NOT NULL,
    include_in_base_scenario BOOLEAN NOT NULL,
    start_date VARCHAR(16) NOT NULL,
    end_date VARCHAR(16),
    is_active BOOLEAN NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS goals (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    target_amount_minor INTEGER NOT NULL,
    current_amount_minor INTEGER NOT NULL,
    deadline VARCHAR(16),
    priority VARCHAR(16) NOT NULL,
    goal_type VARCHAR(32) NOT NULL,
    monthly_contribution_minor INTEGER,
    status VARCHAR(24) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS recommendations (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    severity VARCHAR(24) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    action_label VARCHAR(80),
    action_type VARCHAR(32),
    related_entity_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    dismissed_at TIMESTAMPTZ,
    metadata JSONB
  )`,
  `CREATE TABLE IF NOT EXISTS decision_history (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(24) NOT NULL,
    name VARCHAR(160) NOT NULL,
    verdict VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL
  )`,
] as const

export async function ensureDatabaseSchema(database: {
  execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown>
}) {
  for (const statement of SCHEMA_STATEMENTS) {
    await database.execute(sql.raw(statement))
  }
}
