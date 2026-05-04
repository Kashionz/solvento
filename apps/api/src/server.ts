import { buildApp } from './app'

async function start() {
  const app = await buildApp()
  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
