import type { Account, Category, RecurringRule, Transaction } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import {
  Button,
  Group,
  Modal,
  NativeSelect,
  NumberInput,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { accountApi, metadataApi, recurringRuleApi, transactionApi } from '../api'
import { PageHeader } from '../components/page-header'

type TransactionFormValues = {
  accountId: string
  date: string
  amountMinor: number
  direction: Transaction['direction']
  categoryId: string
  note: string
  merchant: string
  relatedBillId: string
  isRecurring: boolean
}

type RuleFormValues = {
  name: string
  amountMinor: number
  direction: RecurringRule['direction']
  accountId: string
  paymentAccountId: string
  categoryId: string
  frequency: RecurringRule['frequency']
  dayOfMonth: number
  uncertainty: RecurringRule['uncertainty']
  includeInBaseScenario: boolean
  startDate: string
  endDate: string
  isActive: boolean
}

const defaultTransactionFormValues: TransactionFormValues = {
  accountId: '',
  date: '2026-05-04',
  amountMinor: 0,
  direction: 'expense',
  categoryId: '',
  note: '',
  merchant: '',
  relatedBillId: '',
  isRecurring: false,
}

const defaultRuleFormValues: RuleFormValues = {
  name: '',
  amountMinor: 0,
  direction: 'expense',
  accountId: '',
  paymentAccountId: '',
  categoryId: '',
  frequency: 'monthly',
  dayOfMonth: 5,
  uncertainty: 'fixed',
  includeInBaseScenario: true,
  startDate: '2026-05-04',
  endDate: '',
  isActive: true,
}

export function TransactionsPage() {
  const queryClient = useQueryClient()
  const [transactionOpened, setTransactionOpened] = useState(false)
  const [ruleOpened, setRuleOpened] = useState(false)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [transactionForm, setTransactionForm] = useState<TransactionFormValues>(
    defaultTransactionFormValues,
  )
  const [ruleForm, setRuleForm] = useState<RuleFormValues>(defaultRuleFormValues)
  const [transactionFilters, setTransactionFilters] = useState({
    search: '',
    direction: 'all',
    accountId: 'all',
    categoryId: 'all',
    sort: 'date_desc',
  })

  const transactions = useQuery({
    queryKey: ['transactions'],
    queryFn: () => transactionApi.list(),
  })
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => metadataApi.categories(),
  })
  const recurringRules = useQuery({
    queryKey: ['recurring-rules'],
    queryFn: () => recurringRuleApi.list(),
  })

  const createTransaction = useMutation({
    mutationFn: () => transactionApi.create(toTransactionPayload(transactionForm)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '交易已建立' })
      closeTransactionModal()
      await invalidateTransactionQueries(queryClient)
    },
  })

  const updateTransaction = useMutation({
    mutationFn: () =>
      transactionApi.update(editingTransactionId ?? '', toTransactionPayload(transactionForm)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '交易已更新' })
      closeTransactionModal()
      await invalidateTransactionQueries(queryClient)
    },
  })

  const deleteTransaction = useMutation({
    mutationFn: (transactionId: string) => transactionApi.delete(transactionId),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '交易已刪除' })
      await invalidateTransactionQueries(queryClient)
    },
  })

  const createRule = useMutation({
    mutationFn: () => recurringRuleApi.create(toRecurringRulePayload(ruleForm)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '固定規則已建立' })
      closeRuleModal()
      await invalidateTransactionQueries(queryClient)
    },
  })

  const updateRule = useMutation({
    mutationFn: () =>
      recurringRuleApi.update(editingRuleId ?? '', toRecurringRulePayload(ruleForm)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '固定規則已更新' })
      closeRuleModal()
      await invalidateTransactionQueries(queryClient)
    },
  })

  const deleteRule = useMutation({
    mutationFn: (ruleId: string) => recurringRuleApi.delete(ruleId),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '固定規則已刪除' })
      await invalidateTransactionQueries(queryClient)
    },
  })

  const accountOptions = (accounts.data ?? []).map((account: Account) => ({
    label: account.name,
    value: account.id,
  }))
  const categoryOptions = (categories.data ?? []).map((category: Category) => ({
    label: category.name,
    value: category.id,
  }))
  const accountNameById = new Map(
    (accounts.data ?? []).map((account) => [account.id, account.name]),
  )
  const categoryNameById = new Map(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  )

  const filteredTransactions = [...(transactions.data ?? [])]
    .filter((transaction) => {
      if (
        transactionFilters.direction !== 'all' &&
        transaction.direction !== transactionFilters.direction
      ) {
        return false
      }
      if (
        transactionFilters.accountId !== 'all' &&
        transaction.accountId !== transactionFilters.accountId
      ) {
        return false
      }
      if (
        transactionFilters.categoryId !== 'all' &&
        transaction.categoryId !== transactionFilters.categoryId
      ) {
        return false
      }

      const keyword = transactionFilters.search.trim().toLowerCase()
      if (!keyword) {
        return true
      }

      return [
        transaction.note,
        transaction.merchant,
        accountNameById.get(transaction.accountId),
        categoryNameById.get(transaction.categoryId),
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    })
    .sort((left, right) => sortTransactions(left, right, transactionFilters.sort))

  const sortedRules = [...(recurringRules.data ?? [])].sort((left, right) => {
    if (left.dayOfMonth && right.dayOfMonth && left.dayOfMonth !== right.dayOfMonth) {
      return left.dayOfMonth - right.dayOfMonth
    }
    return left.name.localeCompare(right.name, 'zh-Hant')
  })

  function closeTransactionModal() {
    setEditingTransactionId(null)
    setTransactionForm(defaultTransactionFormValues)
    setTransactionOpened(false)
  }

  function openCreateTransactionModal() {
    setEditingTransactionId(null)
    setTransactionForm(defaultTransactionFormValues)
    setTransactionOpened(true)
  }

  function openEditTransactionModal(transaction: Transaction) {
    setEditingTransactionId(transaction.id)
    setTransactionForm({
      accountId: transaction.accountId,
      date: transaction.date,
      amountMinor: transaction.amountMinor,
      direction: transaction.direction,
      categoryId: transaction.categoryId,
      note: transaction.note ?? '',
      merchant: transaction.merchant ?? '',
      relatedBillId: transaction.relatedBillId ?? '',
      isRecurring: transaction.isRecurring,
    })
    setTransactionOpened(true)
  }

  function closeRuleModal() {
    setEditingRuleId(null)
    setRuleForm(defaultRuleFormValues)
    setRuleOpened(false)
  }

  function openCreateRuleModal() {
    setEditingRuleId(null)
    setRuleForm(defaultRuleFormValues)
    setRuleOpened(true)
  }

  function openEditRuleModal(rule: RecurringRule) {
    setEditingRuleId(rule.id)
    setRuleForm({
      name: rule.name,
      amountMinor: rule.amountMinor,
      direction: rule.direction,
      accountId: rule.accountId ?? '',
      paymentAccountId: rule.paymentAccountId ?? '',
      categoryId: rule.categoryId,
      frequency: rule.frequency,
      dayOfMonth: rule.dayOfMonth ?? 5,
      uncertainty: rule.uncertainty,
      includeInBaseScenario: rule.includeInBaseScenario,
      startDate: rule.startDate,
      endDate: rule.endDate ?? '',
      isActive: rule.isActive,
    })
    setRuleOpened(true)
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="交易"
        description="交易紀錄用來回看真實收支，固定規則則提供未來現金流預測的已知收入與支出。"
        action={<Button onClick={openCreateTransactionModal}>新增交易</Button>}
      />

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Title order={4}>交易列表</Title>
              <Text c="dimmed" fz="sm">
                預設以最新日期優先，快速篩出收入、支出與特定帳戶。
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, xl: 5 }} spacing="md">
            <TextInput
              label="搜尋交易"
              placeholder="商家、備註、帳戶或分類"
              value={transactionFilters.search}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setTransactionFilters((current) => ({
                  ...current,
                  search: value,
                }))
              }}
            />
            <NativeSelect
              label="交易方向"
              data={[
                { label: '全部', value: 'all' },
                { label: '收入', value: 'income' },
                { label: '支出', value: 'expense' },
                { label: '轉入', value: 'transfer_in' },
                { label: '轉出', value: 'transfer_out' },
              ]}
              value={transactionFilters.direction}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setTransactionFilters((current) => ({
                  ...current,
                  direction: value,
                }))
              }}
            />
            <NativeSelect
              label="交易帳戶"
              data={[
                { label: '全部帳戶', value: 'all' },
                ...accountOptions.map((option) => ({ label: option.label, value: option.value })),
              ]}
              value={transactionFilters.accountId}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setTransactionFilters((current) => ({
                  ...current,
                  accountId: value,
                }))
              }}
            />
            <NativeSelect
              label="交易分類"
              data={[
                { label: '全部分類', value: 'all' },
                ...categoryOptions.map((option) => ({ label: option.label, value: option.value })),
              ]}
              value={transactionFilters.categoryId}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setTransactionFilters((current) => ({
                  ...current,
                  categoryId: value,
                }))
              }}
            />
            <NativeSelect
              label="排序方式"
              data={[
                { label: '日期新到舊', value: 'date_desc' },
                { label: '日期舊到新', value: 'date_asc' },
                { label: '金額高到低', value: 'amount_desc' },
                { label: '金額低到高', value: 'amount_asc' },
              ]}
              value={transactionFilters.sort}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setTransactionFilters((current) => ({
                  ...current,
                  sort: value,
                }))
              }}
            />
          </SimpleGrid>

          <Table aria-label="交易列表" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>日期</Table.Th>
                <Table.Th>帳戶</Table.Th>
                <Table.Th>分類</Table.Th>
                <Table.Th>方向</Table.Th>
                <Table.Th>商家 / 備註</Table.Th>
                <Table.Th>金額</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredTransactions.map((transaction) => (
                <Table.Tr key={transaction.id}>
                  <Table.Td>{transaction.date}</Table.Td>
                  <Table.Td>{accountNameById.get(transaction.accountId) ?? '未指派帳戶'}</Table.Td>
                  <Table.Td>{categoryNameById.get(transaction.categoryId) ?? '未分類'}</Table.Td>
                  <Table.Td>{transaction.direction}</Table.Td>
                  <Table.Td>{transaction.merchant ?? transaction.note ?? '—'}</Table.Td>
                  <Table.Td>{formatMinorUnits(transaction.amountMinor)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        size="compact-sm"
                        variant="light"
                        onClick={() => openEditTransactionModal(transaction)}
                      >
                        編輯
                      </Button>
                      <Button
                        color="red"
                        size="compact-sm"
                        variant="subtle"
                        loading={deleteTransaction.isPending}
                        onClick={() => deleteTransaction.mutate(transaction.id)}
                      >
                        刪除
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Title order={4}>固定規則</Title>
              <Text c="dimmed" fz="sm">
                固定收入與固定支出會直接影響未來 60 / 90 / 180 天的現金流預測。
              </Text>
            </div>
            <Button variant="light" onClick={openCreateRuleModal}>
              新增固定規則
            </Button>
          </Group>

          <Table aria-label="固定規則列表" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>名稱</Table.Th>
                <Table.Th>方向</Table.Th>
                <Table.Th>帳戶</Table.Th>
                <Table.Th>頻率</Table.Th>
                <Table.Th>基準情境</Table.Th>
                <Table.Th>金額</Table.Th>
                <Table.Th>狀態</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedRules.map((rule) => (
                <Table.Tr key={rule.id}>
                  <Table.Td>{rule.name}</Table.Td>
                  <Table.Td>{rule.direction}</Table.Td>
                  <Table.Td>
                    {accountNameById.get(rule.accountId ?? rule.paymentAccountId ?? '') ?? '未指定'}
                  </Table.Td>
                  <Table.Td>{describeRuleSchedule(rule.frequency, rule.dayOfMonth)}</Table.Td>
                  <Table.Td>{rule.includeInBaseScenario ? '納入' : '排除'}</Table.Td>
                  <Table.Td>{formatMinorUnits(rule.amountMinor)}</Table.Td>
                  <Table.Td>{rule.isActive ? '啟用' : '停用'}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Button
                        size="compact-sm"
                        variant="light"
                        onClick={() => openEditRuleModal(rule)}
                      >
                        編輯
                      </Button>
                      <Button
                        color="red"
                        size="compact-sm"
                        variant="subtle"
                        loading={deleteRule.isPending}
                        onClick={() => deleteRule.mutate(rule.id)}
                      >
                        刪除
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      <Modal
        opened={transactionOpened}
        onClose={closeTransactionModal}
        title={editingTransactionId ? '編輯交易' : '新增交易'}
        centered
      >
        <Stack>
          <NativeSelect
            label="帳戶"
            data={accountOptions}
            value={transactionForm.accountId}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setTransactionForm((current) => ({
                ...current,
                accountId: value,
              }))
            }}
          />
          <NativeSelect
            label="分類"
            data={categoryOptions}
            value={transactionForm.categoryId}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setTransactionForm((current) => ({
                ...current,
                categoryId: value,
              }))
            }}
          />
          <NativeSelect
            label="方向"
            data={[
              { label: '收入', value: 'income' },
              { label: '支出', value: 'expense' },
              { label: '轉入', value: 'transfer_in' },
              { label: '轉出', value: 'transfer_out' },
            ]}
            value={transactionForm.direction}
            onChange={({ currentTarget }) => {
              const value = currentTarget.value as Transaction['direction']
              setTransactionForm((current) => ({
                ...current,
                direction: value,
              }))
            }}
          />
          <TextInput
            label="日期"
            value={transactionForm.date}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setTransactionForm((current) => ({
                ...current,
                date: value,
              }))
            }}
          />
          <NumberInput
            label="金額（minor）"
            value={transactionForm.amountMinor}
            onChange={(value) =>
              setTransactionForm((current) => ({
                ...current,
                amountMinor: toNumber(value),
              }))
            }
          />
          <TextInput
            label="商家"
            value={transactionForm.merchant}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setTransactionForm((current) => ({
                ...current,
                merchant: value,
              }))
            }}
          />
          <TextInput
            label="備註"
            value={transactionForm.note}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setTransactionForm((current) => ({
                ...current,
                note: value,
              }))
            }}
          />
          <Switch
            label="同時標記為固定交易"
            checked={transactionForm.isRecurring}
            onChange={({ currentTarget }) => {
              const { checked } = currentTarget
              setTransactionForm((current) => ({
                ...current,
                isRecurring: checked,
              }))
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeTransactionModal}>
              取消
            </Button>
            <Button
              loading={createTransaction.isPending || updateTransaction.isPending}
              onClick={() =>
                editingTransactionId ? updateTransaction.mutate() : createTransaction.mutate()
              }
            >
              {editingTransactionId ? '儲存變更' : '建立交易'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={ruleOpened}
        onClose={closeRuleModal}
        title={editingRuleId ? '編輯固定規則' : '新增固定規則'}
        centered
      >
        <Stack>
          <TextInput
            label="規則名稱"
            value={ruleForm.name}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setRuleForm((current) => ({
                ...current,
                name: value,
              }))
            }}
          />
          <NativeSelect
            label="規則方向"
            data={[
              { label: '收入', value: 'income' },
              { label: '支出', value: 'expense' },
            ]}
            value={ruleForm.direction}
            onChange={({ currentTarget }) => {
              const value = currentTarget.value as RecurringRule['direction']
              setRuleForm((current) => ({
                ...current,
                direction: value,
              }))
            }}
          />
          <NativeSelect
            label="規則分類"
            data={categoryOptions}
            value={ruleForm.categoryId}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setRuleForm((current) => ({
                ...current,
                categoryId: value,
              }))
            }}
          />
          <NativeSelect
            label={ruleForm.direction === 'income' ? '入帳帳戶' : '扣款帳戶'}
            data={accountOptions}
            value={ruleForm.direction === 'income' ? ruleForm.accountId : ruleForm.paymentAccountId}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setRuleForm((current) => ({
                ...current,
                accountId: current.direction === 'income' ? value : current.accountId,
                paymentAccountId:
                  current.direction === 'expense' ? value : current.paymentAccountId,
              }))
            }}
          />
          <NumberInput
            label="規則金額（minor）"
            value={ruleForm.amountMinor}
            onChange={(value) =>
              setRuleForm((current) => ({
                ...current,
                amountMinor: toNumber(value),
              }))
            }
          />
          <NativeSelect
            label="規則頻率"
            data={[
              { label: '每月', value: 'monthly' },
              { label: '每週', value: 'weekly' },
              { label: '每年', value: 'yearly' },
              { label: '自訂', value: 'custom' },
            ]}
            value={ruleForm.frequency}
            onChange={({ currentTarget }) => {
              const value = currentTarget.value as RecurringRule['frequency']
              setRuleForm((current) => ({
                ...current,
                frequency: value,
              }))
            }}
          />
          <NumberInput
            label="每月日期"
            value={ruleForm.dayOfMonth}
            min={1}
            max={31}
            onChange={(value) =>
              setRuleForm((current) => ({
                ...current,
                dayOfMonth: Math.max(1, Math.min(31, toNumber(value))),
              }))
            }
          />
          <TextInput
            label="開始日"
            value={ruleForm.startDate}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setRuleForm((current) => ({
                ...current,
                startDate: value,
              }))
            }}
          />
          <NativeSelect
            label="不確定性"
            data={[
              { label: '固定', value: 'fixed' },
              { label: '日期浮動', value: 'variable_date' },
              { label: '金額浮動', value: 'variable_amount' },
            ]}
            value={ruleForm.uncertainty}
            onChange={({ currentTarget }) => {
              const value = currentTarget.value as RecurringRule['uncertainty']
              setRuleForm((current) => ({
                ...current,
                uncertainty: value,
              }))
            }}
          />
          <Switch
            label="納入基準情境"
            checked={ruleForm.includeInBaseScenario}
            onChange={({ currentTarget }) => {
              const { checked } = currentTarget
              setRuleForm((current) => ({
                ...current,
                includeInBaseScenario: checked,
              }))
            }}
          />
          <Switch
            label="啟用規則"
            checked={ruleForm.isActive}
            onChange={({ currentTarget }) => {
              const { checked } = currentTarget
              setRuleForm((current) => ({
                ...current,
                isActive: checked,
              }))
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeRuleModal}>
              取消
            </Button>
            <Button
              loading={createRule.isPending || updateRule.isPending}
              onClick={() => (editingRuleId ? updateRule.mutate() : createRule.mutate())}
            >
              {editingRuleId ? '儲存規則' : '建立規則'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

function sortTransactions(left: Transaction, right: Transaction, sort: string) {
  if (sort === 'date_asc') {
    return left.date.localeCompare(right.date)
  }
  if (sort === 'amount_desc') {
    return right.amountMinor - left.amountMinor
  }
  if (sort === 'amount_asc') {
    return left.amountMinor - right.amountMinor
  }
  return right.date.localeCompare(left.date)
}

function describeRuleSchedule(frequency: RecurringRule['frequency'], dayOfMonth?: number) {
  if (frequency === 'monthly') {
    return dayOfMonth ? `每月 ${dayOfMonth} 號` : '每月'
  }
  if (frequency === 'weekly') {
    return '每週'
  }
  if (frequency === 'yearly') {
    return '每年'
  }
  return '自訂'
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function toNumber(value: string | number) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function toTransactionPayload(form: TransactionFormValues) {
  return {
    accountId: form.accountId,
    date: form.date.trim(),
    amountMinor: form.amountMinor,
    direction: form.direction,
    categoryId: form.categoryId,
    note: normalizeOptionalText(form.note),
    merchant: normalizeOptionalText(form.merchant),
    relatedBillId: normalizeOptionalText(form.relatedBillId),
    isRecurring: form.isRecurring,
  }
}

function toRecurringRulePayload(form: RuleFormValues) {
  return {
    name: form.name.trim(),
    amountMinor: form.amountMinor,
    direction: form.direction,
    accountId: form.direction === 'income' ? normalizeOptionalText(form.accountId) : undefined,
    paymentAccountId:
      form.direction === 'expense' ? normalizeOptionalText(form.paymentAccountId) : undefined,
    categoryId: form.categoryId,
    frequency: form.frequency,
    dayOfMonth: form.frequency === 'monthly' ? form.dayOfMonth : undefined,
    uncertainty: form.uncertainty,
    includeInBaseScenario: form.includeInBaseScenario,
    startDate: form.startDate.trim(),
    endDate: normalizeOptionalText(form.endDate),
    isActive: form.isActive,
  }
}

async function invalidateTransactionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['recurring-rules'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
  ])
}
