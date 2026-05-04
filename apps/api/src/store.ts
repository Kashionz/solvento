import {
  type Account,
  type AppSnapshot,
  type Bill,
  createDefaultCategories,
  createDemoSnapshot,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  type DecisionHistoryItem,
  type Goal,
  type InstallmentPlan,
  type RecurringRule,
  type Transaction,
  type User,
} from '@cashpilot/shared'
import argon2 from 'argon2'
import { nanoid } from 'nanoid'

import { createSnapshotPersistence, type SnapshotPersistence } from './store-persistence'

type Identifiable = { id: string; userId: string }

type SessionRecord = {
  token: string
  userId: string
  createdAt: string
}

type AccountPatch = Partial<Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already registered')
  }
}

function nowIso() {
  return new Date().toISOString()
}

function cloneValue<T>(value: T) {
  return structuredClone(value)
}

export class MemoryStore {
  snapshot: AppSnapshot
  private readonly sessions = new Map<string, SessionRecord>()
  private readonly persistence?: SnapshotPersistence

  private constructor(snapshot: AppSnapshot, persistence?: SnapshotPersistence) {
    this.snapshot = snapshot
    this.persistence = persistence
  }

  static async create() {
    const persistence = await createSnapshotPersistence()
    const persistedSnapshot = await persistence.loadSnapshot()
    const store = new MemoryStore(persistedSnapshot ?? createDemoSnapshot(), persistence)
    const shouldPersistImmediately = !persistedSnapshot
    const didSeedPasswordHash = await store.seedPasswordHash()
    if (shouldPersistImmediately || didSeedPasswordHash) {
      await store.persistSnapshot()
    }
    return store
  }

  private async seedPasswordHash() {
    const demoUser = this.snapshot.users.find((user) => user.email === DEMO_EMAIL)
    if (!demoUser || demoUser.passwordHash) {
      return false
    }

    demoUser.passwordHash = await argon2.hash(DEMO_PASSWORD)
    return true
  }

  private createEntityId(prefix: string) {
    return `${prefix}_${nanoid(10)}`
  }

  private touchEntity<T extends { updatedAt: string }>(entity: T) {
    entity.updatedAt = nowIso()
    return entity
  }

  private async persistSnapshot() {
    if (this.persistence) {
      await this.persistence.saveSnapshot(this.snapshot)
    }
  }

  async close() {
    await this.persistence?.close()
  }

  getUserBySession(token?: string) {
    if (!token) {
      return null
    }

    const session = this.sessions.get(token)
    if (!session) {
      return null
    }

    return this.snapshot.users.find((user) => user.id === session.userId) ?? null
  }

  createSession(userId: string) {
    const token = this.createEntityId('sess')
    this.sessions.set(token, {
      token,
      userId,
      createdAt: nowIso(),
    })
    return token
  }

  async login(email: string, password: string) {
    const user = this.snapshot.users.find((candidate) => candidate.email === email)
    if (!user?.passwordHash) {
      return null
    }

    const matches = await argon2.verify(user.passwordHash, password)
    if (!matches) {
      return null
    }

    return {
      token: this.createSession(user.id),
      user,
    }
  }

  logout(token?: string) {
    if (token) {
      this.sessions.delete(token)
    }
  }

  async register(email: string, password: string, displayName: string) {
    const existing = this.snapshot.users.find((user) => user.email === email)
    if (existing) {
      throw new DuplicateEmailError()
    }

    const user: User = {
      id: this.createEntityId('usr'),
      email,
      displayName,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    user.passwordHash = await argon2.hash(password)
    this.snapshot.users.push(user)
    this.snapshot.categories.push(
      ...createDefaultCategories(user.id, {
        idPrefix: user.id,
      }),
    )
    await this.persistSnapshot()
    return user
  }

  getScopedSnapshot(userId: string): AppSnapshot {
    return {
      users: this.snapshot.users.filter((user) => user.id === userId).map(cloneValue),
      categories: this.snapshot.categories.filter((item) => item.userId === userId).map(cloneValue),
      accounts: this.snapshot.accounts.filter((item) => item.userId === userId).map(cloneValue),
      transactions: this.snapshot.transactions
        .filter((item) => item.userId === userId)
        .map(cloneValue),
      bills: this.snapshot.bills.filter((item) => item.userId === userId).map(cloneValue),
      recurringRules: this.snapshot.recurringRules
        .filter((item) => item.userId === userId)
        .map(cloneValue),
      installmentPlans: this.snapshot.installmentPlans
        .filter((item) => item.userId === userId)
        .map(cloneValue),
      goals: this.snapshot.goals.filter((item) => item.userId === userId).map(cloneValue),
      recommendations: this.snapshot.recommendations
        .filter((item) => item.userId === userId)
        .map(cloneValue),
      decisionHistory: this.snapshot.decisionHistory
        .filter((item) => item.userId === userId)
        .map(cloneValue),
    }
  }

  listAccounts(userId: string) {
    return this.snapshot.accounts.filter((account) => account.userId === userId)
  }

  getAccount(userId: string, id: string) {
    return (
      this.snapshot.accounts.find((account) => account.userId === userId && account.id === id) ??
      null
    )
  }

  async createAccount(
    userId: string,
    input: Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ) {
    const account: Account = {
      id: this.createEntityId('acc'),
      userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
    }
    this.snapshot.accounts.push(account)
    await this.persistSnapshot()
    return account
  }

  async updateAccount(userId: string, id: string, patch: AccountPatch) {
    const account = this.getAccount(userId, id)
    if (!account) {
      return null
    }

    Object.assign(account, patch)
    const updated = this.touchEntity(account)
    await this.persistSnapshot()
    return updated
  }

  async deleteAccount(userId: string, id: string) {
    const index = this.snapshot.accounts.findIndex(
      (account) => account.userId === userId && account.id === id,
    )
    if (index === -1) {
      return false
    }
    this.snapshot.accounts.splice(index, 1)
    await this.persistSnapshot()
    return true
  }

  listTransactions(userId: string, from?: string, to?: string) {
    return this.snapshot.transactions.filter((transaction) => {
      if (transaction.userId !== userId) {
        return false
      }
      if (from && transaction.date < from) {
        return false
      }
      if (to && transaction.date > to) {
        return false
      }
      return true
    })
  }

  async createTransaction(
    userId: string,
    input: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  ) {
    const transaction: Transaction = {
      id: this.createEntityId('txn'),
      userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
    }
    this.snapshot.transactions.push(transaction)
    await this.persistSnapshot()
    return transaction
  }

  async updateTransaction(userId: string, id: string, patch: Partial<Transaction>) {
    const transaction = this.snapshot.transactions.find(
      (item) => item.userId === userId && item.id === id,
    )
    if (!transaction) {
      return null
    }

    Object.assign(transaction, patch)
    const updated = this.touchEntity(transaction)
    await this.persistSnapshot()
    return updated
  }

  async deleteTransaction(userId: string, id: string) {
    const index = this.snapshot.transactions.findIndex(
      (item) => item.userId === userId && item.id === id,
    )
    if (index === -1) {
      return false
    }
    this.snapshot.transactions.splice(index, 1)
    await this.persistSnapshot()
    return true
  }

  listRecurringRules(userId: string) {
    return this.snapshot.recurringRules.filter((rule) => rule.userId === userId)
  }

  async createRecurringRule(userId: string, input: Omit<RecurringRule, 'id' | 'userId'>) {
    const rule: RecurringRule = {
      id: this.createEntityId('rr'),
      userId,
      ...input,
    }
    this.snapshot.recurringRules.push(rule)
    await this.persistSnapshot()
    return rule
  }

  async updateRecurringRule(userId: string, id: string, patch: Partial<RecurringRule>) {
    const rule = this.snapshot.recurringRules.find(
      (item) => item.userId === userId && item.id === id,
    )
    if (!rule) {
      return null
    }
    Object.assign(rule, patch)
    await this.persistSnapshot()
    return rule
  }

  async deleteRecurringRule(userId: string, id: string) {
    const index = this.snapshot.recurringRules.findIndex(
      (item) => item.userId === userId && item.id === id,
    )
    if (index === -1) {
      return false
    }
    this.snapshot.recurringRules.splice(index, 1)
    await this.persistSnapshot()
    return true
  }

  listBills(userId: string, status?: Bill['status']) {
    return this.snapshot.bills.filter((bill) => {
      if (bill.userId !== userId) {
        return false
      }
      return status ? bill.status === status : true
    })
  }

  getBill(userId: string, id: string) {
    return this.snapshot.bills.find((bill) => bill.userId === userId && bill.id === id) ?? null
  }

  async createBill(userId: string, input: Omit<Bill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const bill: Bill = {
      id: this.createEntityId('bill'),
      userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
    }
    this.snapshot.bills.push(bill)
    await this.persistSnapshot()
    return bill
  }

  async updateBill(userId: string, id: string, patch: Partial<Bill>) {
    const bill = this.getBill(userId, id)
    if (!bill) {
      return null
    }
    Object.assign(bill, patch)
    const updated = this.touchEntity(bill)
    await this.persistSnapshot()
    return updated
  }

  async deleteBill(userId: string, id: string) {
    const index = this.snapshot.bills.findIndex((bill) => bill.userId === userId && bill.id === id)
    if (index === -1) {
      return false
    }
    this.snapshot.bills.splice(index, 1)
    await this.persistSnapshot()
    return true
  }

  async addBillPayment(userId: string, id: string, amountMinor: number) {
    const bill = this.getBill(userId, id)
    if (!bill) {
      return null
    }

    bill.paidAmountMinor = Math.min(bill.totalAmountMinor, bill.paidAmountMinor + amountMinor)
    bill.status = bill.paidAmountMinor >= bill.totalAmountMinor ? 'paid' : 'partial'
    const updated = this.touchEntity(bill)
    await this.persistSnapshot()
    return updated
  }

  async markBillPaid(userId: string, id: string) {
    const bill = this.getBill(userId, id)
    if (!bill) {
      return null
    }

    bill.paidAmountMinor = bill.totalAmountMinor
    bill.status = 'paid'
    const updated = this.touchEntity(bill)
    await this.persistSnapshot()
    return updated
  }

  listInstallmentPlans(userId: string) {
    return this.snapshot.installmentPlans.filter((plan) => plan.userId === userId)
  }

  getInstallmentPlan(userId: string, id: string) {
    return (
      this.snapshot.installmentPlans.find((plan) => plan.userId === userId && plan.id === id) ??
      null
    )
  }

  async addInstallmentPlan(plan: InstallmentPlan) {
    this.snapshot.installmentPlans.push(plan)
    await this.persistSnapshot()
    return plan
  }

  async cancelInstallmentPlan(userId: string, id: string) {
    const plan = this.getInstallmentPlan(userId, id)
    if (!plan) {
      return null
    }

    plan.status = 'cancelled'
    plan.updatedAt = nowIso()
    plan.payments = plan.payments.map((payment) => ({
      ...payment,
      status: payment.status === 'paid' ? 'paid' : 'cancelled',
    }))
    await this.persistSnapshot()
    return plan
  }

  async markInstallmentPaymentPaid(userId: string, planId: string, paymentId: string) {
    const plan = this.getInstallmentPlan(userId, planId)
    if (!plan) {
      return null
    }

    const payment = plan.payments.find((item) => item.id === paymentId)
    if (!payment) {
      return null
    }

    payment.status = 'paid'
    payment.paidAt = nowIso()
    plan.updatedAt = nowIso()
    await this.persistSnapshot()
    return payment
  }

  listGoals(userId: string) {
    return this.snapshot.goals.filter((goal) => goal.userId === userId)
  }

  getGoal(userId: string, id: string) {
    return this.snapshot.goals.find((goal) => goal.userId === userId && goal.id === id) ?? null
  }

  async createGoal(userId: string, input: Omit<Goal, 'id' | 'userId'>) {
    const goal: Goal = {
      id: this.createEntityId('goal'),
      userId,
      ...input,
    }
    this.snapshot.goals.push(goal)
    await this.persistSnapshot()
    return goal
  }

  async updateGoal(userId: string, id: string, patch: Partial<Goal>) {
    const goal = this.getGoal(userId, id)
    if (!goal) {
      return null
    }
    Object.assign(goal, patch)
    await this.persistSnapshot()
    return goal
  }

  async deleteGoal(userId: string, id: string) {
    const index = this.snapshot.goals.findIndex((goal) => goal.userId === userId && goal.id === id)
    if (index === -1) {
      return false
    }

    this.snapshot.goals.splice(index, 1)
    await this.persistSnapshot()
    return true
  }

  async contributeGoal(userId: string, id: string, amountMinor: number) {
    const goal = this.getGoal(userId, id)
    if (!goal) {
      return null
    }

    goal.currentAmountMinor += amountMinor
    if (goal.currentAmountMinor >= goal.targetAmountMinor) {
      goal.status = 'completed'
    }
    await this.persistSnapshot()
    return goal
  }

  async appendDecisionHistory(
    userId: string,
    entry: Omit<DecisionHistoryItem, 'id' | 'userId' | 'createdAt'>,
  ) {
    const record: DecisionHistoryItem = {
      id: this.createEntityId('dec'),
      userId,
      createdAt: nowIso(),
      ...entry,
    }
    this.snapshot.decisionHistory.push(record)
    await this.persistSnapshot()
    return record
  }

  listDecisionHistory(userId: string) {
    return this.snapshot.decisionHistory.filter((entry) => entry.userId === userId)
  }

  listCategories(userId: string) {
    return this.snapshot.categories.filter((category) => category.userId === userId)
  }

  ensureBelongsToUser<T extends Identifiable>(entity: T | null, userId: string) {
    if (!entity || entity.userId !== userId) {
      return null
    }
    return entity
  }
}
