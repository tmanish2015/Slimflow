// Must be the very first import in index.ts. ES module imports are hoisted
// above any plain statement in the same file regardless of source
// position, so a bare `process.loadEnvFile()` call at the top of index.ts
// still runs *after* every one of that file's imports has been fully
// evaluated — including configurator/db.ts, whose `pg.Pool` reads
// DATABASE_URL at module-load time, not lazily. Splitting the env-file load
// into its own module and importing it first (a real import, not a bare
// statement) makes it actually execute before anything else in the graph.
//
// No .env file exists on Vercel (env vars come from its dashboard directly
// into process.env) — only load one for local dev, where it does exist.
if (!process.env.VERCEL) {
  try {
    process.loadEnvFile()
  } catch {
    // No backend/.env yet locally either — fall through with whatever's
    // already in process.env.
  }
}
