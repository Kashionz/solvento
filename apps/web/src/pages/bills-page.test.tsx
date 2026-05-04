import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { BillsPage } from './bills-page'

const { addPaymentMock, createMock, deleteMock, listMock, markPaidMock, showMock, updateMock } =
  vi.hoisted(() => ({
    addPaymentMock: vi.fn(),
    createMock: vi.fn(),
    deleteMock: vi.fn(),
    listMock: vi.fn(),
    markPaidMock: vi.fn(),
    showMock: vi.fn(),
    updateMock: vi.fn(),
  }))

vi.mock('../api', async () => ({
  billApi: {
    list: listMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
    addPayment: addPaymentMock,
    markPaid: markPaidMock,
  },
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: showMock,
  },
}))

describe('BillsPage', () => {
  beforeEach(() => {
    addPaymentMock.mockReset()
    createMock.mockReset()
    deleteMock.mockReset()
    listMock.mockReset()
    markPaidMock.mockReset()
    showMock.mockReset()
    updateMock.mockReset()

    listMock.mockResolvedValue([
      {
        id: 'bill-paid',
        userId: 'usr-demo',
        name: '已繳玉山卡費',
        billType: 'credit_card',
        totalAmountMinor: 100000,
        paidAmountMinor: 100000,
        dueDate: '2026-05-04',
        status: 'paid',
        canInstallment: false,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
      {
        id: 'bill-rent',
        userId: 'usr-demo',
        name: '五月房租',
        billType: 'rent',
        totalAmountMinor: 1500000,
        paidAmountMinor: 0,
        dueDate: '2026-05-05',
        status: 'unpaid',
        canInstallment: false,
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z',
      },
    ])

    addPaymentMock.mockResolvedValue(undefined)
    createMock.mockResolvedValue(undefined)
    deleteMock.mockResolvedValue(undefined)
    markPaidMock.mockResolvedValue(undefined)
    updateMock.mockResolvedValue(undefined)
  })

  it('可依狀態篩選帳單，避免已繳項目干擾未來到期判讀', async () => {
    const user = userEvent.setup()

    renderWithProviders(<BillsPage />)

    expect(await screen.findByText('已繳玉山卡費')).toBeInTheDocument()
    const table = await screen.findByLabelText('帳單列表')
    const dueDates = within(table).getAllByText(/^2026-05-0[45]$/)
    expect(dueDates.map((node) => node.textContent)).toEqual(['2026-05-04', '2026-05-05'])

    await user.selectOptions(screen.getByLabelText('帳單狀態'), 'unpaid')

    expect(screen.getByText('五月房租')).toBeInTheDocument()
    expect(screen.queryByText('已繳玉山卡費')).not.toBeInTheDocument()
  })

  it('可為帳單登記部分付款，讓狀態更新為 partial', async () => {
    const user = userEvent.setup()

    renderWithProviders(<BillsPage />)

    expect(await screen.findByText('五月房租')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '登記付款' }))
    const dialog = await screen.findByRole('dialog', { name: '登記付款' })
    await user.clear(await within(dialog).findByLabelText('付款金額（minor）'))
    await user.type(await within(dialog).findByLabelText('付款金額（minor）'), '500000')
    await user.click(within(dialog).getByRole('button', { name: '送出付款' }))

    await waitFor(() => {
      expect(addPaymentMock).toHaveBeenCalledWith('bill-rent', 500000)
    })
  })
})
