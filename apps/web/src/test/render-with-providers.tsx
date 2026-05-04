import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { cashpilotTheme } from '../theme'

export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="dark" theme={cashpilotTheme}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>,
  )
}
