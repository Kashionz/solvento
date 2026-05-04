import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { LoginPage } from './login-page'

const { loginMock, showMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  showMock: vi.fn(),
}))

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')

  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      login: loginMock,
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
    showMock.mockReset()
    loginMock.mockResolvedValue({
      user: {
        id: 'usr-demo',
        email: 'demo@cashpilot.app',
        displayName: 'CashPilot Demo',
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
})
