import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { SettingsPage } from './settings-page'

describe('SettingsPage', () => {
  it('提供資料匯出入口', () => {
    renderWithProviders(
      <SettingsPage
        user={{
          id: 'usr-demo',
          email: 'demo@cashpilot.app',
          displayName: 'Demo User',
        }}
        darkMode
        onToggleDarkMode={vi.fn()}
        onLogout={vi.fn()}
      />,
    )

    expect(screen.getByRole('link', { name: '匯出資料備份' })).toHaveAttribute(
      'href',
      '/api/v1/export',
    )
  })
})
