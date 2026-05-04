import { createDemoSnapshot } from '@cashpilot/shared'

import { createNodePgDatabase } from './client'
import {
  accounts,
  bills,
  categories,
  decisionHistory,
  goals,
  installmentPayments,
  installmentPlans,
  recommendations,
  recurringRules,
  transactions,
  users,
} from './schema'

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.log('Skip seed: DATABASE_URL is not set.')
    return
  }

  const snapshot = createDemoSnapshot()
  const { db, client } = await createNodePgDatabase(process.env.DATABASE_URL)

  try {
    await db.delete(installmentPayments)
    await db.delete(installmentPlans)
    await db.delete(transactions)
    await db.delete(recommendations)
    await db.delete(decisionHistory)
    await db.delete(bills)
    await db.delete(recurringRules)
    await db.delete(goals)
    await db.delete(accounts)
    await db.delete(categories)
    await db.delete(users)

    await db.insert(users).values(snapshot.users)
    await db.insert(categories).values(snapshot.categories)
    await db.insert(accounts).values(snapshot.accounts)
    await db.insert(goals).values(snapshot.goals)
    await db.insert(recurringRules).values(snapshot.recurringRules)
    await db.insert(bills).values(snapshot.bills)
    await db.insert(transactions).values(snapshot.transactions)

    if (snapshot.installmentPlans.length) {
      await db.insert(installmentPlans).values(snapshot.installmentPlans)
      await db
        .insert(installmentPayments)
        .values(snapshot.installmentPlans.flatMap((plan) => plan.payments))
    }

    if (snapshot.recommendations.length) {
      await db.insert(recommendations).values(snapshot.recommendations)
    }

    if (snapshot.decisionHistory.length) {
      await db.insert(decisionHistory).values(snapshot.decisionHistory)
    }

    console.log('Seed completed.')
  } finally {
    await client.end()
  }
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
