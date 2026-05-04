import { Button, Card, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ApiError, authApi } from '../api'

export function LoginPage() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('demo@cashpilot.app')
  const [password, setPassword] = useState('demo123456')

  const login = useMutation({
    mutationFn: () => authApi.login(email, password),
    onSuccess: async () => {
      notifications.show({
        color: 'green',
        message: '已登入 Demo 帳號',
      })
      await queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        message: error instanceof ApiError ? error.message : '登入失敗',
      })
    },
  })

  return (
    <div className="login-screen">
      <Card className="cashpilot-surface" p="xl" radius="xl" w="100%" maw={420}>
        <Stack gap="lg">
          <Stack gap={4}>
            <Text c="dimmed" ff="monospace" fz="xs" tt="uppercase">
              CashPilot
            </Text>
            <Title order={1}>現金流決策工作台</Title>
            <Text c="dimmed">
              使用規格內的 demo 帳號登入，直接體驗帳單、現金流、分期與購買決策。
            </Text>
          </Stack>

          <TextInput
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <Button loading={login.isPending} onClick={() => login.mutate()} size="md">
            登入 Demo
          </Button>

          <Group c="dimmed" fz="sm" justify="space-between">
            <span>demo@cashpilot.app</span>
            <span>demo123456</span>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
