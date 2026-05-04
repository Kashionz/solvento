import dayjs from 'dayjs'

import type { Account, AppSnapshot, Bill, CurrencyCode, Goal } from './domain'

export function toMinorUnits(value: number) {
  return Math.round(value * 100)
}

export function formatMinorUnits(amountMinor: number, currency: CurrencyCode = 'TWD') {
  const precision = currency === 'JPY' ? 0 : 2
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency,
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(amountMinor / 100)
}

export function sumMinorUnits(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function addDays(date: string, days: number) {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD')
}

export function endOfRange(date: string, days: number) {
  return dayjs(date).add(days, 'day').format('YYYY-MM-DD')
}

export function clampMinimumCashBuffer(minimumCashBufferMinor?: number) {
  return minimumCashBufferMinor ?? 3000000
}

export function getRemainingBillAmount(bill: Bill) {
  return Math.max(0, bill.totalAmountMinor - bill.paidAmountMinor)
}

export function isDateBetween(target: string, start: string, end: string) {
  const value = dayjs(target)
  return value.isAfter(dayjs(start).subtract(1, 'day')) && value.isBefore(dayjs(end).add(1, 'day'))
}

export function compareByDate<T extends { date?: string; dueDate?: string }>(left: T, right: T) {
  const leftDate = left.date ?? left.dueDate ?? ''
  const rightDate = right.date ?? right.dueDate ?? ''
  return dayjs(leftDate).unix() - dayjs(rightDate).unix()
}

export function getMonthEnd(date: string) {
  return dayjs(date).endOf('month').format('YYYY-MM-DD')
}

export function getRemainingDaysInMonth(date: string) {
  const value = dayjs(date)
  return Math.max(1, value.endOf('month').diff(value.startOf('day'), 'day') + 1)
}

export function sumLiquidAccounts(accounts: Account[]) {
  return sumMinorUnits(
    accounts
      .filter((account) => account.isActive && (account.type === 'cash' || account.type === 'bank'))
      .map((account) => account.balanceMinor),
  )
}

export function sumInvestmentAccounts(accounts: Account[]) {
  return sumMinorUnits(
    accounts
      .filter((account) => account.isActive && account.type === 'investment')
      .map((account) => account.balanceMinor),
  )
}

export function sumGoalFunds(accounts: Account[]) {
  return sumMinorUnits(
    accounts
      .filter((account) => account.isActive && account.type === 'goal_fund')
      .map((account) => account.balanceMinor),
  )
}

export function findGoal(snapshot: AppSnapshot, goalType: Goal['goalType'], keyword?: string) {
  return snapshot.goals.find((goal) => {
    if (goal.goalType !== goalType || goal.status !== 'active') {
      return false
    }

    return keyword ? goal.name.includes(keyword) : true
  })
}
