import { z } from 'zod'

import { accountTypes, currencies, riskLevels, scenarios } from './domain'

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
})

export const accountInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(accountTypes),
  currency: z.enum(currencies),
  balanceMinor: z.number().int(),
  creditLimitMinor: z.number().int().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().default(true),
})

export const transactionInputSchema = z.object({
  accountId: z.string(),
  date: z.string(),
  amountMinor: z.number().int().positive(),
  direction: z.enum(['income', 'expense', 'transfer_in', 'transfer_out']),
  categoryId: z.string(),
  note: z.string().optional(),
  merchant: z.string().optional(),
  relatedBillId: z.string().optional(),
  isRecurring: z.boolean().default(false),
})

export const billInputSchema = z.object({
  accountId: z.string().optional(),
  name: z.string().min(1),
  billType: z.enum(['credit_card', 'rent', 'loan', 'utility', 'subscription', 'other']),
  statementMonth: z.string().optional(),
  totalAmountMinor: z.number().int().positive(),
  paidAmountMinor: z.number().int().nonnegative().default(0),
  dueDate: z.string(),
  status: z.enum(['unpaid', 'partial', 'paid', 'installment']).default('unpaid'),
  canInstallment: z.boolean().default(false),
  nonInstallmentAmountMinor: z.number().int().nonnegative().optional(),
  installmentEligibleAmountMinor: z.number().int().nonnegative().optional(),
})

export const recurringRuleInputSchema = z.object({
  name: z.string().min(1),
  amountMinor: z.number().int().positive(),
  direction: z.enum(['income', 'expense']),
  accountId: z.string().optional(),
  paymentAccountId: z.string().optional(),
  categoryId: z.string(),
  frequency: z.enum(['monthly', 'weekly', 'yearly', 'custom']),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  uncertainty: z.enum(['fixed', 'variable_date', 'variable_amount']),
  includeInBaseScenario: z.boolean().default(true),
  startDate: z.string(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const installmentInputSchema = z.object({
  billId: z.string(),
  eligibleAmountMinor: z.number().int().positive(),
  nonInstallmentAmountMinor: z.number().int().nonnegative(),
  aprBps: z.number().int().nonnegative(),
  periods: z.number().int().min(2).max(36),
  firstPaymentMinor: z.number().int().positive().optional(),
  totalInterestMinor: z.number().int().nonnegative().optional(),
  payments: z
    .array(
      z.object({
        period: z.number().int().min(1),
        principalMinor: z.number().int().nonnegative(),
        interestMinor: z.number().int().nonnegative(),
        totalMinor: z.number().int().positive(),
        dueDate: z.string().optional(),
      }),
    )
    .optional(),
})

export const goalInputSchema = z.object({
  name: z.string().min(1),
  targetAmountMinor: z.number().int().positive(),
  currentAmountMinor: z.number().int().nonnegative(),
  deadline: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
  goalType: z.enum(['emergency_fund', 'travel', 'purchase', 'debt_payoff', 'investment']),
  monthlyContributionMinor: z.number().int().nonnegative().optional(),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).default('active'),
})

export const purchaseDecisionInputSchema = z.object({
  name: z.string().min(1),
  priceMinor: z.number().int().positive(),
  category: z.enum(['instrument', 'travel', 'electronics', 'subscription', 'other']),
  purchaseDate: z.string().optional(),
  alternative: z
    .object({
      name: z.string().min(1),
      unitCostMinor: z.number().int().positive(),
      unit: z.enum(['hour', 'day', 'month']),
    })
    .optional(),
  expectedUsage: z
    .object({
      unitPerWeek: z.number().positive().optional(),
      durationMonths: z.number().positive().optional(),
    })
    .optional(),
})

export const travelDecisionInputSchema = z.object({
  name: z.string().min(1),
  estimatedTripCostMinor: z.number().int().positive(),
})

export const projectionQuerySchema = z.object({
  rangeDays: z.coerce.number().int().min(14).max(365).default(90),
  scenario: z.enum(scenarios).default('base'),
})

export const riskLevelSchema = z.enum(riskLevels)
