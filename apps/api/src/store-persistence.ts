import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  accounts,
  bills,
  categories,
  createNodePgDatabase,
  createPgliteDatabase,
  decisionHistory,
  ensureDatabaseSchema,
  goals,
  installmentPayments,
  installmentPlans,
  recommendations,
  recurringRules,
  transactions,
  users,
} from '@cashpilot/db'
import type {
  Account,
  AppSnapshot,
  Bill,
  Category,
  DecisionHistoryItem,
  Goal,
  InstallmentPayment,
  InstallmentPlan,
  Recommendation,
  RecurringRule,
  Transaction,
  User,
} from '@cashpilot/shared'

type NodePgConnection = Awaited<ReturnType<typeof createNodePgDatabase>>
type PgliteConnection = Awaited<ReturnType<typeof createPgliteDatabase>>
type ConnectedDatabase = NodePgConnection | PgliteConnection

export interface SnapshotPersistence {
  close: () => Promise<void>
  loadSnapshot: () => Promise<AppSnapshot | null>
  saveSnapshot: (snapshot: AppSnapshot) => Promise<void>
}

function resolvePgliteDir() {
  if (process.env.CASHPILOT_PGLITE_DIR) {
    return process.env.CASHPILOT_PGLITE_DIR
  }

  if (process.env.NODE_ENV === 'test') {
    return undefined
  }

  const dataDir = join(process.cwd(), '.cashpilot-data', 'pglite')
  mkdirSync(dataDir, { recursive: true })
  return dataDir
}

async function connectDatabase(): Promise<ConnectedDatabase> {
  if (process.env.DATABASE_URL) {
    return createNodePgDatabase(process.env.DATABASE_URL)
  }

  const pgliteDir = resolvePgliteDir()
  return createPgliteDatabase(pgliteDir)
}

function toInstallmentPlans(
  planRows: (typeof installmentPlans.$inferSelect)[],
  paymentRows: (typeof installmentPayments.$inferSelect)[],
): InstallmentPlan[] {
  const paymentsByPlanId = new Map<string, InstallmentPayment[]>()

  for (const payment of paymentRows) {
    const normalizedPayment: InstallmentPayment = {
      ...payment,
      status: payment.status as InstallmentPayment['status'],
      paidAt: payment.paidAt ?? undefined,
    }
    const current = paymentsByPlanId.get(payment.planId) ?? []
    current.push(normalizedPayment)
    paymentsByPlanId.set(payment.planId, current)
  }

  return planRows.map((plan) => ({
    ...plan,
    status: plan.status as InstallmentPlan['status'],
    payments: (paymentsByPlanId.get(plan.id) ?? []).sort(
      (left, right) => left.period - right.period,
    ),
  }))
}

function toUsers(rows: (typeof users.$inferSelect)[]): User[] {
  return rows.map((row) => ({
    ...row,
    passwordHash: row.passwordHash ?? undefined,
  }))
}

function toCategories(rows: (typeof categories.$inferSelect)[]): Category[] {
  return rows.map((row) => ({
    ...row,
    group: row.group as Category['group'],
  }))
}

function toAccounts(rows: (typeof accounts.$inferSelect)[]): Account[] {
  return rows.map((row) => ({
    ...row,
    type: row.type as Account['type'],
    currency: row.currency as Account['currency'],
    creditLimitMinor: row.creditLimitMinor ?? undefined,
    billingDay: row.billingDay ?? undefined,
    dueDay: row.dueDay ?? undefined,
  }))
}

function toTransactions(rows: (typeof transactions.$inferSelect)[]): Transaction[] {
  return rows.map((row) => ({
    ...row,
    direction: row.direction as Transaction['direction'],
    note: row.note ?? undefined,
    merchant: row.merchant ?? undefined,
    relatedBillId: row.relatedBillId ?? undefined,
    relatedInstallmentPaymentId: row.relatedInstallmentPaymentId ?? undefined,
  }))
}

function toBills(rows: (typeof bills.$inferSelect)[]): Bill[] {
  return rows.map((row) => ({
    ...row,
    accountId: row.accountId ?? undefined,
    billType: row.billType as Bill['billType'],
    statementMonth: row.statementMonth ?? undefined,
    status: row.status as Bill['status'],
    nonInstallmentAmountMinor: row.nonInstallmentAmountMinor ?? undefined,
    installmentEligibleAmountMinor: row.installmentEligibleAmountMinor ?? undefined,
  }))
}

function toRecurringRules(rows: (typeof recurringRules.$inferSelect)[]): RecurringRule[] {
  return rows.map((row) => ({
    ...row,
    direction: row.direction as RecurringRule['direction'],
    accountId: row.accountId ?? undefined,
    paymentAccountId: row.paymentAccountId ?? undefined,
    frequency: row.frequency as RecurringRule['frequency'],
    dayOfMonth: row.dayOfMonth ?? undefined,
    uncertainty: row.uncertainty as RecurringRule['uncertainty'],
    endDate: row.endDate ?? undefined,
  }))
}

function toGoals(rows: (typeof goals.$inferSelect)[]): Goal[] {
  return rows.map((row) => ({
    ...row,
    deadline: row.deadline ?? undefined,
    priority: row.priority as Goal['priority'],
    goalType: row.goalType as Goal['goalType'],
    monthlyContributionMinor: row.monthlyContributionMinor ?? undefined,
    status: row.status as Goal['status'],
  }))
}

function toRecommendations(rows: (typeof recommendations.$inferSelect)[]): Recommendation[] {
  return rows.map((row) => ({
    ...row,
    severity: row.severity as Recommendation['severity'],
    actionLabel: row.actionLabel ?? undefined,
    actionType: row.actionType as Recommendation['actionType'],
    relatedEntityId: row.relatedEntityId ?? undefined,
    dismissedAt: row.dismissedAt ?? undefined,
    metadata: (row.metadata as Recommendation['metadata']) ?? undefined,
  }))
}

function toDecisionHistory(rows: (typeof decisionHistory.$inferSelect)[]): DecisionHistoryItem[] {
  return rows.map((row) => ({
    ...row,
    type: row.type as DecisionHistoryItem['type'],
    verdict: row.verdict as DecisionHistoryItem['verdict'],
    payload: row.payload as DecisionHistoryItem['payload'],
  }))
}

export async function createSnapshotPersistence(): Promise<SnapshotPersistence> {
  const connection = await connectDatabase()
  await ensureDatabaseSchema(connection.db)

  return {
    close: async () => {
      if ('end' in connection.client) {
        await connection.client.end()
      } else {
        await connection.client.close()
      }
    },

    loadSnapshot: async () => {
      const loadedUsers = await connection.db.select().from(users)
      if (loadedUsers.length === 0) {
        return null
      }

      const loadedCategories = await connection.db.select().from(categories)
      const loadedAccounts = await connection.db.select().from(accounts)
      const loadedTransactions = await connection.db.select().from(transactions)
      const loadedBills = await connection.db.select().from(bills)
      const loadedRecurringRules = await connection.db.select().from(recurringRules)
      const loadedInstallmentPlans = await connection.db.select().from(installmentPlans)
      const loadedInstallmentPayments = await connection.db.select().from(installmentPayments)
      const loadedGoals = await connection.db.select().from(goals)
      const loadedRecommendations = await connection.db.select().from(recommendations)
      const loadedDecisionHistory = await connection.db.select().from(decisionHistory)

      return {
        users: toUsers(loadedUsers),
        categories: toCategories(loadedCategories),
        accounts: toAccounts(loadedAccounts),
        transactions: toTransactions(loadedTransactions),
        bills: toBills(loadedBills),
        recurringRules: toRecurringRules(loadedRecurringRules),
        installmentPlans: toInstallmentPlans(loadedInstallmentPlans, loadedInstallmentPayments),
        goals: toGoals(loadedGoals),
        recommendations: toRecommendations(loadedRecommendations),
        decisionHistory: toDecisionHistory(loadedDecisionHistory),
      } satisfies AppSnapshot
    },

    saveSnapshot: async (snapshot) => {
      await connection.db.transaction(async (tx) => {
        await tx.delete(installmentPayments)
        await tx.delete(installmentPlans)
        await tx.delete(transactions)
        await tx.delete(recommendations)
        await tx.delete(decisionHistory)
        await tx.delete(bills)
        await tx.delete(recurringRules)
        await tx.delete(goals)
        await tx.delete(accounts)
        await tx.delete(categories)
        await tx.delete(users)

        await tx.insert(users).values(snapshot.users)
        await tx.insert(categories).values(snapshot.categories)
        await tx.insert(accounts).values(snapshot.accounts)
        await tx.insert(goals).values(snapshot.goals)
        await tx.insert(recurringRules).values(snapshot.recurringRules)
        await tx.insert(bills).values(snapshot.bills)
        await tx.insert(transactions).values(snapshot.transactions)

        if (snapshot.installmentPlans.length > 0) {
          await tx
            .insert(installmentPlans)
            .values(snapshot.installmentPlans.map(({ payments, ...plan }) => plan))
          await tx
            .insert(installmentPayments)
            .values(snapshot.installmentPlans.flatMap((plan) => plan.payments))
        }

        if (snapshot.recommendations.length > 0) {
          await tx.insert(recommendations).values(snapshot.recommendations)
        }

        if (snapshot.decisionHistory.length > 0) {
          await tx.insert(decisionHistory).values(snapshot.decisionHistory)
        }
      })
    },
  }
}
