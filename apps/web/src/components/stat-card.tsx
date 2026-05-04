import { Paper, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string
  value: ReactNode
  helper?: ReactNode
  accent?: ReactNode
}) {
  return (
    <Paper className="cashpilot-surface" p="lg" radius="xl">
      <Stack gap="xs">
        <Text c="dimmed" ff="monospace" fz="xs" tt="uppercase">
          {label}
        </Text>
        <Title order={2}>{value}</Title>
        {helper ? (
          <Text c="dimmed" fz="sm">
            {helper}
          </Text>
        ) : null}
        {accent}
      </Stack>
    </Paper>
  )
}
