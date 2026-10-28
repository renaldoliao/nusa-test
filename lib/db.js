/*
 * The shop's shared data, kept as one row in Postgres.
 * Each change locks the row, applies the change and saves, so two devices
 * changing things at the same moment never overwrite each other.
 * The table is created the first time the site runs.
 */
const pg = require("pg");
const L = require("./logic");

let pool = null, ready = null;

// Neon on Vercel may name the address DATABASE_URL, POSTGRES_URL, or add a prefix
// such as STORAGE_DATABASE_URL. Accept any of them so connecting "just works".
function dbUrl() {
  const env = process.env;
  const direct = env.DATABASE_URL || env.POSTGRES_URL;
  if (direct) return direct;
  const key = Object.keys(env).find((k) => /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k) && /^postgres(ql)?:\/\//.test(env[k] || ""));
  return key ? env[key] : undefined;
}
const enabled = () => !!dbUrl();

function getPool() {
  if (!pool) {
    const url = dbUrl();
    const local = /localhost|127\.0\.0\.1/.test(url);
    pool = new pg.Pool({ connectionString: url, max: 3, ssl: local || /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } });
  }
  return pool;
}
function setup() {
  if (!ready) ready = (async () => {
    const db = getPool();
    await db.query("CREATE TABLE IF NOT EXISTS nusa_store (id int PRIMARY KEY, version bigint NOT NULL, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())");
    await db.query("INSERT INTO nusa_store (id, version, state) VALUES (1, 1, $1) ON CONFLICT (id) DO NOTHING", [JSON.stringify(L.seed())]);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
async function read() {
  await setup();
  const r = await getPool().query("SELECT version, state FROM nusa_store WHERE id = 1");
  return { version: Number(r.rows[0].version), state: r.rows[0].state };
}
async function version() {
  await setup();
  const r = await getPool().query("SELECT version FROM nusa_store WHERE id = 1");
  return Number(r.rows[0].version);
}
/** Lock, apply one change, save. */
async function mutate(fn) {
  await setup();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const r = await client.query("SELECT version, state FROM nusa_store WHERE id = 1 FOR UPDATE");
    const cur = { version: Number(r.rows[0].version), state: r.rows[0].state };
    const res = fn(cur.state);
    if (res.error) { await client.query("ROLLBACK"); return Object.assign({}, cur, { error: res.error }); }
    if (res.state === cur.state) { await client.query("ROLLBACK"); return Object.assign({}, cur, { id: res.id }); }
    const v = cur.version + 1;
    await client.query("UPDATE nusa_store SET version = $1, state = $2, updated_at = now() WHERE id = 1", [v, JSON.stringify(res.state)]);
    await client.query("COMMIT");
    return { state: res.state, version: v, id: res.id, thread: res.thread };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
module.exports = { enabled, read, version, mutate };
