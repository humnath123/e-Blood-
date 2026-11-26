// Drops all user tables and sequences in the current Oracle schema.
// Usage: node scripts/reset.js

const oracledb = require("oracledb");
require("dotenv/config");

async function main() {
  const conn = await oracledb.getConnection({
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
  });

  try {
    const tables = await conn.execute(
      `SELECT table_name FROM user_tables ORDER BY table_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    for (const row of tables.rows) {
      const name = row.TABLE_NAME;
      try {
        await conn.execute(`DROP TABLE "${name}" CASCADE CONSTRAINTS`, [], { autoCommit: true });
        console.log(`Dropped table ${name}`);
      } catch (e) {
        console.error(`Failed to drop ${name}: ${e.message}`);
      }
    }

    const seqs = await conn.execute(
      `SELECT sequence_name FROM user_sequences ORDER BY sequence_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    for (const row of seqs.rows) {
      const name = row.SEQUENCE_NAME;
      try {
        await conn.execute(`DROP SEQUENCE "${name}"`, [], { autoCommit: true });
        console.log(`Dropped sequence ${name}`);
      } catch (e) {
        console.error(`Failed to drop ${name}: ${e.message}`);
      }
    }
    console.log("Reset complete.");
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error("Reset failed:", e);
  process.exit(1);
});