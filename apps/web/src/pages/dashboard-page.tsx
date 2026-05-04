import { formatMinorUnits } from '@cashpilot/shared'
import {
  Alert,
  Button,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'

import { cashflowApi } from '../api'
import { PageHeader } from '../components/page-header'
import { StatCard } from '../components/stat-card'
import { StatusPill } from '../components/status-pill'

export function DashboardPage() {
  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => cashflowApi.summary(),
  })

  if (summary.isLoading) {
    return <Text c="dimmed">載入 Dashboard...</Text>
  }

  if (!summary.data) {
    return <Alert color="red">無法載入 Dashboard</Alert>
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="財務總覽"
        description="用可自由支配金額、未來 14 天到期付款與風險等級判斷這個月能不能撐過去。"
        action={<StatusPill riskLevel={summary.data.riskLevel} />}
      />

      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="lg">
        <StatCard label="淨資產" value={formatMinorUnits(summary.data.netWorthMinor)} />
        <StatCard label="流動資金" value={formatMinorUnits(summary.data.liquidAssetsMinor)} />
        <StatCard label="投資" value={formatMinorUnits(summary.data.investmentAssetsMinor)} />
        <StatCard label="負債" value={formatMinorUnits(summary.data.liabilitiesMinor)} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack gap="lg">
            <Group justify="space-between">
              <div>
                <Text c="dimmed" ff="monospace" fz="xs" tt="uppercase">
                  五月風險狀態
                </Text>
                <Title order={3}>本月現金流警示</Title>
              </div>
              <StatusPill riskLevel={summary.data.riskLevel} />
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <StatCard
                label="14 天應付款"
                value={formatMinorUnits(summary.data.future14DaysBillsMinor)}
              />
              <StatCard
                label="本月生活費上限"
                value={formatMinorUnits(summary.data.monthLivingBudgetMinor)}
              />
              <StatCard
                label="今日安全花費"
                value={formatMinorUnits(summary.data.dailySafeSpendMinor)}
              />
              <StatCard
                label="建議存款"
                value={formatMinorUnits(summary.data.suggestedSavingsMinor)}
              />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack gap="md">
            <Text c="dimmed" ff="monospace" fz="xs" tt="uppercase">
              提醒
            </Text>
            {summary.data.notifications.length ? (
              summary.data.notifications.map((item) => (
                <Alert
                  key={item.id}
                  color={item.severity === 'critical' ? 'red' : 'orange'}
                  title={item.title}
                >
                  {item.message}
                </Alert>
              ))
            ) : (
              <Text c="dimmed">目前沒有新的提醒。</Text>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>未來 14 天帳單</Title>
              <Button component="a" href="/bills" size="xs" variant="light">
                查看全部
              </Button>
            </Group>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>項目</Table.Th>
                  <Table.Th>到期日</Table.Th>
                  <Table.Th>金額</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {summary.data.dueSoon.map((bill) => (
                  <Table.Tr key={bill.id}>
                    <Table.Td>{bill.name}</Table.Td>
                    <Table.Td>{bill.dueDate}</Table.Td>
                    <Table.Td>
                      {formatMinorUnits(bill.totalAmountMinor - bill.paidAmountMinor)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>

        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack gap="md">
            <Title order={4}>建議行動</Title>
            {summary.data.recommendations.length ? (
              <List spacing="sm">
                {summary.data.recommendations.map((item) => (
                  <List.Item key={item.id}>
                    <Text fw={600}>{item.title}</Text>
                    <Text c="dimmed" fz="sm">
                      {item.message}
                    </Text>
                  </List.Item>
                ))}
              </List>
            ) : (
              <Text c="dimmed">目前沒有新的建議行動。</Text>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}
