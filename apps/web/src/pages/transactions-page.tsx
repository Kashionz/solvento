import type { Account, Category, Transaction } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import { Button, Group, Modal, NumberInput, Select, Stack, Table, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { accountApi, apiRequest, metadataApi, transactionApi } from '../api'
import { PageHeader } from '../components/page-header'

export function TransactionsPage() {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [form, setForm] = useState({
    accountId: '',
    date: '2026-05-04',
    amountMinor: 0,
    direction: 'expense',
    categoryId: '',
    note: '',
    merchant: '',
    isRecurring: false,
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

  const createTransaction = useMutation({
    mutationFn: () =>
      apiRequest('/transactions', {
        method: 'POST',
        bodyJson: form,
      }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '交易已建立' })
      setOpened(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      ])
    },
  })

  return (
    <Stack gap="xl">
      <PageHeader
        title="交易"
        description="收入、支出、轉帳與信用卡付款都從這裡進。"
        action={<Button onClick={() => setOpened(true)}>新增交易</Button>}
      />

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>日期</Table.Th>
            <Table.Th>方向</Table.Th>
            <Table.Th>商家 / 備註</Table.Th>
            <Table.Th>金額</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {transactions.data?.map((transaction: Transaction) => (
            <Table.Tr key={transaction.id}>
              <Table.Td>{transaction.date}</Table.Td>
              <Table.Td>{transaction.direction}</Table.Td>
              <Table.Td>{transaction.merchant ?? transaction.note ?? '—'}</Table.Td>
              <Table.Td>{formatMinorUnits(transaction.amountMinor)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title="新增交易" centered>
        <Stack>
          <Select
            label="帳戶"
            data={(accounts.data ?? []).map((account: Account) => ({
              label: account.name,
              value: account.id,
            }))}
            value={form.accountId}
            onChange={(value) => setForm((current) => ({ ...current, accountId: value ?? '' }))}
          />
          <Select
            label="分類"
            data={(categories.data ?? []).map((category: Category) => ({
              label: category.name,
              value: category.id,
            }))}
            value={form.categoryId}
            onChange={(value) => setForm((current) => ({ ...current, categoryId: value ?? '' }))}
          />
          <Select
            label="方向"
            data={['income', 'expense', 'transfer_in', 'transfer_out']}
            value={form.direction}
            onChange={(value) =>
              setForm((current) => ({ ...current, direction: value ?? 'expense' }))
            }
          />
          <TextInput
            label="日期"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({ ...current, date: event.currentTarget.value }))
            }
          />
          <NumberInput
            label="金額（minor）"
            value={form.amountMinor}
            onChange={(value) =>
              setForm((current) => ({ ...current, amountMinor: Number(value) || 0 }))
            }
          />
          <TextInput
            label="商家"
            value={form.merchant}
            onChange={(event) =>
              setForm((current) => ({ ...current, merchant: event.currentTarget.value }))
            }
          />
          <TextInput
            label="備註"
            value={form.note}
            onChange={(event) =>
              setForm((current) => ({ ...current, note: event.currentTarget.value }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>
              取消
            </Button>
            <Button
              loading={createTransaction.isPending}
              onClick={() => createTransaction.mutate()}
            >
              建立
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
