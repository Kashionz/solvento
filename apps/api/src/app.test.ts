import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPgliteDatabase, users } from '@cashpilot/db'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@cashpilot/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from './app'

describe('cashpilot api', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let sessionCookie = ''
  let registeredSessionCookie = ''
  let registeredUserId = ''

  beforeAll(async () => {
    app = await buildApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rejects unauthenticated account reads', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/accounts',
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns credential-friendly cors headers for auth preflight requests', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/register',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('logs in with the seeded demo user and returns a session cookie', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().user.email).toBe(DEMO_EMAIL)

    const cookie = response.cookies.find(
      (item: { name: string; value: string }) => item.name === 'cashpilot_session',
    )
    expect(cookie?.value).toBeTruthy()
    sessionCookie = `cashpilot_session=${cookie?.value ?? ''}`
  })

  it('returns seeded accounts for the authenticated user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().length).toBeGreaterThan(1)
  })

  it('registers a user, creates a session cookie, and seeds default categories', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'week2-user@cashpilot.app',
        password: 'week2pass123',
        displayName: 'Week 2 User',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json().user.email).toBe('week2-user@cashpilot.app')
    registeredUserId = response.json().user.id as string

    const cookie = response.cookies.find(
      (item: { name: string; value: string }) => item.name === 'cashpilot_session',
    )
    expect(cookie?.value).toBeTruthy()
    registeredSessionCookie = `cashpilot_session=${cookie?.value ?? ''}`

    const categoriesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/meta/categories',
      headers: {
        cookie: registeredSessionCookie,
      },
    })

    expect(categoriesResponse.statusCode).toBe(200)
    expect(categoriesResponse.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: registeredUserId,
          name: '薪資',
        }),
        expect.objectContaining({
          userId: registeredUserId,
          name: '房租',
        }),
      ]),
    )
  })

  it('rejects duplicate registration with a conflict response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        displayName: 'Duplicate Demo',
      },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().message).toBe('Email already registered')
  })

  it('rejects account patches that include protected ownership fields', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/accounts/acc-bank',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        name: '不應更新',
        userId: registeredUserId,
      },
    })

    expect(response.statusCode).toBe(400)

    const accountResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/accounts/acc-bank',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(accountResponse.statusCode).toBe(200)
    expect(accountResponse.json()).toEqual(
      expect.objectContaining({
        id: 'acc-bank',
        userId: 'usr-demo',
        name: '台新銀行',
      }),
    )
  })

  it('rejects transaction patches that include protected ownership fields', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/transactions/txn-salary-apr',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        note: '不應更新',
        userId: registeredUserId,
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('rejects recurring rule patches that include protected ownership fields', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/recurring-rules/rule-salary',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        name: '不應更新',
        userId: registeredUserId,
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('hides other users accounts from delete operations', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/accounts/acc-bank',
      headers: {
        cookie: registeredSessionCookie,
      },
    })

    expect(response.statusCode).toBe(404)
  })

  it('simulates installments for a bill and returns a recommendation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/installments/simulate',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        billId: 'bill-yushan-2026-05',
        eligibleAmountMinor: 1135000,
        nonInstallmentAmountMinor: 298700,
        aprBps: 1100,
        periods: 3,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().recommendation).toBe('recommended')
  })

  it('creates an installment plan and moves the bill into installment status', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/installments',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        billId: 'bill-yushan-2026-05',
        eligibleAmountMinor: 1135000,
        nonInstallmentAmountMinor: 298700,
        aprBps: 1100,
        periods: 3,
      },
    })

    expect(createResponse.statusCode).toBe(201)
    expect(createResponse.json().status).toBe('active')

    const billResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/bills?status=installment',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(billResponse.statusCode).toBe(200)
    expect(
      billResponse.json().some((bill: { id: string }) => bill.id === 'bill-yushan-2026-05'),
    ).toBe(true)
  })

  it('allows partial bill payments to move status to partial', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/bills/bill-rent-2026-05/payments',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        amountMinor: 500000,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: 'bill-rent-2026-05',
        paidAmountMinor: 500000,
        status: 'partial',
      }),
    )
  })

  it('allows users to delete their own bills', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/bills/bill-loan-2026-05',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(response.statusCode).toBe(204)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/bills',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(
      listResponse.json().some((bill: { id: string }) => bill.id === 'bill-loan-2026-05'),
    ).toBe(false)
  })

  it('returns all cashflow scenarios for dashboard comparisons', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/cashflow/scenarios',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        rangeDays: 180,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(
      expect.objectContaining({
        conservative: expect.objectContaining({
          scenario: 'conservative',
        }),
        base: expect.objectContaining({
          scenario: 'base',
        }),
        optimistic: expect.objectContaining({
          scenario: 'optimistic',
        }),
      }),
    )
  })

  it('creates and deletes a goal through the goals api', async () => {
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/goals',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        name: '日本旅行基金',
        targetAmountMinor: 5000000,
        currentAmountMinor: 250000,
        priority: 'medium',
        goalType: 'travel',
        monthlyContributionMinor: 150000,
        status: 'active',
      },
    })

    expect(createResponse.statusCode).toBe(201)
    const createdGoalId = createResponse.json().id as string

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/goals/${createdGoalId}`,
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(deleteResponse.statusCode).toBe(204)

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/goals',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(listResponse.statusCode).toBe(200)
    expect(listResponse.json().some((goal: { id: string }) => goal.id === createdGoalId)).toBe(
      false,
    )
  })

  it('exports a scoped backup payload for the authenticated user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/export',
      headers: {
        cookie: sessionCookie,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('application/json')
    expect(response.headers['content-disposition']).toContain('cashpilot-backup')
    expect(response.json()).toEqual(
      expect.objectContaining({
        version: '0.1.0',
        snapshot: expect.objectContaining({
          users: [expect.objectContaining({ id: 'usr-demo' })],
          accounts: expect.arrayContaining([expect.objectContaining({ userId: 'usr-demo' })]),
        }),
      }),
    )
  })

  it('persists created accounts across app restarts when using the database-backed store', async () => {
    const previousPgliteDir = process.env.CASHPILOT_PGLITE_DIR
    const pgliteDir = mkdtempSync(join(tmpdir(), 'cashpilot-pglite-'))
    process.env.CASHPILOT_PGLITE_DIR = pgliteDir

    const firstApp = await buildApp()

    try {
      const loginResponse = await firstApp.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        },
      })
      const cookie = loginResponse.cookies.find(
        (item: { name: string; value: string }) => item.name === 'cashpilot_session',
      )
      const firstSessionCookie = `cashpilot_session=${cookie?.value ?? ''}`

      const createResponse = await firstApp.inject({
        method: 'POST',
        url: '/api/v1/accounts',
        headers: {
          cookie: firstSessionCookie,
        },
        payload: {
          name: '跨重啟測試帳戶',
          type: 'bank',
          currency: 'TWD',
          balanceMinor: 990000,
          isActive: true,
        },
      })

      expect(createResponse.statusCode).toBe(201)
    } finally {
      await firstApp.close()
    }

    const secondApp = await buildApp()

    try {
      const secondLoginResponse = await secondApp.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        },
      })
      const secondCookie = secondLoginResponse.cookies.find(
        (item: { name: string; value: string }) => item.name === 'cashpilot_session',
      )
      const secondSessionCookie = `cashpilot_session=${secondCookie?.value ?? ''}`

      const listResponse = await secondApp.inject({
        method: 'GET',
        url: '/api/v1/accounts',
        headers: {
          cookie: secondSessionCookie,
        },
      })

      expect(listResponse.statusCode).toBe(200)
      expect(
        listResponse.json().some((account: { name: string }) => account.name === '跨重啟測試帳戶'),
      ).toBe(true)
    } finally {
      await secondApp.close()
      if (previousPgliteDir) {
        process.env.CASHPILOT_PGLITE_DIR = previousPgliteDir
      } else {
        delete process.env.CASHPILOT_PGLITE_DIR
      }
      rmSync(pgliteDir, { force: true, recursive: true })
    }
  })

  it('backfills the demo password hash into a legacy persisted snapshot', async () => {
    const previousPgliteDir = process.env.CASHPILOT_PGLITE_DIR
    const pgliteDir = mkdtempSync(join(tmpdir(), 'cashpilot-pglite-'))
    process.env.CASHPILOT_PGLITE_DIR = pgliteDir

    const seededApp = await buildApp()
    await seededApp.close()

    const legacyConnection = await createPgliteDatabase(pgliteDir)
    await legacyConnection.db.update(users).set({ passwordHash: null })
    await legacyConnection.client.close()

    const recoveredApp = await buildApp()
    await recoveredApp.close()

    const verifyConnection = await createPgliteDatabase(pgliteDir)
    const [demoUser] = await verifyConnection.db.select().from(users)

    try {
      expect(demoUser?.passwordHash).toBeTruthy()
    } finally {
      await verifyConnection.client.close()
      if (previousPgliteDir) {
        process.env.CASHPILOT_PGLITE_DIR = previousPgliteDir
      } else {
        delete process.env.CASHPILOT_PGLITE_DIR
      }
      rmSync(pgliteDir, { force: true, recursive: true })
    }
  })
})
