import type { Goal } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import {
  Button,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiRequest, type GoalWithForecast, goalApi } from '../api'
import { PageHeader } from '../components/page-header'

type GoalFormValues = {
  name: string
  targetAmountMinor: number
  currentAmountMinor: number
  priority: Goal['priority']
  goalType: Goal['goalType']
  monthlyContributionMinor: number | ''
  deadline: string
  status: Goal['status']
}

const defaultGoalFormValues: GoalFormValues = {
  name: '',
  targetAmountMinor: 1000000,
  currentAmountMinor: 0,
  priority: 'medium',
  goalType: 'travel',
  monthlyContributionMinor: '',
  deadline: '',
  status: 'active',
}

function toOptionalNumber(value: number | '') {
  return value === '' ? undefined : value
}

function toGoalPayload(form: GoalFormValues) {
  return {
    name: form.name.trim(),
    targetAmountMinor: form.targetAmountMinor,
    currentAmountMinor: form.currentAmountMinor,
    priority: form.priority,
    goalType: form.goalType,
    monthlyContributionMinor: toOptionalNumber(form.monthlyContributionMinor),
    deadline: form.deadline.trim() || undefined,
    status: form.status,
  }
}

function toGoalFormValues(goal: GoalWithForecast): GoalFormValues {
  return {
    name: goal.name,
    targetAmountMinor: goal.targetAmountMinor,
    currentAmountMinor: goal.currentAmountMinor,
    priority: goal.priority,
    goalType: goal.goalType,
    monthlyContributionMinor: goal.monthlyContributionMinor ?? '',
    deadline: goal.deadline ?? '',
    status: goal.status,
  }
}

export function GoalsPage() {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [contributions, setContributions] = useState<Record<string, number>>({})
  const [form, setForm] = useState<GoalFormValues>(defaultGoalFormValues)
  const goals = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalApi.list(),
  })

  const createGoal = useMutation({
    mutationFn: () => goalApi.create(toGoalPayload(form)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '目標已建立' })
      closeModal()
      await invalidateGoalQueries(queryClient)
    },
  })

  const updateGoal = useMutation({
    mutationFn: () => goalApi.update(editingGoalId ?? '', toGoalPayload(form)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '目標已更新' })
      closeModal()
      await invalidateGoalQueries(queryClient)
    },
  })

  const deleteGoal = useMutation({
    mutationFn: (goalId: string) => goalApi.delete(goalId),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '目標已刪除' })
      await invalidateGoalQueries(queryClient)
    },
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

  function closeModal() {
    setOpened(false)
    setEditingGoalId(null)
    setForm(defaultGoalFormValues)
  }

  function openCreateModal() {
    setEditingGoalId(null)
    setForm(defaultGoalFormValues)
    setOpened(true)
  }

  function openEditModal(goal: GoalWithForecast) {
    setEditingGoalId(goal.id)
    setForm(toGoalFormValues(goal))
    setOpened(true)
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="目標"
        description="追蹤緊急預備金、北歐獨旅基金與 Roland FP-30X 基金，並預估完成月份。"
        action={<Button onClick={openCreateModal}>新增目標</Button>}
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
                <Group gap="xs" wrap="nowrap">
                  <Button variant="light" size="compact-sm" onClick={() => openEditModal(goal)}>
                    編輯
                  </Button>
                  <Button
                    color="red"
                    variant="subtle"
                    size="compact-sm"
                    loading={deleteGoal.isPending}
                    onClick={() => deleteGoal.mutate(goal.id)}
                  >
                    刪除
                  </Button>
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

      <Modal
        opened={opened}
        onClose={closeModal}
        title={editingGoalId ? '編輯目標' : '新增目標'}
        centered
      >
        <Stack>
          <TextInput
            label="名稱"
            value={form.name}
            onChange={(event) => {
              const { value } = event.currentTarget
              setForm((current) => ({ ...current, name: value }))
            }}
          />
          <NumberInput
            label="目標金額（minor）"
            value={form.targetAmountMinor}
            min={0}
            onChange={(value) =>
              setForm((current) => ({ ...current, targetAmountMinor: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="目前累積（minor）"
            value={form.currentAmountMinor}
            min={0}
            onChange={(value) =>
              setForm((current) => ({ ...current, currentAmountMinor: Number(value) || 0 }))
            }
          />
          <NativeSelect
            label="目標類型"
            data={[
              { label: '緊急預備金', value: 'emergency_fund' },
              { label: '旅行', value: 'travel' },
              { label: '購買', value: 'purchase' },
              { label: '還債', value: 'debt_payoff' },
              { label: '投資', value: 'investment' },
            ]}
            value={form.goalType}
            onChange={({ currentTarget }) =>
              setForm((current) => ({
                ...current,
                goalType: currentTarget.value as Goal['goalType'],
              }))
            }
          />
          <NativeSelect
            label="優先度"
            data={[
              { label: '高', value: 'high' },
              { label: '中', value: 'medium' },
              { label: '低', value: 'low' },
            ]}
            value={form.priority}
            onChange={({ currentTarget }) =>
              setForm((current) => ({
                ...current,
                priority: currentTarget.value as Goal['priority'],
              }))
            }
          />
          <NativeSelect
            label="狀態"
            data={[
              { label: '進行中', value: 'active' },
              { label: '暫停', value: 'paused' },
              { label: '已完成', value: 'completed' },
              { label: '已取消', value: 'cancelled' },
            ]}
            value={form.status}
            onChange={({ currentTarget }) =>
              setForm((current) => ({
                ...current,
                status: currentTarget.value as Goal['status'],
              }))
            }
          />
          <NumberInput
            label="每月投入（minor）"
            value={form.monthlyContributionMinor}
            min={0}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                monthlyContributionMinor: typeof value === 'number' ? value : '',
              }))
            }
          />
          <TextInput
            label="截止日"
            placeholder="2026-12-31"
            value={form.deadline}
            onChange={(event) => {
              const { value } = event.currentTarget
              setForm((current) => ({ ...current, deadline: value }))
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeModal}>
              取消
            </Button>
            <Button
              loading={createGoal.isPending || updateGoal.isPending}
              onClick={() => (editingGoalId ? updateGoal.mutate() : createGoal.mutate())}
            >
              {editingGoalId ? '儲存變更' : '建立目標'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

async function invalidateGoalQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['goals'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}
