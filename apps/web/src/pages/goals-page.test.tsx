import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { GoalsPage } from './goals-page'

const { apiRequestMock, createMock, deleteMock, listMock, showMock, updateMock } = vi.hoisted(
  () => ({
    apiRequestMock: vi.fn(),
    createMock: vi.fn(),
    deleteMock: vi.fn(),
    listMock: vi.fn(),
    showMock: vi.fn(),
    updateMock: vi.fn(),
  }),
)

vi.mock('../api', async () => ({
  apiRequest: apiRequestMock,
  goalApi: {
    list: listMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
  },
}))

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: showMock,
  },
}))

describe('GoalsPage', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    createMock.mockReset()
    deleteMock.mockReset()
    listMock.mockReset()
    showMock.mockReset()
    updateMock.mockReset()

    listMock.mockResolvedValue([
      {
        id: 'goal-travel',
        userId: 'usr-demo',
        name: '北歐獨旅基金',
        targetAmountMinor: 12000000,
        currentAmountMinor: 3200000,
        priority: 'high',
        goalType: 'travel',
        monthlyContributionMinor: 180000,
        status: 'active',
        forecast: {
          months: 20,
          targetMonth: '2027-01',
        },
      },
    ])
    apiRequestMock.mockResolvedValue(undefined)
    createMock.mockResolvedValue(undefined)
    updateMock.mockResolvedValue(undefined)
    deleteMock.mockResolvedValue(undefined)
  })

  it('允許建立新的目標', async () => {
    const user = userEvent.setup()

    renderWithProviders(<GoalsPage />)

    expect(await screen.findByText('北歐獨旅基金')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '新增目標' }))

    const dialog = await screen.findByRole('dialog', { name: '新增目標' })
    await user.type(within(dialog).getByLabelText('名稱'), '日本旅行基金')
    await user.clear(within(dialog).getByLabelText('目標金額（minor）'))
    await user.type(within(dialog).getByLabelText('目標金額（minor）'), '5000000')
    await user.clear(within(dialog).getByLabelText('目前累積（minor）'))
    await user.type(within(dialog).getByLabelText('目前累積（minor）'), '250000')
    await user.click(within(dialog).getByRole('button', { name: '建立目標' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '日本旅行基金',
          targetAmountMinor: 5000000,
          currentAmountMinor: 250000,
          goalType: 'travel',
          priority: 'medium',
          status: 'active',
        }),
      )
    })
  })

  it('允許編輯既有目標', async () => {
    const user = userEvent.setup()

    renderWithProviders(<GoalsPage />)

    expect(await screen.findByText('北歐獨旅基金')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '編輯' }))

    const dialog = await screen.findByRole('dialog', { name: '編輯目標' })
    const nameInput = within(dialog).getByLabelText('名稱')
    await user.clear(nameInput)
    await user.type(nameInput, '2027 北歐獨旅基金')
    await user.click(within(dialog).getByRole('button', { name: '儲存變更' }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'goal-travel',
        expect.objectContaining({
          name: '2027 北歐獨旅基金',
        }),
      )
    })
  })

  it('允許刪除既有目標', async () => {
    const user = userEvent.setup()

    renderWithProviders(<GoalsPage />)

    expect(await screen.findByText('北歐獨旅基金')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '刪除' }))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('goal-travel')
    })
  })
})
