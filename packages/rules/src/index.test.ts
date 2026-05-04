import type { AppSnapshot, Recommendation } from '@cashpilot/shared'
import { describe, expect, it } from 'vitest'

type RulesModule = typeof import('./index')

async function loadRules(): Promise<RulesModule> {
  return import('./index')
}

type Fixture = AppSnapshot & { referenceDate: string }

function createFixture(): Fixture {
  return {
    referenceDate: '2026-05-04',
    accounts: [
      {
        id: 'acc-bank',
        userId: 'usr-demo',
        name: '台新帳戶',
        type: 'bank',
        currency: 'TWD',
        balanceMinor: 2250000,
        isActive: true,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'acc-invest',
        userId: 'usr-demo',
        name: '富果投資',
        type: 'investment',
        currency: 'TWD',
        balanceMinor: 437200,
        isActive: true,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    ],
    bills: [
      {
        id: 'bill-yushan',
        userId: 'usr-demo',
        accountId: 'acc-yushan',
        name: '玉山信用卡',
        billType: 'credit_card',
        totalAmountMinor: 1433700,
        paidAmountMinor: 0,
        dueDate: '2026-05-10',
        status: 'unpaid',
        canInstallment: true,
        nonInstallmentAmountMinor: 298700,
        installmentEligibleAmountMinor: 1135000,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'bill-rent',
        userId: 'usr-demo',
        name: '房租',
        billType: 'rent',
        totalAmountMinor: 1500000,
        paidAmountMinor: 0,
        dueDate: '2026-05-05',
        status: 'unpaid',
        canInstallment: false,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    ],
    recurringRules: [
      {
        id: 'rule-salary',
        userId: 'usr-demo',
        name: '薪水',
        amountMinor: 5107000,
        direction: 'income',
        categoryId: 'cat-salary',
        frequency: 'monthly',
        dayOfMonth: 25,
        uncertainty: 'fixed',
        includeInBaseScenario: true,
        startDate: '2026-01-01',
        isActive: true,
      },
      {
        id: 'rule-rent-subsidy',
        userId: 'usr-demo',
        name: '租屋補貼',
        amountMinor: 360000,
        direction: 'income',
        categoryId: 'cat-subsidy',
        frequency: 'monthly',
        dayOfMonth: 20,
        uncertainty: 'variable_date',
        includeInBaseScenario: false,
        startDate: '2026-01-01',
        isActive: true,
      },
      {
        id: 'rule-rent',
        userId: 'usr-demo',
        name: '房租',
        amountMinor: 1500000,
        direction: 'expense',
        categoryId: 'cat-rent',
        frequency: 'monthly',
        dayOfMonth: 5,
        uncertainty: 'fixed',
        includeInBaseScenario: true,
        startDate: '2026-01-01',
        isActive: true,
      },
    ],
    installmentPlans: [],
    goals: [
      {
        id: 'goal-emergency-100k',
        userId: 'usr-demo',
        name: '緊急預備金 100,000',
        targetAmountMinor: 10000000,
        currentAmountMinor: 1881800,
        priority: 'high',
        goalType: 'emergency_fund',
        monthlyContributionMinor: 0,
        status: 'active',
      },
      {
        id: 'goal-piano',
        userId: 'usr-demo',
        name: 'Roland FP-30X 基金',
        targetAmountMinor: 2500000,
        currentAmountMinor: 0,
        priority: 'medium',
        goalType: 'purchase',
        monthlyContributionMinor: 0,
        status: 'active',
      },
      {
        id: 'goal-travel',
        userId: 'usr-demo',
        name: '北歐獨旅基金',
        targetAmountMinor: 12000000,
        currentAmountMinor: 2400000,
        priority: 'medium',
        goalType: 'travel',
        monthlyContributionMinor: 0,
        status: 'active',
      },
    ],
    recommendations: [],
    decisionHistory: [],
    transactions: [],
    categories: [],
    users: [],
  }
}

describe('cashpilot rules engine', () => {
  it('marks projection as critical when upcoming bills make cashflow negative', async () => {
    const rules = await loadRules()
    const data = createFixture()

    const projection = rules.projectCashflow(data, {
      rangeDays: 30,
      scenario: 'conservative',
      referenceDate: data.referenceDate,
    })

    expect(projection.riskLevel).toBe('critical')
    expect(projection.minimumBalanceMinor).toBeLessThanOrEqual(0)
  })

  it('recommends installment when full payment would break this month cashflow', async () => {
    const rules = await loadRules()
    const data = createFixture()

    const projection = rules.projectCashflow(data, {
      rangeDays: 30,
      scenario: 'conservative',
      referenceDate: data.referenceDate,
    })

    const result = rules.simulateInstallment(
      data,
      {
        billId: 'bill-yushan',
        eligibleAmountMinor: 1135000,
        nonInstallmentAmountMinor: 298700,
        aprBps: 1100,
        periods: 3,
      },
      projection,
    )

    expect(result.recommendation).toBe('recommended')
    expect(result.firstMonthCashSavedMinor).toBeGreaterThan(0)
  })

  it('does not prefer the longest installment when cash improvement is marginal', async () => {
    const rules = await loadRules()
    const data = createFixture()
    const projection = rules.projectCashflow(data, {
      rangeDays: 60,
      scenario: 'conservative',
      referenceDate: data.referenceDate,
    })

    const shorter = rules.simulateInstallment(
      data,
      {
        billId: 'bill-yushan',
        eligibleAmountMinor: 1135000,
        nonInstallmentAmountMinor: 298700,
        aprBps: 1100,
        periods: 12,
      },
      projection,
    )

    const longer = rules.simulateInstallment(
      data,
      {
        billId: 'bill-yushan',
        eligibleAmountMinor: 1135000,
        nonInstallmentAmountMinor: 298700,
        aprBps: 1100,
        periods: 18,
      },
      projection,
    )

    const ranked = rules.rankInstallmentOptions([shorter, longer])

    expect(ranked[0]?.debtClearMonth).not.toBe(longer.debtClearMonth)
  })

  it('materializes installment payments with the persisted plan id', async () => {
    const rules = await loadRules()
    const data = createFixture()

    const plan = rules.materializeInstallmentPlan(data, {
      billId: 'bill-yushan',
      eligibleAmountMinor: 1135000,
      nonInstallmentAmountMinor: 298700,
      aprBps: 1100,
      periods: 3,
    })

    expect(plan.payments.length).toBeGreaterThan(0)
    expect(plan.payments.every((payment) => payment.planId === plan.id)).toBe(true)
  })

  it('forces monthly savings suggestion to zero during high risk periods', async () => {
    const rules = await loadRules()
    const data = createFixture()
    const projection = rules.projectCashflow(data, {
      rangeDays: 30,
      scenario: 'conservative',
      referenceDate: data.referenceDate,
    })

    const recommendations = rules.buildRecommendations(data, projection)
    const goalRecommendation = recommendations.find(
      (item: Recommendation) => item.code === 'RULE-GOAL-001',
    )

    expect(goalRecommendation).toBeDefined()
    expect(goalRecommendation?.metadata?.suggestedSavingsMinor).toBe(0)
  })

  it('rejects FP-30X purchase when post-purchase liquid cash falls below 30,000', async () => {
    const rules = await loadRules()
    const data = createFixture()
    const projection = rules.projectCashflow(data, {
      rangeDays: 60,
      scenario: 'base',
      referenceDate: data.referenceDate,
    })

    const decision = rules.evaluatePurchaseDecision(
      data,
      {
        name: 'Roland FP-30X',
        priceMinor: 2500000,
        category: 'instrument',
        alternative: {
          name: '租琴房',
          unitCostMinor: 16000,
          unit: 'hour',
        },
        expectedUsage: {
          unitPerWeek: 2,
          durationMonths: 12,
        },
      },
      projection,
    )

    expect(decision.verdict).toBe('reject')
    expect(decision.remainingCashAfterPurchaseMinor).toBeLessThan(3000000)
  })

  it('keeps nordic travel in wait state before emergency fund reaches 100,000', async () => {
    const rules = await loadRules()
    const data = createFixture()
    const projection = rules.projectCashflow(data, {
      rangeDays: 180,
      scenario: 'base',
      referenceDate: data.referenceDate,
    })

    const result = rules.evaluateTravelDecision(
      data,
      {
        name: '北歐獨旅',
        estimatedTripCostMinor: 12000000,
      },
      projection,
    )

    expect(result.verdict).toBe('wait')
    expect(result.reasons.some((reason: string) => reason.includes('100,000'))).toBe(true)
  })
})
