import {
  buildDashboardSummary,
  buildRecommendations,
  evaluatePurchaseDecision,
  evaluateTravelDecision,
  forecastGoalCompletion,
  materializeInstallmentPlan,
  projectCashflow,
  simulateInstallment,
} from '@cashpilot/rules'
import {
  APP_TODAY,
  accountInputSchema,
  accountUpdateSchema,
  type Bill,
  billInputSchema,
  billUpdateSchema,
  type Goal,
  goalInputSchema,
  installmentInputSchema,
  loginSchema,
  projectionQuerySchema,
  purchaseDecisionInputSchema,
  type RecurringRule,
  recurringRuleInputSchema,
  recurringRuleUpdateSchema,
  registerSchema,
  scenarioComparisonSchema,
  type Transaction,
  transactionInputSchema,
  transactionUpdateSchema,
  travelDecisionInputSchema,
} from '@cashpilot/shared'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import type { FastifyReply, FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import type { z } from 'zod'

import { DuplicateEmailError, MemoryStore } from './store'

function parseBody<T>(schema: z.ZodType<T>, body: unknown) {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.flatten(),
    }
  }

  return {
    ok: true as const,
    data: parsed.data,
  }
}

export async function buildApp() {
  const store = await MemoryStore.create()
  const app = Fastify({
    logger: false,
    bodyLimit: 1024 * 1024,
  })
  app.addHook('onClose', async () => {
    await store.close()
  })

  await app.register(cookie, {
    secret: 'cashpilot-dev-secret',
  })
  await app.register(cors, {
    origin: ['http://localhost:3000'],
    credentials: true,
  })
  await app.register(helmet)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CashPilot API',
        version: '0.1.0',
      },
    },
  })
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  })

  function requireUserId(request: Pick<FastifyRequest, 'cookies'>, reply: FastifyReply) {
    const user = store.getUserBySession(request.cookies.cashpilot_session)
    if (!user) {
      void reply.code(401).send({
        message: 'Unauthorized',
      })
      return null
    }
    return user.id
  }

  function setSessionCookie(reply: FastifyReply, token: string) {
    reply.setCookie('cashpilot_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    })
  }

  app.get('/health', async () => ({
    ok: true,
  }))

  app.post('/api/v1/auth/register', async (request, reply) => {
    const body = parseBody(registerSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    try {
      const user = await store.register(body.data.email, body.data.password, body.data.displayName)
      setSessionCookie(reply, store.createSession(user.id))

      return reply.code(201).send({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
      })
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        return reply.code(409).send({
          message: error.message,
        })
      }

      throw error
    }
  })

  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = parseBody(loginSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const result = await store.login(body.data.email, body.data.password)
    if (!result) {
      return reply.code(401).send({
        message: 'Invalid credentials',
      })
    }

    setSessionCookie(reply, result.token)

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
      },
    }
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    store.logout(request.cookies.cashpilot_session)
    reply.clearCookie('cashpilot_session', {
      path: '/',
    })
    return {
      ok: true,
    }
  })

  app.get('/api/v1/auth/me', async (request, reply) => {
    const user = store.getUserBySession(request.cookies.cashpilot_session)
    if (!user) {
      return reply.code(401).send({
        message: 'Unauthorized',
      })
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    }
  })

  app.get('/api/v1/accounts', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    return store.listAccounts(userId)
  })

  app.post('/api/v1/accounts', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(accountInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    return reply.code(201).send(await store.createAccount(userId, body.data))
  })

  app.get('/api/v1/accounts/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const account = store.getAccount(userId, (request.params as { id: string }).id)
    if (!account) {
      return reply.code(404).send({ message: 'Account not found' })
    }
    return account
  })

  app.patch('/api/v1/accounts/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(accountUpdateSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const account = await store.updateAccount(
      userId,
      (request.params as { id: string }).id,
      body.data,
    )
    if (!account) {
      return reply.code(404).send({ message: 'Account not found' })
    }
    return account
  })

  app.delete('/api/v1/accounts/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const deleted = await store.deleteAccount(userId, (request.params as { id: string }).id)
    return reply
      .code(deleted ? 204 : 404)
      .send(deleted ? undefined : { message: 'Account not found' })
  })

  app.get('/api/v1/transactions', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const query = request.query as { from?: string; to?: string }
    return store.listTransactions(userId, query.from, query.to)
  })

  app.post('/api/v1/transactions', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(transactionInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    return reply.code(201).send(await store.createTransaction(userId, body.data))
  })

  app.patch('/api/v1/transactions/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(transactionUpdateSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const transaction = await store.updateTransaction(
      userId,
      (request.params as { id: string }).id,
      body.data as Partial<Transaction>,
    )
    if (!transaction) {
      return reply.code(404).send({ message: 'Transaction not found' })
    }
    return transaction
  })

  app.delete('/api/v1/transactions/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const deleted = await store.deleteTransaction(userId, (request.params as { id: string }).id)
    return reply
      .code(deleted ? 204 : 404)
      .send(deleted ? undefined : { message: 'Transaction not found' })
  })

  app.get('/api/v1/recurring-rules', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    return store.listRecurringRules(userId)
  })

  app.post('/api/v1/recurring-rules', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(recurringRuleInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    return reply.code(201).send(await store.createRecurringRule(userId, body.data))
  })

  app.patch('/api/v1/recurring-rules/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(recurringRuleUpdateSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const rule = await store.updateRecurringRule(
      userId,
      (request.params as { id: string }).id,
      body.data as Partial<RecurringRule>,
    )
    if (!rule) {
      return reply.code(404).send({ message: 'Recurring rule not found' })
    }
    return rule
  })

  app.delete('/api/v1/recurring-rules/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const deleted = await store.deleteRecurringRule(userId, (request.params as { id: string }).id)
    return reply
      .code(deleted ? 204 : 404)
      .send(deleted ? undefined : { message: 'Recurring rule not found' })
  })

  app.get('/api/v1/bills', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const query = request.query as { status?: 'unpaid' | 'partial' | 'paid' | 'installment' }
    return store.listBills(userId, query.status)
  })

  app.post('/api/v1/bills', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(billInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    return reply.code(201).send(await store.createBill(userId, body.data))
  })

  app.get('/api/v1/bills/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const bill = store.getBill(userId, (request.params as { id: string }).id)
    if (!bill) {
      return reply.code(404).send({ message: 'Bill not found' })
    }
    return bill
  })

  app.patch('/api/v1/bills/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(billUpdateSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const bill = await store.updateBill(
      userId,
      (request.params as { id: string }).id,
      body.data as Partial<Bill>,
    )
    if (!bill) {
      return reply.code(404).send({ message: 'Bill not found' })
    }
    return bill
  })

  app.delete('/api/v1/bills/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const deleted = await store.deleteBill(userId, (request.params as { id: string }).id)
    return reply.code(deleted ? 204 : 404).send(deleted ? undefined : { message: 'Bill not found' })
  })

  app.post('/api/v1/bills/:id/payments', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const amountMinor = Number((request.body as { amountMinor?: number }).amountMinor ?? 0)
    if (amountMinor <= 0) {
      return reply.code(400).send({ message: 'amountMinor must be positive' })
    }

    const bill = await store.addBillPayment(
      userId,
      (request.params as { id: string }).id,
      amountMinor,
    )
    if (!bill) {
      return reply.code(404).send({ message: 'Bill not found' })
    }
    return bill
  })

  app.post('/api/v1/bills/:id/mark-paid', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const bill = await store.markBillPaid(userId, (request.params as { id: string }).id)
    if (!bill) {
      return reply.code(404).send({ message: 'Bill not found' })
    }
    return bill
  })

  app.post('/api/v1/installments/simulate', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(installmentInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 90,
      scenario: 'conservative',
      referenceDate: '2026-05-04',
    })

    return simulateInstallment(snapshot, body.data, projection)
  })

  app.post('/api/v1/installments', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(installmentInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    const plan = materializeInstallmentPlan(snapshot, body.data, '2026-05-04')
    await store.addInstallmentPlan(plan)
    await store.updateBill(userId, body.data.billId, {
      status: 'installment',
      totalAmountMinor: body.data.nonInstallmentAmountMinor,
      nonInstallmentAmountMinor: body.data.nonInstallmentAmountMinor,
      installmentEligibleAmountMinor: 0,
      canInstallment: false,
    })

    return reply.code(201).send(plan)
  })

  app.get('/api/v1/installments', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    return store.listInstallmentPlans(userId)
  })

  app.get('/api/v1/installments/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const plan = store.getInstallmentPlan(userId, (request.params as { id: string }).id)
    if (!plan) {
      return reply.code(404).send({ message: 'Installment not found' })
    }
    return plan
  })

  app.post('/api/v1/installments/:id/cancel', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const plan = await store.cancelInstallmentPlan(userId, (request.params as { id: string }).id)
    if (!plan) {
      return reply.code(404).send({ message: 'Installment not found' })
    }
    return plan
  })

  app.get('/api/v1/cashflow/projection', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const query = parseBody(projectionQuerySchema, request.query)
    if (!query.ok) {
      return reply.code(400).send(query.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    return projectCashflow(snapshot, {
      ...query.data,
      referenceDate: '2026-05-04',
    })
  })

  app.post('/api/v1/cashflow/scenarios', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(scenarioComparisonSchema, request.body ?? {})
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    return {
      conservative: projectCashflow(snapshot, {
        rangeDays: body.data.rangeDays,
        scenario: 'conservative',
        referenceDate: '2026-05-04',
      }),
      base: projectCashflow(snapshot, {
        rangeDays: body.data.rangeDays,
        scenario: 'base',
        referenceDate: '2026-05-04',
      }),
      optimistic: projectCashflow(snapshot, {
        rangeDays: body.data.rangeDays,
        scenario: 'optimistic',
        referenceDate: '2026-05-04',
      }),
    }
  })

  app.post('/api/v1/cashflow/recalculate', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 90,
      scenario: 'base',
      referenceDate: '2026-05-04',
    })
    return {
      projection,
      recommendations: buildRecommendations(snapshot, projection),
    }
  })

  app.get('/api/v1/cashflow/summary', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 90,
      scenario: 'base',
      referenceDate: '2026-05-04',
    })
    return buildDashboardSummary(snapshot, projection)
  })

  app.get('/api/v1/goals', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 90,
      scenario: 'base',
      referenceDate: '2026-05-04',
    })
    const availableMonthlyMinor = Math.max(0, projection.safeToSpendMinor)

    return store.listGoals(userId).map((goal) => ({
      ...goal,
      forecast: forecastGoalCompletion(goal, availableMonthlyMinor),
    }))
  })

  app.post('/api/v1/goals', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(goalInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    return reply.code(201).send(await store.createGoal(userId, body.data))
  })

  app.patch('/api/v1/goals/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const goal = await store.updateGoal(
      userId,
      (request.params as { id: string }).id,
      request.body as Partial<Goal>,
    )
    if (!goal) {
      return reply.code(404).send({ message: 'Goal not found' })
    }
    return goal
  })

  app.post('/api/v1/goals/:id/contributions', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const amountMinor = Number((request.body as { amountMinor?: number }).amountMinor ?? 0)
    if (amountMinor <= 0) {
      return reply.code(400).send({ message: 'amountMinor must be positive' })
    }

    const goal = await store.contributeGoal(
      userId,
      (request.params as { id: string }).id,
      amountMinor,
    )
    if (!goal) {
      return reply.code(404).send({ message: 'Goal not found' })
    }
    return goal
  })

  app.post('/api/v1/goals/:id/pause', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const goal = await store.updateGoal(userId, (request.params as { id: string }).id, {
      status: 'paused',
    })
    if (!goal) {
      return reply.code(404).send({ message: 'Goal not found' })
    }
    return goal
  })

  app.post('/api/v1/goals/:id/complete', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const goal = await store.updateGoal(userId, (request.params as { id: string }).id, {
      status: 'completed',
    })
    if (!goal) {
      return reply.code(404).send({ message: 'Goal not found' })
    }
    return goal
  })

  app.delete('/api/v1/goals/:id', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const deleted = await store.deleteGoal(userId, (request.params as { id: string }).id)
    return reply.code(deleted ? 204 : 404).send(deleted ? undefined : { message: 'Goal not found' })
  })

  app.post('/api/v1/decisions/purchase', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(purchaseDecisionInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 90,
      scenario: 'base',
      referenceDate: '2026-05-04',
    })
    const decision = evaluatePurchaseDecision(snapshot, body.data, projection)
    await store.appendDecisionHistory(userId, {
      type: 'purchase',
      name: body.data.name,
      verdict: decision.verdict,
      payload: body.data,
    })
    return decision
  })

  app.post('/api/v1/decisions/travel', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(travelDecisionInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 180,
      scenario: 'base',
      referenceDate: '2026-05-04',
    })
    const decision = evaluateTravelDecision(snapshot, body.data, projection)
    await store.appendDecisionHistory(userId, {
      type: 'travel',
      name: body.data.name,
      verdict: decision.verdict,
      payload: body.data,
    })
    return decision
  })

  app.post('/api/v1/decisions/custom', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    const body = parseBody(purchaseDecisionInputSchema, request.body)
    if (!body.ok) {
      return reply.code(400).send(body.error)
    }

    const snapshot = store.getScopedSnapshot(userId)
    const projection = projectCashflow(snapshot, {
      rangeDays: 90,
      scenario: 'base',
      referenceDate: '2026-05-04',
    })
    const decision = evaluatePurchaseDecision(snapshot, body.data, projection)
    await store.appendDecisionHistory(userId, {
      type: 'purchase',
      name: body.data.name,
      verdict: decision.verdict,
      payload: body.data,
    })
    return decision
  })

  app.get('/api/v1/decisions/history', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    return store.listDecisionHistory(userId)
  })

  app.get('/api/v1/export', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    reply.header(
      'content-disposition',
      `attachment; filename="cashpilot-backup-${APP_TODAY}-${userId}.json"`,
    )

    return {
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      snapshot: store.getScopedSnapshot(userId),
    }
  })

  app.get('/api/v1/meta/categories', async (request, reply) => {
    const userId = requireUserId(request, reply)
    if (!userId) {
      return
    }

    return store.listCategories(userId)
  })

  return app
}
