import type { Bill } from '@cashpilot/shared'
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

import { billApi } from '../api'
import { PageHeader } from '../components/page-header'

type BillFormValues = {
  name: string
  billType: Bill['billType']
  statementMonth: string
  totalAmountMinor: number
  paidAmountMinor: number
  dueDate: string
  status: Bill['status']
  canInstallment: boolean
  nonInstallmentAmountMinor: number
  installmentEligibleAmountMinor: number
}

const defaultBillFormValues: BillFormValues = {
  name: '',
  billType: 'credit_card',
  statementMonth: '',
  totalAmountMinor: 0,
  paidAmountMinor: 0,
  dueDate: '2026-05-10',
  status: 'unpaid',
  canInstallment: false,
  nonInstallmentAmountMinor: 0,
  installmentEligibleAmountMinor: 0,
}

export function BillsPage() {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [paymentOpened, setPaymentOpened] = useState(false)
  const [editingBillId, setEditingBillId] = useState<string | null>(null)
  const [payingBillId, setPayingBillId] = useState<string | null>(null)
  const [paymentAmountMinor, setPaymentAmountMinor] = useState(0)
  const [form, setForm] = useState<BillFormValues>(defaultBillFormValues)
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    billType: 'all',
    sort: 'due_asc',
  })

  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: () => billApi.list(),
  })

  const createBill = useMutation({
    mutationFn: () => billApi.create(toBillPayload(form)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳單已建立' })
      closeBillModal()
      await invalidateBillQueries(queryClient)
    },
  })

  const updateBill = useMutation({
    mutationFn: () => billApi.update(editingBillId ?? '', toBillPayload(form)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳單已更新' })
      closeBillModal()
      await invalidateBillQueries(queryClient)
    },
  })

  const deleteBill = useMutation({
    mutationFn: (billId: string) => billApi.delete(billId),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳單已刪除' })
      await invalidateBillQueries(queryClient)
    },
  })

  const addPayment = useMutation({
    mutationFn: () => billApi.addPayment(payingBillId ?? '', paymentAmountMinor),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '付款已登記' })
      closePaymentModal()
      await invalidateBillQueries(queryClient)
    },
  })

  const markPaid = useMutation({
    mutationFn: (billId: string) => billApi.markPaid(billId),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳單已標記為已繳' })
      await invalidateBillQueries(queryClient)
    },
  })

  const filteredBills = [...(bills.data ?? [])]
    .filter((bill) => {
      if (filters.status !== 'all' && bill.status !== filters.status) {
        return false
      }
      if (filters.billType !== 'all' && bill.billType !== filters.billType) {
        return false
      }

      const keyword = filters.search.trim().toLowerCase()
      if (!keyword) {
        return true
      }

      return [bill.name, bill.statementMonth, bill.billType]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    })
    .sort((left, right) => sortBills(left, right, filters.sort))

  function closeBillModal() {
    setEditingBillId(null)
    setForm(defaultBillFormValues)
    setOpened(false)
  }

  function openCreateBillModal() {
    setEditingBillId(null)
    setForm(defaultBillFormValues)
    setOpened(true)
  }

  function openEditBillModal(bill: Bill) {
    setEditingBillId(bill.id)
    setForm({
      name: bill.name,
      billType: bill.billType,
      statementMonth: bill.statementMonth ?? '',
      totalAmountMinor: bill.totalAmountMinor,
      paidAmountMinor: bill.paidAmountMinor,
      dueDate: bill.dueDate,
      status: bill.status,
      canInstallment: bill.canInstallment,
      nonInstallmentAmountMinor: bill.nonInstallmentAmountMinor ?? 0,
      installmentEligibleAmountMinor: bill.installmentEligibleAmountMinor ?? 0,
    })
    setOpened(true)
  }

  function openPaymentModal(bill: Bill) {
    setPayingBillId(bill.id)
    setPaymentAmountMinor(Math.max(0, bill.totalAmountMinor - bill.paidAmountMinor))
    setPaymentOpened(true)
  }

  function closePaymentModal() {
    setPayingBillId(null)
    setPaymentAmountMinor(0)
    setPaymentOpened(false)
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="帳單"
        description="信用卡、房租、學貸與固定扣款都集中管理，依狀態與到期日快速判斷本月壓力。"
        action={<Button onClick={openCreateBillModal}>新增帳單</Button>}
      />

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Title order={4}>帳單列表</Title>
              <Text c="dimmed" fz="sm">
                先看到期日，再用狀態與類型篩出需要優先處理的付款。
              </Text>
            </div>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
            <TextInput
              label="搜尋帳單"
              placeholder="名稱、月份或類型"
              value={filters.search}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setFilters((current) => ({
                  ...current,
                  search: value,
                }))
              }}
            />
            <NativeSelect
              label="帳單狀態"
              data={[
                { label: '全部狀態', value: 'all' },
                { label: '未繳', value: 'unpaid' },
                { label: '部分付款', value: 'partial' },
                { label: '已繳', value: 'paid' },
                { label: '已轉分期', value: 'installment' },
              ]}
              value={filters.status}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setFilters((current) => ({
                  ...current,
                  status: value,
                }))
              }}
            />
            <NativeSelect
              label="帳單類型"
              data={[
                { label: '全部類型', value: 'all' },
                { label: '信用卡', value: 'credit_card' },
                { label: '房租', value: 'rent' },
                { label: '貸款', value: 'loan' },
                { label: '水電瓦斯', value: 'utility' },
                { label: '訂閱', value: 'subscription' },
                { label: '其他', value: 'other' },
              ]}
              value={filters.billType}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setFilters((current) => ({
                  ...current,
                  billType: value,
                }))
              }}
            />
            <NativeSelect
              label="排序方式"
              data={[
                { label: '到期日近到遠', value: 'due_asc' },
                { label: '到期日遠到近', value: 'due_desc' },
                { label: '剩餘金額高到低', value: 'remaining_desc' },
              ]}
              value={filters.sort}
              onChange={({ currentTarget }) => {
                const { value } = currentTarget
                setFilters((current) => ({
                  ...current,
                  sort: value,
                }))
              }}
            />
          </SimpleGrid>

          <Table aria-label="帳單列表" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>名稱</Table.Th>
                <Table.Th>類型</Table.Th>
                <Table.Th>到期日</Table.Th>
                <Table.Th>狀態</Table.Th>
                <Table.Th>已付 / 剩餘</Table.Th>
                <Table.Th>操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredBills.map((bill) => {
                const remainingMinor = Math.max(0, bill.totalAmountMinor - bill.paidAmountMinor)
                return (
                  <Table.Tr key={bill.id}>
                    <Table.Td>{bill.name}</Table.Td>
                    <Table.Td>{bill.billType}</Table.Td>
                    <Table.Td>{bill.dueDate}</Table.Td>
                    <Table.Td>{bill.status}</Table.Td>
                    <Table.Td>
                      {formatMinorUnits(bill.paidAmountMinor)} / {formatMinorUnits(remainingMinor)}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="wrap">
                        {bill.status !== 'paid' ? (
                          <Button
                            size="compact-sm"
                            variant="light"
                            onClick={() => openPaymentModal(bill)}
                          >
                            登記付款
                          </Button>
                        ) : null}
                        {bill.status !== 'paid' ? (
                          <Button
                            size="compact-sm"
                            variant="subtle"
                            loading={markPaid.isPending}
                            onClick={() => markPaid.mutate(bill.id)}
                          >
                            標記已繳
                          </Button>
                        ) : null}
                        <Button
                          size="compact-sm"
                          variant="light"
                          onClick={() => openEditBillModal(bill)}
                        >
                          編輯
                        </Button>
                        <Button
                          color="red"
                          size="compact-sm"
                          variant="subtle"
                          loading={deleteBill.isPending}
                          onClick={() => deleteBill.mutate(bill.id)}
                        >
                          刪除
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>

      <Modal
        opened={opened}
        onClose={closeBillModal}
        title={editingBillId ? '編輯帳單' : '新增帳單'}
        centered
      >
        <Stack>
          <TextInput
            label="名稱"
            value={form.name}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setForm((current) => ({ ...current, name: value }))
            }}
          />
          <NativeSelect
            label="類型"
            data={[
              { label: '信用卡', value: 'credit_card' },
              { label: '房租', value: 'rent' },
              { label: '貸款', value: 'loan' },
              { label: '水電瓦斯', value: 'utility' },
              { label: '訂閱', value: 'subscription' },
              { label: '其他', value: 'other' },
            ]}
            value={form.billType}
            onChange={({ currentTarget }) => {
              const value = currentTarget.value as Bill['billType']
              setForm((current) => ({
                ...current,
                billType: value,
              }))
            }}
          />
          <TextInput
            label="帳單月份"
            value={form.statementMonth}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setForm((current) => ({
                ...current,
                statementMonth: value,
              }))
            }}
          />
          <TextInput
            label="到期日"
            value={form.dueDate}
            onChange={({ currentTarget }) => {
              const { value } = currentTarget
              setForm((current) => ({ ...current, dueDate: value }))
            }}
          />
          <NumberInput
            label="總金額（minor）"
            value={form.totalAmountMinor}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                totalAmountMinor: toNumber(value),
              }))
            }
          />
          <NumberInput
            label="已付金額（minor）"
            value={form.paidAmountMinor}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                paidAmountMinor: toNumber(value),
              }))
            }
          />
          <NativeSelect
            label="狀態"
            data={[
              { label: '未繳', value: 'unpaid' },
              { label: '部分付款', value: 'partial' },
              { label: '已繳', value: 'paid' },
              { label: '已轉分期', value: 'installment' },
            ]}
            value={form.status}
            onChange={({ currentTarget }) => {
              const value = currentTarget.value as Bill['status']
              setForm((current) => ({
                ...current,
                status: value,
              }))
            }}
          />
          <Switch
            label="可分期"
            checked={form.canInstallment}
            onChange={({ currentTarget }) => {
              const { checked } = currentTarget
              setForm((current) => ({
                ...current,
                canInstallment: checked,
              }))
            }}
          />
          <NumberInput
            label="不可分期金額（minor）"
            value={form.nonInstallmentAmountMinor}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                nonInstallmentAmountMinor: toNumber(value),
              }))
            }
          />
          <NumberInput
            label="可分期金額（minor）"
            value={form.installmentEligibleAmountMinor}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                installmentEligibleAmountMinor: toNumber(value),
              }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeBillModal}>
              取消
            </Button>
            <Button
              loading={createBill.isPending || updateBill.isPending}
              onClick={() => (editingBillId ? updateBill.mutate() : createBill.mutate())}
            >
              {editingBillId ? '儲存變更' : '建立帳單'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={paymentOpened} onClose={closePaymentModal} title="登記付款" centered>
        <Stack>
          <NumberInput
            label="付款金額（minor）"
            value={paymentAmountMinor}
            onChange={(value) => setPaymentAmountMinor(toNumber(value))}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closePaymentModal}>
              取消
            </Button>
            <Button loading={addPayment.isPending} onClick={() => addPayment.mutate()}>
              送出付款
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

function sortBills(left: Bill, right: Bill, sort: string) {
  if (sort === 'due_desc') {
    return right.dueDate.localeCompare(left.dueDate)
  }
  if (sort === 'remaining_desc') {
    return (
      right.totalAmountMinor -
      right.paidAmountMinor -
      (left.totalAmountMinor - left.paidAmountMinor)
    )
  }
  return left.dueDate.localeCompare(right.dueDate)
}

function toNumber(value: string | number) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function toBillPayload(form: BillFormValues) {
  return {
    name: form.name.trim(),
    billType: form.billType,
    statementMonth: normalizeOptionalText(form.statementMonth),
    totalAmountMinor: form.totalAmountMinor,
    paidAmountMinor: form.paidAmountMinor,
    dueDate: form.dueDate.trim(),
    status: form.status,
    canInstallment: form.canInstallment,
    nonInstallmentAmountMinor: form.canInstallment ? form.nonInstallmentAmountMinor : undefined,
    installmentEligibleAmountMinor: form.canInstallment
      ? form.installmentEligibleAmountMinor
      : undefined,
  }
}

async function invalidateBillQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['bills'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
    queryClient.invalidateQueries({ queryKey: ['installments'] }),
  ])
}
