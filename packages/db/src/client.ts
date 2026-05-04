import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'

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
    db: drizzle(client),
  }
}
