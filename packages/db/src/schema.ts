import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 160 }).notNull(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
})

export const categories = pgTable('categories', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  group: varchar('group', { length: 40 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
})

export const accounts = pgTable('accounts', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  currency: varchar('currency', { length: 8 }).notNull(),
  balanceMinor: integer('balance_minor').notNull(),
  creditLimitMinor: integer('credit_limit_minor'),
  billingDay: integer('billing_day'),
  dueDay: integer('due_day'),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
})

export const transactions = pgTable('transactions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: varchar('account_id', { length: 64 })
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 16 }).notNull(),
  amountMinor: integer('amount_minor').notNull(),
  direction: varchar('direction', { length: 24 }).notNull(),
  categoryId: varchar('category_id', { length: 64 })
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  note: text('note'),
  merchant: varchar('merchant', { length: 160 }),
  relatedBillId: varchar('related_bill_id', { length: 64 }),
  relatedInstallmentPaymentId: varchar('related_installment_payment_id', { length: 64 }),
  isRecurring: boolean('is_recurring').notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
})

export const bills = pgTable('bills', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: varchar('account_id', { length: 64 }).references(() => accounts.id, {
    onDelete: 'set null',
  }),
  name: varchar('name', { length: 160 }).notNull(),
  billType: varchar('bill_type', { length: 32 }).notNull(),
  statementMonth: varchar('statement_month', { length: 16 }),
  totalAmountMinor: integer('total_amount_minor').notNull(),
  paidAmountMinor: integer('paid_amount_minor').notNull(),
  dueDate: varchar('due_date', { length: 16 }).notNull(),
  status: varchar('status', { length: 24 }).notNull(),
  canInstallment: boolean('can_installment').notNull(),
  nonInstallmentAmountMinor: integer('non_installment_amount_minor'),
  installmentEligibleAmountMinor: integer('installment_eligible_amount_minor'),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
})

export const installmentPlans = pgTable('installment_plans', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  billId: varchar('bill_id', { length: 64 })
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  periods: integer('periods').notNull(),
  aprBps: integer('apr_bps').notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string', withTimezone: true }).notNull(),
  status: varchar('status', { length: 24 }).notNull(),
  totalPrincipalMinor: integer('total_principal_minor').notNull(),
  totalInterestMinor: integer('total_interest_minor').notNull(),
  totalPaymentMinor: integer('total_payment_minor').notNull(),
})

export const installmentPayments = pgTable('installment_payments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  planId: varchar('plan_id', { length: 64 })
    .notNull()
    .references(() => installmentPlans.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  period: integer('period').notNull(),
  principalMinor: integer('principal_minor').notNull(),
  interestMinor: integer('interest_minor').notNull(),
  totalMinor: integer('total_minor').notNull(),
  dueDate: varchar('due_date', { length: 16 }).notNull(),
  status: varchar('status', { length: 24 }).notNull(),
  paidAt: timestamp('paid_at', { mode: 'string', withTimezone: true }),
})

export const recurringRules = pgTable('recurring_rules', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  amountMinor: integer('amount_minor').notNull(),
  direction: varchar('direction', { length: 16 }).notNull(),
  accountId: varchar('account_id', { length: 64 }).references(() => accounts.id, {
    onDelete: 'set null',
  }),
  paymentAccountId: varchar('payment_account_id', { length: 64 }).references(() => accounts.id, {
    onDelete: 'set null',
  }),
  categoryId: varchar('category_id', { length: 64 })
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  frequency: varchar('frequency', { length: 24 }).notNull(),
  dayOfMonth: integer('day_of_month'),
  uncertainty: varchar('uncertainty', { length: 24 }).notNull(),
  includeInBaseScenario: boolean('include_in_base_scenario').notNull(),
  startDate: varchar('start_date', { length: 16 }).notNull(),
  endDate: varchar('end_date', { length: 16 }),
  isActive: boolean('is_active').notNull(),
})

export const goals = pgTable('goals', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 160 }).notNull(),
  targetAmountMinor: integer('target_amount_minor').notNull(),
  currentAmountMinor: integer('current_amount_minor').notNull(),
  deadline: varchar('deadline', { length: 16 }),
  priority: varchar('priority', { length: 16 }).notNull(),
  goalType: varchar('goal_type', { length: 32 }).notNull(),
  monthlyContributionMinor: integer('monthly_contribution_minor'),
  status: varchar('status', { length: 24 }).notNull(),
})

export const recommendations = pgTable('recommendations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  code: varchar('code', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  severity: varchar('severity', { length: 24 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  message: text('message').notNull(),
  actionLabel: varchar('action_label', { length: 80 }),
  actionType: varchar('action_type', { length: 32 }),
  relatedEntityId: varchar('related_entity_id', { length: 64 }),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  dismissedAt: timestamp('dismissed_at', { mode: 'string', withTimezone: true }),
  metadata: jsonb('metadata'),
})

export const decisionHistory = pgTable('decision_history', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 24 }).notNull(),
  name: varchar('name', { length: 160 }).notNull(),
  verdict: varchar('verdict', { length: 24 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string', withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
})
