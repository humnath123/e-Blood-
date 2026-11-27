// Oracle database pool and connection management
require('dotenv').config();
const oracledb = require('oracledb');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool: any | null = null;
let shutdownHandlerRegistered = false;

export async function initDb(): Promise<void> {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1
  });
  // Health check query to verify connection
  const conn = await oracledb.getConnection();
  try {
    await conn.execute('SELECT 1 FROM dual');
  } finally {
    await conn.close();
  }
}

export async function getPool(): Promise<any> {
  if (pool) return pool;

  const required = ['DB_USER', 'DB_PASSWORD', 'DB_CONNECT_STRING'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1
  });
  return pool;
}

export async function closePool(): Promise<void> {
  const activePool = pool;
  pool = null;
  if (activePool) await activePool.close(0);
}

export async function getConnection() {
  const pool = await getPool();
  const connection = await pool.getConnection();
  return connection;
}

// Helper to always release connection in finally
export async function withConnection<T>(
  fn: (conn: any) => Promise<T>
): Promise<T> {
  let connection: any | null = null;
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
  fn: (conn: any) => Promise<{ success: boolean; result?: T; error?: string; orderId?: number; message?: string }>
): Promise<{ success: boolean; result?: T; error?: string; orderId?: number; message?: string }> {
  let connection: any | null = null;
  try {
    connection = await getConnection();
    const result = await fn(connection);

    // Check if the result indicates success
    if (result.success === true || result.success === undefined) {
      try {
        await connection.commit();
      } catch (commitErr) {
        console.error("Transaction commit error:", commitErr);
        await connection.rollback();
        return { success: false, error: "COMMIT_FAILED", message: "Failed to commit transaction" };
      }
      return { success: true, result: result.result, orderId: result.orderId };
    } else {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error("Transaction rollback error:", rollbackErr);
      }
      return { success: false, result: result.result, error: result.error };
    }
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error("Transaction rollback error in catch:", rollbackErr);
      }
    }
    // Re-throw with context for the caller
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

// Query runner for simple queries
export async function runQuery<T = Record<string, any>>(
  sql: string,
  binds: any[] | Record<string, any> = [],
  options: { autoCommit?: boolean } = {}
): Promise<T[]> {
  const result: any = await withConnection(async (conn: any) => {
    const execResult: any = await (conn as any).execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: options.autoCommit ?? true,
      // Return CLOB columns as plain strings instead of Lob objects
      fetchAsString: [oracledb.CLOB],
    });

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

