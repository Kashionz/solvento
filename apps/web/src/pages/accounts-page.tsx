import type { Account } from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { accountApi } from '../api'
import { PageHeader } from '../components/page-header'

type AccountFormValues = {
  name: string
  type: Account['type']
  currency: Account['currency']
  balanceMinor: number
  creditLimitMinor: number | ''
  billingDay: number | ''
  dueDay: number | ''
  isActive: boolean
}

const defaultFormValues: AccountFormValues = {
  name: '',
  type: 'bank',
  currency: 'TWD',
  balanceMinor: 0,
  creditLimitMinor: '',
  billingDay: '',
  dueDay: '',
  isActive: true,
}

function toOptionalNumber(value: number | '') {
  return value === '' ? undefined : value
}

function toPayload(form: AccountFormValues) {
  return {
    name: form.name.trim(),
    type: form.type,
    currency: form.currency,
    balanceMinor: form.balanceMinor,
    creditLimitMinor: toOptionalNumber(form.creditLimitMinor),
    billingDay: toOptionalNumber(form.billingDay),
    dueDay: toOptionalNumber(form.dueDay),
    isActive: form.isActive,
  }
}

function toFormValues(account: Account): AccountFormValues {
  return {
    name: account.name,
    type: account.type,
    currency: account.currency,
    balanceMinor: account.balanceMinor,
    creditLimitMinor: account.creditLimitMinor ?? '',
    billingDay: account.billingDay ?? '',
    dueDay: account.dueDay ?? '',
    isActive: account.isActive,
  }
}

export function AccountsPage() {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [form, setForm] = useState<AccountFormValues>(defaultFormValues)

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
  })

  const createAccount = useMutation({
    mutationFn: () => accountApi.create(toPayload(form)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳戶已建立' })
      closeModal()
      await invalidateAccountQueries(queryClient)
    },
  })

  const updateAccount = useMutation({
    mutationFn: () => accountApi.update(editingAccountId ?? '', toPayload(form)),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳戶已更新' })
      closeModal()
      await invalidateAccountQueries(queryClient)
    },
  })

  const deleteAccount = useMutation({
    mutationFn: (accountId: string) => accountApi.delete(accountId),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳戶已刪除' })
      await invalidateAccountQueries(queryClient)
    },
  })

  function closeModal() {
    setOpened(false)
    setEditingAccountId(null)
    setForm(defaultFormValues)
  }

  function openCreateModal() {
    setEditingAccountId(null)
    setForm(defaultFormValues)
    setOpened(true)
  }

  function openEditModal(account: Account) {
    setEditingAccountId(account.id)
    setForm(toFormValues(account))
    setOpened(true)
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="帳戶"
        description="管理現金、銀行、投資、信用卡與貸款帳戶，所有金額以 minor units 儲存。"
        action={<Button onClick={openCreateModal}>新增帳戶</Button>}
      />

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>名稱</Table.Th>
              <Table.Th>類型</Table.Th>
              <Table.Th>餘額</Table.Th>
              <Table.Th>狀態</Table.Th>
              <Table.Th>操作</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.data?.map((account) => (
              <Table.Tr key={account.id}>
                <Table.Td>{account.name}</Table.Td>
                <Table.Td>{account.type}</Table.Td>
                <Table.Td>{formatMinorUnits(account.balanceMinor, account.currency)}</Table.Td>
                <Table.Td>{account.isActive ? '啟用' : '停用'}</Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      variant="light"
                      size="compact-sm"
                      onClick={() => openEditModal(account)}
                    >
                      編輯
                    </Button>
                    <Button
                      color="red"
                      variant="subtle"
                      size="compact-sm"
                      loading={deleteAccount.isPending}
                      onClick={() => deleteAccount.mutate(account.id)}
                    >
                      刪除
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal
        opened={opened}
        onClose={closeModal}
        title={editingAccountId ? '編輯帳戶' : '新增帳戶'}
        centered
      >
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
            data={['cash', 'bank', 'investment', 'credit_card', 'loan', 'goal_fund']}
            value={form.type}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                type: (value as Account['type'] | null) ?? 'bank',
              }))
            }
          />
          <Select
            label="幣別"
            data={['TWD', 'JPY', 'USD', 'EUR', 'SEK', 'DKK', 'NOK']}
            value={form.currency}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                currency: (value as Account['currency'] | null) ?? 'TWD',
              }))
            }
          />
          <NumberInput
            label="餘額（minor）"
            value={form.balanceMinor}
            onChange={(value) =>
              setForm((current) => ({ ...current, balanceMinor: Number(value) || 0 }))
            }
          />
          <NumberInput
            label="信用額度（minor）"
            value={form.creditLimitMinor}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                creditLimitMinor: typeof value === 'number' ? value : '',
              }))
            }
          />
          <Group grow>
            <NumberInput
              label="結帳日"
              value={form.billingDay}
              min={1}
              max={31}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  billingDay: typeof value === 'number' ? value : '',
                }))
              }
            />
            <NumberInput
              label="繳款日"
              value={form.dueDay}
              min={1}
              max={31}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  dueDay: typeof value === 'number' ? value : '',
                }))
              }
            />
          </Group>
          <Switch
            label="啟用"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeModal}>
              取消
            </Button>
            <Button
              loading={createAccount.isPending || updateAccount.isPending}
              onClick={() => (editingAccountId ? updateAccount.mutate() : createAccount.mutate())}
            >
              {editingAccountId ? '儲存變更' : '建立帳戶'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

async function invalidateAccountQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}
