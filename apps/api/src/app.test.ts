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
})
