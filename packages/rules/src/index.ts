import {
  APP_TODAY,
  type AppSnapshot,
  addDays,
  type Bill,
  type CashflowEvent,
  type CashflowProjection,
  clampMinimumCashBuffer,
  type DashboardSummary,
  findGoal,
  type Goal,
  getMonthEnd,
  getRemainingBillAmount,
  getRemainingDaysInMonth,
  type InstallmentPayment,
  type InstallmentPlan,
  type InstallmentQuoteInput,
  type InstallmentQuotePayment,
  type InstallmentSimulationResult,
  isDateBetween,
  type NotificationItem,
  type ProjectionOptions,
  type PurchaseDecisionInput,
  type PurchaseDecisionResult,
  type Recommendation,
  type RecommendationSeverity,
  type Scenario,
  sumGoalFunds,
  sumInvestmentAccounts,
  sumLiquidAccounts,
  sumMinorUnits,
  type TravelDecisionInput,
  type TravelDecisionResult,
} from '@cashpilot/shared'
import dayjs from 'dayjs'

const RECOMMENDATION_ORDER: Record<InstallmentSimulationResult['recommendation'], number> = {
  recommended: 0,
  acceptable: 1,
  not_recommended: 2,
}

function resolveReferenceDate(referenceDate?: string) {
  return referenceDate ?? APP_TODAY
}

function resolveUserId(snapshot: AppSnapshot) {
  return snapshot.users[0]?.id ?? 'usr-demo'
}

function getTypicalMonthlyIncome(snapshot: AppSnapshot) {
  return sumMinorUnits(
    snapshot.recurringRules
      .filter(
        (rule) => rule.isActive && rule.direction === 'income' && rule.frequency === 'monthly',
      )
      .map((rule) => rule.amountMinor),
  )
}

function getScenarioAmount(
  amountMinor: number,
  scenario: Scenario,
  direction: 'income' | 'expense',
  uncertainty: 'fixed' | 'variable_date' | 'variable_amount',
) {
  if (uncertainty !== 'variable_amount') {
    return amountMinor
  }

  if (direction === 'expense') {
    if (scenario === 'optimistic') {
      return Math.round(amountMinor * 0.95)
    }

    if (scenario === 'conservative') {
      return Math.round(amountMinor * 1.1)
    }
  }

  if (scenario === 'conservative') {
    return Math.round(amountMinor * 0.9)
  }

  if (scenario === 'optimistic') {
    return Math.round(amountMinor * 1.05)
  }

  return amountMinor
}

function shouldIncludeRecurringIncome(
  includeInBaseScenario: boolean,
  scenario: Scenario,
  uncertainty: 'fixed' | 'variable_date' | 'variable_amount',
) {
  if (uncertainty === 'fixed') {
    return true
  }

  if (scenario === 'optimistic') {
    return true
  }

  if (scenario === 'base') {
    return includeInBaseScenario
  }

  return false
}

function hasMatchingBillForRule(
  snapshot: AppSnapshot,
  ruleIdOrName: { name: string; paymentAccountId?: string },
  occurrenceDate: string,
) {
  return snapshot.bills.some((bill) => {
    if (bill.status === 'paid') {
      return false
    }

    const sameMonth =
      dayjs(bill.dueDate).format('YYYY-MM') === dayjs(occurrenceDate).format('YYYY-MM')
    if (!sameMonth) {
      return false
    }

    const sameAccount = Boolean(
      ruleIdOrName.paymentAccountId && bill.accountId === ruleIdOrName.paymentAccountId,
    )
    const nameMatches =
      bill.name.includes(ruleIdOrName.name) ||
      ruleIdOrName.name.includes(bill.name.replace(/\d+/g, '').trim())

    return sameAccount || nameMatches
  })
}

function createRecurringEvents(snapshot: AppSnapshot, options: ProjectionOptions): CashflowEvent[] {
  const referenceDate = resolveReferenceDate(options.referenceDate)
  const endDate = addDays(referenceDate, options.rangeDays)
  const userId = resolveUserId(snapshot)
  const events: CashflowEvent[] = []

  for (const rule of snapshot.recurringRules) {
    if (!rule.isActive) {
      continue
    }

    if (
      rule.direction === 'income' &&
      !shouldIncludeRecurringIncome(rule.includeInBaseScenario, options.scenario, rule.uncertainty)
    ) {
      continue
    }

    if (rule.frequency === 'monthly') {
      let cursor = dayjs(referenceDate).startOf('month')
      const endCursor = dayjs(endDate).endOf('month')

      while (cursor.isBefore(endCursor) || cursor.isSame(endCursor, 'month')) {
        const dayOfMonth = Math.min(
          rule.dayOfMonth ?? dayjs(rule.startDate).date(),
          cursor.daysInMonth(),
        )
        let occurrence = cursor.date(dayOfMonth)

        if (rule.uncertainty === 'variable_date') {
          if (options.scenario === 'optimistic') {
            occurrence = occurrence.subtract(5, 'day')
          } else if (options.scenario === 'base') {
            occurrence = occurrence.add(2, 'day')
          }
        }

        const occurrenceDate = occurrence.format('YYYY-MM-DD')
        const isInRange = isDateBetween(occurrenceDate, referenceDate, endDate)
        const isAfterStart = dayjs(occurrenceDate).isAfter(dayjs(rule.startDate).subtract(1, 'day'))
        const isBeforeEnd =
          !rule.endDate || dayjs(occurrenceDate).isBefore(dayjs(rule.endDate).add(1, 'day'))

        if (
          rule.direction === 'expense' &&
          hasMatchingBillForRule(
            snapshot,
            { name: rule.name, paymentAccountId: rule.paymentAccountId },
            occurrenceDate,
          )
        ) {
          cursor = cursor.add(1, 'month')
          continue
        }

        if (isInRange && isAfterStart && isBeforeEnd) {
          events.push({
            id: `evt-${rule.id}-${occurrenceDate}`,
            userId,
            date: occurrenceDate,
            name: rule.name,
            type: rule.direction === 'income' ? 'income' : 'expense',
            amountMinor: getScenarioAmount(
              rule.amountMinor,
              options.scenario,
              rule.direction,
              rule.uncertainty,
            ),
            certainty: rule.uncertainty === 'fixed' ? 'confirmed' : 'estimated',
            sourceId: rule.id,
          })
        }

        cursor = cursor.add(1, 'month')
      }

      continue
    }

    if (rule.frequency === 'weekly') {
      let cursor = dayjs(rule.startDate)
      const endCursor = dayjs(endDate)

      while (cursor.isBefore(endCursor) || cursor.isSame(endCursor, 'day')) {
        const occurrenceDate = cursor.format('YYYY-MM-DD')

        if (isDateBetween(occurrenceDate, referenceDate, endDate)) {
          events.push({
            id: `evt-${rule.id}-${occurrenceDate}`,
            userId,
            date: occurrenceDate,
            name: rule.name,
            type: rule.direction === 'income' ? 'income' : 'expense',
            amountMinor: getScenarioAmount(
              rule.amountMinor,
              options.scenario,
              rule.direction,
              rule.uncertainty,
            ),
            certainty: rule.uncertainty === 'fixed' ? 'confirmed' : 'estimated',
            sourceId: rule.id,
          })
        }

        cursor = cursor.add(1, 'week')
      }

      continue
    }

    const occurrenceDate = dayjs(rule.startDate).format('YYYY-MM-DD')
    if (isDateBetween(occurrenceDate, referenceDate, endDate)) {
      events.push({
        id: `evt-${rule.id}-${occurrenceDate}`,
        userId,
        date: occurrenceDate,
        name: rule.name,
        type: rule.direction === 'income' ? 'income' : 'expense',
        amountMinor: getScenarioAmount(
          rule.amountMinor,
          options.scenario,
          rule.direction,
          rule.uncertainty,
        ),
        certainty: rule.uncertainty === 'fixed' ? 'confirmed' : 'estimated',
        sourceId: rule.id,
      })
    }
  }

  return events
}

function createBillEvents(snapshot: AppSnapshot, options: ProjectionOptions): CashflowEvent[] {
  const referenceDate = resolveReferenceDate(options.referenceDate)
  const endDate = addDays(referenceDate, options.rangeDays)
  const userId = resolveUserId(snapshot)

  return snapshot.bills
    .filter((bill) => bill.status !== 'paid')
    .filter((bill) => isDateBetween(bill.dueDate, referenceDate, endDate))
    .map((bill) => ({
      id: `evt-bill-${bill.id}`,
      userId,
      date: bill.dueDate,
      name: bill.name,
      type: 'bill' as const,
      amountMinor: getRemainingBillAmount(bill),
      certainty: 'confirmed' as const,
      sourceId: bill.id,
    }))
}

function createInstallmentEvents(
  snapshot: AppSnapshot,
  options: ProjectionOptions,
): CashflowEvent[] {
  const referenceDate = resolveReferenceDate(options.referenceDate)
  const endDate = addDays(referenceDate, options.rangeDays)
  const userId = resolveUserId(snapshot)

  return snapshot.installmentPlans
    .filter((plan) => plan.status === 'active')
    .flatMap((plan) =>
      plan.payments
        .filter((payment) => payment.status === 'scheduled')
        .filter((payment) => isDateBetween(payment.dueDate, referenceDate, endDate))
        .map((payment) => ({
          id: `evt-installment-${payment.id}`,
          userId,
          date: payment.dueDate,
          name: `${plan.name} 第 ${payment.period} 期`,
          type: 'installment' as const,
          amountMinor: payment.totalMinor,
          certainty: 'confirmed' as const,
          sourceId: payment.id,
        })),
    )
}

function createGoalContributionEvents(
  snapshot: AppSnapshot,
  options: ProjectionOptions,
): CashflowEvent[] {
  const referenceDate = resolveReferenceDate(options.referenceDate)
  const endDate = addDays(referenceDate, options.rangeDays)
  const userId = resolveUserId(snapshot)
  const events: CashflowEvent[] = []

  for (const goal of snapshot.goals) {
    if (goal.status !== 'active' || !goal.monthlyContributionMinor) {
      continue
    }

    let cursor = dayjs(referenceDate).startOf('month')
    const endCursor = dayjs(endDate).endOf('month')

    while (cursor.isBefore(endCursor) || cursor.isSame(endCursor, 'month')) {
      const occurrenceDate = cursor.date(Math.min(28, cursor.daysInMonth())).format('YYYY-MM-DD')
      if (isDateBetween(occurrenceDate, referenceDate, endDate)) {
        events.push({
          id: `evt-goal-${goal.id}-${occurrenceDate}`,
          userId,
          date: occurrenceDate,
          name: `${goal.name} 存款`,
          type: 'saving',
          amountMinor: goal.monthlyContributionMinor,
          certainty: 'optional',
          sourceId: goal.id,
        })
      }
      cursor = cursor.add(1, 'month')
    }
  }

  return events
}

function eventPriority(event: CashflowEvent) {
  switch (event.type) {
    case 'income':
      return 0
    case 'saving':
      return 4
    default:
      return 2
  }
}

function sortEvents(events: CashflowEvent[]) {
  return [...events].sort((left, right) => {
    const dateDiff = dayjs(left.date).unix() - dayjs(right.date).unix()
    if (dateDiff !== 0) {
      return dateDiff
    }
    return eventPriority(left) - eventPriority(right)
  })
}

function calculateRiskLevel(minimumBalanceMinor: number) {
  if (minimumBalanceMinor >= 3000000) {
    return 'safe'
  }

  if (minimumBalanceMinor >= 1000000) {
    return 'watch'
  }

  if (minimumBalanceMinor > 0) {
    return 'warning'
  }

  return 'critical'
}

function calculateMonthLivingBudget(
  projection: CashflowProjection,
  snapshot: AppSnapshot,
  options: ProjectionOptions,
) {
  const referenceDate = resolveReferenceDate(options.referenceDate)
  const monthEnd = getMonthEnd(referenceDate)
  const minimumCashBufferMinor = clampMinimumCashBuffer(options.minimumCashBufferMinor)
  const monthEvents = projection.events.filter((event) =>
    isDateBetween(event.date, referenceDate, monthEnd),
  )

  const confirmedIncome = sumMinorUnits(
    monthEvents
      .filter((event) => event.type === 'income' && event.certainty !== 'optional')
      .map((event) => event.amountMinor),
  )
  const fixedExpenses = sumMinorUnits(
    monthEvents.filter((event) => event.type === 'expense').map((event) => event.amountMinor),
  )
  const confirmedBills = sumMinorUnits(
    monthEvents.filter((event) => event.type === 'bill').map((event) => event.amountMinor),
  )
  const installmentPayments = sumMinorUnits(
    monthEvents.filter((event) => event.type === 'installment').map((event) => event.amountMinor),
  )
  const plannedSavings =
    options.plannedSavingsMinor ??
    sumMinorUnits(
      snapshot.goals
        .filter((goal) => goal.status === 'active')
        .map((goal) => goal.monthlyContributionMinor ?? 0),
    )

  return (
    projection.openingBalanceMinor +
    confirmedIncome -
    fixedExpenses -
    confirmedBills -
    installmentPayments -
    plannedSavings -
    minimumCashBufferMinor
  )
}

function createInstallmentPlan(
  snapshot: AppSnapshot,
  input: InstallmentQuoteInput,
  referenceDate: string,
) {
  const bill = snapshot.bills.find((entry) => entry.id === input.billId)
  if (!bill) {
    throw new Error(`Bill ${input.billId} not found`)
  }

  const quoteId = `quote-${input.billId}-${input.periods}`
  const payments = createInstallmentPayments(input, bill.dueDate, resolveUserId(snapshot), quoteId)
  const totalInterestMinor = sumMinorUnits(payments.map((payment) => payment.interestMinor))
  const totalPrincipalMinor = sumMinorUnits(payments.map((payment) => payment.principalMinor))
  const totalPaymentMinor = sumMinorUnits(payments.map((payment) => payment.totalMinor))

  const plan: InstallmentPlan = {
    id: `ipl-${input.billId}-${referenceDate}-${input.periods}`,
    userId: bill.userId,
    billId: bill.id,
    name: `${bill.name} 分期`,
    periods: input.periods,
    aprBps: input.aprBps,
    createdAt: `${referenceDate}T00:00:00.000Z`,
    updatedAt: `${referenceDate}T00:00:00.000Z`,
    status: 'active',
    totalPrincipalMinor,
    totalInterestMinor,
    totalPaymentMinor,
    payments,
  }

  return {
    plan,
    quoteId,
  }
}

function createInstallmentPayments(
  input: InstallmentQuoteInput,
  firstDueDate: string,
  userId: string,
  quoteId: string,
): InstallmentPayment[] {
  const providedPayments = input.payments
  if (providedPayments?.length) {
    return providedPayments.map((payment) => ({
      id: `${quoteId}-${payment.period}`,
      planId: quoteId,
      userId,
      period: payment.period,
      principalMinor: payment.principalMinor,
      interestMinor: payment.interestMinor,
      totalMinor: payment.totalMinor,
      dueDate:
        payment.dueDate ??
        dayjs(firstDueDate)
          .add(payment.period - 1, 'month')
          .format('YYYY-MM-DD'),
      status: 'scheduled',
    }))
  }

  const payments: InstallmentQuotePayment[] = []
  const basePrincipal = Math.floor(input.eligibleAmountMinor / input.periods)
  let principalRemainder = input.eligibleAmountMinor - basePrincipal * input.periods
  let remainingPrincipal = input.eligibleAmountMinor
  let remainingInterest = input.totalInterestMinor ?? 0
  const monthlyRate = input.aprBps / 10000 / 12

  for (let period = 1; period <= input.periods; period += 1) {
    const principalMinor = basePrincipal + (principalRemainder > 0 ? 1 : 0)
    principalRemainder = Math.max(0, principalRemainder - 1)
    let interestMinor = input.totalInterestMinor
      ? Math.floor(remainingInterest / (input.periods - period + 1))
      : Math.round(remainingPrincipal * monthlyRate)

    if (period === 1 && input.firstPaymentMinor) {
      interestMinor = Math.max(0, input.firstPaymentMinor - principalMinor)
    }

    remainingInterest = Math.max(0, remainingInterest - interestMinor)
    payments.push({
      period,
      principalMinor,
      interestMinor,
      totalMinor: principalMinor + interestMinor,
      dueDate: dayjs(firstDueDate)
        .add(period - 1, 'month')
        .format('YYYY-MM-DD'),
    })
    remainingPrincipal -= principalMinor
  }

  return payments.map((payment) => ({
    id: `${quoteId}-${payment.period}`,
    planId: quoteId,
    userId,
    period: payment.period,
    principalMinor: payment.principalMinor,
    interestMinor: payment.interestMinor,
    totalMinor: payment.totalMinor,
    dueDate: payment.dueDate ?? firstDueDate,
    status: 'scheduled',
  }))
}

function cloneSnapshotWithInstallment(
  snapshot: AppSnapshot,
  input: InstallmentQuoteInput,
  referenceDate: string,
) {
  const cloned = structuredClone(snapshot)
  const targetBill = cloned.bills.find((bill) => bill.id === input.billId)
  if (!targetBill) {
    throw new Error(`Bill ${input.billId} not found`)
  }

  targetBill.status = 'installment'
  targetBill.totalAmountMinor = input.nonInstallmentAmountMinor
  targetBill.installmentEligibleAmountMinor = 0
  targetBill.nonInstallmentAmountMinor = input.nonInstallmentAmountMinor
  targetBill.canInstallment = false

  const { plan, quoteId } = createInstallmentPlan(cloned, input, referenceDate)
  cloned.installmentPlans.push(plan)

  return {
    snapshot: cloned,
    quoteId,
    plan,
  }
}

export function calculateNetWorth(snapshot: AppSnapshot) {
  const assetsMinor =
    sumLiquidAccounts(snapshot.accounts) +
    sumInvestmentAccounts(snapshot.accounts) +
    sumGoalFunds(snapshot.accounts)

  const loanLiabilitiesMinor = sumMinorUnits(
    snapshot.accounts
      .filter((account) => account.isActive && account.type === 'loan')
      .map((account) => Math.abs(account.balanceMinor)),
  )

  const unpaidBillsMinor = sumMinorUnits(
    snapshot.bills
      .filter((bill) => bill.status !== 'paid')
      .map((bill) => getRemainingBillAmount(bill)),
  )

  const installmentLiabilitiesMinor = sumMinorUnits(
    snapshot.installmentPlans
      .filter((plan) => plan.status === 'active')
      .flatMap((plan) => plan.payments)
      .filter((payment) => payment.status === 'scheduled')
      .map((payment) => payment.totalMinor),
  )

  const liabilitiesMinor = loanLiabilitiesMinor + unpaidBillsMinor + installmentLiabilitiesMinor

  return {
    assetsMinor,
    liabilitiesMinor,
    netWorthMinor: assetsMinor - liabilitiesMinor,
  }
}

export function projectCashflow(
  snapshot: AppSnapshot,
  options: ProjectionOptions,
): CashflowProjection {
  const referenceDate = resolveReferenceDate(options.referenceDate)
  const openingBalanceMinor = sumLiquidAccounts(snapshot.accounts)
  const orderedEvents = sortEvents([
    ...createRecurringEvents(snapshot, options),
    ...createBillEvents(snapshot, options),
    ...createInstallmentEvents(snapshot, options),
    ...createGoalContributionEvents(snapshot, options),
  ])

  let runningBalance = openingBalanceMinor
  let minimumBalanceMinor = openingBalanceMinor
  let minimumBalanceDate = referenceDate

  const events = orderedEvents.map((event) => {
    runningBalance += event.type === 'income' ? event.amountMinor : -event.amountMinor

    if (runningBalance <= minimumBalanceMinor) {
      minimumBalanceMinor = runningBalance
      minimumBalanceDate = event.date
    }

    return {
      ...event,
      balanceAfterMinor: runningBalance,
    }
  })

  const closingBalanceMinor = runningBalance
  const riskLevel = calculateRiskLevel(minimumBalanceMinor)
  const monthLivingBudgetMinor = calculateMonthLivingBudget(
    {
      scenario: options.scenario,
      startDate: referenceDate,
      endDate: addDays(referenceDate, options.rangeDays),
      openingBalanceMinor,
      closingBalanceMinor,
      minimumBalanceMinor,
      minimumBalanceDate,
      safeToSpendMinor: 0,
      dailySafeSpendMinor: 0,
      riskLevel,
      events,
    },
    snapshot,
    options,
  )
  const safeToSpendMinor = Math.max(0, monthLivingBudgetMinor)
  const dailySafeSpendMinor = Math.floor(safeToSpendMinor / getRemainingDaysInMonth(referenceDate))

  return {
    scenario: options.scenario,
    startDate: referenceDate,
    endDate: addDays(referenceDate, options.rangeDays),
    openingBalanceMinor,
    closingBalanceMinor,
    minimumBalanceMinor,
    minimumBalanceDate,
    safeToSpendMinor,
    dailySafeSpendMinor,
    riskLevel,
    events,
  }
}

export function simulateInstallment(
  snapshot: AppSnapshot,
  input: InstallmentQuoteInput,
  baselineProjection?: CashflowProjection,
) {
  const referenceDate = baselineProjection?.startDate ?? resolveReferenceDate()
  const baseline =
    baselineProjection ??
    projectCashflow(snapshot, { rangeDays: 90, scenario: 'base', referenceDate })
  const {
    snapshot: installmentSnapshot,
    quoteId,
    plan,
  } = cloneSnapshotWithInstallment(snapshot, input, referenceDate)
  const projectionAfter = projectCashflow(installmentSnapshot, {
    rangeDays: Math.max(
      90,
      baseline.events.length ? dayjs(baseline.endDate).diff(dayjs(referenceDate), 'day') : 90,
    ),
    scenario: baseline.scenario,
    referenceDate,
    minimumCashBufferMinor: 3000000,
  })
  const firstPayment = plan.payments[0]
  const firstMonthCashSavedMinor = Math.max(
    0,
    input.eligibleAmountMinor - (firstPayment?.totalMinor ?? 0),
  )
  const monthlyIncomeMinor = getTypicalMonthlyIncome(snapshot)
  const debtClearMonth = dayjs(plan.payments.at(-1)?.dueDate ?? referenceDate).format('YYYY-MM')
  const reasonCodes: string[] = []

  let recommendation: InstallmentSimulationResult['recommendation'] = 'acceptable'
  if (
    (baseline.minimumBalanceMinor <= 0 && projectionAfter.minimumBalanceMinor > 0) ||
    (baseline.safeToSpendMinor <= 0 && projectionAfter.safeToSpendMinor > 0)
  ) {
    recommendation = 'recommended'
    reasonCodes.push('avoid_monthly_cash_break')
  }

  if (input.periods > 12 && firstMonthCashSavedMinor < 150000) {
    recommendation = 'not_recommended'
    reasonCodes.push('too_long_for_small_relief')
  }

  if (monthlyIncomeMinor > 0 && (firstPayment?.totalMinor ?? 0) > monthlyIncomeMinor * 0.2) {
    reasonCodes.push('monthly_pressure_over_20_percent')
    if (recommendation === 'recommended') {
      recommendation = 'acceptable'
    }
  }

  if (projectionAfter.minimumBalanceMinor <= 0) {
    recommendation = 'not_recommended'
    reasonCodes.push('still_below_minimum_cash_buffer')
  }

  const scoreBase =
    recommendation === 'recommended' ? 100 : recommendation === 'acceptable' ? 70 : 30
  const score =
    scoreBase -
    Math.round(plan.totalInterestMinor / 5000) -
    Math.max(0, input.periods - 12) * 3 +
    Math.round(firstMonthCashSavedMinor / 100000)

  return {
    quoteId,
    billId: input.billId,
    periods: input.periods,
    monthlyCashflowImpact: plan.payments.map((payment) => ({
      period: payment.period,
      dueDate: payment.dueDate,
      amountMinor: payment.totalMinor,
    })),
    totalPrincipalMinor: plan.totalPrincipalMinor,
    totalInterestMinor: plan.totalInterestMinor,
    totalPaymentMinor: plan.totalPaymentMinor,
    firstMonthCashSavedMinor,
    debtClearMonth,
    recommendation,
    reasonCodes,
    riskLevelAfterInstallment: projectionAfter.riskLevel,
    score,
  } satisfies InstallmentSimulationResult
}

export function materializeInstallmentPlan(
  snapshot: AppSnapshot,
  input: InstallmentQuoteInput,
  referenceDate = APP_TODAY,
) {
  return createInstallmentPlan(snapshot, input, referenceDate).plan
}

export function rankInstallmentOptions(results: InstallmentSimulationResult[]) {
  return [...results].sort((left, right) => {
    const recommendationDiff =
      RECOMMENDATION_ORDER[left.recommendation] - RECOMMENDATION_ORDER[right.recommendation]
    if (recommendationDiff !== 0) {
      return recommendationDiff
    }

    const savingsGap = Math.abs(left.firstMonthCashSavedMinor - right.firstMonthCashSavedMinor)
    if (savingsGap < 100000 && left.periods !== right.periods) {
      return left.periods - right.periods
    }

    if (left.score !== right.score) {
      return right.score - left.score
    }

    if (left.totalInterestMinor !== right.totalInterestMinor) {
      return left.totalInterestMinor - right.totalInterestMinor
    }

    return left.periods - right.periods
  })
}

function createRecommendation(
  snapshot: AppSnapshot,
  code: string,
  severity: RecommendationSeverity,
  title: string,
  message: string,
  metadata?: Recommendation['metadata'],
  actionType?: Recommendation['actionType'],
  relatedEntityId?: string,
) {
  const referenceDate = APP_TODAY
  return {
    id: `rec-${code.toLowerCase()}-${referenceDate}`,
    code,
    userId: resolveUserId(snapshot),
    severity,
    title,
    message,
    createdAt: `${referenceDate}T00:00:00.000Z`,
    actionType,
    relatedEntityId,
    metadata,
  } satisfies Recommendation
}

export function buildRecommendations(snapshot: AppSnapshot, projection: CashflowProjection) {
  const referenceDate = projection.startDate
  const liquidAssetsMinor = sumLiquidAccounts(snapshot.accounts)
  const future14DaysBillsMinor = sumMinorUnits(
    snapshot.bills
      .filter((bill) => bill.status !== 'paid')
      .filter((bill) => isDateBetween(bill.dueDate, referenceDate, addDays(referenceDate, 14)))
      .map((bill) => getRemainingBillAmount(bill)),
  )
  const monthlyIncomeMinor = getTypicalMonthlyIncome(snapshot)
  const emergencyFundGoal =
    findGoal(snapshot, 'emergency_fund', '100,000') ?? findGoal(snapshot, 'emergency_fund')

  const recommendations: Recommendation[] = []

  if (future14DaysBillsMinor > liquidAssetsMinor - 3000000 || projection.riskLevel === 'critical') {
    recommendations.push(
      createRecommendation(
        snapshot,
        'RULE-CASH-001',
        'critical',
        '未來 14 天現金流可能斷裂',
        '未來 14 天必付款已超過可用現金扣除生活緩衝後的安全範圍。',
        {
          future14DaysBillsMinor,
          liquidAssetsMinor,
        },
        'pay_bill',
      ),
    )
  }

  const debtHeavyBill = snapshot.bills.find(
    (bill) =>
      bill.billType === 'credit_card' && getRemainingBillAmount(bill) > monthlyIncomeMinor * 0.5,
  )
  if (debtHeavyBill) {
    recommendations.push(
      createRecommendation(
        snapshot,
        'RULE-DEBT-001',
        'warning',
        '信用卡帳單已超過月收入 50%',
        '建議優先檢查可分期帳單，避免本月現金流壓力過高。',
        {
          billAmountMinor: getRemainingBillAmount(debtHeavyBill),
          monthlyIncomeMinor,
        },
        'create_installment',
        debtHeavyBill.id,
      ),
    )
  }

  const hasSubscription = snapshot.recurringRules.some(
    (rule) =>
      rule.direction === 'expense' &&
      ['Patreon', 'FANBOX', 'IFMOBILE', '不明會員'].includes(rule.name),
  )
  if ((emergencyFundGoal?.currentAmountMinor ?? 0) < 3000000 && hasSubscription) {
    recommendations.push(
      createRecommendation(
        snapshot,
        'RULE-SUB-001',
        'warning',
        '緊急預備金不足 30,000',
        '目前仍有非必要訂閱支出，建議先暫停或降級方案。',
        {
          emergencyFundMinor: emergencyFundGoal?.currentAmountMinor ?? 0,
        },
        'pause_subscription',
      ),
    )
  }

  if (projection.riskLevel !== 'safe') {
    recommendations.push(
      createRecommendation(
        snapshot,
        'RULE-GOAL-001',
        projection.riskLevel === 'critical' ? 'critical' : 'warning',
        '本月目標存款建議暫停',
        '先確保不逾期與保留最低生活現金，本月建議存款先設為 0。',
        {
          suggestedSavingsMinor: 0,
          riskLevel: projection.riskLevel,
        },
        'save_money',
      ),
    )
  }

  return recommendations
}

export function evaluatePurchaseDecision(
  snapshot: AppSnapshot,
  input: PurchaseDecisionInput,
  projection: CashflowProjection,
) {
  const liquidAssetsMinor = sumLiquidAccounts(snapshot.accounts)
  const emergencyGoal =
    findGoal(snapshot, 'emergency_fund', '100,000') ?? findGoal(snapshot, 'emergency_fund')
  const emergencyFundMinor = emergencyGoal?.currentAmountMinor ?? liquidAssetsMinor
  const remainingCashAfterPurchaseMinor = liquidAssetsMinor - input.priceMinor
  const reasons: string[] = []
  const unlockConditions: string[] = []

  if (emergencyFundMinor < 5000000) {
    reasons.push('目前緊急預備金低於 50,000，不建議新增大型購買。')
    unlockConditions.push('先把緊急預備金提升到至少 50,000。')
  }

  if (remainingCashAfterPurchaseMinor < 3000000) {
    reasons.push('購買後可動用現金會低於 30,000。')
    unlockConditions.push('購買後仍需保留至少 30,000 的生活緩衝。')
  }

  if (projection.riskLevel === 'critical') {
    reasons.push('目前未來 30 天現金流屬於 critical。')
    unlockConditions.push('先讓未來 30 天最低現金餘額回到正數。')
  }

  let paybackAnalysis: PurchaseDecisionResult['paybackAnalysis']
  if (input.alternative) {
    const breakEvenUsageCount = Number(
      (input.priceMinor / input.alternative.unitCostMinor).toFixed(2),
    )
    const weeklyUsage = input.expectedUsage?.unitPerWeek ?? 0
    const monthlyUsage = weeklyUsage * 4
    paybackAnalysis = {
      breakEvenUsageCount,
      breakEvenMonths:
        monthlyUsage > 0 ? Number((breakEvenUsageCount / monthlyUsage).toFixed(2)) : 0,
    }

    if (input.category === 'instrument' && weeklyUsage < 2) {
      reasons.push('每週練習時間低於 2 小時，先租琴房更合理。')
      unlockConditions.push('先確認每週穩定練習至少 2 小時。')
    }
  }

  let verdict: PurchaseDecisionResult['verdict'] = 'wait'
  if (reasons.length >= 2 || remainingCashAfterPurchaseMinor < 3000000) {
    verdict = 'reject'
  } else if (
    emergencyFundMinor >= 8000000 &&
    projection.riskLevel !== 'critical' &&
    remainingCashAfterPurchaseMinor >= 3000000
  ) {
    verdict = 'allow'
  }

  return {
    verdict,
    requiredSavingsBeforePurchaseMinor: Math.max(0, 3000000 - remainingCashAfterPurchaseMinor),
    remainingCashAfterPurchaseMinor,
    paybackAnalysis,
    reasons,
    unlockConditions,
  } satisfies PurchaseDecisionResult
}

export function evaluateTravelDecision(
  snapshot: AppSnapshot,
  input: TravelDecisionInput,
  projection: CashflowProjection,
) {
  const emergencyGoal =
    findGoal(snapshot, 'emergency_fund', '100,000') ?? findGoal(snapshot, 'emergency_fund')
  const travelGoal = findGoal(snapshot, 'travel')
  const emergencyFundMinor = emergencyGoal?.currentAmountMinor ?? 0
  const travelFundMinor = travelGoal?.currentAmountMinor ?? 0
  const reasons: string[] = []
  const unlockConditions: string[] = []

  if (emergencyFundMinor < 10000000) {
    reasons.push('緊急預備金尚未達到 100,000。')
    unlockConditions.push('先把緊急預備金補到 100,000。')
  }

  if (travelFundMinor < input.estimatedTripCostMinor) {
    reasons.push('旅遊基金尚未達到預估旅費。')
    unlockConditions.push('先把旅遊基金補足到預估旅費。')
  }

  if (projection.minimumBalanceMinor < 3000000) {
    reasons.push('即使出發前，現金流安全緩衝仍不足 30,000。')
    unlockConditions.push('確保出發前後仍能保留至少 30,000 的現金緩衝。')
  }

  return {
    verdict: reasons.length === 0 ? 'allow' : 'wait',
    requiredTravelFundMinor: input.estimatedTripCostMinor,
    reasons,
    unlockConditions,
  } satisfies TravelDecisionResult
}

export function buildNotifications(snapshot: AppSnapshot, projection: CashflowProjection) {
  const referenceDate = projection.startDate
  const notifications: NotificationItem[] = []
  const dueOffsets = new Set([7, 3, 1])

  for (const bill of snapshot.bills) {
    if (bill.status === 'paid') {
      continue
    }

    const daysUntilDue = dayjs(bill.dueDate).diff(dayjs(referenceDate), 'day')
    if (dueOffsets.has(daysUntilDue)) {
      notifications.push({
        id: `noti-bill-${bill.id}-${daysUntilDue}`,
        severity: daysUntilDue === 1 ? 'critical' : 'warning',
        title: `${bill.name} 即將到期`,
        message: `${bill.name} 將在 ${daysUntilDue} 天後到期，請預先安排付款。`,
        dueDate: bill.dueDate,
        relatedEntityId: bill.id,
      })
    }
  }

  if (projection.minimumBalanceMinor < 1000000) {
    notifications.push({
      id: `noti-balance-${referenceDate}`,
      severity: 'critical',
      title: '未來 14 天現金餘額偏低',
      message: '最低現金餘額已低於 10,000，請優先處理帳單與延後非必要支出。',
    })
  }

  return notifications
}

export function buildDashboardSummary(
  snapshot: AppSnapshot,
  projection: CashflowProjection,
): DashboardSummary {
  const netWorth = calculateNetWorth(snapshot)
  const recommendations = buildRecommendations(snapshot, projection)
  const notifications = buildNotifications(snapshot, projection)
  const goalRecommendation = recommendations.find(
    (recommendation) => recommendation.code === 'RULE-GOAL-001',
  )
  const future14DaysBillsMinor = sumMinorUnits(
    snapshot.bills
      .filter((bill) => bill.status !== 'paid')
      .filter((bill) =>
        isDateBetween(bill.dueDate, projection.startDate, addDays(projection.startDate, 14)),
      )
      .map((bill) => getRemainingBillAmount(bill)),
  )
  const monthLivingBudgetMinor = calculateMonthLivingBudget(projection, snapshot, {
    rangeDays: dayjs(projection.endDate).diff(dayjs(projection.startDate), 'day'),
    scenario: projection.scenario,
    referenceDate: projection.startDate,
    minimumCashBufferMinor: 3000000,
  })

  return {
    netWorthMinor: netWorth.netWorthMinor,
    liquidAssetsMinor: sumLiquidAccounts(snapshot.accounts),
    investmentAssetsMinor: sumInvestmentAccounts(snapshot.accounts),
    liabilitiesMinor: netWorth.liabilitiesMinor,
    future14DaysBillsMinor,
    monthLivingBudgetMinor,
    dailySafeSpendMinor: projection.dailySafeSpendMinor,
    suggestedSavingsMinor:
      (goalRecommendation?.metadata?.suggestedSavingsMinor as number | undefined) ?? 0,
    suggestedInvestmentMinor:
      projection.riskLevel === 'safe' ? Math.floor(projection.safeToSpendMinor * 0.1) : 0,
    riskLevel: projection.riskLevel,
    dueSoon: [...snapshot.bills]
      .filter((bill) => bill.status !== 'paid')
      .filter((bill) =>
        isDateBetween(bill.dueDate, projection.startDate, addDays(projection.startDate, 14)),
      )
      .sort((left: Bill, right: Bill) => dayjs(left.dueDate).unix() - dayjs(right.dueDate).unix()),
    notifications,
    recommendations,
  }
}

export function forecastGoalCompletion(goal: Goal, monthlyAvailableMinor: number) {
  if (goal.currentAmountMinor >= goal.targetAmountMinor) {
    return {
      months: 0,
      targetMonth: APP_TODAY.slice(0, 7),
    }
  }

  if (monthlyAvailableMinor <= 0) {
    return {
      months: null,
      targetMonth: null,
    }
  }

  const remainingMinor = goal.targetAmountMinor - goal.currentAmountMinor
  const months = Math.ceil(remainingMinor / monthlyAvailableMinor)
  return {
    months,
    targetMonth: dayjs(APP_TODAY).add(months, 'month').format('YYYY-MM'),
  }
}
