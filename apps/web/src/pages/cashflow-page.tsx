import type { CashflowEvent, Scenario } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import { LineChart } from '@mantine/charts'
import {
  Button,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState, useTransition } from 'react'

import { cashflowApi } from '../api'
import { PageHeader } from '../components/page-header'

export function CashflowPage() {
  const [rangeDays, setRangeDays] = useState(90)
  const [scenario, setScenario] = useState<Scenario>('base')
  const [isPending, startTransition] = useTransition()

  const projection = useQuery({
    queryKey: ['cashflow', rangeDays, scenario],
    queryFn: () => cashflowApi.projection(rangeDays, scenario),
  })

  const chartData = (projection.data?.events ?? []).map((event: CashflowEvent) => ({
    date: event.date,
    balance: Number(((event.balanceAfterMinor ?? 0) / 100).toFixed(2)),
  }))

  return (
    <Stack gap="xl">
      <PageHeader
        title="現金流"
        description="用 60 / 90 / 180 天時間軸檢查最低點、已知收入、帳單與分期付款壓力。"
      />

      <Group wrap="wrap">
        <SegmentedControl
          data={[
            { label: '60 天', value: '60' },
            { label: '90 天', value: '90' },
            { label: '180 天', value: '180' },
          ]}
          value={String(rangeDays)}
          onChange={(value) => startTransition(() => setRangeDays(Number(value)))}
        />
        <Select
          data={[
            { label: '保守', value: 'conservative' },
            { label: '基準', value: 'base' },
            { label: '樂觀', value: 'optimistic' },
          ]}
          value={scenario}
          onChange={(value) => startTransition(() => setScenario((value as Scenario) ?? 'base'))}
        />
        <Button
          variant="light"
          loading={isPending || projection.isFetching}
          onClick={() => void projection.refetch()}
        >
          重新計算
        </Button>
      </Group>

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack>
          <Title order={4}>餘額曲線</Title>
          <LineChart
            h={320}
            data={chartData}
            dataKey="date"
            series={[{ name: 'balance', color: 'indigo.5', label: '預估餘額' }]}
            withLegend
            curveType="linear"
          />
          <Group justify="space-between">
            <Text c="dimmed">
              最低餘額：{formatMinorUnits(projection.data?.minimumBalanceMinor ?? 0)}
            </Text>
            <Text c="dimmed">
              安全花費：{formatMinorUnits(projection.data?.dailySafeSpendMinor ?? 0)}
            </Text>
          </Group>
        </Stack>
      </Paper>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>日期</Table.Th>
            <Table.Th>事件</Table.Th>
            <Table.Th>金額</Table.Th>
            <Table.Th>事件後餘額</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(projection.data?.events ?? []).map((event: CashflowEvent) => (
            <Table.Tr key={event.id}>
              <Table.Td>{event.date}</Table.Td>
              <Table.Td>{event.name}</Table.Td>
              <Table.Td>{formatMinorUnits(event.amountMinor)}</Table.Td>
              <Table.Td>{formatMinorUnits(event.balanceAfterMinor ?? 0)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
