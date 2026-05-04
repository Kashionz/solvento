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
import { accountApi, apiRequest } from '../api'
import { PageHeader } from '../components/page-header'

export function AccountsPage() {
  const queryClient = useQueryClient()
  const [opened, setOpened] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'bank',
    currency: 'TWD',
    balanceMinor: 0,
    creditLimitMinor: 0,
    isActive: true,
  })

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountApi.list(),
  })

  const createAccount = useMutation({
    mutationFn: () =>
      apiRequest('/accounts', {
        method: 'POST',
        bodyJson: form,
      }),
    onSuccess: async () => {
      notifications.show({ color: 'green', message: '帳戶已建立' })
      setOpened(false)
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <Stack gap="xl">
      <PageHeader
        title="帳戶"
        description="管理現金、銀行、投資、信用卡與貸款帳戶，所有金額以 minor units 儲存。"
        action={<Button onClick={() => setOpened(true)}>新增帳戶</Button>}
      />

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>名稱</Table.Th>
              <Table.Th>類型</Table.Th>
              <Table.Th>餘額</Table.Th>
              <Table.Th>狀態</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.data?.map((account: Account) => (
              <Table.Tr key={account.id}>
                <Table.Td>{account.name}</Table.Td>
                <Table.Td>{account.type}</Table.Td>
                <Table.Td>{formatMinorUnits(account.balanceMinor, account.currency)}</Table.Td>
                <Table.Td>{account.isActive ? '啟用' : '停用'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Modal opened={opened} onClose={() => setOpened(false)} title="新增帳戶" centered>
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
            onChange={(value) => setForm((current) => ({ ...current, type: value ?? 'bank' }))}
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
              setForm((current) => ({ ...current, creditLimitMinor: Number(value) || 0 }))
            }
          />
          <Switch
            label="啟用"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))
            }
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setOpened(false)}>
              取消
            </Button>
            <Button loading={createAccount.isPending} onClick={() => createAccount.mutate()}>
              儲存
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
