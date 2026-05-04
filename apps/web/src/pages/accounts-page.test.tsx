import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { AccountsPage } from './accounts-page'

const { createMock, deleteMock, listMock, showMock, updateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  deleteMock: vi.fn(),
  listMock: vi.fn(),
  showMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('../api', async () => ({
  accountApi: {
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

describe('AccountsPage', () => {
  beforeEach(() => {
    createMock.mockReset()
    deleteMock.mockReset()
    listMock.mockReset()
    showMock.mockReset()
    updateMock.mockReset()

    listMock.mockResolvedValue([
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
    ])
    createMock.mockResolvedValue(undefined)
    updateMock.mockResolvedValue(undefined)
    deleteMock.mockResolvedValue(undefined)
  })

  it('允許編輯既有帳戶', async () => {
    const user = userEvent.setup()

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('台新銀行')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '編輯' }))
    const nameInput = await screen.findByLabelText('名稱')
    await user.clear(nameInput)
    await user.type(nameInput, '台新 Richart')
    await user.click(screen.getByRole('button', { name: '儲存變更' }))

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        'acc-bank',
        expect.objectContaining({
          name: '台新 Richart',
        }),
      )
    })
  })

  it('允許刪除既有帳戶', async () => {
    const user = userEvent.setup()

    renderWithProviders(<AccountsPage />)

    expect(await screen.findByText('台新銀行')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '刪除' }))

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('acc-bank')
    })
  })
})
