import { Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Group align="end" justify="space-between" wrap="wrap">
      <Stack gap={4}>
        <Text c="dimmed" ff="monospace" fz="xs" tt="uppercase">
          CashPilot
        </Text>
        <Title order={2}>{title}</Title>
        <Text c="dimmed" maw={640}>
          {description}
        </Text>
      </Stack>
      {action}
    </Group>
  )
}
