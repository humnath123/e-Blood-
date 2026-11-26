// Oracle database pool and connection management
import oracledb from "oracledb";
import env from "../config";

// Pool type from oracledb
export type PoolType = oracledb.Pool;
export type SessionType = oracledb.Connection;

let pool: PoolType | null = null;

export async function getPool(): Promise<PoolType> {
  if (pool) return pool;

  // Pool options - oracledb.PoolOptions
  const options: oracledb.PoolAttributes = {
    user: env.ORACLE_USER,
    password: env.ORACLE_PASSWORD,
    connectString: env.ORACLE_CONNECT_STRING,
    poolMin: env.ORACLE_POOL_MIN,
    poolMax: env.ORACLE_POOL_MAX,
    // Enable auto-commit off by default for transaction control
    // We'll manage transactions explicitly
  };

  pool = await oracledb.createPool(options);

  // Graceful shutdown handler
  process.on("beforeExit", async () => {
    try {
      await pool?.close();
      console.log("Oracle pool closed successfully");
    } catch (err) {
      console.error("Error closing Oracle pool:", err);
    }
  });

  return pool;
}

export async function getConnection() {
  const pool = await getPool();
  const connection = await pool.getConnection();
  return connection;
}

// Helper to always release connection in finally
export async function withConnection<T>(
  fn: (conn: SessionType) => Promise<T>
): Promise<T> {
  let connection: SessionType | null = null;
  try {
    connection = await getConnection();
    return await fn(connection);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        // Log but don't throw - we must not let a close error mask the original error
        console.error("Error releasing connection:", err);
      }
    }
  }
}

// Transaction helper - autoCommit false, explicit commit or rollback
export async function withTransaction<T>(
  fn: (conn: SessionType) => Promise<{ success: boolean; result?: T; error?: string; orderId?: number }>
): Promise<{ success: boolean; result?: T; error?: string; orderId?: number }> {
  let connection: SessionType | null = null;
  try {
    connection = await getConnection();
    const result = await fn(connection);

    // Check if the result indicates success
    if (result.success === true || result.success === undefined) {
      await connection.commit();
      return { success: true, result: result.result, orderId: result.orderId };
    } else {
      await connection.rollback();
      return { success: false, result: result.result, error: result.error };
    }
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error("Transaction rollback error:", rollbackErr);
      }
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error releasing connection after transaction:", err);
      }
    }
  }
}

// Oracle requires INSERT/UPDATE/DELETE ... RETURNING to use an INTO clause with
// OUT binds. Many route handlers pass a bare "RETURNING col1, col2" and expect
// the row back. This helper rewrites such statements to add the INTO clause and
// OUT bind descriptors, inferring a bind type from each column name.
function rewriteReturning(
  sql: string,
  binds: any
): { sql: string; binds: any; cols: string[]; rewritten: boolean; positional: boolean; baseCount: number } {
  const skip = { sql, binds, cols: [] as string[], rewritten: false, positional: false, baseCount: 0 };
  if (!/\bRETURNING\b/i.test(sql)) return skip;
  const match = sql.match(/RETURNING\s+([\s\S]+?)\s*$/i);
  if (!match) return skip;
  // Already has an INTO clause inside RETURNING (e.g. "RETURNING x INTO :x")
  if (/\bINTO\b/i.test(match[1])) return skip;

  const cols = match[1]
    .split(",")
    .map((c: string) => c.trim())
    .filter(Boolean);
  if (cols.length === 0) return skip;

  const typeFor = (col: string): any => {
    if (/_at$|_date$/i.test(col)) return oracledb.DATE;
    if (/(^id$|_id$|units|points|amount|capacity|stock|latitude|longitude|\blat\b|\blon\b|discount|count|total|is_active|is_verified|created_by)/i.test(col)) {
      return oracledb.NUMBER;
    }
    return oracledb.STRING;
  };

  if (Array.isArray(binds)) {
    const base = binds.length;
    const into = cols.map((_: string, i: number) => `:${base + i + 1}`).join(", ");
    const newSql = sql.replace(/RETURNING\s+[\s\S]+?\s*$/i, `RETURNING ${cols.join(", ")} INTO ${into}`);
    const outBinds = cols.map((c: string) => ({ dir: oracledb.BIND_OUT, type: typeFor(c) }));
    return { sql: newSql, binds: [...binds, ...outBinds], cols, rewritten: true, positional: true, baseCount: base };
  }

  const into = cols.map((c: string) => `:${c}`).join(", ");
  const newSql = sql.replace(/RETURNING\s+[\s\S]+?\s*$/i, `RETURNING ${cols.join(", ")} INTO ${into}`);
  const outBinds: Record<string, any> = {};
  for (const c of cols) outBinds[c] = { dir: oracledb.BIND_OUT, type: typeFor(c) };
  return { sql: newSql, binds: Object.assign({}, binds, outBinds), cols, rewritten: true, positional: false, baseCount: 0 };
}

// Convert any oracledb Lob column values (CLOB/BLOB) to plain strings/buffers so
// they serialize to JSON cleanly. oracledb's fetchAsString is unreliable across
// versions, so we resolve Lobs explicitly here.
async function resolveLobValues(rows: any[]): Promise<any[]> {
  if (!rows || rows.length === 0) return rows;
  const isLob = (v: any): boolean => v && typeof v.getData === "function";
  return Promise.all(
    rows.map(async (row) => {
      if (row && typeof row === "object" && !Array.isArray(row) && !isLob(row)) {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          if (isLob(v)) {
            try {
              const buf = await (v as any).getData();
              out[k] = buf ? buf.toString() : null;
            } catch {
              out[k] = null;
            }
          } else {
            out[k] = v;
          }
        }
        return out;
      }
      return row;
    })
  );
}

// Query runner for simple queries
export async function runQuery<T = Record<string, any>>(
  sql: string,
  binds: any[] | Record<string, any> = [],
  options: { autoCommit?: boolean } = {}
): Promise<T[]> {
  const rw = rewriteReturning(sql, binds);

  const result: any = await withConnection(async (conn) => {
    const execResult: any = await (conn as any).execute(rw.sql, rw.binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: options.autoCommit ?? true,
      // Return CLOB columns as plain strings instead of Lob objects
      fetchAsString: [oracledb.CLOB],
    });

    if (rw.rewritten && execResult.outBinds) {
      const row: Record<string, any> = {};
      const outBinds = execResult.outBinds as any;
      if (rw.positional) {
        const onlyOut = outBinds.length === rw.cols.length;
        rw.cols.forEach((c: string, i: number) => {
          row[c.toUpperCase()] = outBinds[onlyOut ? i : rw.baseCount + i];
        });
      } else {
        for (const c of rw.cols) {
          row[c.toUpperCase()] = outBinds[c];
        }
      }
      return [row];
    }
    return await resolveLobValues(execResult.rows || []);
  });

  return result || [];
}

// Query runner with single result
export async function runQueryOne<T = Record<string, any>>(
  sql: string,
  binds: any[] = []
): Promise<T | null> {
  const rows: T[] = await runQuery(sql, binds);
  return rows.length > 0 ? rows[0] : null;
}
