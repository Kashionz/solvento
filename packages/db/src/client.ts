import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/node-postgres'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { Client } from 'pg'

import * as schema from './schema'

export async function createNodePgDatabase(
  databaseUrl = process.env.DATABASE_URL ??
    'postgres://cashpilot:cashpilot@localhost:5432/cashpilot',
) {
  const client = new Client({
    connectionString: databaseUrl,
  })

  await client.connect()

  return {
    client,
    db: drizzle(client, { schema }),
  }
}

export async function createPgliteDatabase(dataDir?: string) {
  const client = new PGlite(dataDir)

  return {
    client,
    db: drizzlePglite(client, { schema }),
  }
}
