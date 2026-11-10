import postgres from "postgres";
import type { AppState } from "@/lib/domain/types";
import { freshSeed } from "./seed-state";
import type { Store } from "./types";

/**
 * Postgres store: one JSONB row holds the whole app state. Works with any
 * Postgres URL (Neon, Supabase, Vercel Postgres). Use the pooled connection
 * string on serverless hosts.
 */
const TABLE = "milestone_pay_state";
const ROW_ID = "default";

type Sql = ReturnType<typeof postgres>;
const globalForSql = globalThis as unknown as { __milestonePaySql?: Sql; __milestonePayTableReady?: Promise<void> };

/**
 * Connection strings copied from Prisma or hosting docs often carry query
 * parameters that Postgres itself rejects ("unrecognized configuration
 * parameter"). Drop those before connecting.
 */
const NON_POSTGRES_PARAMS = ["pgbouncer", "connection_limit", "pool_timeout", "schema", "supa", "statement_cache_size", "socket_timeout", "connect_timeout"];

export function cleanDatabaseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of NON_POSTGRES_PARAMS) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return raw;
  }
}

function client(rawUrl: string): Sql {
  if (!globalForSql.__milestonePaySql) {
    const url = cleanDatabaseUrl(rawUrl);
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalForSql.__milestonePaySql = postgres(url, {
      max: 1,
      prepare: false, // compatible with transaction-mode poolers
      ssl: local ? false : "require",
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalForSql.__milestonePaySql;
}

async function ensureTable(sql: Sql): Promise<void> {
  if (!globalForSql.__milestonePayTableReady) {
    globalForSql.__milestonePayTableReady = sql`
      create table if not exists ${sql(TABLE)} (
        id text primary key,
        state jsonb not null,
        updated_at timestamptz not null default now()
      )`.then(() => undefined);
  }
  return globalForSql.__milestonePayTableReady;
}

function parse(value: unknown): AppState {
  return (typeof value === "string" ? JSON.parse(value) : value) as AppState;
}

export function createPostgresStore(url: string): Store {
  const sql = client(url);

  async function write(tx: Sql, state: AppState) {
    await tx`
      insert into ${tx(TABLE)} (id, state, updated_at)
      values (${ROW_ID}, ${JSON.stringify(state)}::jsonb, now())
      on conflict (id) do update set state = excluded.state, updated_at = now()`;
  }

  return {
    kind: "postgres",
    async read() {
      await ensureTable(sql);
      const rows = await sql`select state from ${sql(TABLE)} where id = ${ROW_ID}`;
      if (rows.length) return parse(rows[0].state);
      const seed = freshSeed();
      await write(sql, seed);
      return seed;
    },
    async update(mutate) {
      await ensureTable(sql);
      return sql.begin(async (tx) => {
        const rows = await tx`select state from ${tx(TABLE)} where id = ${ROW_ID} for update`;
        const state = rows.length ? parse(rows[0].state) : freshSeed();
        const result = await mutate(state);
        await write(tx as unknown as Sql, state);
        return result;
      }) as Promise<Awaited<ReturnType<typeof mutate>>>;
    },
    async reset() {
      await ensureTable(sql);
      const seed = freshSeed();
      await write(sql, seed);
      return seed;
    },
  };
}
