import type { Bill, InstallmentPlan, InstallmentSimulationResult } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { billApi, installmentApi } from '../api'
import { PageHeader } from '../components/page-header'

export function InstallmentsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    billId: 'bill-yushan-2026-05',
    eligibleAmountMinor: 1135000,
    nonInstallmentAmountMinor: 298700,
    aprBps: 1100,
    periods: 3,
  })
  const [result, setResult] = useState<InstallmentSimulationResult | null>(null)

  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: () => billApi.list(),
  })

  const plans = useQuery({
    queryKey: ['installments'],
    queryFn: () => installmentApi.list(),
  })

  const simulate = useMutation({
    mutationFn: () => installmentApi.simulate(form),
    onSuccess: (data) => setResult(data),
  })

  const createPlan = useMutation({
    mutationFn: () => installmentApi.create(form),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '分期方案已建立' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
        queryClient.invalidateQueries({ queryKey: ['installments'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      ])
    },
  })

  const eligibleBills = (bills.data ?? []).filter(
    (bill: Bill) => bill.canInstallment && bill.status !== 'paid',
  )

  return (
    <Stack gap="xl">
      <PageHeader
        title="分期試算"
        description="輸入銀行提供的利率與期數，直接比對第一個月能省多少現金，以及總利息與結清月份。"
      />

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack>
          <Select
            label="帳單"
            data={eligibleBills.map((bill: Bill) => ({ label: bill.name, value: bill.id }))}
            value={form.billId}
            onChange={(value) =>
              setForm((current) => ({ ...current, billId: value ?? current.billId }))
            }
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="可分期金額（minor）"
              value={form.eligibleAmountMinor}
              onChange={(value) =>
                setForm((current) => ({ ...current, eligibleAmountMinor: Number(value) || 0 }))
              }
            />
            <NumberInput
              label="不可分期金額（minor）"
              value={form.nonInstallmentAmountMinor}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  nonInstallmentAmountMinor: Number(value) || 0,
                }))
              }
            />
            <NumberInput
              label="APR（bps）"
              value={form.aprBps}
              onChange={(value) =>
                setForm((current) => ({ ...current, aprBps: Number(value) || 0 }))
              }
            />
            <Select
              label="期數"
              data={['3', '6', '12', '18']}
              value={String(form.periods)}
              onChange={(value) =>
                setForm((current) => ({ ...current, periods: Number(value) || 3 }))
              }
            />
          </SimpleGrid>

          <Group>
            <Button loading={simulate.isPending} onClick={() => simulate.mutate()}>
              試算
            </Button>
            <Button
              disabled={!result}
              loading={createPlan.isPending}
              variant="light"
              onClick={() => createPlan.mutate()}
            >
              建立分期
            </Button>
          </Group>
        </Stack>
      </Paper>

      {result ? (
        <Stack gap="lg">
          <Alert
            color={result.recommendation === 'recommended' ? 'green' : 'orange'}
            title="建議結果"
          >
            {result.recommendation}
          </Alert>
          <SimpleGrid cols={{ base: 1, md: 4 }}>
            <Paper className="cashpilot-surface" p="lg" radius="xl">
              <Text c="dimmed">首月省下</Text>
              <Title order={3}>{formatMinorUnits(result.firstMonthCashSavedMinor)}</Title>
            </Paper>
            <Paper className="cashpilot-surface" p="lg" radius="xl">
              <Text c="dimmed">總利息</Text>
              <Title order={3}>{formatMinorUnits(result.totalInterestMinor)}</Title>
            </Paper>
            <Paper className="cashpilot-surface" p="lg" radius="xl">
              <Text c="dimmed">總支出</Text>
              <Title order={3}>{formatMinorUnits(result.totalPaymentMinor)}</Title>
            </Paper>
            <Paper className="cashpilot-surface" p="lg" radius="xl">
              <Text c="dimmed">結清月份</Text>
              <Title order={3}>{result.debtClearMonth}</Title>
            </Paper>
          </SimpleGrid>

          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>期數</Table.Th>
                <Table.Th>到期日</Table.Th>
                <Table.Th>月付</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {result.monthlyCashflowImpact.map((item) => (
                <Table.Tr key={item.period}>
                  <Table.Td>{item.period}</Table.Td>
                  <Table.Td>{item.dueDate}</Table.Td>
                  <Table.Td>{formatMinorUnits(item.amountMinor)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ) : null}

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack gap="md">
          <Title order={4}>既有分期方案</Title>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>名稱</Table.Th>
                <Table.Th>期數</Table.Th>
                <Table.Th>狀態</Table.Th>
                <Table.Th>總付款</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(plans.data ?? []).map((plan: InstallmentPlan) => (
                <Table.Tr key={plan.id}>
                  <Table.Td>{plan.name}</Table.Td>
                  <Table.Td>{plan.periods}</Table.Td>
                  <Table.Td>{plan.status}</Table.Td>
                  <Table.Td>{formatMinorUnits(plan.totalPaymentMinor)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>
    </Stack>
  )
}
