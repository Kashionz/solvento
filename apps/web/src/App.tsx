import {
  ActionIcon,
  AppShell,
  Burger,
  Drawer,
  Group,
  Loader,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  useMantineColorScheme,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  ChartArea,
  ChartPie,
  CreditCard,
  House,
  type LucideIcon,
  Moon,
  PiggyBank,
  Receipt,
  Settings,
  Sun,
  Target,
  WalletCards,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { authApi, cashflowApi } from './api'

const AccountsPage = lazy(() =>
  import('./pages/accounts-page').then((module) => ({ default: module.AccountsPage })),
)
const BillsPage = lazy(() =>
  import('./pages/bills-page').then((module) => ({ default: module.BillsPage })),
)
const CashflowPage = lazy(() =>
  import('./pages/cashflow-page').then((module) => ({ default: module.CashflowPage })),
)
const DashboardPage = lazy(() =>
  import('./pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
)
const DecisionsPage = lazy(() =>
  import('./pages/decisions-page').then((module) => ({ default: module.DecisionsPage })),
)
const GoalsPage = lazy(() =>
  import('./pages/goals-page').then((module) => ({ default: module.GoalsPage })),
)
const InstallmentsPage = lazy(() =>
  import('./pages/installments-page').then((module) => ({ default: module.InstallmentsPage })),
)
const LoginPage = lazy(() =>
  import('./pages/login-page').then((module) => ({ default: module.LoginPage })),
)
const ReportsPage = lazy(() =>
  import('./pages/reports-page').then((module) => ({ default: module.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/settings-page').then((module) => ({ default: module.SettingsPage })),
)
const TransactionsPage = lazy(() =>
  import('./pages/transactions-page').then((module) => ({ default: module.TransactionsPage })),
)

const NAV_ITEMS: ReadonlyArray<{ label: string; to: string; icon: LucideIcon }> = [
  { label: '總覽', to: '/', icon: House },
  { label: '帳戶', to: '/accounts', icon: WalletCards },
  { label: '交易', to: '/transactions', icon: Receipt },
  { label: '帳單', to: '/bills', icon: CreditCard },
  { label: '分期', to: '/installments', icon: PiggyBank },
  { label: '現金流', to: '/cashflow', icon: ChartArea },
  { label: '目標', to: '/goals', icon: Target },
  { label: '決策', to: '/decisions', icon: Bell },
  { label: '報表', to: '/reports', icon: ChartPie },
  { label: '設定', to: '/settings', icon: Settings },
]

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const [navOpened, setNavOpened] = useState(false)
  const [notificationOpened, setNotificationOpened] = useState(false)

  const auth = useQuery({
    queryKey: ['auth'],
    queryFn: () => authApi.me(),
    retry: false,
  })

  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => cashflowApi.summary(),
    enabled: Boolean(auth.data?.user),
  })

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '已登出' })
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  const navLinks = useMemo(
    () =>
      NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          active={location.pathname === item.to}
          component="button"
          label={item.label}
          leftSection={<item.icon size={18} />}
          onClick={() => {
            navigate(item.to)
            setNavOpened(false)
          }}
        />
      )),
    [location.pathname, navigate],
  )

  if (auth.isLoading) {
    return <RouteLoader />
  }

  if (!auth.data?.user) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <LoginPage />
      </Suspense>
    )
  }

  return (
    <>
      <AppShell
        header={{ height: 72 }}
        navbar={{
          width: 260,
          breakpoint: 'sm',
          collapsed: { mobile: !navOpened },
        }}
        padding="lg"
      >
        <AppShell.Header className="cashpilot-header">
          <Group h="100%" justify="space-between" px="lg">
            <Group>
              <Burger
                opened={navOpened}
                onClick={() => setNavOpened((opened) => !opened)}
                hiddenFrom="sm"
                size="sm"
              />
              <div>
                <Text ff="monospace" fz="xs" c="dimmed" tt="uppercase">
                  CashPilot
                </Text>
                <Text fw={700}>財務決策工作台</Text>
              </div>
            </Group>
            <Group>
              <ActionIcon variant="subtle" onClick={() => setNotificationOpened(true)}>
                <Bell size={18} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
              >
                {colorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </ActionIcon>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar className="cashpilot-navbar" p="sm">
          <ScrollArea h="100%">
            <Stack gap="xs">{navLinks}</Stack>
          </ScrollArea>
        </AppShell.Navbar>

        <AppShell.Main>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/installments" element={<InstallmentsPage />} />
              <Route path="/cashflow" element={<CashflowPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/decisions" element={<DecisionsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route
                path="/settings"
                element={
                  <SettingsPage
                    user={auth.data.user}
                    darkMode={colorScheme === 'dark'}
                    onToggleDarkMode={() =>
                      setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')
                    }
                    onLogout={() => logout.mutate()}
                  />
                }
              />
              <Route path="*" element={<Navigate replace to="/" />} />
            </Routes>
          </Suspense>
        </AppShell.Main>
      </AppShell>

      <Drawer
        opened={notificationOpened}
        onClose={() => setNotificationOpened(false)}
        title="提醒中心"
        position="right"
      >
        <Stack>
          {(summary.data?.notifications ?? []).map((notification) => (
            <div key={notification.id} className="notification-row">
              <Text fw={600}>{notification.title}</Text>
              <Text c="dimmed" fz="sm">
                {notification.message}
              </Text>
            </div>
          ))}
        </Stack>
      </Drawer>
    </>
  )
}

function RouteLoader() {
  return (
    <div className="loading-screen">
      <Loader color="indigo" />
    </div>
  )
}
