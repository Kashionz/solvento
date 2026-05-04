import type {
  DecisionHistoryItem,
  PurchaseDecisionResult,
  TravelDecisionResult,
} from '@cashpilot/shared'
import { formatMinorUnits } from '@cashpilot/shared'
import {
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { decisionApi } from '../api'
import { PageHeader } from '../components/page-header'

export function DecisionsPage() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'purchase' | 'travel'>('purchase')
  const [purchaseForm, setPurchaseForm] = useState({
    name: 'Roland FP-30X',
    priceMinor: 2500000,
    category: 'instrument',
    alternativeName: '租琴房',
    alternativeUnitCostMinor: 16000,
    unitPerWeek: 2,
    durationMonths: 12,
  })
  const [travelForm, setTravelForm] = useState({
    name: '北歐獨旅',
    estimatedTripCostMinor: 12000000,
  })
  const [decision, setDecision] = useState<PurchaseDecisionResult | TravelDecisionResult | null>(
    null,
  )

  const history = useQuery({
    queryKey: ['decision-history'],
    queryFn: () => decisionApi.history(),
  })

  const submitPurchase = useMutation({
    mutationFn: () =>
      decisionApi.purchase({
        name: purchaseForm.name,
        priceMinor: purchaseForm.priceMinor,
        category: purchaseForm.category as 'instrument',
        alternative: {
          name: purchaseForm.alternativeName,
          unitCostMinor: purchaseForm.alternativeUnitCostMinor,
          unit: 'hour',
        },
        expectedUsage: {
          unitPerWeek: purchaseForm.unitPerWeek,
          durationMonths: purchaseForm.durationMonths,
        },
      }),
    onSuccess: async (data) => {
      setDecision(data)
      await queryClient.invalidateQueries({ queryKey: ['decision-history'] })
    },
  })

  const submitTravel = useMutation({
    mutationFn: () => decisionApi.travel(travelForm),
    onSuccess: async (data) => {
      setDecision(data)
      await queryClient.invalidateQueries({ queryKey: ['decision-history'] })
    },
  })

  return (
    <Stack gap="xl">
      <PageHeader title="決策" description="把『可不可以買』從主觀直覺改成可驗證的現金流判斷。" />

      <SegmentedControl
        data={[
          { label: '購買', value: 'purchase' },
          { label: '旅行', value: 'travel' },
        ]}
        value={mode}
        onChange={(value) => setMode((value as typeof mode) ?? 'purchase')}
      />

      {mode === 'purchase' ? (
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <TextInput
              label="品項"
              value={purchaseForm.name}
              onChange={(event) => {
                const { value } = event.currentTarget
                setPurchaseForm((current) => ({ ...current, name: value }))
              }}
            />
            <NumberInput
              label="價格（minor）"
              value={purchaseForm.priceMinor}
              onChange={(value) =>
                setPurchaseForm((current) => ({ ...current, priceMinor: Number(value) || 0 }))
              }
            />
            <NumberInput
              label="替代方案單價（minor）"
              value={purchaseForm.alternativeUnitCostMinor}
              onChange={(value) =>
                setPurchaseForm((current) => ({
                  ...current,
                  alternativeUnitCostMinor: Number(value) || 0,
                }))
              }
            />
            <Group grow>
              <NumberInput
                label="每週使用量"
                value={purchaseForm.unitPerWeek}
                onChange={(value) =>
                  setPurchaseForm((current) => ({ ...current, unitPerWeek: Number(value) || 0 }))
                }
              />
              <NumberInput
                label="預估月數"
                value={purchaseForm.durationMonths}
                onChange={(value) =>
                  setPurchaseForm((current) => ({
                    ...current,
                    durationMonths: Number(value) || 0,
                  }))
                }
              />
            </Group>
            <Button loading={submitPurchase.isPending} onClick={() => submitPurchase.mutate()}>
              執行購買決策
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <TextInput
              label="旅行名稱"
              value={travelForm.name}
              onChange={(event) => {
                const { value } = event.currentTarget
                setTravelForm((current) => ({ ...current, name: value }))
              }}
            />
            <NumberInput
              label="預估旅費（minor）"
              value={travelForm.estimatedTripCostMinor}
              onChange={(value) =>
                setTravelForm((current) => ({
                  ...current,
                  estimatedTripCostMinor: Number(value) || 0,
                }))
              }
            />
            <Button loading={submitTravel.isPending} onClick={() => submitTravel.mutate()}>
              執行旅行判斷
            </Button>
          </Stack>
        </Paper>
      )}

      {decision ? (
        <Paper className="cashpilot-surface" p="lg" radius="xl">
          <Stack>
            <Title order={4}>決策結果：{decision.verdict}</Title>
            {'remainingCashAfterPurchaseMinor' in decision ? (
              <Text>購買後現金：{formatMinorUnits(decision.remainingCashAfterPurchaseMinor)}</Text>
            ) : (
              <Text>所需旅遊基金：{formatMinorUnits(decision.requiredTravelFundMinor)}</Text>
            )}
            {decision.reasons.map((reason) => (
              <Text key={reason} c="dimmed">
                • {reason}
              </Text>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Paper className="cashpilot-surface" p="lg" radius="xl">
        <Stack>
          <Title order={4}>決策歷史</Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>時間</Table.Th>
                <Table.Th>名稱</Table.Th>
                <Table.Th>類型</Table.Th>
                <Table.Th>結論</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(history.data ?? []).map((item: DecisionHistoryItem) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{item.createdAt.slice(0, 10)}</Table.Td>
                  <Table.Td>{item.name}</Table.Td>
                  <Table.Td>{item.type}</Table.Td>
                  <Table.Td>{item.verdict}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      </Paper>
    </Stack>
  )
}
