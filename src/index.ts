import { db } from './db/database'
import { buildContainer } from './container'
import { buildApp } from './app'
import { config } from './config'

async function main() {
  const container = buildContainer(db)
  const app = buildApp(container)

  await app.listen({ port: config.port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
