import type { RiskLevel } from '@cashpilot/shared'
import { Badge } from '@mantine/core'

const COLOR_MAP: Record<RiskLevel, string> = {
  safe: 'green',
  watch: 'yellow',
  warning: 'orange',
  critical: 'red',
}

const LABEL_MAP: Record<RiskLevel, string> = {
  safe: '安全',
  watch: '注意',
  warning: '風險',
  critical: '危險',
}

export function StatusPill({ riskLevel }: { riskLevel: RiskLevel }) {
  return (
    <Badge color={COLOR_MAP[riskLevel]} radius="xl" size="lg" variant="light">
      {LABEL_MAP[riskLevel]}
    </Badge>
  )
}
