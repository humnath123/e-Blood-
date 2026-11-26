// Migration runner for Oracle Database.
// Splits SQL files into executable statements, handling both ";" (plain SQL)
// and "/" on its own line (PL/SQL blocks such as triggers).
//
// Usage: node scripts/migrate.js [--dir db/migrations] [--file 001_schema.sql]

const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
require("dotenv/config");

function splitStatements(sql) {
  const lines = sql.split(/\r?\n/);
  const out = [];
  let buf = [];
  let inPlsql = false;

  const flush = () => {
    const stmt = buf.join("\n").trim();
    if (stmt) out.push(stmt);
    buf = [];
    inPlsql = false;
  };

  for (const line of lines) {
    const t = line.trim();
    if (t === "/") {
      flush();
      continue;
    }
    if (t.startsWith("--")) continue; // drop full-line comments
    buf.push(line);
    const joined = buf.join("\n");
    if (/\bBEGIN\b/i.test(joined) || /\bDECLARE\b/i.test(joined)) inPlsql = true;
    if (!inPlsql && t.endsWith(";")) flush();
  }
  flush();
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dirArg = args.indexOf("--dir");
  const fileArg = args.indexOf("--file");
  const dir = path.resolve(dirArg >= 0 ? args[dirArg + 1] : "db/migrations");
  const onlyFile = fileArg >= 0 ? args[fileArg + 1] : null;

  let files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && (onlyFile || !f.endsWith("_seed.sql")))
    .sort();
  if (onlyFile) files = files.filter((f) => f === onlyFile);

  if (files.length === 0) {
    console.error(`No .sql files found in ${dir}`);
    process.exit(1);
  }

  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  });

  let totalErrors = 0;
  try {
    for (const file of files) {
      const full = path.join(dir, file);
      const sql = fs.readFileSync(full, "utf8");
      const statements = splitStatements(sql);
      console.log(`\n=== ${file} (${statements.length} statements) ===`);
      let fileErrors = 0;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
        try {
          await conn.execute(stmt, [], { autoCommit: true });
        } catch (e) {
          fileErrors++;
          totalErrors++;
          console.error(`  [${i + 1}] FAILED: ${preview}`);
          console.error(`        ${e.message}`);
        }
      }
      console.log(`  ${file}: ${statements.length - fileErrors}/${statements.length} ok`);
    }
  } finally {
    await conn.close();
  }

  if (totalErrors > 0) {
    console.error(`\nMigration completed with ${totalErrors} error(s).`);
    process.exit(1);
  }
  console.log("\nAll migrations applied successfully.");
}

main().catch((e) => {
  console.error("Migration runner failed:", e);
  process.exit(1);
});