require('dotenv').config();
const oracledb = require('oracledb');

async function main() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: process.env.DB_CONNECT_STRING
    });
    
    // Create users table - use simple approach
    const sql = `
      BEGIN
        EXECUTE IMMEDIATE '
          CREATE TABLE users (
            user_id NUMBER PRIMARY KEY,
            username VARCHAR2(50) NOT NULL UNIQUE,
            email VARCHAR2(100) NOT NULL UNIQUE,
            phone VARCHAR2(20) NOT NULL UNIQUE,
            password_hash VARCHAR2(255) NOT NULL,
            role VARCHAR2(20) NOT NULL,
            is_active NUMBER(1) DEFAULT 1,
            blood_group VARCHAR2(5) CHECK (blood_group IN (''A+'', ''A-'', ''B+'', ''B-'', ''AB+'', ''AB-'', ''O+'', ''O-'')),
            is_available NUMBER(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        ';
      END;
    `;
    
    await conn.execute(sql, [], { autoCommit: true });
    console.log('Users table created');
    
    // Verify
    const result = await conn.execute('SELECT COUNT(*) AS cnt FROM users', [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    console.log('Users count:', result.rows[0].CNT);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error('Close error:', err);
      }
    }
  }
}

main();