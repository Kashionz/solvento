import type { CashflowProjection, DashboardSummary } from '@cashpilot/shared'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { DashboardPage } from './dashboard-page'

const { scenariosMock, summaryMock } = vi.hoisted(() => ({
  scenariosMock:
    vi.fn<() => Promise<Record<'conservative' | 'base' | 'optimistic', CashflowProjection>>>(),
  summaryMock: vi.fn<() => Promise<DashboardSummary>>(),
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')

  return {
    ...actual,
    cashflowApi: {
      ...actual.cashflowApi,
      scenarios: scenariosMock,
      summary: summaryMock,
    },
  }
})

describe('DashboardPage', () => {
  function createProjection(
    scenario: CashflowProjection['scenario'],
    riskLevel: CashflowProjection['riskLevel'],
    minimumBalanceMinor: number,
    dailySafeSpendMinor: number,
  ): CashflowProjection {
    return {
      scenario,
      startDate: '2026-05-04',
      endDate: '2026-08-02',
      openingBalanceMinor: 3800000,
      closingBalanceMinor: 2400000,
      minimumBalanceMinor,
      minimumBalanceDate: '2026-05-12',
      safeToSpendMinor: 960000,
      dailySafeSpendMinor,
      riskLevel,
      events: [],
    }
  }

  beforeEach(() => {
    scenariosMock.mockReset()
    summaryMock.mockReset()
    summaryMock.mockResolvedValue({
      netWorthMinor: 12000000,
      liquidAssetsMinor: 3800000,
      investmentAssetsMinor: 5600000,
      liabilitiesMinor: 8200000,
      future14DaysBillsMinor: 1640000,
      monthLivingBudgetMinor: 900000,
      dailySafeSpendMinor: 32000,
      suggestedSavingsMinor: 0,
      suggestedInvestmentMinor: 0,
      riskLevel: 'warning',
      dueSoon: [
        {
          id: 'bill-1',
          userId: 'usr-demo',
          accountId: 'acc-card',
          name: '玉山信用卡',
          billType: 'credit_card',
          statementMonth: '2026-05',
          totalAmountMinor: 1433700,
          paidAmountMinor: 200000,
          dueDate: '2026-05-10',
          status: 'unpaid',
          canInstallment: true,
          nonInstallmentAmountMinor: 298700,
          installmentEligibleAmountMinor: 1135000,
          createdAt: '2026-05-04T00:00:00.000Z',
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      ],
      notifications: [
        {
          id: 'notif-1',
          severity: 'critical',
          title: '現金流即將跌破安全線',
          message: '請在 14 天內處理信用卡帳單。',
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          code: 'RULE-CASH',
          userId: 'usr-demo',
          severity: 'critical',
          title: '建議改採短期分期',
          message: '先保住本月流動性。',
          createdAt: '2026-05-04T00:00:00.000Z',
        },
      ],
    })
    scenariosMock.mockResolvedValue({
      conservative: createProjection('conservative', 'critical', -180000, 0),
      base: createProjection('base', 'warning', 820000, 32000),
      optimistic: createProjection('optimistic', 'safe', 2140000, 68000),
    })
  })

  it('會渲染關鍵財務指標、提醒與建議', async () => {
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('財務總覽')).toBeInTheDocument()
    expect(screen.getByText('現金流即將跌破安全線')).toBeInTheDocument()
    expect(screen.getByText('玉山信用卡')).toBeInTheDocument()
    expect(screen.getByText('建議改採短期分期')).toBeInTheDocument()
    expect(screen.getAllByText('風險')).toHaveLength(3)
  })

  it('會顯示 Week4 需要的情境推演與建議投資資訊', async () => {
    renderWithProviders(<DashboardPage />)

    expect(await screen.findByText('情境推演')).toBeInTheDocument()
    expect(screen.getByText('保守')).toBeInTheDocument()
    expect(screen.getByText('基準')).toBeInTheDocument()
    expect(screen.getByText('樂觀')).toBeInTheDocument()
    expect(screen.getByText('建議投資')).toBeInTheDocument()
  })
})
