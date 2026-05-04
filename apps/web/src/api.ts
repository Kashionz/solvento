import type {
  Account,
  Bill,
  CashflowProjection,
  Category,
  DashboardSummary,
  DecisionHistoryItem,
  Goal,
  InstallmentPlan,
  InstallmentQuoteInput,
  InstallmentSimulationResult,
  PurchaseDecisionInput,
  PurchaseDecisionResult,
  RecurringRule,
  Transaction,
  TravelDecisionInput,
  TravelDecisionResult,
} from '@cashpilot/shared'

export type AuthUser = {
  id: string
  email: string
  displayName: string
}

export type GoalWithForecast = Goal & {
  forecast: {
    months: number | null
    targetMonth: string | null
  }
}

type ApiOptions = RequestInit & {
  bodyJson?: unknown
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const API_BASE = '/api/v1'

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
    body: options.bodyJson ? JSON.stringify(options.bodyJson) : options.body,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      typeof payload?.message === 'string' ? payload.message : 'Request failed',
      response.status,
    )
  }

  return payload as T
}

export const authApi = {
  me: () => apiRequest<{ user: AuthUser }>('/auth/me'),
  login: (email: string, password: string) =>
    apiRequest<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      bodyJson: { email, password },
    }),
  logout: () =>
    apiRequest<{ ok: boolean }>('/auth/logout', {
      method: 'POST',
    }),
}

export const cashflowApi = {
  summary: () => apiRequest<DashboardSummary>('/cashflow/summary'),
  projection: (rangeDays: number, scenario: 'conservative' | 'base' | 'optimistic') =>
    apiRequest<CashflowProjection>(
      `/cashflow/projection?rangeDays=${rangeDays}&scenario=${scenario}`,
    ),
  recalculate: () =>
    apiRequest<{
      projection: CashflowProjection
      recommendations: DashboardSummary['recommendations']
    }>('/cashflow/recalculate', {
      method: 'POST',
    }),
}

export const installmentApi = {
  list: () => apiRequest<InstallmentPlan[]>('/installments'),
  simulate: (payload: InstallmentQuoteInput) =>
    apiRequest<InstallmentSimulationResult>('/installments/simulate', {
      method: 'POST',
      bodyJson: payload,
    }),
  create: (payload: InstallmentQuoteInput) =>
    apiRequest<InstallmentPlan>('/installments', {
      method: 'POST',
      bodyJson: payload,
    }),
}

export const decisionApi = {
  history: () => apiRequest<DecisionHistoryItem[]>('/decisions/history'),
  purchase: (payload: PurchaseDecisionInput) =>
    apiRequest<PurchaseDecisionResult>('/decisions/purchase', {
      method: 'POST',
      bodyJson: payload,
    }),
  travel: (payload: TravelDecisionInput) =>
    apiRequest<TravelDecisionResult>('/decisions/travel', {
      method: 'POST',
      bodyJson: payload,
    }),
}

export const accountApi = {
  list: () => apiRequest<Account[]>('/accounts'),
}

export const transactionApi = {
  list: () => apiRequest<Transaction[]>('/transactions'),
}

export const billApi = {
  list: () => apiRequest<Bill[]>('/bills'),
}

export const goalApi = {
  list: () => apiRequest<GoalWithForecast[]>('/goals'),
}

export const metadataApi = {
  categories: () => apiRequest<Category[]>('/meta/categories'),
}

export const recurringRuleApi = {
  list: () => apiRequest<RecurringRule[]>('/recurring-rules'),
}
