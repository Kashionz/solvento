export const APP_TODAY = '2026-05-04'

export const currencies = ['TWD', 'JPY', 'USD', 'EUR', 'SEK', 'DKK', 'NOK'] as const
export type CurrencyCode = (typeof currencies)[number]

export const accountTypes = [
  'cash',
  'bank',
  'investment',
  'credit_card',
  'loan',
  'goal_fund',
] as const
export type AccountType = (typeof accountTypes)[number]

export const riskLevels = ['safe', 'watch', 'warning', 'critical'] as const
export type RiskLevel = (typeof riskLevels)[number]

export const scenarios = ['conservative', 'base', 'optimistic'] as const
export type Scenario = (typeof scenarios)[number]

export const decisionVerdicts = ['allow', 'wait', 'reject'] as const
export type DecisionVerdict = (typeof decisionVerdicts)[number]

export const recommendationSeverities = ['info', 'warning', 'critical'] as const
export type RecommendationSeverity = (typeof recommendationSeverities)[number]

export interface User {
  id: string
  email: string
  displayName: string
  passwordHash?: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  userId: string
  name: string
  group:
    | 'income'
    | 'housing'
    | 'subscription'
    | 'transport'
    | 'shopping'
    | 'investment'
    | 'debt'
    | 'travel'
    | 'other'
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  userId: string
  name: string
  type: AccountType
  currency: CurrencyCode
  balanceMinor: number
  creditLimitMinor?: number
  billingDay?: number
  dueDay?: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  accountId: string
  date: string
  amountMinor: number
  direction: 'income' | 'expense' | 'transfer_in' | 'transfer_out'
  categoryId: string
  note?: string
  merchant?: string
  relatedBillId?: string
  relatedInstallmentPaymentId?: string
  isRecurring: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurringRule {
  id: string
  userId: string
  name: string
  amountMinor: number
  direction: 'income' | 'expense'
  accountId?: string
  paymentAccountId?: string
  categoryId: string
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  dayOfMonth?: number
  uncertainty: 'fixed' | 'variable_date' | 'variable_amount'
  includeInBaseScenario: boolean
  startDate: string
  endDate?: string
  isActive: boolean
}

export interface Bill {
  id: string
  userId: string
  accountId?: string
  name: string
  billType: 'credit_card' | 'rent' | 'loan' | 'utility' | 'subscription' | 'other'
  statementMonth?: string
  totalAmountMinor: number
  paidAmountMinor: number
  dueDate: string
  status: 'unpaid' | 'partial' | 'paid' | 'installment'
  canInstallment: boolean
  nonInstallmentAmountMinor?: number
  installmentEligibleAmountMinor?: number
  createdAt: string
  updatedAt: string
}

export interface InstallmentQuotePayment {
  period: number
  principalMinor: number
  interestMinor: number
  totalMinor: number
  dueDate?: string
}

export interface InstallmentQuoteInput {
  billId: string
  eligibleAmountMinor: number
  nonInstallmentAmountMinor: number
  aprBps: number
  periods: number
  firstPaymentMinor?: number
  totalInterestMinor?: number
  payments?: InstallmentQuotePayment[]
}

export interface InstallmentPayment {
  id: string
  planId: string
  userId: string
  period: number
  principalMinor: number
  interestMinor: number
  totalMinor: number
  dueDate: string
  status: 'scheduled' | 'paid' | 'cancelled'
  paidAt?: string
}

export interface InstallmentPlan {
  id: string
  userId: string
  billId: string
  name: string
  periods: number
  aprBps: number
  createdAt: string
  updatedAt: string
  status: 'active' | 'completed' | 'cancelled'
  totalPrincipalMinor: number
  totalInterestMinor: number
  totalPaymentMinor: number
  payments: InstallmentPayment[]
}

export interface CashflowEvent {
  id: string
  userId: string
  date: string
  name: string
  type: 'income' | 'expense' | 'bill' | 'installment' | 'saving' | 'buffer'
  amountMinor: number
  certainty: 'confirmed' | 'estimated' | 'optional'
  sourceId?: string
  balanceAfterMinor?: number
}

export interface CashflowProjection {
  scenario: Scenario
  startDate: string
  endDate: string
  openingBalanceMinor: number
  closingBalanceMinor: number
  minimumBalanceMinor: number
  minimumBalanceDate: string
  safeToSpendMinor: number
  dailySafeSpendMinor: number
  riskLevel: RiskLevel
  events: CashflowEvent[]
}

export type CashflowScenarioSet = Record<Scenario, CashflowProjection>

export interface CashflowImpact {
  period: number
  dueDate: string
  amountMinor: number
}

export interface InstallmentSimulationResult {
  quoteId: string
  billId: string
  periods: number
  monthlyCashflowImpact: CashflowImpact[]
  totalPrincipalMinor: number
  totalInterestMinor: number
  totalPaymentMinor: number
  firstMonthCashSavedMinor: number
  debtClearMonth: string
  recommendation: 'recommended' | 'acceptable' | 'not_recommended'
  reasonCodes: string[]
  riskLevelAfterInstallment: RiskLevel
  score: number
}

export interface Goal {
  id: string
  userId: string
  name: string
  targetAmountMinor: number
  currentAmountMinor: number
  deadline?: string
  priority: 'high' | 'medium' | 'low'
  goalType: 'emergency_fund' | 'travel' | 'purchase' | 'debt_payoff' | 'investment'
  monthlyContributionMinor?: number
  status: 'active' | 'paused' | 'completed' | 'cancelled'
}

export interface PurchaseDecisionInput {
  name: string
  priceMinor: number
  category: 'instrument' | 'travel' | 'electronics' | 'subscription' | 'other'
  purchaseDate?: string
  alternative?: {
    name: string
    unitCostMinor: number
    unit: 'hour' | 'day' | 'month'
  }
  expectedUsage?: {
    unitPerWeek?: number
    durationMonths?: number
  }
}

export interface PurchaseDecisionResult {
  verdict: DecisionVerdict
  earliestRecommendedDate?: string
  requiredSavingsBeforePurchaseMinor: number
  remainingCashAfterPurchaseMinor: number
  paybackAnalysis?: {
    breakEvenUsageCount: number
    breakEvenMonths: number
  }
  reasons: string[]
  unlockConditions: string[]
}

export interface TravelDecisionInput {
  name: string
  estimatedTripCostMinor: number
}

export interface TravelDecisionResult {
  verdict: DecisionVerdict
  earliestRecommendedDate?: string
  requiredTravelFundMinor: number
  reasons: string[]
  unlockConditions: string[]
}

export interface Recommendation {
  id: string
  code: string
  userId: string
  severity: RecommendationSeverity
  title: string
  message: string
  actionLabel?: string
  actionType?:
    | 'pay_bill'
    | 'create_installment'
    | 'pause_subscription'
    | 'save_money'
    | 'avoid_purchase'
  relatedEntityId?: string
  createdAt: string
  dismissedAt?: string
  metadata?: Record<string, number | string | boolean | null>
}

export interface NotificationItem {
  id: string
  severity: RecommendationSeverity
  title: string
  message: string
  dueDate?: string
  relatedEntityId?: string
}

export interface DashboardSummary {
  netWorthMinor: number
  liquidAssetsMinor: number
  investmentAssetsMinor: number
  liabilitiesMinor: number
  future14DaysBillsMinor: number
  monthLivingBudgetMinor: number
  dailySafeSpendMinor: number
  suggestedSavingsMinor: number
  suggestedInvestmentMinor: number
  riskLevel: RiskLevel
  dueSoon: Bill[]
  notifications: NotificationItem[]
  recommendations: Recommendation[]
}

export interface DecisionHistoryItem {
  id: string
  userId: string
  type: 'purchase' | 'travel'
  name: string
  verdict: DecisionVerdict
  createdAt: string
  payload: PurchaseDecisionInput | TravelDecisionInput
}

export interface AppSnapshot {
  users: User[]
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  bills: Bill[]
  recurringRules: RecurringRule[]
  installmentPlans: InstallmentPlan[]
  goals: Goal[]
  recommendations: Recommendation[]
  decisionHistory: DecisionHistoryItem[]
}

export interface ProjectionOptions {
  rangeDays: number
  scenario: Scenario
  referenceDate?: string
  minimumCashBufferMinor?: number
  plannedSavingsMinor?: number
}
