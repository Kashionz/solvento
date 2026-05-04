import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { TransactionsPage } from './transactions-page'

const {
  accountListMock,
  categoryListMock,
  createRecurringRuleMock,
  createTransactionMock,
  deleteRecurringRuleMock,
  deleteTransactionMock,
  listRecurringRulesMock,
  listTransactionsMock,
  showMock,
  updateRecurringRuleMock,
  updateTransactionMock,
} = vi.hoisted(() => ({
  accountListMock: vi.fn(),
  categoryListMock: vi.fn(),
  createRecurringRuleMock: vi.fn(),
  createTransactionMock: vi.fn(),
  deleteRecurringRuleMock: vi.fn(),
  deleteTransactionMock: vi.fn(),
  listRecurringRulesMock: vi.fn(),
  listTransactionsMock: vi.fn(),
  showMock: vi.fn(),
  updateRecurringRuleMock: vi.fn(),
  updateTransactionMock: vi.fn(),
}))

vi.mock('../api', async () => ({
  accountApi: {
    list: accountListMock,
  },
  metadataApi: {
    categories: categoryListMock,
  },
  recurringRuleApi: {
    list: listRecurringRulesMock,
    create: createRecurringRuleMock,
    update: updateRecurringRuleMock,
    delete: deleteRecurringRuleMock,
  },
  transactionApi: {
    list: listTransactionsMock,
    create: createTransactionMock,
    update: updateTransactionMock,
    delete: deleteTransactionMock,
  },
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: showMock,
  },
}))

describe('TransactionsPage', () => {
  beforeEach(() => {
    accountListMock.mockReset()
    categoryListMock.mockReset()
    createRecurringRuleMock.mockReset()
    createTransactionMock.mockReset()
    deleteRecurringRuleMock.mockReset()
    deleteTransactionMock.mockReset()
    listRecurringRulesMock.mockReset()
    listTransactionsMock.mockReset()
    showMock.mockReset()
    updateRecurringRuleMock.mockReset()
    updateTransactionMock.mockReset()

    accountListMock.mockResolvedValue([
      {
        id: 'acc-bank',
        userId: 'usr-demo',
        name: '台新銀行',
        type: 'bank',
        currency: 'TWD',
        balanceMinor: 1881800,
        isActive: true,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'acc-union',
        userId: 'usr-demo',
        name: '聯邦信用卡',
        type: 'credit_card',
        currency: 'TWD',
        balanceMinor: 0,
        isActive: true,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    ])
    categoryListMock.mockResolvedValue([
      {
        id: 'cat-salary',
        userId: 'usr-demo',
        name: '薪資',
        group: 'income',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'cat-rent',
        userId: 'usr-demo',
        name: '房租',
        group: 'housing',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'cat-subscription',
        userId: 'usr-demo',
        name: '訂閱',
        group: 'subscription',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    ])
    listTransactionsMock.mockResolvedValue([
      {
        id: 'txn-rent',
        userId: 'usr-demo',
        accountId: 'acc-bank',
        date: '2026-05-03',
        amountMinor: 1500000,
        direction: 'expense',
        categoryId: 'cat-rent',
        note: '五月房租',
        isRecurring: false,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'txn-salary',
        userId: 'usr-demo',
        accountId: 'acc-bank',
        date: '2026-05-05',
        amountMinor: 5107000,
        direction: 'income',
        categoryId: 'cat-salary',
        note: '五月薪資',
        isRecurring: true,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    ])
    listRecurringRulesMock.mockResolvedValue([
      {
        id: 'rule-rent',
        userId: 'usr-demo',
        name: '房租',
        amountMinor: 1500000,
        direction: 'expense',
        paymentAccountId: 'acc-bank',
        categoryId: 'cat-rent',
        frequency: 'monthly',
        dayOfMonth: 5,
        uncertainty: 'fixed',
        includeInBaseScenario: true,
        startDate: '2026-01-01',
        isActive: true,
      },
    ])

    createTransactionMock.mockResolvedValue(undefined)
    updateTransactionMock.mockResolvedValue(undefined)
    deleteTransactionMock.mockResolvedValue(undefined)
    createRecurringRuleMock.mockResolvedValue(undefined)
    updateRecurringRuleMock.mockResolvedValue(undefined)
    deleteRecurringRuleMock.mockResolvedValue(undefined)
  })

  it('會先依日期新到舊排序，並可依方向篩選交易', async () => {
    const user = userEvent.setup()

    renderWithProviders(<TransactionsPage />)

    expect(await screen.findByText('五月薪資')).toBeInTheDocument()
    const table = await screen.findByLabelText('交易列表')
    const dates = within(table).getAllByText(/^2026-05-0[35]$/)
    expect(dates.map((node) => node.textContent)).toEqual(['2026-05-05', '2026-05-03'])

    await user.selectOptions(screen.getByLabelText('交易方向'), 'income')

    expect(screen.queryByText('五月房租')).not.toBeInTheDocument()
    expect(screen.getByText('五月薪資')).toBeInTheDocument()
  })

  it('可建立固定規則，讓後續現金流預測使用', async () => {
    const user = userEvent.setup()

    renderWithProviders(<TransactionsPage />)

    expect(await screen.findByText('固定規則')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '新增固定規則' }))
    const dialog = await screen.findByRole('dialog', { name: '新增固定規則' })
    await user.type(await within(dialog).findByLabelText('規則名稱'), '健身房')
    await user.selectOptions(await within(dialog).findByLabelText('規則方向'), 'expense')
    await user.selectOptions(await within(dialog).findByLabelText('規則分類'), 'cat-subscription')
    await user.selectOptions(await within(dialog).findByLabelText('扣款帳戶'), 'acc-union')
    await user.clear(await within(dialog).findByLabelText('規則金額（minor）'))
    await user.type(await within(dialog).findByLabelText('規則金額（minor）'), '129000')
    await user.selectOptions(await within(dialog).findByLabelText('規則頻率'), 'monthly')
    await user.clear(await within(dialog).findByLabelText('每月日期'))
    await user.type(await within(dialog).findByLabelText('每月日期'), '8')
    await user.clear(await within(dialog).findByLabelText('開始日'))
    await user.type(await within(dialog).findByLabelText('開始日'), '2026-05-08')
    await user.click(within(dialog).getByRole('button', { name: '建立規則' }))

    await waitFor(() => {
      expect(createRecurringRuleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '健身房',
          amountMinor: 129000,
          direction: 'expense',
          categoryId: 'cat-subscription',
          paymentAccountId: 'acc-union',
        }),
      )
    })
  })
})
