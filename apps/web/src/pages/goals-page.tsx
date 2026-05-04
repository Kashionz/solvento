import { formatMinorUnits } from '@cashpilot/shared'
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiRequest, goalApi } from '../api'
import { PageHeader } from '../components/page-header'

export function GoalsPage() {
  const queryClient = useQueryClient()
  const [contributions, setContributions] = useState<Record<string, number>>({})
  const goals = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalApi.list(),
  })

  const contribute = useMutation({
    mutationFn: ({ id, amountMinor }: { id: string; amountMinor: number }) =>
      apiRequest(`/goals/${id}/contributions`, {
        method: 'POST',
        bodyJson: { amountMinor },
      }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '目標進度已更新' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })

  return (
    <Stack gap="xl">
      <PageHeader
        title="目標"
        description="追蹤緊急預備金、北歐獨旅基金與 Roland FP-30X 基金，並預估完成月份。"
      />

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {(goals.data ?? []).map((goal) => {
          const ratio = Math.min(
            100,
            Math.round((goal.currentAmountMinor / goal.targetAmountMinor) * 100),
          )
          return (
            <Paper key={goal.id} className="cashpilot-surface" p="lg" radius="xl">
              <Stack>
                <Title order={4}>{goal.name}</Title>
                <Text c="dimmed">
                  {goal.forecast?.targetMonth
                    ? `預估完成 ${goal.forecast.targetMonth}`
                    : '目前沒有足夠現金流推進'}
                </Text>
                <Progress radius="xl" size="xl" value={ratio} />
                <Group justify="space-between">
                  <Text>{formatMinorUnits(goal.currentAmountMinor)}</Text>
                  <Text c="dimmed">/ {formatMinorUnits(goal.targetAmountMinor)}</Text>
                </Group>
                <Group align="end">
                  <NumberInput
                    label="追加金額（minor）"
                    value={contributions[goal.id] ?? 100000}
                    onChange={(value) =>
                      setContributions((current) => ({
                        ...current,
                        [goal.id]: Number(value) || 0,
                      }))
                    }
                  />
                  <Button
                    onClick={() =>
                      contribute.mutate({
                        id: goal.id,
                        amountMinor: contributions[goal.id] ?? 100000,
                      })
                    }
                  >
                    存入
                  </Button>
                </Group>
              </Stack>
            </Paper>
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
