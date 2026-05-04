import { Button, Paper, Stack, Switch, Text, Title } from '@mantine/core'

import type { AuthUser } from '../api'
import { PageHeader } from '../components/page-header'

export function SettingsPage({
  user,
  darkMode,
  onToggleDarkMode,
  onLogout,
}: {
  user: AuthUser
  darkMode: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
}) {
  return (
    <Stack gap="xl">
      <PageHeader title="設定" description="管理使用者資訊、主題與 Demo 工作環境。" />

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack>
          <Title order={4}>使用者</Title>
          <Text>{user.displayName}</Text>
          <Text c="dimmed">{user.email}</Text>
        </Stack>
      </Paper>

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack>
          <Title order={4}>外觀</Title>
          <Switch checked={darkMode} label="深色模式" onChange={onToggleDarkMode} />
        </Stack>
      </Paper>

      <Button color="red" variant="light" onClick={onLogout}>
        登出
      </Button>
    </Stack>
  )
}
