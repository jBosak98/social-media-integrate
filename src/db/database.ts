import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import type { Database } from './types'

export function createDb(connectionString: string): Kysely<Database> {
  const url = new URL(connectionString)
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: url.hostname,
        port: parseInt(url.port, 10) || 5432,
        database: url.pathname.slice(1),
        user: url.username,
        password: decodeURIComponent(url.password),
      }),
    }),
  })
}

export const db = createDb(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/social-media-integrator')
