import type { Bill } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import { Button, Group, Modal, NumberInput, Select, Stack, Table, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiRequest, billApi } from '../api'
import { PageHeader } from '../components/page-header'

export function BillsPage() {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [form, setForm] = useState({
    name: '',
    billType: 'credit_card',
    totalAmountMinor: 0,
    paidAmountMinor: 0,
    dueDate: '2026-05-10',
    status: 'unpaid',
    canInstallment: false,
  })

  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: () => billApi.list(),
  })

  const createBill = useMutation({
    mutationFn: () =>
      apiRequest('/bills', {
        method: 'POST',
        bodyJson: form,
      }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳單已建立' })
      setOpened(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      ])
    },
  })

  const markPaid = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/bills/${id}/mark-paid`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bills'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      ])
    },
  })

  return (
    <Stack gap="xl">
      <PageHeader
        title="帳單"
        description="信用卡、房租、學貸與一次性付款都用帳單管理，排序以到期日為主。"
        action={<Button onClick={() => setOpened(true)}>新增帳單</Button>}
      />

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>名稱</Table.Th>
            <Table.Th>到期日</Table.Th>
            <Table.Th>狀態</Table.Th>
            <Table.Th>金額</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...(bills.data ?? [])]
            .sort((left: Bill, right: Bill) => left.dueDate.localeCompare(right.dueDate))
            .map((bill: Bill) => (
              <Table.Tr key={bill.id}>
                <Table.Td>{bill.name}</Table.Td>
                <Table.Td>{bill.dueDate}</Table.Td>
                <Table.Td>{bill.status}</Table.Td>
                <Table.Td>
                  {formatMinorUnits(bill.totalAmountMinor - bill.paidAmountMinor)}
                </Table.Td>
                <Table.Td>
                  {bill.status !== 'paid' ? (
                    <Button size="xs" variant="light" onClick={() => markPaid.mutate(bill.id)}>
                      標記已繳
                    </Button>
                  ) : null}
                </Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title="新增帳單" centered>
        <Stack>
          <TextInput
            label="名稱"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.currentTarget.value }))
            }
          />
          <Select
            label="類型"
            data={['credit_card', 'rent', 'loan', 'utility', 'subscription', 'other']}
            value={form.billType}
            onChange={(value) =>
              setForm((current) => ({ ...current, billType: value ?? 'credit_card' }))
            }
          />
          <TextInput
            label="到期日"
            value={form.dueDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.currentTarget.value }))
            }
          />
          <NumberInput
            label="總金額（minor）"
            value={form.totalAmountMinor}
            onChange={(value) =>
              setForm((current) => ({ ...current, totalAmountMinor: Number(value) || 0 }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>
              取消
            </Button>
            <Button loading={createBill.isPending} onClick={() => createBill.mutate()}>
              建立
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
