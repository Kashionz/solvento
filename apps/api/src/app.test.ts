import { DEMO_EMAIL, DEMO_PASSWORD } from '@cashpilot/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildApp } from './app'

describe('cashpilot api', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let sessionCookie = ''

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
})
