// Database migration runner for eBlood (Oracle)
// Usage (run from project root):
//   node scripts/migrate-db.cjs inspect
//   node scripts/migrate-db.cjs migrate [namePrefix ...]
//   node scripts/migrate-db.cjs reset
//
// The connection comes from .env (ORACLE_USER/PASSWORD/CONNECT_STRING).

const oracledb = require("oracledb");
const fs = require("fs");
const path = require("path");
require("dotenv/config");

const CONN = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
};

const MIGRATIONS_DIR = path.resolve("db/migrations");

// Split a .sql file into executable statements.
// - A lone "/" on its own line terminates a PL/SQL block (CREATE TRIGGER/PROCEDURE or anonymous block).
// - Otherwise, non-block statements are split on ";" followed by whitespace/EOL.
// - Full-line comments starting with "--" are stripped.
function splitStatements(sql) {
  // Split into lines so we can strip comment lines
  const lines = sql.split(/\r?\n/);
  const cleaned = [];
  for (const raw of lines) {
    const line = raw; // keep as-is
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue; // drop comment-only lines
    cleaned.push(line);
  }

  const stmts = [];
  let buf = "";
  let inBlock = false;

  for (const line of cleaned) {
    const trimmed = line.trim();
    // A lone "/" terminates the current PL/SQL block
    if (trimmed === "/") {
      const s = buf.trim();
      if (s.length > 0) stmts.push(s);
      buf = "";
      inBlock = false;
      continue;
    }
    // Detect anonymous PL/SQL block start (DECLARE / BEGIN at start of statement)
    if (!inBlock && /^(DECLARE|BEGIN\s)/i.test(trimmed) && trimmed !== "BEGIN") {
      // Only treat as block if it's an anonymous block (DECLARE or "BEGIN" followed by more)
      if (/^DECLARE\b/i.test(trimmed) || /^BEGIN\s+.+/i.test(trimmed)) {
        inBlock = true;
      }
    }
    buf += line + "\n";
  }
  // If there's a trailing non-block statement
  const trailing = buf.trim();
  if (trailing.length > 0) {
    // For plain (non-block) statements, split on ";"
    if (!inBlock) {
      const parts = trailing.split(/;\s*(?=\S)/);
      for (const p of parts) {
        const s = p.trim();
        if (s.length > 0) stmts.push(s);
      }
    } else {
      stmts.push(trailing);
    }
  }
  return stmts;
}

// Errors that are safe to ignore when an object already exists (idempotent re-runs)
const IGNORABLE = new Set([
  942,  // ORA-00942 table or view does not exist
  4043, // ORA-04043 object does not exist
  955,  // ORA-00955 name is already used by an existing object
  1418, // ORA-01418 object is referenced by other objects
  1432, // ORA-01432 public synonym does not exist
]);

async function executeSql(conn, sql, label) {
  const stmts = splitStatements(sql);
  for (const s of stmts) {
    try {
      await conn.execute(s);
    } catch (err) {
      const code = err.errorNumber || err.code;
      if (IGNORABLE.has(code)) {
        continue;
      }
      throw new Error(`[${label}] Failed:\n${s.slice(0, 160)}\nError: ${err.message}`);
    }
  }
}

async function getConnection() {
  return oracledb.getConnection(CONN);
}

async function inspect() {
  const conn = await getConnection();
  console.log("Connected:", conn.username, "@", conn.connectString);
  const tables = await conn.execute("SELECT table_name FROM user_tables ORDER BY table_name");
  console.log("TABLES:", tables.rows.join(", ") || "(none)");
  const names = [
    "users", "blood_banks", "hospitals", "blood_inventory", "blood_requests",
    "request_matches", "orders", "donations", "partner_businesses", "rewards",
    "reward_redemptions", "ngo_campaigns", "campaign_participants",
    "notifications", "refresh_tokens", "audit_log",
  ];
  for (const t of names) {
    try {
      const r = await conn.execute(`SELECT COUNT(*) FROM ${t}`);
      console.log(`${t}: ${r.rows[0][0]}`);
    } catch {
      console.log(`${t}: (missing)`);
    }
  }
  await conn.close();
}

// Normalize malformed interval literals so DML still runs
function normalizeSql(sql) {
  return sql.replace(/NUMTOINTERVALS\(\s*([0-9]+)\s*,\s*'DAY'\s*\)/gi, "NUMTODSINTERVAL($1,'DAY')");
}

async function runMigrations(prefixes) {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const toRun = prefixes && prefixes.length
    ? files.filter((f) => prefixes.some((p) => f.startsWith(p)))
    : files;
  if (toRun.length === 0) {
    console.log("No migrations matched.");
    return;
  }

  const conn = await getConnection();
  console.log("Connected:", conn.username, "@", conn.connectString);
  for (const file of toRun) {
    let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    sql = normalizeSql(sql);
    console.log(`\n=== Running ${file} ===`);
    try {
      await executeSql(conn, sql, file);
      console.log(`   OK ${file}`);
    } catch (err) {
      console.error(`   FAILED ${file}:`, err.message);
      await conn.close();
      process.exitCode = 1;
      return;
    }
  }
  await conn.close();
}

const DROP_ORDER = [
  "campaign_participants", "notifications", "request_matches", "orders",
  "reward_redemptions", "rewards", "ngo_campaigns", "donations",
  "blood_requests", "blood_inventory", "hospitals", "blood_banks",
  "users", "refresh_tokens", "audit_log", "partner_businesses",
];
const DROP_SEQUENCES = [
  "seq_users", "seq_blood_banks", "seq_hospitals", "seq_blood_inventory",
  "seq_blood_requests", "seq_request_matches", "seq_orders", "seq_donations",
  "seq_partner_businesses", "seq_rewards", "seq_reward_redemptions",
  "seq_ngo_campaigns", "seq_campaign_participants", "seq_notifications",
  "seq_refresh_tokens", "seq_audit_log",
];

async function dropAll(conn) {
  for (const t of DROP_ORDER) {
    try { await conn.execute(`DROP TABLE ${t} CASCADE CONSTRAINTS`); } catch { /* ignore */ }
  }
  for (const s of DROP_SEQUENCES) {
    try { await conn.execute(`DROP SEQUENCE ${s}`); } catch { /* ignore */ }
  }
}

async function main() {
  const arg = process.argv[2] || "migrate";
  switch (arg) {
    case "inspect":
      await inspect();
      break;
    case "migrate": {
      const prefixes = process.argv.slice(3);
      await runMigrations(prefixes);
      break;
    }
    case "reset": {
      const conn = await getConnection();
      console.log("Dropping existing objects...");
      await dropAll(conn);
      await conn.close();
      await runMigrations([]);
      break;
    }
    default:
      console.log("Unknown command:", arg);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
