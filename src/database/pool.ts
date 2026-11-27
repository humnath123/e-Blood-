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
  // Health check query to verify connection & ensure audit_log table exists
  const conn = await pool.getConnection();
  try {
    await conn.execute('SELECT 1 FROM dual');
    await ensureCoreSequences(conn);
    await ensureAuditLogTable(conn);
  } finally {
    await conn.close();
  }
}

async function ensureCoreSequences(conn: any): Promise<void> {
  const sequences = [
    'seq_users',
    'seq_refresh_tokens',
  ];

  for (const sequenceName of sequences) {
    try {
      // Check if sequence already exists; if so, skip creation
      const result: any = await conn.execute(
        `SELECT 1 FROM user_sequences WHERE sequence_name = UPPER(:1)`,
        [sequenceName],
        { autoCommit: true }
      );
      if (result.rows.length === 0) {
        // Sequence doesn't exist; create it
        await conn.execute(
          `CREATE SEQUENCE ${sequenceName} START WITH 1 INCREMENT BY 1 CACHE 20`,
          [],
          { autoCommit: true }
        );
      }
    } catch (err) {
      // ORA-02201: sequence already exists / not allowed here - ignore and continue
      // Sequences may have been created during initial DB setup
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!errMsg.includes('ORA-02201')) {
        console.warn(`Could not ensure ${sequenceName}:`, err);
      }
    }
  }
}

async function ensureAuditLogTable(conn: any): Promise<void> {
  try {
    const exists: any = await conn.execute(
      `SELECT 1 FROM user_tables WHERE table_name = UPPER('audit_log')`,
      [],
      { autoCommit: true }
    );
    if (exists.rows.length > 0) {
      console.log('audit_log table already exists');
      return;
    }
    await conn.execute(
      `CREATE TABLE audit_log (
          log_id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id NUMBER,
          action VARCHAR2(100) NOT NULL,
          entity_type VARCHAR2(50),
          entity_id NUMBER,
          old_values CLOB,
          new_values CLOB,
          ip_address VARCHAR2(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
      )`,
      [],
      { autoCommit: true }
    );
    try {
      await conn.execute(
        `CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id)`,
        [], { autoCommit: true }
      );
    } catch {
      // index may already exist
    }
    try {
      await conn.execute(
        `CREATE INDEX idx_audit_created ON audit_log(created_at)`,
        [], { autoCommit: true }
      );
    } catch {
      // index may already exist
    }
    console.log('Ensured audit_log table exists');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (!errorMessage.includes('ORA-00955') && !errorMessage.includes('already exists')) {
      console.warn('Could not ensure audit_log table:', err);
    }
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

