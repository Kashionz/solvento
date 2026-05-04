import type { Account, Bill, CashflowEvent, RecurringRule } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import { DonutChart, LineChart } from '@mantine/charts'
import { Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'

import { accountApi, billApi, cashflowApi, goalApi, recurringRuleApi } from '../api'
import { PageHeader } from '../components/page-header'

export function ReportsPage() {
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
  })
  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: () => billApi.list(),
  })
  const goals = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalApi.list(),
  })
  const projection = useQuery({
    queryKey: ['cashflow', 'report'],
    queryFn: () => cashflowApi.projection(180, 'base'),
  })
  const recurringRules = useQuery({
    queryKey: ['recurring-rules'],
    queryFn: () => recurringRuleApi.list(),
  })

  const assetData = [
    {
      name: '流動資金',
      value: (accounts.data ?? [])
        .filter((account: Account) => ['cash', 'bank'].includes(account.type))
        .reduce((total, account) => total + account.balanceMinor / 100, 0),
      color: 'green.6',
    },
    {
      name: '投資',
      value: (accounts.data ?? [])
        .filter((account: Account) => account.type === 'investment')
        .reduce((total, account) => total + account.balanceMinor / 100, 0),
      color: 'indigo.5',
    },
    {
      name: '目標基金',
      value: (goals.data ?? []).reduce((total, goal) => total + goal.currentAmountMinor / 100, 0),
      color: 'orange.5',
    },
  ]

  const recurringExpenseData = (recurringRules.data ?? [])
    .filter((rule: RecurringRule) => rule.direction === 'expense')
    .map((rule: RecurringRule) => ({
      date: rule.name,
      amount: Number((rule.amountMinor / 100).toFixed(2)),
    }))

  const debtData = (bills.data ?? []).map((bill: Bill) => ({
    date: bill.name,
    amount: Number(((bill.totalAmountMinor - bill.paidAmountMinor) / 100).toFixed(2)),
  }))

  const cashflowData = (projection.data?.events ?? []).map((event: CashflowEvent) => ({
    date: event.date,
    balance: Number(((event.balanceAfterMinor ?? 0) / 100).toFixed(2)),
  }))

  return (
    <Stack gap="xl">
      <PageHeader
        title="報表"
        description="用圖表快速看淨資產結構、未來餘額曲線、固定支出與債務壓力。"
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <Title order={4}>資產結構</Title>
            <DonutChart data={assetData} thickness={22} />
          </Stack>
        </Paper>
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <Title order={4}>現金流預測</Title>
            <LineChart
              h={300}
              data={cashflowData}
              dataKey="date"
              series={[{ name: 'balance', color: 'indigo.5' }]}
            />
            <Text c="dimmed">
              最低點：{formatMinorUnits(projection.data?.minimumBalanceMinor ?? 0)}
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <Title order={4}>固定支出</Title>
            <LineChart
              h={260}
              data={recurringExpenseData}
              dataKey="date"
              series={[{ name: 'amount', color: 'orange.5' }]}
            />
          </Stack>
        </Paper>
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <Title order={4}>債務下降圖</Title>
            <LineChart
              h={260}
              data={debtData}
              dataKey="date"
              series={[{ name: 'amount', color: 'red.5' }]}
            />
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
