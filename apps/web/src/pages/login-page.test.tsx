import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { LoginPage } from './login-page'

const { loginMock, registerMock, showMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  showMock: vi.fn(),
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')

  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      login: loginMock,
      register: registerMock,
    },
  }
})

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: showMock,
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset()
    registerMock.mockReset()
    showMock.mockReset()
    loginMock.mockResolvedValue({
      user: {
        id: 'usr-demo',
        email: 'demo@cashpilot.app',
        displayName: 'CashPilot Demo',
      },
    })
    registerMock.mockResolvedValue({
      user: {
        id: 'usr-new',
        email: 'new@cashpilot.app',
        displayName: 'New User',
      },
    })
  })

  it('使用預設 demo 帳號送出登入', async () => {
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />)

    expect(screen.getByDisplayValue('demo@cashpilot.app')).toBeInTheDocument()
    expect(screen.getByDisplayValue('demo123456')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '登入 Demo' }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('demo@cashpilot.app', 'demo123456')
    })
    expect(showMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'green',
        message: '已登入 Demo 帳號',
      }),
    )
  })

  it('可切換到註冊模式並送出新帳號資料', async () => {
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />)

    await user.click(screen.getByRole('button', { name: '建立帳號' }))
    await user.type(screen.getByLabelText('顯示名稱'), 'New User')
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'new@cashpilot.app')
    await user.clear(screen.getByLabelText('Password'))
    await user.type(screen.getByLabelText('Password'), 'week2pass123')
    await user.click(screen.getByRole('button', { name: '送出註冊' }))

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith('new@cashpilot.app', 'week2pass123', 'New User')
    })
    expect(showMock).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'green',
        message: '帳號已建立',
      }),
    )
  })
})
